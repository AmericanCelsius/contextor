import fs from "node:fs/promises";
import path from "node:path";

import { Browser, BrowserContext, Page, chromium } from "playwright-core";
import TurndownService from "turndown";

import { Logger } from "../core/logger";
import { applyRedactions } from "../core/redaction";
import {
  BrowserConnectionDiagnostics,
  BrowserPageSummary,
  BrowserSource,
  ContextorConfig,
  PageSelection,
  RunDirectories,
} from "../core/types";
import { detectInstalledBrowserExecutable, ensureDirectory, safeArtifactName } from "../utils/files";
import { extractKeyPoints, summarizeText, truncate } from "../utils/text";
import { resolveStrategy } from "../strategies/registry";
import { ExtractedPageContent, ExpansionPlan, SiteStrategy } from "../strategies/types";

interface BrowserSession {
  source: "cdp" | "launch";
  browser?: Browser;
  context?: BrowserContext;
}

interface ConnectionOptions {
  requireAttachedSession?: boolean;
}

interface CaptureProgress {
  phase: "indexing" | "extracting" | "complete";
  current: number;
  total: number;
  details?: string;
}

export class BrowserAdapter {
  private readonly turndown = new TurndownService({ codeBlockStyle: "fenced", headingStyle: "atx" });

  private session?: BrowserSession;

  constructor(
    private readonly config: ContextorConfig,
    private readonly logger: Logger,
  ) {}

  async listTabs(
    selection: PageSelection = { current: true },
    connectionOptions: ConnectionOptions = {},
  ): Promise<Array<{ title: string; url: string }>> {
    const pages = await this.selectPages(selection, connectionOptions);
    return Promise.all(
      pages.map(async (page) => ({
        title: await this.getSafeTitle(page),
        url: page.url(),
      })),
    );
  }

  async inspectConnection(selection: PageSelection = { all: true }): Promise<BrowserConnectionDiagnostics> {
    const selectionLabel = formatSelectionLabel(selection);
    const pageTargets = await this.fetchAttachTargets();
    const diagnostics: BrowserConnectionDiagnostics = {
      attachUrl: this.config.browser.attachUrl,
      browserMode: this.config.browser.mode,
      endpointReachable: pageTargets !== null,
      attached: pageTargets !== null,
      source: pageTargets ? "cdp" : "unavailable",
      launchedFallback: false,
      totalTargets: pageTargets?.length ?? 0,
      usableTargets: 0,
      matchingTargets: 0,
      selectionLabel,
      pages: [],
      issues: [],
      suggestions: [],
    };

    if (!pageTargets) {
      diagnostics.attachError = `Contextor could not reach Chrome at ${this.config.browser.attachUrl}.`;
      diagnostics.issues.push("Chrome remote debugging endpoint is unavailable.");
      diagnostics.suggestions.push(
        'Launch the browser instance you want Contextor to inspect with --remote-debugging-port=9222.',
      );
      diagnostics.suggestions.push(
        "Open-tab workflows do not use the attach-or-launch fallback because a fresh automation profile does not contain your existing tabs.",
      );
      return diagnostics;
    }

    const usableTargets = pageTargets.filter((target) => isUsablePage(target.url));
    const matchingTargets = filterTargetSummaries(usableTargets, selection);

    diagnostics.usableTargets = usableTargets.length;
    diagnostics.matchingTargets = matchingTargets.length;
    diagnostics.pages = usableTargets.slice(0, 16);

    if (usableTargets.length === 0) {
      diagnostics.issues.push("Chrome is reachable, but no regular page targets are open.");
      diagnostics.suggestions.push("Open one or more tabs in the attached Chrome session and retry.");
    }

    if (selection.match && matchingTargets.length === 0) {
      diagnostics.issues.push(`No reachable tabs matched /${selection.match.source}/i.`);
      diagnostics.suggestions.push("Adjust the match pattern or inspect the browser status panel for the current tab titles.");
    }

    return diagnostics;
  }

  async describeSelectionFailure(selection: PageSelection = { current: true }): Promise<string> {
    const diagnostics = await this.inspectConnection(selection);

    if (!diagnostics.endpointReachable) {
      return `${diagnostics.attachError} Start Chrome with --remote-debugging-port=9222 and retry.`;
    }

    if (diagnostics.usableTargets === 0) {
      return "Contextor reached Chrome, but the debugging endpoint did not expose any usable page tabs.";
    }

    if (selection.match && diagnostics.matchingTargets === 0) {
      const samples = diagnostics.pages
        .slice(0, 4)
        .map((page) => page.title || page.url)
        .join("; ");
      return `Contextor attached to Chrome, but no tabs matched /${selection.match.source}/i. Sample attached tabs: ${samples || "none"}.`;
    }

    return `Contextor attached to Chrome at ${diagnostics.attachUrl}, but no tabs matched the ${diagnostics.selectionLabel} selection.`;
  }

  async selectPages(selection: PageSelection = { current: true }, connectionOptions: ConnectionOptions = {}): Promise<Page[]> {
    const pages = await this.getAllPages(connectionOptions);
    const filtered = pages.filter((page) => isUsablePage(page.url()));

    if (selection.match) {
      return filterPagesByPattern(filtered, selection.match);
    }

    if (selection.all) {
      return filtered;
    }

    if (selection.current || filtered.length === 1) {
      const page = await this.getCurrentPage(filtered);
      return page ? [page] : [];
    }

    return filtered;
  }

  async capturePages(
    selection: PageSelection,
    runDirectories: RunDirectories,
    options: {
      preferredMode?: string;
      includePdf?: boolean;
      requireAttachedSession?: boolean;
      signal?: AbortSignal;
      onProgress?: (progress: CaptureProgress) => Promise<void> | void;
    },
  ): Promise<BrowserSource[]> {
    throwIfAborted(options.signal, "Tabs compile aborted by operator.");
    const pages = await this.selectPages(selection, {
      requireAttachedSession: options.requireAttachedSession,
    });
    const sources: BrowserSource[] = [];

    await options.onProgress?.({
      phase: "indexing",
      current: 0,
      total: pages.length,
      details: `Attached to ${pages.length} tab(s). Beginning capture pass.`,
    });

    for (const [index, page] of pages.entries()) {
      throwIfAborted(options.signal, "Tabs compile aborted by operator.");
      const target = { title: await this.getSafeTitle(page), url: page.url() };
      const strategy = resolveStrategy(target, this.config.strategies.enabled, options.preferredMode);
      const source = await this.capturePage(page, strategy, runDirectories, {
        includePdf: options.includePdf ?? false,
        signal: options.signal,
      });
      sources.push(source);
      await options.onProgress?.({
        phase: "extracting",
        current: index + 1,
        total: pages.length,
        details: target.title || target.url,
      });
    }

    await options.onProgress?.({
      phase: "complete",
      current: sources.length,
      total: pages.length,
      details: `Captured ${sources.length} tab source(s).`,
    });
    return sources;
  }

  async capturePage(
    page: Page,
    strategy: SiteStrategy,
    runDirectories: RunDirectories,
    options: { includePdf: boolean; signal?: AbortSignal },
  ): Promise<BrowserSource> {
    throwIfAborted(options.signal, "Tabs compile aborted by operator.");
    const title = await this.getSafeTitle(page);
    const url = page.url();
    await this.logger.info("Capturing browser page", { title, url, strategy: strategy.name });

    await this.expandPage(page, strategy.getExpansionPlan(), options.signal);
    throwIfAborted(options.signal, "Tabs compile aborted by operator.");
    const extracted = strategy.postProcess
      ? strategy.postProcess(await this.extractPageContent(page))
      : await this.extractPageContent(page);

    const baseName = safeArtifactName(title || url);
    const markdownPath = path.join(runDirectories.artifacts, `${baseName}.md`);
    const textPath = path.join(runDirectories.artifacts, `${baseName}.txt`);
    const artifacts: Record<string, string> = {
      markdown: markdownPath,
      text: textPath,
    };

    await Promise.all([
      fs.writeFile(markdownPath, extracted.markdown, "utf8"),
      fs.writeFile(textPath, extracted.text, "utf8"),
    ]);

    if (options.includePdf) {
      const pdfPath = path.join(runDirectories.artifacts, `${baseName}.pdf`);
      try {
        await this.exportPdf(page, pdfPath);
        artifacts.pdf = pdfPath;
      } catch (error) {
        await this.logger.warn("PDF export failed for page", {
          title,
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      sourceType: "browser",
      id: `${Date.now()}-${baseName}`,
      title: extracted.title,
      url: extracted.url,
      text: extracted.text,
      markdown: extracted.markdown,
      excerpt: truncate(extracted.text, this.config.redaction.maxExcerptLength),
      summary: summarizeText(extracted.text),
      keyPoints: extractKeyPoints(extracted.text),
      capturedAt: new Date().toISOString(),
      strategy: strategy.name,
      notes: strategy.getNotes?.({ title: extracted.title, url: extracted.url }) ?? [],
      artifacts,
      metadata: {
        textLength: extracted.text.length,
        markdownLength: extracted.markdown.length,
      },
    };
  }

  async expandPage(page: Page, plan: ExpansionPlan, signal?: AbortSignal): Promise<void> {
    for (let round = 0; round < plan.maxRounds; round += 1) {
      throwIfAborted(signal, "Tabs compile aborted by operator.");
      const beforeLength = await this.bodyTextLength(page);
      const clicks = await this.clickVisibleExpanders(page, plan);
      await this.scrollToStable(page, plan.scrollSelectors, 1, plan.waitAfterInteractionMs, signal);
      const afterLength = await this.bodyTextLength(page);
      const stable = clicks === 0 || Math.abs(afterLength - beforeLength) < 120;

      if (stable && round > 0) {
        break;
      }
    }
  }

  async scrollToStable(
    page: Page,
    selectors: string[],
    maxPasses = this.config.browser.maxScrollPasses,
    waitMs = 300,
    signal?: AbortSignal,
  ): Promise<void> {
    for (let pass = 0; pass < maxPasses; pass += 1) {
      throwIfAborted(signal, "Tabs compile aborted by operator.");
      const moved = await page.evaluate(
        ({ selectors: candidateSelectors }) => {
          const resolveScrollRoot = (): Element | Window => {
            for (const selector of candidateSelectors) {
              const candidate = document.querySelector(selector) as HTMLElement | null;
              if (candidate && candidate.scrollHeight > candidate.clientHeight) {
                return candidate;
              }
            }

            return window;
          };

          const root = resolveScrollRoot();
          if (root === window) {
            const start = window.scrollY;
            window.scrollBy({ top: Math.floor(window.innerHeight * 0.82), behavior: "auto" });
            return window.scrollY !== start;
          }

          const element = root as HTMLElement;
          const start = element.scrollTop;
          element.scrollBy({ top: Math.floor(element.clientHeight * 0.88), behavior: "auto" });
          return element.scrollTop !== start;
        },
        { selectors },
      );

      await page.waitForTimeout(waitMs);
      if (!moved) {
        break;
      }
    }
  }

  async exportPdf(page: Page, outputPath: string): Promise<void> {
    const session = await page.context().newCDPSession(page);
    const result = await session.send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    });
    await fs.writeFile(outputPath, Buffer.from(result.data, "base64"));
  }

  async dispose(): Promise<void> {
    if (!this.session) {
      return;
    }

    try {
      if (this.session.source === "launch" && this.session.context) {
        await this.session.context.close();
      }
    } catch (error) {
      await this.logger.warn("Browser cleanup raised an error", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.session = undefined;
    }
  }

  private async ensureConnected(connectionOptions: ConnectionOptions = {}): Promise<BrowserSession> {
    if (this.session) {
      return this.session;
    }

    const browserMode = this.config.browser.mode;

    if (browserMode !== "launch-only") {
      try {
        const browser = await chromium.connectOverCDP(this.config.browser.attachUrl);
        this.session = { source: "cdp", browser };
        await this.logger.info("Attached to existing Chrome/Chromium via CDP", {
          attachUrl: this.config.browser.attachUrl,
        });
        return this.session;
      } catch (error) {
        await this.logger.warn("CDP attach failed", {
          attachUrl: this.config.browser.attachUrl,
          error: error instanceof Error ? error.message : String(error),
        });

        if (browserMode === "attach-only" || connectionOptions.requireAttachedSession) {
          throw new Error(this.buildAttachFailureMessage(error));
        }
      }
    }

    if (connectionOptions.requireAttachedSession && browserMode === "launch-only") {
      throw new Error(
        "Contextor is configured with browser.mode=launch-only, which cannot inspect the tabs already open in your Chrome session.",
      );
    }

    const executablePath = this.config.browser.executablePath ?? (await detectInstalledBrowserExecutable());
    if (!executablePath) {
      throw new Error(
        "No Chrome/Chromium executable was found. Install Chrome or set browser.executablePath in config/contextor.config.json.",
      );
    }

    await ensureDirectory(this.config.browser.userDataDir);
    const context = await chromium.launchPersistentContext(this.config.browser.userDataDir, {
      headless: false,
      executablePath,
      viewport: null,
      ignoreHTTPSErrors: true,
    });

    this.session = { source: "launch", context };
    await this.logger.info("Launched dedicated automation browser profile", {
      executablePath,
      userDataDir: this.config.browser.userDataDir,
    });
    return this.session;
  }

  private async getAllPages(connectionOptions: ConnectionOptions = {}): Promise<Page[]> {
    const session = await this.ensureConnected(connectionOptions);
    const contexts =
      session.source === "launch"
        ? session.context
          ? [session.context]
          : []
        : session.browser?.contexts() ?? [];

    return contexts.flatMap((context) => context.pages());
  }

  private async getCurrentPage(pages: Page[]): Promise<Page | undefined> {
    const scored = await Promise.all(
      pages.map(async (page) => ({
        page,
        score: await this.visibilityScore(page),
      })),
    );

    return scored.sort((left, right) => right.score - left.score)[0]?.page ?? pages.at(-1);
  }

  private async visibilityScore(page: Page): Promise<number> {
    try {
      return await page.evaluate(() => {
        const visible = document.visibilityState === "visible" ? 5 : 0;
        const focused = document.hasFocus() ? 2 : 0;
        return visible + focused;
      });
    } catch {
      return 0;
    }
  }

  private async clickVisibleExpanders(page: Page, plan: ExpansionPlan): Promise<number> {
    const candidates = page.locator("button, a, summary, div[role='button'], span[role='button']");
    const count = await candidates.count();
    const regex = new RegExp(plan.clickTexts.map(escapeRegExp).join("|"), "i");
    let clicks = 0;

    for (let index = 0; index < count; index += 1) {
      if (clicks >= plan.maxClicksPerRound) {
        break;
      }

      const candidate = candidates.nth(index);
      let text = "";

      try {
        text = (await candidate.innerText()).trim();
      } catch {
        continue;
      }

      if (!regex.test(text)) {
        continue;
      }

      try {
        if (!(await candidate.isVisible())) {
          continue;
        }

        await candidate.scrollIntoViewIfNeeded();
        await candidate.click({ timeout: 1500 });
        clicks += 1;
        await page.waitForTimeout(plan.waitAfterInteractionMs);
      } catch {
        continue;
      }
    }

    if (clicks > 0) {
      await this.logger.info("Clicked dynamic content expanders", { clicks });
    }

    return clicks;
  }

  private async extractPageContent(page: Page): Promise<ExtractedPageContent> {
    await page.waitForLoadState("domcontentloaded");
    const title = await this.getSafeTitle(page);
    const url = page.url();

    const html = await page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript, input[type='password']").forEach((element) => element.remove());
      return clone.outerHTML;
    });

    const markdown = applyRedactions(this.turndown.turndown(html), this.config.redaction);
    const text = applyRedactions(
      await page.evaluate(() => document.body?.innerText ?? document.documentElement.innerText ?? ""),
      this.config.redaction,
    );

    return {
      title,
      url,
      html,
      markdown,
      text,
    };
  }

  private async getSafeTitle(page: Page): Promise<string> {
    try {
      return (await page.title()) || page.url();
    } catch {
      return page.url();
    }
  }

  private async bodyTextLength(page: Page): Promise<number> {
    try {
      const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
      return bodyText.length;
    } catch {
      return 0;
    }
  }

  private async fetchAttachTargets(): Promise<BrowserPageSummary[] | null> {
    try {
      const response = await fetch(buildAttachUrl(this.config.browser.attachUrl, "/json/list"));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as Array<Record<string, unknown>>;
      return payload.map((item) => ({
        title: String(item.title ?? ""),
        url: String(item.url ?? ""),
        type: String(item.type ?? "unknown"),
      }));
    } catch {
      return null;
    }
  }

  private buildAttachFailureMessage(error: unknown): string {
    const details = error instanceof Error ? error.message : String(error);
    return `Failed to attach to Chrome at ${this.config.browser.attachUrl}. Start the browser you want Contextor to inspect with --remote-debugging-port=9222. Details: ${details}`;
  }
}

function isUsablePage(url: string): boolean {
  return /^(https?|file):/i.test(url);
}

async function filterPagesByPattern(pages: Page[], pattern: RegExp): Promise<Page[]> {
  const matching: Page[] = [];

  for (const page of pages) {
    const title = await page.title().catch(() => "");
    if (pattern.test(`${page.url()} ${title}`)) {
      matching.push(page);
    }
  }

  return matching;
}

function filterTargetSummaries(targets: BrowserPageSummary[], selection: PageSelection): BrowserPageSummary[] {
  if (selection.match) {
    return targets.filter((target) => selection.match?.test(`${target.url} ${target.title}`));
  }

  if (selection.all) {
    return targets;
  }

  if (selection.current) {
    return targets.slice(0, 1);
  }

  return targets;
}

function buildAttachUrl(baseUrl: string, pathname: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\//, ""), normalizedBase).toString();
}

function formatSelectionLabel(selection: PageSelection): string {
  if (selection.match) {
    return `match pattern /${selection.match.source}/i`;
  }

  if (selection.all) {
    return "all tabs";
  }

  return "current tab";
}

function throwIfAborted(signal: AbortSignal | undefined, message: string): void {
  if (signal?.aborted) {
    throw new Error(message);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

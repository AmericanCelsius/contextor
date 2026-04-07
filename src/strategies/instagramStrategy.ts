import type { Page } from "playwright-core";

import type { BrowserAdapter } from "../adapters/browserAdapter";
import type { RunLogger } from "../core/logger";
import type { InstagramAccount, InstagramAuditPageData } from "../core/types";
import { normalizeWhitespace } from "../utils/text";
import { SiteStrategy } from "./types";

const RESERVED_SEGMENTS = new Set([
  "about",
  "accounts",
  "developer",
  "direct",
  "explore",
  "legal",
  "p",
  "privacy",
  "reel",
  "reels",
  "stories",
]);

export class InstagramStrategy implements SiteStrategy {
  readonly name = "instagram";

  matches(target: { url: string; title: string }): boolean {
    return /instagram\.com/i.test(target.url);
  }

  getExpansionPlan() {
    return {
      clickTexts: ["more", "see more", "show more", "view replies"],
      maxRounds: 6,
      maxClicksPerRound: 10,
      scrollSelectors: ["div[role='dialog'] div._aano", "div[role='dialog']", "main", "body"],
      waitAfterInteractionMs: 600,
    };
  }

  getNotes(): string[] {
    return ["Instagram read-only extraction mode. Social audit output is review-only and does not perform account actions."];
  }

  async extractInstagramList(
    page: Page,
    adapter: BrowserAdapter,
    logger: RunLogger,
  ): Promise<InstagramAuditPageData | null> {
    await adapter.expandPage(page, this.getExpansionPlan());
    await adapter.scrollToStable(page, this.getExpansionPlan().scrollSelectors, 16, 350);

    const result = await page.evaluate(
      ({ reservedSegments }) => {
        const extractUsername = (href: string | null): string | null => {
          if (!href) {
            return null;
          }

          const match = href.match(/^\/([^/?#]+)\/?$/);
          if (!match) {
            return null;
          }

          const handle = match[1]?.toLowerCase();
          if (!handle || reservedSegments.includes(handle)) {
            return null;
          }

          return handle;
        };

        const dialog = document.querySelector("div[role='dialog']");
        const headingText = (
          dialog?.querySelector("h1, h2")?.textContent ||
          document.querySelector("main h1, main h2")?.textContent ||
          document.title
        ).trim();
        const combinedHint = `${window.location.href} ${document.title} ${headingText}`.toLowerCase();

        const listType: "followers" | "following" | "unknown" = combinedHint.includes("followers")
          ? "followers"
          : combinedHint.includes("following")
            ? "following"
            : "unknown";

        const pathParts = window.location.pathname.split("/").filter(Boolean);
        const ownerHandle = pathParts[0] || "unknown";

        const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
        const byUsername = new Map<
          string,
          {
            username: string;
            displayName: string;
            rowText: string;
          }
        >();

        for (const anchor of anchors) {
          const username = extractUsername(anchor.getAttribute("href"));
          if (!username) {
            continue;
          }

          const row =
            anchor.closest("li") ||
            anchor.closest("div[role='button']") ||
            anchor.closest("section") ||
            anchor.parentElement;
          const rowText = row?.textContent?.replace(/\s+/g, " ").trim() ?? "";
          if (rowText.length === 0) {
            continue;
          }

          if (!dialog && !/followers|following/i.test(rowText) && !document.body.innerText.includes(anchor.textContent ?? "")) {
            continue;
          }

          const segments = rowText
            .split(/\s{2,}|\n+/g)
            .map((segment) => segment.trim())
            .filter(Boolean);
          const displayName = segments.find((segment) => segment.toLowerCase() !== username) || "";

          byUsername.set(username, {
            username,
            displayName,
            rowText,
          });
        }

        return {
          pageUrl: window.location.href,
          ownerHandle,
          listType,
          accounts: Array.from(byUsername.values()),
        };
      },
      { reservedSegments: Array.from(RESERVED_SEGMENTS) },
    );

    if (result.accounts.length === 0) {
      await logger.warn("Instagram strategy found no accounts on page", { url: page.url() });
      return null;
    }

    const categorizedAccounts = result.accounts.map((account): InstagramAccount => ({
      ...account,
      inferredCategory: inferCategory(`${account.username} ${account.displayName} ${account.rowText}`),
      isLikelyMutual: /follows you|mutual/i.test(account.rowText),
      sourceList: result.listType,
    }));

    await logger.info("Instagram strategy extracted accounts", {
      url: result.pageUrl,
      listType: result.listType,
      count: categorizedAccounts.length,
    });

    return {
      ...result,
      accounts: dedupeAccounts(categorizedAccounts),
    };
  }
}

function inferCategory(text: string): "person" | "brand_or_org" | "public_figure" {
  const normalized = normalizeWhitespace(text).toLowerCase();

  if (/(official|brand|media|shop|store|team|club|university|college|school|agency|studio|press|news|company|inc|llc)/i.test(normalized)) {
    return "brand_or_org";
  }

  if (/(actor|artist|creator|athlete|speaker|verified|coach|host|musician|author|public figure)/i.test(normalized)) {
    return "public_figure";
  }

  return "person";
}

function dedupeAccounts(accounts: InstagramAccount[]): InstagramAccount[] {
  const seen = new Set<string>();
  const deduped: InstagramAccount[] = [];

  for (const account of accounts) {
    const key = account.username.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(account);
  }

  return deduped;
}

import fs from "node:fs/promises";
import path from "node:path";

import { Page } from "playwright-core";

import { BrowserAdapter } from "../adapters/browserAdapter";
import { ContextCompiler } from "../compiler/contextCompiler";
import { RunLogger } from "../core/logger";
import { InstagramAccount, InstagramAuditPageData, RunDirectories, SocialAuditOptions, WorkflowResult } from "../core/types";
import { resolveStrategy } from "../strategies/registry";
import { writeCsv, writeJsonFile } from "../utils/files";

export async function runInstagramAuditWorkflow(input: {
  browserAdapter: BrowserAdapter;
  compiler: ContextCompiler;
  logger: RunLogger;
  runDirectories: RunDirectories;
  options: SocialAuditOptions;
  enabledStrategies: string[];
}): Promise<WorkflowResult> {
  const instagramPages = await input.browserAdapter.selectPages(
    { all: true, match: /instagram\.com/i },
    { requireAttachedSession: true },
  );
  if (instagramPages.length === 0) {
    throw new Error("No Instagram tabs were found. Open Instagram follower/following views in Chrome first.");
  }

  const extracted = await extractLists(instagramPages, input);
  if (extracted.length === 0) {
    throw new Error(
      "Instagram tabs were found, but no follower/following accounts were extracted. Open the follower/following list dialog or dedicated list page and retry.",
    );
  }

  const followers = mergeAccounts(extracted.filter((page) => page.listType === "followers"));
  const following = mergeAccounts(extracted.filter((page) => page.listType === "following"));
  const nonMutuals = following.filter((account) => !followers.some((follower) => follower.username === account.username));
  const reviewable = nonMutuals.filter((account) => account.inferredCategory === "person");
  const filteredOut = nonMutuals.filter((account) => account.inferredCategory !== "person");

  const markdownPath = path.join(input.runDirectories.artifacts, "instagram_non_mutuals.md");
  const csvPath = path.join(input.runDirectories.artifacts, "instagram_non_mutuals.csv");
  const jsonPath = path.join(input.runDirectories.manifests, "instagram_audit.json");

  await Promise.all([
    fs.writeFile(markdownPath, renderInstagramReport(reviewable, filteredOut, input.options, extracted), "utf8"),
    writeCsv(
      csvPath,
      reviewable.map((account) => ({
        username: account.username,
        display_name: account.displayName,
        inferred_category: account.inferredCategory,
        likely_mutual: account.isLikelyMutual,
        source_list: account.sourceList,
      })),
    ),
    writeJsonFile(jsonPath, {
      generatedAt: new Date().toISOString(),
      extractedPages: extracted,
      followersCount: followers.length,
      followingCount: following.length,
      nonMutualCount: nonMutuals.length,
      reviewableCount: reviewable.length,
      filteredOutCount: filteredOut.length,
      safety: {
        dryRun: input.options.dryRun,
        allowAccountActions: input.options.allowAccountActions,
        confirm: input.options.confirm,
        actionsImplemented: false,
      },
    }),
  ]);

  const result = await input.compiler.compile(input.runDirectories, {
    goal: input.options.goal,
    workflow: "instagram-audit",
    browserSources: [],
    fileSources: [],
    communicationNotes: extracted.map(
      (page) => `Instagram ${page.listType} list extracted from ${page.pageUrl} with ${page.accounts.length} account(s).`,
    ),
    actionableNotes: [
      `Review ${path.basename(markdownPath)} before taking any account action.`,
      "This workflow is read-only. Account-changing actions are not implemented in phase 1.",
      "If counts look incomplete, reopen the follower/following dialogs and rerun after scrolling further.",
    ],
    manifestExtras: {
      instagramAudit: {
        followersCount: followers.length,
        followingCount: following.length,
        reviewableNonMutualCount: reviewable.length,
        filteredOutCount: filteredOut.length,
        markdownPath,
        csvPath,
        jsonPath,
      },
    },
  });

  await input.logger.info("Instagram audit completed", {
    followers: followers.length,
    following: following.length,
    nonMutuals: reviewable.length,
  });

  return {
    ...result,
    artifactPaths: [...result.artifactPaths, markdownPath, csvPath],
    workflow: "instagram-audit",
    summary: `Instagram audit exported ${reviewable.length} reviewable non-mutual account(s)`,
  };
}

async function extractLists(
  pages: Page[],
  input: {
    browserAdapter: BrowserAdapter;
    logger: RunLogger;
    enabledStrategies: string[];
  },
): Promise<InstagramAuditPageData[]> {
  const extracted: InstagramAuditPageData[] = [];

  for (const page of pages) {
    const target = {
      title: await page.title().catch(() => page.url()),
      url: page.url(),
    };
    const strategy = resolveStrategy(target, input.enabledStrategies, "instagram");
    if (!strategy.extractInstagramList) {
      continue;
    }

    const result = await strategy.extractInstagramList(page, input.browserAdapter, input.logger);
    if (result) {
      extracted.push(result);
    }
  }

  return extracted;
}

function mergeAccounts(pages: InstagramAuditPageData[]): InstagramAccount[] {
  const map = new Map<string, InstagramAccount>();

  for (const page of pages) {
    for (const account of page.accounts) {
      if (!map.has(account.username)) {
        map.set(account.username, account);
      }
    }
  }

  return Array.from(map.values()).sort((left, right) => left.username.localeCompare(right.username));
}

function renderInstagramReport(
  reviewable: InstagramAccount[],
  filteredOut: InstagramAccount[],
  options: SocialAuditOptions,
  extracted: InstagramAuditPageData[],
): string {
  const reviewableLines =
    reviewable.length === 0
      ? "- None"
      : reviewable.map((account) => `- @${account.username} (${account.displayName || "no display name"})`).join("\n");
  const filteredLines =
    filteredOut.length === 0
      ? "- None"
      : filteredOut
          .map((account) => `- @${account.username} [${account.inferredCategory}] (${account.displayName || "no display name"})`)
          .join("\n");

  return `# Instagram Non-Mutuals Audit

- Dry run: ${options.dryRun}
- Allow account actions: ${options.allowAccountActions}
- Confirm flag provided: ${options.confirm}
- Extracted lists: ${extracted.map((page) => `${page.listType}:${page.accounts.length}`).join(", ")}

## Reviewable Non-Mutuals

${reviewableLines}

## Filtered Out

${filteredLines}

## Safety Notes

- Contextor does not unfollow or modify accounts in this milestone.
- This report is intended for manual review only.
`;
}

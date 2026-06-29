#!/usr/bin/env node
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { ContextorOrchestrator } from "../core/orchestrator";
import { CONTEXTOR_VERSION } from "../core/version";
import { RunEvent, WorkflowResult } from "../core/types";
import { clearTerminalScreen, getNpmExecutable, openPathInShell, runCommand } from "../utils/system";

const program = new Command();

program
  .name("contextor")
  .description("Local-first context aggregation and browser automation.")
  .version(CONTEXTOR_VERSION);

program
  .command("tabs")
  .description("Compile selected Chrome/Chromium tabs into one context.md")
  .option("--all", "Capture all open tabs")
  .option("--current", "Capture only the current visible tab")
  .option("--match <pattern>", "Regex for tab URL/title filtering")
  .option("--goal <goal>", "Goal string for context compilation", "summarize the currently open browser context")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const result = await orchestrator.compileTabs({
      goal: options.goal,
      all: options.all,
      current: options.current,
      match: options.match,
    });
    printResult(result);
  });

program
  .command("folder")
  .description("Compile a local folder into one context.md")
  .argument("<folderPath>", "Absolute or relative path to the folder")
  .option("--goal <goal>", "Goal string for context compilation", "summarize the selected local folder")
  .option("--limit <count>", "Maximum number of file sources to include, or 'all'", "all")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (folderPath, options) => {
    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const progress = createWorkflowProgressReporter();
    const result = await orchestrator.compileFolder(
      {
        goal: options.goal,
        folderPath,
        limit: parseFolderLimit(options.limit),
      },
      progress,
    );
    printResult(result);
  });

program
  .command("copy-folder")
  .description("Export a literal directory copy into aggregated markdown and text files")
  .argument("<folderPath>", "Absolute or relative path to the folder")
  .option("--goal <goal>", "Goal string for directory copy context", "create a literal directory copy for downstream review")
  .option("--format <format>", "Requested primary output format: md, txt, or both", "both")
  .option("--include-hidden", "Include dotfiles and dot-directories such as .gitignore and .claude")
  .option("--chunk-markdown", "Split markdown and text outputs into strategic continuation chunks")
  .option("--chunk-lines <count>", "Target maximum rendered lines per chunk", "10000")
  .option("--chunk-bytes <bytes>", "Target maximum rendered bytes per chunk", "8388608")
  .option("--no-open-output-prompt", "Do not ask to open the generated run folder after export")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (folderPath, options) => {
    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const progress = createWorkflowProgressReporter();
    const result = await orchestrator.copyFolder(
      {
        goal: options.goal,
        folderPath,
        format: parseCopyFormat(options.format),
        includeHidden: Boolean(options.includeHidden),
        chunkMarkdown: Boolean(options.chunkMarkdown),
        chunkLineTarget: parsePositiveInteger(options.chunkLines, 10_000),
        chunkByteTarget: parsePositiveInteger(options.chunkBytes, 8 * 1024 * 1024),
      },
      progress,
    );
    printResult(result);
    await promptToOpenRunFolderIfWanted(
      result,
      Boolean(options.openOutputPrompt) && orchestrator.getConfig().offlineMode.promptToOpenOutputFolder !== false,
    );
  });

program
  .command("compile")
  .description("Compile tabs, a folder, or both using one goal string")
  .requiredOption("--goal <goal>", "Goal string for orchestration")
  .option("--folder <path>", "Folder path to include")
  .option("--tabs", "Include browser tabs in the compile")
  .option("--all-tabs", "Include all tabs instead of only the current tab")
  .option("--match <pattern>", "Regex for tab URL/title filtering")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const result = await orchestrator.compile({
      goal: options.goal,
      folderPath: options.folder,
      includeTabs: options.tabs,
      allTabs: options.allTabs,
      match: options.match,
    });
    printResult(result);
  });

program
  .command("page-export")
  .description("Expand and export the current page to markdown, text, and PDF")
  .option("--current", "Export the current visible page", true)
  .option("--mode <mode>", "Preferred site strategy such as linkedin or generic", "generic")
  .option("--goal <goal>", "Goal string for export context", "export the current page for downstream LLM use")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const result = await orchestrator.exportCurrentPage({
      goal: options.goal,
      current: options.current,
      mode: options.mode,
    });
    printResult(result);
  });

program
  .command("social-audit")
  .description("Legacy read-only Instagram audit fallback preserved outside the main TUI")
  .option("--platform <platform>", "Supported platform", "instagram")
  .option("--mode <mode>", "Supported audit mode", "non-mutuals")
  .option("--dry-run", "Keep the workflow in review-only mode", true)
  .option("--allow-account-actions", "Reserved for future account-changing actions", false)
  .option("--confirm", "Explicit confirmation flag for future account-changing actions", false)
  .option("--goal <goal>", "Goal string for audit context", "review likely Instagram non-mutual accounts in read-only mode")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    console.error(
      "`contextor social-audit` is a legacy fallback in v0.2.2. The Instagram audit has been removed from the main TUI while the broader prompt console is prepared.",
    );

    if (options.platform !== "instagram") {
      throw new Error("Phase 1 only supports --platform instagram.");
    }

    if (options.mode !== "non-mutuals") {
      throw new Error("Phase 1 only supports --mode non-mutuals.");
    }

    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const result = await orchestrator.socialAudit({
      platform: "instagram",
      mode: "non-mutuals",
      dryRun: Boolean(options.dryRun),
      allowAccountActions: Boolean(options.allowAccountActions),
      confirm: Boolean(options.confirm),
      goal: options.goal,
    });
    printResult(result);
  });

program
  .command("browser-status")
  .description("Inspect Chrome remote debugging availability and visible tabs")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const diagnostics = await orchestrator.inspectBrowser({ all: true });
    console.log(`Attach URL: ${diagnostics.attachUrl}`);
    console.log(`Mode: ${diagnostics.browserMode}`);
    console.log(`Endpoint reachable: ${diagnostics.endpointReachable}`);
    console.log(`Usable tabs: ${diagnostics.usableTargets}/${diagnostics.totalTargets}`);
    if (diagnostics.ignoredTargets > 0) {
      console.log(`Filtered noisy targets: ${diagnostics.ignoredTargets}`);
    }
    if (diagnostics.issues.length > 0) {
      console.log("Issues:");
      for (const issue of diagnostics.issues) {
        console.log(`- ${issue}`);
      }
    }
    if (diagnostics.detectedProfiles.length > 0) {
      console.log("Detected local Chrome profiles:");
      for (const profile of diagnostics.detectedProfiles) {
        console.log(`- ${profile}`);
      }
    }
    if (diagnostics.pages.length > 0) {
      console.log("Sample tabs:");
      for (const page of diagnostics.pages) {
        console.log(`- ${page.title || page.url}`);
      }
    }
  });

program
  .command("tui")
  .alias("dashboard")
  .description("Launch the terminal-contained Contextor dashboard")
  .option("--offline", "Launch in local-only offline mode")
  .option("--fullscreen", "Best-effort fullscreen request for the current terminal window")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const { startTui } = await import("../tui/index");
    await startTui({
      projectRoot: process.cwd(),
      configPath: options.config,
      offline: Boolean(options.offline),
      fullscreen: Boolean(options.fullscreen),
    });
  });

program
  .command("offline")
  .description("Launch the terminal TUI in local-only offline mode")
  .option("--fullscreen", "Best-effort fullscreen request for the current terminal window")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const { startTui } = await import("../tui/index");
    await startTui({
      projectRoot: process.cwd(),
      configPath: options.config,
      offline: true,
      fullscreen: Boolean(options.fullscreen),
    });
  });

program
  .command("launch")
  .alias("start")
  .description("Install dependencies, rebuild Contextor, and launch the TUI")
  .option("--offline", "Launch the rebuilt TUI in local-only offline mode")
  .option("--fullscreen", "Best-effort fullscreen request for the current terminal window")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const projectRoot = inferProjectRoot();
    await runCommand(getNpmExecutable(), ["install"], { cwd: projectRoot });
    await runCommand(getNpmExecutable(), ["run", "build"], { cwd: projectRoot });
    clearTerminalScreen();

    const args = ["dist/cli/index.js", "tui"];
    if (options.offline) {
      args.push("--offline");
    }
    if (options.fullscreen) {
      args.push("--fullscreen");
    }
    if (options.config) {
      args.push("--config", options.config);
    }

    await runCommand(process.execPath, args, { cwd: projectRoot });
  });

program
  .command("gui")
  .description("Deprecated alias for the terminal TUI")
  .option("--offline", "Launch in local-only offline mode")
  .option("--fullscreen", "Best-effort fullscreen request for the current terminal window")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    console.error("`contextor gui` is deprecated in v0.2.2. Launching the terminal TUI instead.");
    const { startTui } = await import("../tui/index");
    await startTui({
      projectRoot: process.cwd(),
      configPath: options.config,
      offline: Boolean(options.offline),
      fullscreen: Boolean(options.fullscreen),
    });
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(`Contextor failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

function printResult(result: WorkflowResult): void {
  console.log(result.summary);
  console.log(`Run directory: ${result.runDir}`);
  console.log(`Context markdown: ${result.contextMarkdownPath}`);
  console.log(`Context text: ${result.contextTextPath}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Log: ${result.logPath}`);
  if (result.artifactPaths.length > 0) {
    console.log("Artifacts:");
    for (const artifactPath of result.artifactPaths) {
      console.log(`- ${artifactPath}`);
    }
  }
}

async function promptToOpenRunFolderIfWanted(result: WorkflowResult, enabled: boolean): Promise<void> {
  if (!enabled || !process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await reader.question("Export complete. Open this run's output folder? [Y/n] ")).trim().toLowerCase();
    if (!answer || answer === "y" || answer === "yes") {
      openPathInShell(result.runDir);
    }
  } finally {
    reader.close();
  }
}

function inferProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../..");
}

function parseFolderLimit(value: string | undefined): number | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseCopyFormat(value: string | undefined): "md" | "txt" | "both" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "md" || normalized === "txt") {
    return normalized;
  }

  return "both";
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function createWorkflowProgressReporter(): (event: RunEvent) => void {
  let active = false;

  return (event: RunEvent): void => {
    if (!process.stdout.isTTY) {
      return;
    }

    if (event.kind === "run-started") {
      active = true;
      process.stdout.write(`Starting ${event.workflow} workflow...\n`);
      return;
    }

    if (event.kind === "progress" && event.progress) {
      active = true;
      const total = Math.max(0, event.progress.total);
      const current = Math.max(0, Math.min(event.progress.current, total));
      const width = 24;
      const ratio = total > 0 ? current / total : 0;
      const filled = Math.round(width * ratio);
      const bar = `[${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}]`;
      const countLabel = total > 0 ? `${current}/${total} (${Math.round(ratio * 100)}%)` : "0/0 (0%)";
      const detail = event.progress.details ? ` ${event.progress.details}` : "";
      process.stdout.write(`\r${bar} ${countLabel} ${event.progress.unit}${detail}`);
      return;
    }

    if ((event.kind === "run-completed" || event.kind === "run-failed") && active) {
      process.stdout.write("\n");
      active = false;
    }
  };
}

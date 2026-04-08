#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { ContextorOrchestrator } from "../core/orchestrator";
import { CONTEXTOR_VERSION } from "../core/version";
import { WorkflowResult } from "../core/types";
import { getNpmExecutable, runCommand } from "../utils/system";

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
  .option("--limit <count>", "Maximum number of file sources to include", "15")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (folderPath, options) => {
    const orchestrator = await ContextorOrchestrator.create(process.cwd(), options.config);
    const result = await orchestrator.compileFolder({
      goal: options.goal,
      folderPath,
      limit: Number(options.limit),
    });
    printResult(result);
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
  .description("Run a read-only social audit against browser tabs already open in Chrome")
  .option("--platform <platform>", "Supported platform", "instagram")
  .option("--mode <mode>", "Supported audit mode", "non-mutuals")
  .option("--dry-run", "Keep the workflow in review-only mode", true)
  .option("--allow-account-actions", "Reserved for future account-changing actions", false)
  .option("--confirm", "Explicit confirmation flag for future account-changing actions", false)
  .option("--goal <goal>", "Goal string for audit context", "review likely Instagram non-mutual accounts in read-only mode")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
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
    if (diagnostics.issues.length > 0) {
      console.log("Issues:");
      for (const issue of diagnostics.issues) {
        console.log(`- ${issue}`);
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
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const { startTui } = await import("../tui/index");
    await startTui({
      projectRoot: process.cwd(),
      configPath: options.config,
    });
  });

program
  .command("launch")
  .alias("start")
  .description("Install dependencies, rebuild Contextor, and launch the TUI")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    const projectRoot = inferProjectRoot();
    await runCommand(getNpmExecutable(), ["install"], { cwd: projectRoot });
    await runCommand(getNpmExecutable(), ["run", "build"], { cwd: projectRoot });

    const args = ["dist/cli/index.js", "tui"];
    if (options.config) {
      args.push("--config", options.config);
    }

    await runCommand(process.execPath, args, { cwd: projectRoot });
  });

program
  .command("gui")
  .description("Deprecated alias for the terminal TUI")
  .option("--config <path>", "Path to a Contextor config file")
  .action(async (options) => {
    console.error("`contextor gui` is deprecated in v0.2.1. Launching the terminal TUI instead.");
    const { startTui } = await import("../tui/index");
    await startTui({
      projectRoot: process.cwd(),
      configPath: options.config,
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

function inferProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../..");
}

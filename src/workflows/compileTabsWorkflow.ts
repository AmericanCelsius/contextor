import { BrowserAdapter } from "../adapters/browserAdapter";
import { ContextCompiler } from "../compiler/contextCompiler";
import { RunLogger } from "../core/logger";
import { CompileTabsOptions, RunDirectories, WorkflowResult } from "../core/types";

export async function runCompileTabsWorkflow(input: {
  browserAdapter: BrowserAdapter;
  compiler: ContextCompiler;
  logger: RunLogger;
  runDirectories: RunDirectories;
  options: CompileTabsOptions;
}): Promise<WorkflowResult> {
  const selection = {
    all: input.options.all ?? false,
    current: input.options.current ?? (!input.options.all && !input.options.match),
    match: input.options.match ? new RegExp(input.options.match, "i") : undefined,
  };

  const browserSources = await input.browserAdapter.capturePages(selection, input.runDirectories, {
    includePdf: false,
  });
  if (browserSources.length === 0) {
    throw new Error("No browser tabs matched the requested selection.");
  }

  const communicationNotes = browserSources
    .filter((source) => ["gmail", "portal"].includes(source.strategy))
    .map((source) => `${source.strategy} source captured from ${source.title}`);

  const actionableNotes = [
    "Use the browser source excerpts to reconstruct immediate context before opening the full artifacts.",
    "Inspect manifests/sources.json if you need complete provenance for each tab capture.",
  ];

  const result = await input.compiler.compile(input.runDirectories, {
    goal: input.options.goal,
    workflow: "tabs",
    browserSources,
    fileSources: [],
    communicationNotes,
    actionableNotes,
  });

  await input.logger.info("Tabs workflow completed", { count: browserSources.length });
  return {
    ...result,
    workflow: "tabs",
    summary: `Compiled ${browserSources.length} tab(s) into context.md`,
  };
}

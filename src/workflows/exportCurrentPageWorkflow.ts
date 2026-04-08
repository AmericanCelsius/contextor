import { BrowserAdapter } from "../adapters/browserAdapter";
import { ContextCompiler } from "../compiler/contextCompiler";
import { RunLogger } from "../core/logger";
import { ExportCurrentPageOptions, RunDirectories, WorkflowResult } from "../core/types";

export async function runExportCurrentPageWorkflow(input: {
  browserAdapter: BrowserAdapter;
  compiler: ContextCompiler;
  logger: RunLogger;
  runDirectories: RunDirectories;
  options: ExportCurrentPageOptions;
}): Promise<WorkflowResult> {
  const browserSources = await input.browserAdapter.capturePages(
    { current: input.options.current ?? true },
    input.runDirectories,
    {
      preferredMode: input.options.mode,
      includePdf: true,
      requireAttachedSession: true,
    },
  );

  if (browserSources.length === 0) {
    throw new Error(await input.browserAdapter.describeSelectionFailure({ current: true }));
  }

  const source = browserSources[0]!;
  const result = await input.compiler.compile(input.runDirectories, {
    goal: input.options.goal,
    workflow: "page-export",
    browserSources,
    fileSources: [],
    communicationNotes: source.notes,
    actionableNotes: [
      "Use the exported PDF when the visual layout matters.",
      "Use the exported markdown/text artifacts for downstream LLM context windows.",
    ],
  });

  await input.logger.info("Current page export completed", {
    title: source.title,
    url: source.url,
    artifacts: source.artifacts,
  });

  return {
    ...result,
    workflow: "page-export",
    summary: `Exported current page with ${Object.keys(source.artifacts).join(", ")} artifacts`,
  };
}

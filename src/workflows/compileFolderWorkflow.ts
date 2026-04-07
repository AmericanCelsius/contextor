import { FilesystemAdapter } from "../adapters/filesystemAdapter";
import { ContextCompiler } from "../compiler/contextCompiler";
import { RunLogger } from "../core/logger";
import { CompileFolderOptions, RunDirectories, WorkflowResult } from "../core/types";

export async function runCompileFolderWorkflow(input: {
  filesystemAdapter: FilesystemAdapter;
  compiler: ContextCompiler;
  logger: RunLogger;
  runDirectories: RunDirectories;
  options: CompileFolderOptions;
}): Promise<WorkflowResult> {
  const fileSources = await input.filesystemAdapter.compileDirectory(
    input.options.folderPath,
    input.options.goal,
    input.options.limit,
  );
  if (fileSources.length === 0) {
    throw new Error("No supported files were found in the selected folder.");
  }

  const actionableNotes = [
    "Prioritize the highest-scoring files before drilling into lower-relevance files.",
    "Use file excerpts to decide whether the full original files need to be opened.",
  ];

  const result = await input.compiler.compile(input.runDirectories, {
    goal: input.options.goal,
    workflow: "folder",
    browserSources: [],
    fileSources,
    communicationNotes: [],
    actionableNotes,
  });

  await input.logger.info("Folder workflow completed", { count: fileSources.length });
  return {
    ...result,
    workflow: "folder",
    summary: `Compiled ${fileSources.length} file source(s) into context.md`,
  };
}

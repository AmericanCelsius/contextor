import fs from "node:fs/promises";
import path from "node:path";

import { FilesystemAdapter } from "../adapters/filesystemAdapter";
import { RunLogger } from "../core/logger";
import { CopyFolderOptions, DirectoryCopyBundle, RunDirectories, RunObserver, RuntimeEnvironmentInfo, WorkflowResult } from "../core/types";
import { writeJsonFile } from "../utils/files";
import { getRuntimeEnvironmentInfo } from "../utils/system";

export async function runCopyFolderWorkflow(input: {
  filesystemAdapter: FilesystemAdapter;
  logger: RunLogger;
  runDirectories: RunDirectories;
  options: CopyFolderOptions;
  observe?: RunObserver;
  signal?: AbortSignal;
}): Promise<WorkflowResult> {
  const bundle = await input.filesystemAdapter.copyDirectory(input.options.folderPath, {
    signal: input.signal,
    onProgress: (progress) =>
      input.observe?.({
        kind: "progress",
        workflow: "directory-copy",
        goal: input.options.goal,
        runDir: input.runDirectories.root,
        progress: {
          phase: progress.phase,
          current: progress.current,
          total: progress.total,
          unit: "files",
          details: progress.details,
        },
      }),
  });

  throwIfAborted(input.signal);
  await input.observe?.({
    kind: "progress",
    workflow: "directory-copy",
    goal: input.options.goal,
    runDir: input.runDirectories.root,
    progress: {
      phase: "compiling",
      current: bundle.totalFiles,
      total: bundle.totalFiles,
      unit: "files",
      details: "Rendering literal directory copy bundle...",
    },
  });

  const runtimeInfo = getRuntimeEnvironmentInfo();
  const contextMarkdownPath = path.join(input.runDirectories.root, "context.md");
  const contextTextPath = path.join(input.runDirectories.root, "context.txt");
  const manifestPath = path.join(input.runDirectories.manifests, "sources.json");
  const runManifestPath = path.join(input.runDirectories.manifests, "run.json");

  await Promise.all([
    fs.writeFile(contextMarkdownPath, renderDirectoryCopyMarkdown(bundle, input.options, runtimeInfo), "utf8"),
    fs.writeFile(contextTextPath, renderDirectoryCopyText(bundle, input.options, runtimeInfo), "utf8"),
    writeJsonFile(manifestPath, {
      generatedAt: new Date().toISOString(),
      workflow: "directory-copy",
      goal: input.options.goal,
      rootPath: bundle.rootPath,
      requestedFormat: input.options.format,
      totalFiles: bundle.totalFiles,
      includedFiles: bundle.includedFiles,
      skippedFiles: bundle.skippedFiles,
      entries: bundle.entries.map((entry) => ({
        path: entry.path,
        relativePath: entry.relativePath,
        name: entry.name,
        extension: entry.extension,
        modifiedTime: entry.modifiedTime,
        size: entry.size,
        contentKind: entry.contentKind,
        note: entry.note,
      })),
      runtime: runtimeInfo,
    }),
    writeJsonFile(runManifestPath, {
      name: input.runDirectories.name,
      createdAt: input.runDirectories.createdAt,
      workflow: "directory-copy",
      goal: input.options.goal,
      runDir: input.runDirectories.root,
      runtime: runtimeInfo,
      requestedFormat: input.options.format,
    }),
  ]);

  await input.logger.info("Directory copy workflow completed", {
    rootPath: bundle.rootPath,
    totalFiles: bundle.totalFiles,
    includedFiles: bundle.includedFiles,
    skippedFiles: bundle.skippedFiles,
    requestedFormat: input.options.format,
  });

  return {
    workflow: "directory-copy",
    summary: `Exported ${bundle.includedFiles} readable file(s) from ${bundle.totalFiles} scanned file(s) into literal directory copy artifacts.`,
    runDir: input.runDirectories.root,
    contextMarkdownPath,
    contextTextPath,
    manifestPath,
    artifactPaths: [],
    logPath: input.logger.logPath,
  };
}

function renderDirectoryCopyMarkdown(
  bundle: DirectoryCopyBundle,
  options: CopyFolderOptions,
  runtimeInfo: RuntimeEnvironmentInfo,
): string {
  const runtimeLines = [
    `- Local time: ${runtimeInfo.localTimestamp}`,
    `- UTC time: ${runtimeInfo.utcTimestamp}`,
    `- Time zone: ${runtimeInfo.timeZone}`,
  ];

  if (runtimeInfo.approximateLocation) {
    runtimeLines.push(`- Approximate location: ${runtimeInfo.approximateLocation}`);
  }

  if (runtimeInfo.approximateLocationNote) {
    runtimeLines.push(`- Location note: ${runtimeInfo.approximateLocationNote}`);
  }

  const fileList =
    bundle.entries.length === 0
      ? "_No files were found in the selected directory._"
      : bundle.entries
          .map((entry) => `- \`${entry.relativePath}\` (${entry.size} bytes, ${entry.contentKind})`)
          .join("\n");

  const sections =
    bundle.entries.length === 0
      ? "_No file bodies were captured because the selected directory is empty._"
      : bundle.entries.map((entry, index) => renderDirectoryCopyMarkdownEntry(entry, index + 1)).join("\n\n");

  return `# Directory Copy Goal

${options.goal}

# Runtime Context

${runtimeLines.join("\n")}

# Source Directory

- Root path: ${bundle.rootPath}
- Requested output format: ${options.format}
- Total files scanned: ${bundle.totalFiles}
- Readable files copied: ${bundle.includedFiles}
- Skipped or error entries: ${bundle.skippedFiles}

# Recursive File List

${fileList}

# Aggregated File Bodies

${sections}
`;
}

function renderDirectoryCopyMarkdownEntry(entry: DirectoryCopyBundle["entries"][number], index: number): string {
  const detailLines = [
    `- Source path: ${entry.path}`,
    `- Relative path: ${entry.relativePath}`,
    `- Extension: ${entry.extension || "(none)"}`,
    `- Modified: ${entry.modifiedTime}`,
    `- Size: ${entry.size} bytes`,
    `- Status: ${entry.contentKind}`,
  ];

  if (entry.note) {
    detailLines.push(`- Note: ${entry.note}`);
  }

  return `## File ${index}: ${entry.relativePath}

${detailLines.join("\n")}

\`\`\`text
${entry.content}
\`\`\``;
}

function renderDirectoryCopyText(
  bundle: DirectoryCopyBundle,
  options: CopyFolderOptions,
  runtimeInfo: RuntimeEnvironmentInfo,
): string {
  const lines = [
    "DIRECTORY COPY",
    `Goal: ${options.goal}`,
    `Root path: ${bundle.rootPath}`,
    `Requested format: ${options.format}`,
    `Total files scanned: ${bundle.totalFiles}`,
    `Readable files copied: ${bundle.includedFiles}`,
    `Skipped or error entries: ${bundle.skippedFiles}`,
    `Local time: ${runtimeInfo.localTimestamp}`,
    `UTC time: ${runtimeInfo.utcTimestamp}`,
    `Time zone: ${runtimeInfo.timeZone}`,
  ];

  if (runtimeInfo.approximateLocation) {
    lines.push(`Approximate location: ${runtimeInfo.approximateLocation}`);
  }

  if (runtimeInfo.approximateLocationNote) {
    lines.push(`Location note: ${runtimeInfo.approximateLocationNote}`);
  }

  lines.push("", "RECURSIVE FILE LIST");
  if (bundle.entries.length === 0) {
    lines.push("(No files were found in the selected directory.)");
  } else {
    for (const entry of bundle.entries) {
      lines.push(`- ${entry.relativePath} (${entry.size} bytes, ${entry.contentKind})`);
    }
  }

  lines.push("", "AGGREGATED FILE BODIES");
  if (bundle.entries.length === 0) {
    lines.push("(No file bodies were captured because the selected directory is empty.)");
  } else {
    for (const entry of bundle.entries) {
      lines.push(
        "",
        `===== START FILE: ${entry.relativePath} =====`,
        `Source path: ${entry.path}`,
        `Extension: ${entry.extension || "(none)"}`,
        `Modified: ${entry.modifiedTime}`,
        `Size: ${entry.size} bytes`,
        `Status: ${entry.contentKind}`,
      );
      if (entry.note) {
        lines.push(`Note: ${entry.note}`);
      }
      lines.push("", entry.content, `===== END FILE: ${entry.relativePath} =====`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Directory copy aborted by operator.");
  }
}

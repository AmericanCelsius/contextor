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
    includeHidden: input.options.includeHidden,
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
  const outputFileBase = buildDirectoryCopyOutputBase(bundle.rootName);
  const contextMarkdownPath = path.join(input.runDirectories.root, `${outputFileBase}_context.md`);
  const contextTextPath = path.join(input.runDirectories.root, `${outputFileBase}_context.txt`);
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
      rootName: bundle.rootName,
      outputFileBase,
      directories: bundle.directories,
      requestedFormat: input.options.format,
      includeHidden: Boolean(input.options.includeHidden),
      totalFiles: bundle.totalFiles,
      includedFiles: bundle.includedFiles,
      skippedFiles: bundle.skippedFiles,
      entries: bundle.entries.map((entry) => ({
        path: entry.path,
        relativePath: entry.relativePath,
        pathWithinRoot: entry.pathWithinRoot,
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
      includeHidden: Boolean(input.options.includeHidden),
      outputFiles: {
        markdown: contextMarkdownPath,
        text: contextTextPath,
      },
    }),
  ]);

  await input.logger.info("Directory copy workflow completed", {
    rootPath: bundle.rootPath,
    totalFiles: bundle.totalFiles,
    includedFiles: bundle.includedFiles,
    skippedFiles: bundle.skippedFiles,
    requestedFormat: input.options.format,
    includeHidden: Boolean(input.options.includeHidden),
    outputFileBase,
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

function buildDirectoryCopyOutputBase(rootName: string): string {
  const normalized = rootName
    .normalize("NFKD")
    .replace(/[^\w\s.-]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return (normalized || "directory").slice(0, 80);
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

  const directoryListing = renderDirectoryListingMarkdown(bundle);

  const sections =
    bundle.entries.length === 0
      ? "_No file bodies were captured because the selected directory is empty._"
      : bundle.entries.map((entry, index) => renderDirectoryCopyMarkdownEntry(entry, index + 1)).join("\n\n");

  return `# Literal Directory Copy

- Root path: ${bundle.rootPath}
- Relative root: ${bundle.rootName}/
- Requested output format: ${options.format}
- Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}
- Total files scanned: ${bundle.totalFiles}
- Text-representable files copied: ${bundle.includedFiles}
- Non-text or error entries represented: ${bundle.skippedFiles}

# Complete Directory Listing

${directoryListing}

# Directory Copy Goal

${options.goal}

# Runtime Context

${runtimeLines.join("\n")}

# Source Directory

- Root path: ${bundle.rootPath}
- Relative root: ${bundle.rootName}/
- Requested output format: ${options.format}
- Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}
- Total files scanned: ${bundle.totalFiles}
- Text-representable files copied: ${bundle.includedFiles}
- Non-text or error entries represented: ${bundle.skippedFiles}

# Aggregated File Bodies

${sections}
`;
}

function renderDirectoryListingMarkdown(bundle: DirectoryCopyBundle): string {
  if (bundle.entries.length === 0) {
    return "_No files were found in the selected directory._";
  }

  return renderDirectoryListingLines(bundle).map((line) => `- \`${line.path}\`${line.detail ? ` ${line.detail}` : ""}`).join("\n");
}

function renderDirectoryCopyMarkdownEntry(entry: DirectoryCopyBundle["entries"][number], index: number): string {
  const detailLines = [
    `- Relative path: ${entry.relativePath}`,
    `- Actual path: ${entry.path}`,
    `- Path inside copied folder: ${entry.pathWithinRoot}`,
    `- Extension: ${entry.extension || "(none)"}`,
    `- Modified: ${entry.modifiedTime}`,
    `- Size: ${entry.size} bytes`,
    `- Status: ${entry.contentKind}`,
  ];

  if (entry.note) {
    detailLines.push(`- Note: ${entry.note}`);
  }

  const fence = entry.content.includes("```") ? "````" : "```";

  return `## File ${index}: ${entry.relativePath}

${detailLines.join("\n")}

${fence}text
${entry.content}
${fence}`;
}

function renderDirectoryCopyText(
  bundle: DirectoryCopyBundle,
  options: CopyFolderOptions,
  runtimeInfo: RuntimeEnvironmentInfo,
): string {
  const lines = [
    "LITERAL DIRECTORY COPY",
    `Root path: ${bundle.rootPath}`,
    `Relative root: ${bundle.rootName}/`,
    `Requested format: ${options.format}`,
    `Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}`,
    `Total files scanned: ${bundle.totalFiles}`,
    `Text-representable files copied: ${bundle.includedFiles}`,
    `Non-text or error entries represented: ${bundle.skippedFiles}`,
    "",
    "COMPLETE DIRECTORY LISTING",
  ];

  if (bundle.entries.length === 0) {
    lines.push("(No files were found in the selected directory.)");
  } else {
    for (const line of renderDirectoryListingLines(bundle)) {
      lines.push(`- ${line.path}${line.detail ? ` ${line.detail}` : ""}`);
    }
  }

  lines.push(
    "",
    "DIRECTORY COPY GOAL",
    options.goal,
    "",
    "RUNTIME CONTEXT",
    `Local time: ${runtimeInfo.localTimestamp}`,
    `UTC time: ${runtimeInfo.utcTimestamp}`,
    `Time zone: ${runtimeInfo.timeZone}`,
  );

  if (runtimeInfo.approximateLocation) {
    lines.push(`Approximate location: ${runtimeInfo.approximateLocation}`);
  }

  if (runtimeInfo.approximateLocationNote) {
    lines.push(`Location note: ${runtimeInfo.approximateLocationNote}`);
  }

  lines.push("", "AGGREGATED FILE BODIES");
  if (bundle.entries.length === 0) {
    lines.push("(No file bodies were captured because the selected directory is empty.)");
  } else {
    for (const entry of bundle.entries) {
      lines.push(
        "",
        `===== START FILE: ${entry.relativePath} =====`,
        `Relative path: ${entry.relativePath}`,
        `Actual path: ${entry.path}`,
        `Path inside copied folder: ${entry.pathWithinRoot}`,
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

function renderDirectoryListingLines(bundle: DirectoryCopyBundle): Array<{ path: string; detail?: string }> {
  const lines: Array<{ path: string; detail?: string }> = [];
  for (const directory of bundle.directories) {
    lines.push({ path: directory, detail: directory === `${bundle.rootName}/` ? undefined : "(directory)" });
  }

  for (const entry of bundle.entries) {
    lines.push({ path: entry.relativePath, detail: `(${entry.size} bytes, ${entry.contentKind})` });
  }

  return lines;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Directory copy aborted by operator.");
  }
}

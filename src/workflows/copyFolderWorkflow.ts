import fs from "node:fs/promises";
import path from "node:path";

import { FilesystemAdapter } from "../adapters/filesystemAdapter";
import { RunLogger } from "../core/logger";
import { CopyFolderOptions, DirectoryCopyBundle, DirectoryCopyEntry, RunDirectories, RunObserver, RuntimeEnvironmentInfo, WorkflowResult } from "../core/types";
import { writeJsonFile } from "../utils/files";
import { getRuntimeEnvironmentInfo } from "../utils/system";

const CHUNK_LINE_LIMIT = 10_000;

interface ChunkInfo {
  part: number;
  totalParts: number;
  chunkEntries: DirectoryCopyEntry[];
}

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
  const manifestPath = path.join(input.runDirectories.manifests, "sources.json");
  const runManifestPath = path.join(input.runDirectories.manifests, "run.json");

  const chunks = splitEntriesIntoChunks(bundle.entries);
  const totalParts = chunks.length;
  const isChunked = totalParts > 1;

  const buildChunkPaths = (i: number) => {
    const suffix = isChunked ? `_part${i + 1}of${totalParts}` : "";
    return {
      md: path.join(input.runDirectories.root, `${outputFileBase}_context${suffix}.md`),
      txt: path.join(input.runDirectories.root, `${outputFileBase}_context${suffix}.txt`),
    };
  };

  const chunkPathPairs = chunks.map((_, i) => buildChunkPaths(i));
  const chunkMarkdownPaths = chunkPathPairs.map((p) => p.md);
  const chunkTextPaths = chunkPathPairs.map((p) => p.txt);

  const chunkWrites = chunks.flatMap((chunkEntries, i) => {
    const chunkInfo: ChunkInfo | undefined = isChunked ? { part: i + 1, totalParts, chunkEntries } : undefined;
    const { md: mdPath, txt: txtPath } = chunkPathPairs[i]!;
    return [
      fs.writeFile(mdPath, renderDirectoryCopyMarkdown(bundle, input.options, runtimeInfo, chunkInfo), "utf8"),
      fs.writeFile(txtPath, renderDirectoryCopyText(bundle, input.options, runtimeInfo, chunkInfo), "utf8"),
    ];
  });

  const primaryMarkdownPath: string = chunkMarkdownPaths[0]!;
  const primaryTextPath: string = chunkTextPaths[0]!;

  await Promise.all([
    ...chunkWrites,
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
      totalChunks: totalParts,
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
      outputFiles: isChunked
        ? {
            markdown: primaryMarkdownPath,
            text: primaryTextPath,
            markdownChunks: chunkMarkdownPaths,
            textChunks: chunkTextPaths,
          }
        : { markdown: primaryMarkdownPath, text: primaryTextPath },
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
    totalChunks: totalParts,
  });

  return {
    workflow: "directory-copy",
    summary: `Exported ${bundle.includedFiles} readable file(s) from ${bundle.totalFiles} scanned file(s) into literal directory copy artifacts${isChunked ? ` (${totalParts} parts)` : ""}.`,
    runDir: input.runDirectories.root,
    contextMarkdownPath: primaryMarkdownPath,
    contextTextPath: primaryTextPath,
    manifestPath,
    artifactPaths: isChunked ? [...chunkMarkdownPaths, ...chunkTextPaths] : [],
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
  chunkInfo?: ChunkInfo,
): string {
  const isChunked = chunkInfo !== undefined;
  const entries = isChunked ? chunkInfo.chunkEntries : bundle.entries;
  const partLabel = isChunked ? ` — Part ${chunkInfo.part} of ${chunkInfo.totalParts}` : "";

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
  const chunkListingHeading = isChunked ? `\n# Files in This Part (${chunkInfo.part} of ${chunkInfo.totalParts})\n\n${renderChunkFilesListing(chunkInfo.chunkEntries)}\n` : "";

  const sections =
    entries.length === 0
      ? "_No file bodies were captured because the selected directory is empty._"
      : entries.map((entry, index) => renderDirectoryCopyMarkdownEntry(entry, index + 1)).join("\n\n");

  return `# Literal Directory Copy${partLabel}

- Root path: ${bundle.rootPath}
- Relative root: ${bundle.rootName}/
- Requested output format: ${options.format}
- Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}
- Total files scanned: ${bundle.totalFiles}
- Text-representable files copied: ${bundle.includedFiles}
- Non-text or error entries represented: ${bundle.skippedFiles}${isChunked ? `\n- Total parts: ${chunkInfo.totalParts}\n- This part: ${chunkInfo.part} of ${chunkInfo.totalParts}\n- Files in this part: ${chunkInfo.chunkEntries.length}` : ""}

# Complete Directory Listing${isChunked ? " (All Parts)" : ""}

${directoryListing}
${chunkListingHeading}
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

function renderChunkFilesListing(entries: DirectoryCopyEntry[]): string {
  if (entries.length === 0) return "_No files in this part._";
  return entries.map((entry) => `- \`${entry.relativePath}\` (${entry.size} bytes, ${entry.contentKind})`).join("\n");
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
  chunkInfo?: ChunkInfo,
): string {
  const isChunked = chunkInfo !== undefined;
  const entries = isChunked ? chunkInfo.chunkEntries : bundle.entries;
  const partLabel = isChunked ? ` — PART ${chunkInfo.part} OF ${chunkInfo.totalParts}` : "";

  const lines = [
    `LITERAL DIRECTORY COPY${partLabel}`,
    `Root path: ${bundle.rootPath}`,
    `Relative root: ${bundle.rootName}/`,
    `Requested format: ${options.format}`,
    `Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}`,
    `Total files scanned: ${bundle.totalFiles}`,
    `Text-representable files copied: ${bundle.includedFiles}`,
    `Non-text or error entries represented: ${bundle.skippedFiles}`,
  ];

  if (isChunked) {
    lines.push(`Total parts: ${chunkInfo.totalParts}`, `This part: ${chunkInfo.part} of ${chunkInfo.totalParts}`, `Files in this part: ${chunkInfo.chunkEntries.length}`);
  }

  lines.push("", `COMPLETE DIRECTORY LISTING${isChunked ? " (ALL PARTS)" : ""}`);

  if (bundle.entries.length === 0) {
    lines.push("(No files were found in the selected directory.)");
  } else {
    for (const line of renderDirectoryListingLines(bundle)) {
      lines.push(`- ${line.path}${line.detail ? ` ${line.detail}` : ""}`);
    }
  }

  if (isChunked) {
    lines.push("", `FILES IN THIS PART (${chunkInfo.part} OF ${chunkInfo.totalParts})`);
    if (chunkInfo.chunkEntries.length === 0) {
      lines.push("(No files in this part.)");
    } else {
      for (const entry of chunkInfo.chunkEntries) {
        lines.push(`- ${entry.relativePath} (${entry.size} bytes, ${entry.contentKind})`);
      }
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
  if (entries.length === 0) {
    lines.push("(No file bodies were captured because the selected directory is empty.)");
  } else {
    for (const entry of entries) {
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

function countEntryLines(entry: DirectoryCopyEntry): number {
  return entry.content.split("\n").length + 12;
}

function splitAtPathDepth(entries: DirectoryCopyEntry[], depth: number, lineLimit: number): DirectoryCopyEntry[][] {
  const groups = new Map<string, DirectoryCopyEntry[]>();
  for (const entry of entries) {
    const parts = entry.relativePath.split("/");
    // Key by the directory portion up to `depth` segments (never include the filename)
    const key = parts.slice(0, Math.min(depth, parts.length - 1)).join("/");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const chunks: DirectoryCopyEntry[][] = [];
  let currentChunk: DirectoryCopyEntry[] = [];
  let currentLines = 0;

  for (const [, groupEntries] of groups) {
    const groupLines = groupEntries.reduce((sum, e) => sum + countEntryLines(e), 0);

    if (groupLines > lineLimit && groupEntries.length > 1) {
      // This group is still too large — recurse one level deeper
      const subChunks = splitAtPathDepth(groupEntries, depth + 1, lineLimit);
      for (const subChunk of subChunks) {
        const subLines = subChunk.reduce((sum, e) => sum + countEntryLines(e), 0);
        if (currentLines > 0 && currentLines + subLines > lineLimit) {
          chunks.push(currentChunk);
          currentChunk = [...subChunk];
          currentLines = subLines;
        } else {
          currentChunk.push(...subChunk);
          currentLines += subLines;
        }
      }
    } else {
      if (currentLines > 0 && currentLines + groupLines > lineLimit) {
        chunks.push(currentChunk);
        currentChunk = [...groupEntries];
        currentLines = groupLines;
      } else {
        currentChunk.push(...groupEntries);
        currentLines += groupLines;
      }
    }
  }

  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [entries];
}

function splitEntriesIntoChunks(entries: DirectoryCopyEntry[]): DirectoryCopyEntry[][] {
  if (entries.length === 0) return [[]];
  const totalLines = entries.reduce((sum, e) => sum + countEntryLines(e), 0);
  if (totalLines <= CHUNK_LINE_LIMIT) return [entries];
  return splitAtPathDepth(entries, 2, CHUNK_LINE_LIMIT);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Directory copy aborted by operator.");
  }
}

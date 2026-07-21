import fs from "node:fs/promises";
import path from "node:path";

import { FilesystemAdapter } from "../adapters/filesystemAdapter";
import { RunLogger } from "../core/logger";
import { CopyFolderOptions, DirectoryCopyBundle, RunDirectories, RunObserver, RuntimeEnvironmentInfo, WorkflowResult } from "../core/types";
import { writeJsonFile } from "../utils/files";
import { describeGeneratedDirectoryOmitPreset, getGeneratedDirectoryOmitNames } from "../utils/generatedDirectories";
import { renderMarkdownTextToPdf } from "../utils/pdf";
import { getRuntimeEnvironmentInfo } from "../utils/system";
import {
  createDirectoryCopyChunkPlan,
  DirectoryCopyChunk,
  DirectoryCopyChunkPlan,
  formatChunkSuffix,
  normalizeDirectoryCopyChunkSettings,
} from "./directoryCopyChunking";

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
    omitGeneratedDirs: input.options.omitGeneratedDirs ?? "common",
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
  const chunkSettings = normalizeDirectoryCopyChunkSettings({
    enabled: input.options.chunkMarkdown,
    lineTarget: input.options.chunkLineTarget,
    byteTarget: input.options.chunkByteTarget,
  });
  const chunkPlan = chunkSettings.enabled ? createDirectoryCopyChunkPlan(bundle, chunkSettings) : undefined;
  const outputFiles = await writeDirectoryCopyOutputs({
    runRoot: input.runDirectories.root,
    outputFileBase,
    bundle,
    options: input.options,
    runtimeInfo,
    chunkPlan,
    logger: input.logger,
  });

  await Promise.all([
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
      omittedGeneratedDirectories: buildOmittedGeneratedDirectoriesManifest(input.options.omitGeneratedDirs),
      chunking: buildChunkManifest(chunkPlan, outputFiles.markdownPaths, outputFiles.textPaths),
      pdfExport: buildPdfManifest(input.options, outputFiles.pdfPaths),
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
      omittedGeneratedDirectories: buildOmittedGeneratedDirectoriesManifest(input.options.omitGeneratedDirs),
      chunking: buildChunkManifest(chunkPlan, outputFiles.markdownPaths, outputFiles.textPaths),
      pdfExport: buildPdfManifest(input.options, outputFiles.pdfPaths),
      outputFiles: {
        markdown: outputFiles.contextMarkdownPath,
        text: outputFiles.contextTextPath,
        pdf: outputFiles.contextPdfPath,
        markdownChunks: outputFiles.markdownPaths,
        textChunks: outputFiles.textPaths,
        pdfChunks: outputFiles.pdfPaths,
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
    omittedGeneratedDirectories: buildOmittedGeneratedDirectoriesManifest(input.options.omitGeneratedDirs),
    outputFileBase,
    chunking: buildChunkManifest(chunkPlan, outputFiles.markdownPaths, outputFiles.textPaths),
    pdfExport: buildPdfManifest(input.options, outputFiles.pdfPaths),
  });

  const chunkSummary = chunkPlan
    ? buildChunkSummary(outputFiles)
    : "";
  const formatSummary =
    input.options.format === "both"
      ? "Markdown and text outputs were separated into format-specific folders."
      : `Generated ${input.options.format === "md" ? "markdown" : "text"} output only.`;
  const pdfSummary = outputFiles.pdfPaths.length > 0 ? ` Generated ${outputFiles.pdfPaths.length} PDF version(s) from markdown.` : "";

  return {
    workflow: "directory-copy",
    summary: `Exported ${bundle.includedFiles} readable file(s) from ${bundle.totalFiles} scanned file(s) into literal directory copy artifacts. ${formatSummary}${chunkSummary}${pdfSummary}`,
    runDir: input.runDirectories.root,
    contextMarkdownPath: outputFiles.contextMarkdownPath,
    contextTextPath: outputFiles.contextTextPath,
    manifestPath,
    artifactPaths: outputFiles.artifactPaths,
    logPath: input.logger.logPath,
  };
}

async function writeDirectoryCopyOutputs(input: {
  runRoot: string;
  outputFileBase: string;
  bundle: DirectoryCopyBundle;
  options: CopyFolderOptions;
  runtimeInfo: RuntimeEnvironmentInfo;
  chunkPlan?: DirectoryCopyChunkPlan;
  logger: RunLogger;
}): Promise<{
  contextMarkdownPath: string;
  contextTextPath: string;
  contextPdfPath: string;
  markdownPaths: string[];
  textPaths: string[];
  pdfPaths: string[];
  artifactPaths: string[];
}> {
  const shouldWriteMarkdown = input.options.format !== "txt";
  const shouldWriteText = input.options.format !== "md";
  const shouldWritePdf = shouldWriteMarkdown && (input.options.exportPdf ?? true);
  const markdownDir = input.options.format === "both" ? path.join(input.runRoot, "markdown") : input.runRoot;
  const textDir = input.options.format === "both" ? path.join(input.runRoot, "text") : input.runRoot;
  const pdfDir = input.options.format === "both" ? path.join(input.runRoot, "pdf") : input.runRoot;

  await Promise.all([
    shouldWriteMarkdown ? fs.mkdir(markdownDir, { recursive: true }) : Promise.resolve(),
    shouldWriteText ? fs.mkdir(textDir, { recursive: true }) : Promise.resolve(),
    shouldWritePdf ? fs.mkdir(pdfDir, { recursive: true }) : Promise.resolve(),
  ]);

  if (!input.chunkPlan) {
    const contextMarkdownPath = shouldWriteMarkdown ? path.join(markdownDir, `${input.outputFileBase}_context.md`) : "";
    const contextTextPath = shouldWriteText ? path.join(textDir, `${input.outputFileBase}_context.txt`) : "";
    const contextPdfPath = shouldWritePdf ? path.join(pdfDir, `${input.outputFileBase}_context.pdf`) : "";
    const writes: Array<Promise<void>> = [];
    let markdown = "";
    if (shouldWriteMarkdown) {
      markdown = renderDirectoryCopyMarkdown(input.bundle, input.options, input.runtimeInfo);
      writes.push(fs.writeFile(contextMarkdownPath, markdown, "utf8"));
    }
    if (shouldWriteText) {
      writes.push(fs.writeFile(contextTextPath, renderDirectoryCopyText(input.bundle, input.options, input.runtimeInfo), "utf8"));
    }
    await Promise.all(writes);
    const pdfPaths = contextPdfPath
      ? await renderPdfSafely({
          markdown,
          outputPath: contextPdfPath,
          title: `${input.bundle.rootName} directory copy`,
          logger: input.logger,
        })
      : [];

    return {
      contextMarkdownPath,
      contextTextPath,
      contextPdfPath: pdfPaths[0] ?? "",
      markdownPaths: contextMarkdownPath ? [contextMarkdownPath] : [],
      textPaths: contextTextPath ? [contextTextPath] : [],
      pdfPaths,
      artifactPaths: pdfPaths,
    };
  }

  const markdownPaths: string[] = [];
  const textPaths: string[] = [];
  const pdfPaths: string[] = [];
  const total = input.chunkPlan.chunks.length;
  for (const chunk of input.chunkPlan.chunks) {
    const suffix = formatChunkSuffix(chunk.index, total);
    const writes: Array<Promise<void>> = [];
    let markdown = "";
    if (shouldWriteMarkdown) {
      const markdownPath = path.join(markdownDir, `${input.outputFileBase}_context_${suffix}.md`);
      markdownPaths.push(markdownPath);
      markdown = renderDirectoryCopyMarkdown(input.bundle, input.options, input.runtimeInfo, {
        chunk,
        total,
        lineTarget: input.chunkPlan.settings.lineTarget,
        byteTarget: input.chunkPlan.settings.byteTarget,
      });
      writes.push(
        fs.writeFile(
          markdownPath,
          markdown,
          "utf8",
        ),
      );
    }
    if (shouldWriteText) {
      const textPath = path.join(textDir, `${input.outputFileBase}_context_${suffix}.txt`);
      textPaths.push(textPath);
      writes.push(
        fs.writeFile(
          textPath,
          renderDirectoryCopyText(input.bundle, input.options, input.runtimeInfo, {
            chunk,
            total,
            lineTarget: input.chunkPlan.settings.lineTarget,
            byteTarget: input.chunkPlan.settings.byteTarget,
          }),
          "utf8",
        ),
      );
    }
    await Promise.all(writes);
    if (shouldWritePdf && markdown) {
      const pdfPath = path.join(pdfDir, `${input.outputFileBase}_context_${suffix}.pdf`);
      pdfPaths.push(
        ...(await renderPdfSafely({
          markdown,
          outputPath: pdfPath,
          title: `${input.bundle.rootName} directory copy ${suffix}`,
          logger: input.logger,
        })),
      );
    }
  }

  return {
    contextMarkdownPath: markdownPaths[0] ?? "",
    contextTextPath: textPaths[0] ?? "",
    contextPdfPath: pdfPaths[0] ?? "",
    markdownPaths,
    textPaths,
    pdfPaths,
    artifactPaths: [...markdownPaths, ...textPaths, ...pdfPaths],
  };
}

async function renderPdfSafely(input: {
  markdown: string;
  outputPath: string;
  title: string;
  logger: RunLogger;
}): Promise<string[]> {
  try {
    await renderMarkdownTextToPdf({
      markdown: input.markdown,
      outputPath: input.outputPath,
      title: input.title,
    });
    return [input.outputPath];
  } catch (error) {
    await input.logger.warn("Directory copy PDF export failed", {
      outputPath: input.outputPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function buildChunkSummary(outputFiles: { markdownPaths: string[]; textPaths: string[] }): string {
  const parts: string[] = [];
  if (outputFiles.markdownPaths.length > 0) {
    parts.push(`${outputFiles.markdownPaths.length} markdown continuation part(s)`);
  }
  if (outputFiles.textPaths.length > 0) {
    parts.push(`${outputFiles.textPaths.length} text continuation part(s)`);
  }

  return parts.length > 0 ? ` Generated ${parts.join(" and ")}.` : "";
}

function buildOmittedGeneratedDirectoriesManifest(preset: CopyFolderOptions["omitGeneratedDirs"]): Record<string, unknown> {
  const normalizedPreset = preset ?? "common";
  return {
    preset: normalizedPreset,
    names: getGeneratedDirectoryOmitNames(normalizedPreset),
  };
}

function buildPdfManifest(options: CopyFolderOptions, pdfPaths: string[]): Record<string, unknown> {
  return {
    requested: options.exportPdf ?? true,
    generated: pdfPaths.length > 0,
    pdfPaths,
    note:
      options.format === "txt"
        ? "PDF export requires markdown output and is skipped when the requested format is txt only."
        : "PDF output is rendered from the generated markdown directory-copy artifact.",
  };
}

function buildChunkManifest(
  chunkPlan: DirectoryCopyChunkPlan | undefined,
  markdownPaths: string[],
  textPaths: string[],
): Record<string, unknown> {
  return {
    enabled: Boolean(chunkPlan),
    chunkLineTarget: chunkPlan?.settings.lineTarget,
    chunkByteTarget: chunkPlan?.settings.byteTarget,
    chunkCount: chunkPlan?.chunks.length ?? 0,
    markdownChunks: chunkPlan ? markdownPaths : [],
    textChunks: chunkPlan ? textPaths : [],
    oversizedWarnings: chunkPlan?.warnings ?? [],
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
  chunkMeta?: {
    chunk: DirectoryCopyChunk;
    total: number;
    lineTarget: number;
    byteTarget?: number;
  },
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
  const activeEntries = chunkMeta ? chunkMeta.chunk.entries : bundle.entries;
  const chunkNotice = chunkMeta
    ? renderDirectoryCopyMarkdownChunkNotice(chunkMeta.chunk, chunkMeta.total, chunkMeta.lineTarget, chunkMeta.byteTarget)
    : "";
  const filesIncluded = chunkMeta ? renderFilesIncludedMarkdown(chunkMeta.chunk.entries) : "";

  const sections =
    activeEntries.length === 0
      ? "_No file bodies were captured because the selected directory is empty._"
      : activeEntries.map((entry, index) => renderDirectoryCopyMarkdownEntry(entry, index + 1)).join("\n\n");

  return `# Literal Directory Copy

- Root path: ${bundle.rootPath}
- Relative root: ${bundle.rootName}/
- Requested output format: ${options.format}
- Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}
- Omitted generated/cache directories: ${describeGeneratedDirectoryOmitPreset(options.omitGeneratedDirs ?? "common")}
- Total files scanned: ${bundle.totalFiles}
- Text-representable files copied: ${bundle.includedFiles}
- Non-text or error entries represented: ${bundle.skippedFiles}
${chunkNotice}

# Complete Directory Listing

${directoryListing}
${filesIncluded}

# Directory Copy Goal

${options.goal}

# Runtime Context

${runtimeLines.join("\n")}

# Source Directory

- Root path: ${bundle.rootPath}
- Relative root: ${bundle.rootName}/
- Requested output format: ${options.format}
- Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}
- Omitted generated/cache directories: ${describeGeneratedDirectoryOmitPreset(options.omitGeneratedDirs ?? "common")}
- Total files scanned: ${bundle.totalFiles}
- Text-representable files copied: ${bundle.includedFiles}
- Non-text or error entries represented: ${bundle.skippedFiles}

# Aggregated File Bodies

${sections}
`;
}

function renderDirectoryCopyMarkdownChunkNotice(
  chunk: DirectoryCopyChunk,
  total: number,
  lineTarget: number,
  byteTarget?: number,
): string {
  const warnings = chunk.warnings.length > 0 ? `\n- Warnings: ${chunk.warnings.join(" | ")}` : "";
  return `
- Continuation part: Part ${chunk.index} of ${total}
- Chunk line target: ${lineTarget}
- Chunk byte target: ${byteTarget ?? "not set"}
- Estimated part size: ${chunk.estimatedLines} lines, ${chunk.estimatedBytes} bytes
- Oversized part: ${chunk.oversized ? "yes" : "no"}${warnings}`;
}

function renderFilesIncludedMarkdown(entries: DirectoryCopyBundle["entries"]): string {
  const body =
    entries.length === 0
      ? "_No files are assigned to this part._"
      : entries.map((entry) => `- \`${entry.relativePath}\` (${entry.size} bytes, ${entry.contentKind})`).join("\n");

  return `

# Files Included In This Part

${body}
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
  chunkMeta?: {
    chunk: DirectoryCopyChunk;
    total: number;
    lineTarget: number;
    byteTarget?: number;
  },
): string {
  const lines = [
    "LITERAL DIRECTORY COPY",
    `Root path: ${bundle.rootPath}`,
    `Relative root: ${bundle.rootName}/`,
    `Requested format: ${options.format}`,
    `Include hidden dot entries: ${options.includeHidden ? "yes" : "no"}`,
    `Omitted generated/cache directories: ${describeGeneratedDirectoryOmitPreset(options.omitGeneratedDirs ?? "common")}`,
    `Total files scanned: ${bundle.totalFiles}`,
    `Text-representable files copied: ${bundle.includedFiles}`,
    `Non-text or error entries represented: ${bundle.skippedFiles}`,
  ];

  if (chunkMeta) {
    lines.push(
      `Continuation part: Part ${chunkMeta.chunk.index} of ${chunkMeta.total}`,
      `Chunk line target: ${chunkMeta.lineTarget}`,
      `Chunk byte target: ${chunkMeta.byteTarget ?? "not set"}`,
      `Estimated part size: ${chunkMeta.chunk.estimatedLines} lines, ${chunkMeta.chunk.estimatedBytes} bytes`,
      `Oversized part: ${chunkMeta.chunk.oversized ? "yes" : "no"}`,
    );
    if (chunkMeta.chunk.warnings.length > 0) {
      lines.push(`Warnings: ${chunkMeta.chunk.warnings.join(" | ")}`);
    }
  }

  lines.push("", "COMPLETE DIRECTORY LISTING");

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

  if (chunkMeta) {
    lines.push("", "FILES INCLUDED IN THIS PART");
    if (chunkMeta.chunk.entries.length === 0) {
      lines.push("(No files are assigned to this part.)");
    } else {
      for (const entry of chunkMeta.chunk.entries) {
        lines.push(`- ${entry.relativePath} (${entry.size} bytes, ${entry.contentKind})`);
      }
    }
  }

  const activeEntries = chunkMeta ? chunkMeta.chunk.entries : bundle.entries;

  lines.push("", "AGGREGATED FILE BODIES");
  if (activeEntries.length === 0) {
    lines.push("(No file bodies were captured because the selected directory is empty.)");
  } else {
    for (const entry of activeEntries) {
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

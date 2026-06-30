import fs from "node:fs/promises";
import path from "node:path";

import { Logger } from "../core/logger";
import { scoreFileCandidate, suppressDuplicateCandidates } from "../core/relevance";
import { applyRedactions } from "../core/redaction";
import { ContextorConfig, DirectoryCopyBundle, DirectoryCopyEntry, FileCandidate, FileSource, GeneratedDirectoryOmitPreset } from "../core/types";
import { isWithinDirectory, pathExists, resolveUserPath } from "../utils/files";
import { getGeneratedDirectoryOmitNames } from "../utils/generatedDirectories";
import { extractKeyPoints, summarizeText, truncate } from "../utils/text";

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".pdf", ".json", ".csv", ".docx"]);
const KNOWN_BINARY_EXTENSIONS = new Set([
  ".7z",
  ".a",
  ".ai",
  ".apk",
  ".bin",
  ".bmp",
  ".class",
  ".dmg",
  ".dll",
  ".doc",
  ".epub",
  ".exe",
  ".gif",
  ".gz",
  ".heic",
  ".heif",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".mov",
  ".otf",
  ".pages",
  ".pdf.pkg",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".psd",
  ".pyc",
  ".so",
  ".tar",
  ".tif",
  ".tiff",
  ".ttf",
  ".wav",
  ".webp",
  ".woff",
  ".woff2",
  ".xls",
  ".xlsx",
  ".zip",
]);
const COPY_TEXT_SPECIAL_CASES = new Set([".csv", ".docx", ".json", ".md", ".pdf", ".txt"]);
const COPY_TEXT_CHAR_LIMIT = 250_000;
const BINARY_SNIFF_BYTES = 4_096;

export class FilesystemAdapter {
  constructor(
    private readonly config: ContextorConfig,
    private readonly logger: Logger,
  ) {}

  async compileDirectory(
    folderPath: string,
    goal: string,
    limit?: number,
    options: {
      onProgress?: (progress: { phase: "indexing" | "extracting" | "complete"; current: number; total: number; details?: string }) => Promise<void> | void;
      signal?: AbortSignal;
    } = {},
  ): Promise<FileSource[]> {
    throwIfAborted(options.signal);
    const resolvedPath = resolveUserPath(folderPath);
    if (!(await pathExists(resolvedPath))) {
      throw new Error(`Folder does not exist: ${resolvedPath}`);
    }

    if (!isWithinDirectory(resolvedPath, this.config.allowedDirectories)) {
      throw new Error(
        `Folder is outside the allowed directories. Update config/contextor.config.json to allow ${resolvedPath}`,
      );
    }

    await this.logger.info("Scanning folder for context sources", { folderPath: resolvedPath });
    const candidates = await this.walkDirectory(resolvedPath, options.signal);
    throwIfAborted(options.signal);
    const scored = candidates
      .map((candidate) => ({
        candidate,
        score: scoreFileCandidate(candidate, goal),
      }))
      .sort((left, right) => right.score - left.score);

    const extractionTargets =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? scored.slice(0, Math.max(limit * 2, 20))
        : scored;

    await options.onProgress?.({
      phase: "indexing",
      current: 0,
      total: extractionTargets.length,
      details:
        typeof limit === "number" && Number.isFinite(limit) && limit > 0
          ? `Indexed ${candidates.length} supported file(s). Extracting the top ${Math.min(extractionTargets.length, limit)} ranked candidate(s).`
          : `Indexed ${candidates.length} supported file(s). Beginning full extraction pass.`,
    });

    const sources: FileSource[] = [];
    for (const [index, item] of extractionTargets.entries()) {
      throwIfAborted(options.signal);
      const extractedText = await this.extractText(item.candidate.path, item.candidate.extension);
      const source: FileSource = {
        sourceType: "file",
        id: `${item.candidate.modifiedTimeMs}-${path.basename(item.candidate.path)}`,
        path: item.candidate.path,
        name: item.candidate.name,
        extension: item.candidate.extension,
        modifiedTime: new Date(item.candidate.modifiedTimeMs).toISOString(),
        size: item.candidate.size,
        extractedText,
        excerpt: truncate(extractedText, this.config.redaction.maxExcerptLength),
        summary: summarizeText(extractedText),
        keyPoints: extractKeyPoints(extractedText),
        score: item.score,
      };
      sources.push(source);

      await options.onProgress?.({
        phase: "extracting",
        current: index + 1,
        total: extractionTargets.length,
        details: item.candidate.name,
      });
    }

    throwIfAborted(options.signal);

    const deduped = suppressDuplicateCandidates(sources)
      .sort((left, right) => right.score - left.score)
      .slice(0, typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : undefined);

    await this.logger.info("Compiled folder sources", { count: deduped.length, scannedFiles: candidates.length });
    await options.onProgress?.({
      phase: "complete",
      current: deduped.length,
      total: deduped.length,
      details: `Compiled ${deduped.length} file source(s).`,
    });
    return deduped;
  }

  async copyDirectory(
    folderPath: string,
    options: {
      includeHidden?: boolean;
      omitGeneratedDirs?: GeneratedDirectoryOmitPreset;
      onProgress?: (progress: { phase: "indexing" | "extracting" | "compiling" | "complete"; current: number; total: number; details?: string }) => Promise<void> | void;
      signal?: AbortSignal;
    } = {},
  ): Promise<DirectoryCopyBundle> {
    throwIfAborted(options.signal);
    const resolvedPath = resolveUserPath(folderPath);
    if (!(await pathExists(resolvedPath))) {
      throw new Error(`Folder does not exist: ${resolvedPath}`);
    }

    if (!isWithinDirectory(resolvedPath, this.config.allowedDirectories)) {
      throw new Error(
        `Folder is outside the allowed directories. Update config/contextor.config.json to allow ${resolvedPath}`,
      );
    }

    await this.logger.info("Scanning folder for literal directory copy", { folderPath: resolvedPath });
    const rootName = path.basename(resolvedPath);
    const omitOptions = {
      includeHidden: Boolean(options.includeHidden),
      omitGeneratedDirs: options.omitGeneratedDirs ?? "common",
    };
    const [candidates, directories] = await Promise.all([
      this.walkDirectory(resolvedPath, options.signal, { includeAllFiles: true, ...omitOptions }),
      this.walkDirectoryPaths(resolvedPath, rootName, options.signal, omitOptions),
    ]);
    throwIfAborted(options.signal);

    await options.onProgress?.({
      phase: "indexing",
      current: 0,
      total: candidates.length,
      details: `Indexed ${candidates.length} file(s). Beginning literal extraction pass.`,
    });

    const entries: DirectoryCopyEntry[] = [];
    for (const [index, candidate] of candidates.entries()) {
      throwIfAborted(options.signal);
      const literal = await this.extractLiteralContent(candidate.path, candidate.extension, candidate.size);
      const pathWithinRoot = path.relative(resolvedPath, candidate.path) || candidate.name;
      entries.push({
        path: candidate.path,
        relativePath: path.join(rootName, pathWithinRoot),
        pathWithinRoot,
        name: candidate.name,
        extension: candidate.extension,
        modifiedTime: new Date(candidate.modifiedTimeMs).toISOString(),
        size: candidate.size,
        content: literal.content,
        contentKind: literal.contentKind,
        note: literal.note,
      });

      await options.onProgress?.({
        phase: "extracting",
        current: index + 1,
        total: candidates.length,
        details: candidate.name,
      });
    }

    throwIfAborted(options.signal);
    const includedFiles = entries.filter((entry) => entry.contentKind === "text").length;
    const skippedFiles = entries.length - includedFiles;

    await this.logger.info("Literal directory copy collected", {
      totalFiles: entries.length,
      includedFiles,
      skippedFiles,
    });
    await options.onProgress?.({
      phase: "complete",
      current: entries.length,
      total: entries.length,
      details: `Collected ${includedFiles} readable file(s) and ${skippedFiles} skipped/error entry(ies).`,
    });

    return {
      rootPath: resolvedPath,
      rootName,
      directories,
      entries,
      totalFiles: entries.length,
      includedFiles,
      skippedFiles,
    };
  }

  private async walkDirectory(
    rootPath: string,
    signal?: AbortSignal,
    options: { includeAllFiles?: boolean; includeHidden?: boolean; omitGeneratedDirs?: GeneratedDirectoryOmitPreset } = {},
  ): Promise<FileCandidate[]> {
    throwIfAborted(signal);
    const candidates: FileCandidate[] = [];
    const entries = (await fs.readdir(rootPath, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    for (const entry of entries) {
      throwIfAborted(signal);
      if (!options.includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        if (shouldOmitGeneratedDirectory(entry.name, options.omitGeneratedDirs)) {
          continue;
        }
        candidates.push(...(await this.walkDirectory(fullPath, signal, options)));
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!options.includeAllFiles && !SUPPORTED_EXTENSIONS.has(extension)) {
        continue;
      }

      const stats = await fs.stat(fullPath);
      candidates.push({
        path: fullPath,
        name: entry.name,
        extension,
        modifiedTimeMs: stats.mtimeMs,
        size: stats.size,
      });
    }

    return candidates;
  }

  private async walkDirectoryPaths(
    rootPath: string,
    rootName: string,
    signal?: AbortSignal,
    options: { includeHidden?: boolean; omitGeneratedDirs?: GeneratedDirectoryOmitPreset } = {},
  ): Promise<string[]> {
    const directories: string[] = [`${rootName}/`];
    await this.collectDirectoryPaths(rootPath, rootPath, rootName, directories, signal, options);
    return directories;
  }

  private async collectDirectoryPaths(
    currentPath: string,
    rootPath: string,
    rootName: string,
    directories: string[],
    signal?: AbortSignal,
    options: { includeHidden?: boolean; omitGeneratedDirs?: GeneratedDirectoryOmitPreset } = {},
  ): Promise<void> {
    throwIfAborted(signal);
    const entries = (await fs.readdir(currentPath, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    for (const entry of entries) {
      throwIfAborted(signal);
      if (!options.includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      if (!entry.isDirectory()) {
        continue;
      }

      if (shouldOmitGeneratedDirectory(entry.name, options.omitGeneratedDirs)) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);
      directories.push(`${path.join(rootName, path.relative(rootPath, fullPath))}/`);
      await this.collectDirectoryPaths(fullPath, rootPath, rootName, directories, signal, options);
    }
  }

  private async extractText(filePath: string, extension: string): Promise<string> {
    try {
      let extracted: string;
      switch (extension) {
        case ".txt":
        case ".md":
        case ".csv":
          extracted = await fs.readFile(filePath, "utf8");
          break;
        case ".json": {
          const raw = await fs.readFile(filePath, "utf8");
          const parsed = JSON.parse(raw) as unknown;
          extracted = JSON.stringify(parsed, null, 2);
          break;
        }
        case ".pdf":
          extracted = await this.extractPdfText(filePath);
          break;
        case ".docx":
          extracted = await this.extractDocxText(filePath);
          break;
        default:
          return "Unsupported file type.";
      }

      return truncate(this.redactText(extracted), 18_000);
    } catch (error) {
      await this.logger.warn("Failed to extract text from file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return "Extraction failed.";
    }
  }

  private async extractLiteralContent(
    filePath: string,
    extension: string,
    size: number,
  ): Promise<{ content: string; contentKind: DirectoryCopyEntry["contentKind"]; note?: string }> {
    try {
      if (COPY_TEXT_SPECIAL_CASES.has(extension)) {
        const extracted =
          extension === ".json"
            ? await this.readJsonLiteral(filePath)
            : extension === ".pdf"
              ? await this.extractPdfText(filePath)
              : extension === ".docx"
                ? await this.extractDocxText(filePath)
                : await fs.readFile(filePath, "utf8");
        const trimmed = limitLiteralContent(this.redactText(extracted));
        return {
          content: trimmed.content,
          contentKind: "text",
          note: trimmed.note,
        };
      }

      if (KNOWN_BINARY_EXTENSIONS.has(extension)) {
        return {
          content: describeNonTextFile(filePath, extension, size),
          contentKind: "skipped",
          note: "Known binary or non-text extension; represented as file metadata.",
        };
      }

      const buffer = await fs.readFile(filePath);
      if (isProbablyBinary(buffer.subarray(0, Math.min(buffer.length, BINARY_SNIFF_BYTES)))) {
        return {
          content: describeNonTextFile(filePath, extension, size),
          contentKind: "skipped",
          note: "Binary content detected during sniffing; represented as file metadata.",
        };
      }

      const trimmed = limitLiteralContent(this.redactText(buffer.toString("utf8")));
      return {
        content: trimmed.content,
        contentKind: "text",
        note: trimmed.note ?? (size > COPY_TEXT_CHAR_LIMIT ? `Original file size: ${size} bytes.` : undefined),
      };
    } catch (error) {
      await this.logger.warn("Failed to collect literal file content", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        content: `Failed to read file: ${filePath}`,
        contentKind: "error",
        note: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async readJsonLiteral(filePath: string): Promise<string> {
    const raw = await fs.readFile(filePath, "utf8");
    try {
      return JSON.stringify(JSON.parse(raw) as unknown, null, 2);
    } catch {
      return raw;
    }
  }

  private redactText(value: string): string {
    return applyRedactions(value, this.config.redaction);
  }

  private async extractPdfText(filePath: string): Promise<string> {
    const pdfParse = (await import("pdf-parse")).default as (
      input: Buffer,
      options?: { version?: string },
    ) => Promise<{ text: string }>;
    const pdfJsModule = (await import("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js")) as {
      VerbosityLevel?: { ERRORS?: number };
      setVerbosityLevel?: (level: number) => void;
    };
    const buffer = await fs.readFile(filePath);
    if (pdfJsModule.VerbosityLevel?.ERRORS !== undefined && pdfJsModule.setVerbosityLevel) {
      pdfJsModule.setVerbosityLevel(pdfJsModule.VerbosityLevel.ERRORS);
    }

    const result = await withMutedConsoleWarnings(
      () => pdfParse(buffer, { version: "v2.0.550" }),
      [/Required "glyf" table is not found -- trying to recover\./i],
    );
    return result.text;
  }

  private async extractDocxText(filePath: string): Promise<string> {
    const mammoth = (await import("mammoth")) as { extractRawText: (input: { path: string }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
}

function limitLiteralContent(value: string): { content: string; note?: string } {
  if (value.length <= COPY_TEXT_CHAR_LIMIT) {
    return { content: value };
  }

  return {
    content: `${value.slice(0, COPY_TEXT_CHAR_LIMIT).trimEnd()}\n\n[Truncated by Contextor after ${COPY_TEXT_CHAR_LIMIT} characters.]`,
    note: `Truncated after ${COPY_TEXT_CHAR_LIMIT} characters to keep the aggregated bundle manageable.`,
  };
}

function isProbablyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }

  let suspiciousBytes = 0;
  for (const byte of buffer) {
    if (byte === 0) {
      return true;
    }

    const isPrintable =
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte <= 126) ||
      byte >= 128;

    if (!isPrintable) {
      suspiciousBytes += 1;
    }
  }

  return suspiciousBytes / buffer.length > 0.25;
}

function describeNonTextFile(filePath: string, extension: string, size: number): string {
  const name = path.basename(filePath);
  const normalizedExtension = extension || path.extname(name).toLowerCase();
  const label = getNonTextFileTypeLabel(normalizedExtension);
  return `${label} named "${name}" (${name}). This file cannot be represented as literal text content, so the directory copy records its path, type, and ${size} byte size.`;
}

function shouldOmitGeneratedDirectory(directoryName: string, preset: GeneratedDirectoryOmitPreset | undefined): boolean {
  if ((preset ?? "common") === "none") {
    return false;
  }

  return getGeneratedDirectoryOmitNames(preset).includes(directoryName);
}

function getNonTextFileTypeLabel(extension: string): string {
  const imageExtensions = new Set([".ai", ".bmp", ".gif", ".heic", ".heif", ".ico", ".jpeg", ".jpg", ".png", ".psd", ".tif", ".tiff", ".webp"]);
  const audioExtensions = new Set([".mp3", ".wav"]);
  const videoExtensions = new Set([".mp4", ".mov"]);
  const archiveExtensions = new Set([".7z", ".gz", ".tar", ".zip"]);
  const fontExtensions = new Set([".otf", ".ttf", ".woff", ".woff2"]);
  const spreadsheetExtensions = new Set([".xls", ".xlsx"]);
  const presentationExtensions = new Set([".ppt", ".pptx"]);
  const documentExtensions = new Set([".doc", ".pages"]);

  if (imageExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} image file`;
  }

  if (audioExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} audio file`;
  }

  if (videoExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} video file`;
  }

  if (archiveExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} archive file`;
  }

  if (fontExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} font file`;
  }

  if (spreadsheetExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} spreadsheet file`;
  }

  if (presentationExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} presentation file`;
  }

  if (documentExtensions.has(extension)) {
    return `${extension.slice(1).toUpperCase()} document file`;
  }

  return extension ? `${extension.slice(1).toUpperCase()} file` : "Non-text file";
}

async function withMutedConsoleWarnings<T>(task: () => Promise<T>, patterns: RegExp[]): Promise<T> {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args.map((value) => String(value)).join(" ");
    if (patterns.some((pattern) => pattern.test(message))) {
      return;
    }

    originalWarn(...args);
  };

  try {
    return await task();
  } finally {
    console.warn = originalWarn;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Folder compile aborted by operator.");
  }
}

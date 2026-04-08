import fs from "node:fs/promises";
import path from "node:path";

import { Logger } from "../core/logger";
import { scoreFileCandidate, suppressDuplicateCandidates } from "../core/relevance";
import { ContextorConfig, FileCandidate, FileSource } from "../core/types";
import { isWithinDirectory, pathExists, resolveUserPath } from "../utils/files";
import { extractKeyPoints, summarizeText, truncate } from "../utils/text";

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".pdf", ".json", ".csv", ".docx"]);

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
    } = {},
  ): Promise<FileSource[]> {
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
    const candidates = await this.walkDirectory(resolvedPath);
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

  private async walkDirectory(rootPath: string): Promise<FileCandidate[]> {
    const candidates: FileCandidate[] = [];
    const entries = await fs.readdir(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        candidates.push(...(await this.walkDirectory(fullPath)));
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
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

  private async extractText(filePath: string, extension: string): Promise<string> {
    try {
      switch (extension) {
        case ".txt":
        case ".md":
        case ".csv":
          return truncate(await fs.readFile(filePath, "utf8"), 18_000);
        case ".json": {
          const raw = await fs.readFile(filePath, "utf8");
          const parsed = JSON.parse(raw) as unknown;
          return truncate(JSON.stringify(parsed, null, 2), 18_000);
        }
        case ".pdf":
          return truncate(await this.extractPdfText(filePath), 18_000);
        case ".docx":
          return truncate(await this.extractDocxText(filePath), 18_000);
        default:
          return "Unsupported file type.";
      }
    } catch (error) {
      await this.logger.warn("Failed to extract text from file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return "Extraction failed.";
    }
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

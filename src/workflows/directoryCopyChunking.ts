import { DirectoryCopyBundle } from "../core/types";

export interface DirectoryCopyChunkSettings {
  enabled: boolean;
  lineTarget: number;
  byteTarget?: number;
}

export interface DirectoryCopyChunk {
  index: number;
  entries: DirectoryCopyBundle["entries"];
  estimatedLines: number;
  estimatedBytes: number;
  oversized: boolean;
  warnings: string[];
}

export interface DirectoryCopyChunkPlan {
  settings: DirectoryCopyChunkSettings;
  chunks: DirectoryCopyChunk[];
  warnings: string[];
}

interface EntryGroup {
  label: string;
  entries: DirectoryCopyBundle["entries"];
  estimatedLines: number;
  estimatedBytes: number;
  oversized: boolean;
  warnings: string[];
}

const DEFAULT_CHUNK_LINE_TARGET = 10_000;
const DEFAULT_CHUNK_BYTE_TARGET = 8 * 1024 * 1024;
const ENTRY_METADATA_LINE_ESTIMATE = 14;

export function normalizeDirectoryCopyChunkSettings(input: {
  enabled?: boolean;
  lineTarget?: number;
  byteTarget?: number;
}): DirectoryCopyChunkSettings {
  return {
    enabled: Boolean(input.enabled),
    lineTarget: normalizePositiveInteger(input.lineTarget, DEFAULT_CHUNK_LINE_TARGET),
    byteTarget: normalizePositiveInteger(input.byteTarget, DEFAULT_CHUNK_BYTE_TARGET),
  };
}

export function createDirectoryCopyChunkPlan(
  bundle: DirectoryCopyBundle,
  settings: DirectoryCopyChunkSettings,
): DirectoryCopyChunkPlan {
  const normalizedSettings = normalizeDirectoryCopyChunkSettings(settings);
  const groups = splitEntriesBySubtree(bundle.entries, 0, normalizedSettings);
  const chunks = packGroupsIntoChunks(groups, normalizedSettings);
  const warnings = chunks.flatMap((chunk) => chunk.warnings);

  return {
    settings: normalizedSettings,
    chunks: chunks.map((chunk, index) => ({ ...chunk, index: index + 1 })),
    warnings,
  };
}

export function formatChunkSuffix(part: number, total: number): string {
  const width = Math.max(2, String(total).length);
  return `part${String(part).padStart(width, "0")}of${String(total).padStart(width, "0")}`;
}

function splitEntriesBySubtree(
  entries: DirectoryCopyBundle["entries"],
  depth: number,
  settings: DirectoryCopyChunkSettings,
): EntryGroup[] {
  if (entries.length === 0) {
    return [];
  }

  const buckets = new Map<string, DirectoryCopyBundle["entries"]>();
  for (const entry of entries) {
    const segments = splitRelativePath(entry.pathWithinRoot);
    const key = segments[depth] ?? entry.pathWithinRoot;
    const current = buckets.get(key) ?? [];
    current.push(entry);
    buckets.set(key, current);
  }

  const groups: EntryGroup[] = [];
  for (const [label, groupEntries] of buckets) {
    const metrics = estimateEntries(groupEntries);
    if (groupEntries.length === 1) {
      const entry = groupEntries[0]!;
      const oversized = exceedsLimit(metrics, settings);
      groups.push({
        label: entry.pathWithinRoot,
        entries: groupEntries,
        estimatedLines: metrics.lines,
        estimatedBytes: metrics.bytes,
        oversized,
        warnings: oversized ? [`${entry.relativePath} exceeds the chunk target and was kept whole in an oversized chunk.`] : [],
      });
      continue;
    }

    if (!exceedsLimit(metrics, settings)) {
      groups.push({
        label,
        entries: groupEntries,
        estimatedLines: metrics.lines,
        estimatedBytes: metrics.bytes,
        oversized: false,
        warnings: [],
      });
      continue;
    }

    const canSplitDeeper = groupEntries.some((entry) => splitRelativePath(entry.pathWithinRoot).length > depth + 1);
    if (canSplitDeeper) {
      groups.push(...splitEntriesBySubtree(groupEntries, depth + 1, settings));
      continue;
    }

    for (const entry of groupEntries) {
      const entryMetrics = estimateEntries([entry]);
      const oversized = exceedsLimit(entryMetrics, settings);
      groups.push({
        label: entry.pathWithinRoot,
        entries: [entry],
        estimatedLines: entryMetrics.lines,
        estimatedBytes: entryMetrics.bytes,
        oversized,
        warnings: oversized ? [`${entry.relativePath} exceeds the chunk target and was kept whole in an oversized chunk.`] : [],
      });
    }
  }

  return groups;
}

function packGroupsIntoChunks(groups: EntryGroup[], settings: DirectoryCopyChunkSettings): DirectoryCopyChunk[] {
  const chunks: DirectoryCopyChunk[] = [];
  let currentEntries: DirectoryCopyBundle["entries"] = [];
  let currentLines = 0;
  let currentBytes = 0;
  let currentWarnings: string[] = [];
  let currentOversized = false;

  const flush = (): void => {
    if (currentEntries.length === 0) {
      return;
    }

    chunks.push({
      index: chunks.length + 1,
      entries: currentEntries,
      estimatedLines: currentLines,
      estimatedBytes: currentBytes,
      oversized: currentOversized,
      warnings: currentWarnings,
    });
    currentEntries = [];
    currentLines = 0;
    currentBytes = 0;
    currentWarnings = [];
    currentOversized = false;
  };

  for (const group of groups) {
    if (group.oversized) {
      flush();
      chunks.push({
        index: chunks.length + 1,
        entries: group.entries,
        estimatedLines: group.estimatedLines,
        estimatedBytes: group.estimatedBytes,
        oversized: true,
        warnings: group.warnings,
      });
      continue;
    }

    const proposed = {
      lines: currentLines + group.estimatedLines,
      bytes: currentBytes + group.estimatedBytes,
    };
    if (currentEntries.length > 0 && exceedsLimit(proposed, settings)) {
      flush();
    }

    currentEntries.push(...group.entries);
    currentLines += group.estimatedLines;
    currentBytes += group.estimatedBytes;
    currentWarnings.push(...group.warnings);
    currentOversized = currentOversized || group.oversized;
  }

  flush();
  return chunks.length > 0
    ? chunks
    : [
        {
          index: 1,
          entries: [],
          estimatedLines: 0,
          estimatedBytes: 0,
          oversized: false,
          warnings: [],
        },
      ];
}

function estimateEntries(entries: DirectoryCopyBundle["entries"]): { lines: number; bytes: number } {
  return entries.reduce(
    (total, entry) => {
      const contentLines = entry.content.length === 0 ? 1 : entry.content.split(/\r\n|\r|\n/).length;
      return {
        lines: total.lines + ENTRY_METADATA_LINE_ESTIMATE + contentLines,
        bytes: total.bytes + Buffer.byteLength(entry.content, "utf8") + Buffer.byteLength(entry.relativePath, "utf8") + 512,
      };
    },
    { lines: 0, bytes: 0 },
  );
}

function exceedsLimit(metrics: { lines: number; bytes: number }, settings: DirectoryCopyChunkSettings): boolean {
  if (metrics.lines > settings.lineTarget) {
    return true;
  }

  return typeof settings.byteTarget === "number" && metrics.bytes > settings.byteTarget;
}

function splitRelativePath(value: string): string[] {
  return value.split(/[\\/]+/).filter(Boolean);
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

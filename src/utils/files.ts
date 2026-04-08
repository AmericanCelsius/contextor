import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { RecentRunSummary, RunDirectories, RunManifest } from "../core/types";
import { formatRunTimestamp } from "./dates";
import { slugify } from "./text";

export async function ensureDirectory(directoryPath: string): Promise<void> {
  await fs.mkdir(directoryPath, { recursive: true });
}

export function expandHomeDirectory(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }

  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function resolveProjectPath(projectRoot: string, inputPath: string): string {
  const expanded = expandHomeDirectory(inputPath);
  return path.isAbsolute(expanded) ? expanded : path.resolve(projectRoot, expanded);
}

export function normalizeUserPathInput(inputPath: string): string {
  let trimmed = inputPath.trim();

  for (let index = 0; index < 2; index += 1) {
    if (trimmed.length >= 4 && trimmed.startsWith('\\"') && trimmed.endsWith('\\"')) {
      trimmed = trimmed.slice(2, -2).trim();
      continue;
    }

    if (trimmed.length >= 4 && trimmed.startsWith("\\'") && trimmed.endsWith("\\'")) {
      trimmed = trimmed.slice(2, -2).trim();
      continue;
    }

    if (trimmed.length >= 2) {
      const quote = trimmed[0];
      if ((quote === "'" || quote === '"') && trimmed.at(-1) === quote) {
        trimmed = trimmed.slice(1, -1).trim();
      }
    }
  }

  return trimmed;
}

export function resolveUserPath(inputPath: string, baseDirectory = process.cwd()): string {
  const normalized = normalizeUserPathInput(inputPath);
  const expanded = expandHomeDirectory(normalized);
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(baseDirectory, expanded);
}

export async function createRunDirectories(
  outputRoot: string,
  options: { workflow?: string; goal?: string } = {},
): Promise<RunDirectories> {
  const createdAt = new Date().toISOString();
  const timestamp = formatRunTimestamp(createdAt);
  const workflowSlug = slugify(options.workflow || "run").slice(0, 24);
  const goalSlug = slugify(options.goal || "context").slice(0, 40);
  const name = `${timestamp}__${workflowSlug}__${goalSlug}`;
  const runRoot = path.join(outputRoot, "runs", name);
  const directories: RunDirectories = {
    name,
    createdAt,
    root: runRoot,
    logs: path.join(runRoot, "logs"),
    artifacts: path.join(runRoot, "artifacts"),
    manifests: path.join(runRoot, "manifests"),
  };

  await Promise.all([
    ensureDirectory(directories.root),
    ensureDirectory(directories.logs),
    ensureDirectory(directories.artifacts),
    ensureDirectory(directories.manifests),
  ]);
  return directories;
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export function safeArtifactName(value: string): string {
  return slugify(value).slice(0, 80);
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function listRecentRuns(outputRoot: string, limit = 10): Promise<RecentRunSummary[]> {
  const runsRoot = path.join(outputRoot, "runs");
  if (!(await pathExists(runsRoot))) {
    return [];
  }

  const entries = await fs.readdir(runsRoot, { withFileTypes: true });
  const runDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()
    .slice(0, limit);

  const summaries = await Promise.all(
    runDirectories.map(async (directoryName) => {
      const runDir = path.join(runsRoot, directoryName);
      const logsDir = path.join(runDir, "logs");
      const manifestsDir = path.join(runDir, "manifests");
      const artifactsDir = path.join(runDir, "artifacts");

      const [artifactNames, manifestNames, logNames] = await Promise.all([
        listFilesSafe(artifactsDir),
        listFilesSafe(manifestsDir),
        listFilesSafe(logsDir),
      ]);
      const runManifestPath = path.join(manifestsDir, "run.json");
      const runManifest = (await pathExists(runManifestPath)) ? await readJsonFile<RunManifest>(runManifestPath) : undefined;
      const createdAt = runManifest?.createdAt || parseRunDirectoryTimestamp(directoryName) || directoryName;

      return {
        runDir,
        createdAt,
        name: runManifest?.name || directoryName,
        workflow: runManifest?.workflow,
        goal: runManifest?.goal,
        contextMarkdownPath: (await pathExists(path.join(runDir, "context.md"))) ? path.join(runDir, "context.md") : undefined,
        logPath: logNames[0] ? path.join(logsDir, logNames[0]) : undefined,
        artifacts: artifactNames.map((name) => path.join(artifactsDir, name)),
        manifests: manifestNames.map((name) => path.join(manifestsDir, name)),
      } satisfies RecentRunSummary;
    }),
  );

  return summaries;
}

async function listFilesSafe(directoryPath: string): Promise<string[]> {
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
}

export async function readLogTail(logPath: string, maxLines = 120): Promise<string[]> {
  if (!(await pathExists(logPath))) {
    return [];
  }

  const content = await fs.readFile(logPath, "utf8");
  return content.trim().split(/\r?\n/g).slice(-maxLines);
}

export async function writeCsv(filePath: string, rows: Array<Record<string, string | number | boolean>>): Promise<void> {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvEscape(String(row[header] ?? "")))
        .join(","),
    ),
  ];

  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function csvEscape(value: string): string {
  if (/["\n,]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

export function isWithinDirectory(targetPath: string, allowedRoots: string[]): boolean {
  const resolvedTarget = path.resolve(targetPath);
  return allowedRoots.some((allowedRoot) => {
    const resolvedRoot = path.resolve(allowedRoot);
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
  });
}

export interface PathInspectionResult {
  rawValue: string;
  normalizedValue: string;
  resolvedPath: string;
  exists: boolean;
  isDirectory: boolean;
  withinAllowedRoots: boolean;
  message: string;
  matches: string[];
}

export async function inspectPathInput(
  inputPath: string,
  allowedRoots: string[],
  baseDirectory = process.cwd(),
): Promise<PathInspectionResult> {
  const normalizedValue = normalizeUserPathInput(inputPath);
  if (!normalizedValue) {
    return {
      rawValue: inputPath,
      normalizedValue,
      resolvedPath: "",
      exists: false,
      isDirectory: false,
      withinAllowedRoots: false,
      message: "Enter a folder path. Quotes and bracketed names are accepted.",
      matches: [],
    };
  }

  const resolvedPath = resolveUserPath(normalizedValue, baseDirectory);
  const stats = await readPathStats(resolvedPath);
  const matches = await listPathMatches(normalizedValue, baseDirectory);

  if (!stats) {
    return {
      rawValue: inputPath,
      normalizedValue,
      resolvedPath,
      exists: false,
      isDirectory: false,
      withinAllowedRoots: false,
      message: matches.length > 0 ? `No exact match yet. ${matches.length} completion candidate(s) found.` : "Path not found.",
      matches,
    };
  }

  if (!stats.isDirectory) {
    return {
      rawValue: inputPath,
      normalizedValue,
      resolvedPath,
      exists: true,
      isDirectory: false,
      withinAllowedRoots: isWithinDirectory(resolvedPath, allowedRoots),
      message: "Path exists, but it is a file. The folder workflow requires a directory.",
      matches,
    };
  }

  if (!isWithinDirectory(resolvedPath, allowedRoots)) {
    return {
      rawValue: inputPath,
      normalizedValue,
      resolvedPath,
      exists: true,
      isDirectory: true,
      withinAllowedRoots: false,
      message: "Directory exists, but it is outside the configured allowlist.",
      matches,
    };
  }

  return {
    rawValue: inputPath,
    normalizedValue,
    resolvedPath,
    exists: true,
    isDirectory: true,
    withinAllowedRoots: true,
    message: "Directory is available and within the allowlist.",
    matches,
  };
}

export interface PathAutocompleteResult {
  completedValue: string;
  matches: string[];
  message: string;
  changed: boolean;
}

export async function autocompletePathInput(
  inputPath: string,
  baseDirectory = process.cwd(),
): Promise<PathAutocompleteResult> {
  const normalizedValue = normalizeUserPathInput(inputPath);
  if (!normalizedValue) {
    return {
      completedValue: inputPath,
      matches: [],
      message: "Type part of a path before requesting autocomplete.",
      changed: false,
    };
  }

  const expandedValue = expandHomeDirectory(normalizedValue);
  const absoluteValue = path.isAbsolute(expandedValue) ? path.normalize(expandedValue) : path.resolve(baseDirectory, expandedValue);
  const searchDirectory =
    normalizedValue.endsWith(path.sep) || expandedValue.endsWith(path.sep)
      ? absoluteValue
      : path.dirname(absoluteValue);
  const searchPrefix =
    normalizedValue.endsWith(path.sep) || expandedValue.endsWith(path.sep) ? "" : path.basename(absoluteValue);
  const stats = await readPathStats(searchDirectory);

  if (!stats?.isDirectory) {
    return {
      completedValue: inputPath,
      matches: [],
      message: "Autocomplete could not find a parent directory for that path.",
      changed: false,
    };
  }

  const entries = await fs.readdir(searchDirectory, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name.toLowerCase().startsWith(searchPrefix.toLowerCase()))
    .map((entry) => {
      const fullPath = path.join(searchDirectory, entry.name);
      return `${fullPath}${path.sep}`;
    })
    .sort();

  if (matches.length === 0) {
    return {
      completedValue: inputPath,
      matches: [],
      message: "No autocomplete candidates matched the current prefix.",
      changed: false,
    };
  }

  const completedValue = matches.length === 1 ? matches[0]! : longestCommonPrefix(matches);

  return {
    completedValue,
    matches: matches.slice(0, 12),
    message:
      matches.length === 1
        ? "Autocomplete filled the matching path."
        : `Autocomplete narrowed to ${matches.length} candidate(s).`,
    changed: completedValue !== absoluteValue,
  };
}

export async function detectInstalledBrowserExecutable(): Promise<string | undefined> {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function parseRunDirectoryTimestamp(directoryName: string): string | undefined {
  const match = directoryName.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!match) {
    return undefined;
  }

  const restored = `${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`;
  const parsed = new Date(restored);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

async function readPathStats(targetPath: string): Promise<{ isDirectory: boolean } | undefined> {
  try {
    const stats = await fs.stat(targetPath);
    return { isDirectory: stats.isDirectory() };
  } catch {
    return undefined;
  }
}

async function listPathMatches(inputPath: string, baseDirectory: string): Promise<string[]> {
  const normalizedValue = normalizeUserPathInput(inputPath);
  if (!normalizedValue) {
    return [];
  }

  const expandedValue = expandHomeDirectory(normalizedValue);
  const absoluteValue = path.isAbsolute(expandedValue) ? path.normalize(expandedValue) : path.resolve(baseDirectory, expandedValue);
  const searchDirectory =
    normalizedValue.endsWith(path.sep) || expandedValue.endsWith(path.sep)
      ? absoluteValue
      : path.dirname(absoluteValue);
  const searchPrefix =
    normalizedValue.endsWith(path.sep) || expandedValue.endsWith(path.sep) ? "" : path.basename(absoluteValue);
  const stats = await readPathStats(searchDirectory);
  if (!stats?.isDirectory) {
    return [];
  }

  const entries = await fs.readdir(searchDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name.toLowerCase().startsWith(searchPrefix.toLowerCase()))
    .map((entry) => {
      const fullPath = path.join(searchDirectory, entry.name);
      return `${fullPath}${path.sep}`;
    })
    .sort()
    .slice(0, 12);
}

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) {
    return "";
  }

  let prefix = values[0]!;
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }

  return prefix;
}

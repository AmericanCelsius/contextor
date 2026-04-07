import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { RecentRunSummary, RunDirectories } from "../core/types";
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

export async function createRunDirectories(outputRoot: string): Promise<RunDirectories> {
  const runRoot = path.join(outputRoot, "runs", formatRunTimestamp());
  const directories: RunDirectories = {
    root: runRoot,
    logs: path.join(runRoot, "logs"),
    artifacts: path.join(runRoot, "artifacts"),
    manifests: path.join(runRoot, "manifests"),
  };

  await Promise.all(Object.values(directories).map((directory) => ensureDirectory(directory)));
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

      return {
        runDir,
        createdAt: directoryName,
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

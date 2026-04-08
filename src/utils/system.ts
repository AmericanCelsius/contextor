import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { RuntimeEnvironmentInfo } from "../core/types";
import { detectInstalledBrowserExecutable } from "./files";

export function openPathInShell(targetPath: string): void {
  if (process.platform === "darwin") {
    const child = spawn("open", [targetPath], { detached: true, stdio: "ignore" });
    child.unref();
    return;
  }

  const command = process.platform === "win32" ? "explorer.exe" : "xdg-open";
  const child = spawn(command, [targetPath], { detached: true, stdio: "ignore" });
  child.unref();
}

export async function runCommand(command: string, args: string[], options: { cwd?: string } = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed (${command} ${args.join(" ")}): exit code ${code ?? "unknown"}`));
    });
  });
}

export function getNpmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function clearTerminalScreen(): void {
  process.stdout.write("\u001Bc\u001B[2J\u001B[3J\u001B[H");
}

export function clearTerminalViewport(): void {
  process.stdout.write("\u001B[2J\u001B[3J\u001B[H");
}

export async function installTuiRuntimeSink(outputDirectory: string): Promise<() => void> {
  const sinkDirectory = await resolveTuiRuntimeSinkDirectory(outputDirectory);
  const sinkPath = path.join(sinkDirectory, "tui-runtime.log");

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  let queue = Promise.resolve();
  const append = (channel: "warn" | "error" | "stderr", chunks: unknown[]): void => {
    const message = chunks
      .map((chunk) => (typeof chunk === "string" ? chunk : JSON.stringify(chunk)))
      .join(" ")
      .trim();

    if (!message) {
      return;
    }

    queue = queue
      .then(() => fs.appendFile(sinkPath, `[${new Date().toISOString()}] [${channel.toUpperCase()}] ${message}\n`, "utf8"))
      .catch(() => undefined);
  };

  console.warn = (...args: unknown[]) => {
    append("warn", args);
  };

  console.error = (...args: unknown[]) => {
    append("error", args);
  };

  process.stderr.write = ((chunk: unknown, encoding?: unknown, callback?: unknown) => {
    append("stderr", [chunk]);
    if (typeof encoding === "function") {
      encoding();
    }
    if (typeof callback === "function") {
      callback();
    }
    return true;
  }) as typeof process.stderr.write;

  return () => {
    console.warn = originalWarn;
    console.error = originalError;
    process.stderr.write = originalStderrWrite;
  };
}

async function resolveTuiRuntimeSinkDirectory(outputDirectory: string): Promise<string> {
  const preferredPath = path.join(outputDirectory, ".contextor-gui");
  const fallbackPath = path.join(outputDirectory, ".contextor-runtime");

  try {
    const stat = await fs.stat(preferredPath);
    if (stat.isDirectory()) {
      return preferredPath;
    }
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }

    await fs.mkdir(preferredPath, { recursive: true });
    return preferredPath;
  }

  await fs.mkdir(fallbackPath, { recursive: true });
  return fallbackPath;
}

export function getRuntimeEnvironmentInfo(now = new Date()): RuntimeEnvironmentInfo {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  const region = extractRegionCode(locale);
  const city = extractCityFromTimeZone(timeZone);
  const country = region ? getCountryName(region) : inferCountryFromTimeZone(timeZone);
  const approximateLocation = city && country ? `${city}, ${country}` : city || country || undefined;

  return {
    localTimestamp: formatLocalTimestamp(now),
    utcTimestamp: formatUtcTimestamp(now),
    timeZone,
    approximateLocation,
    approximateLocationNote: approximateLocation ? "Approximate location inferred from system time zone/locale." : undefined,
  };
}

export async function launchChromeDebugBrowser(projectRoot: string, attachUrl: string, userDataDir?: string): Promise<string> {
  const port = parseAttachPort(attachUrl);
  const helperScript = path.join(projectRoot, "scripts", "open-chrome-debug.sh");
  if (await fileExists(helperScript)) {
    launchDetached(helperScript, [String(port)], projectRoot);
    return `Launched Chrome debug helper on port ${port}. This opens a separate automation profile.`;
  }

  const executablePath = await detectInstalledBrowserExecutable();
  if (!executablePath) {
    throw new Error("No Chrome/Chromium executable was found. Install Chrome or keep using scripts/open-chrome-debug.sh.");
  }

  const profilePath = userDataDir ? path.resolve(userDataDir) : path.join(os.tmpdir(), "contextor-chrome-profile");
  await fs.mkdir(profilePath, { recursive: true });
  launchDetached(
    executablePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profilePath}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
    projectRoot,
  );
  return `Launched Chrome at ${executablePath} on port ${port}. This opens a separate automation profile.`;
}

export async function getRecommendedFolderPaths(
  allowedDirectories: string[],
  cwd = process.cwd(),
): Promise<string[]> {
  const recommendations = new Set<string>();
  const finderPath = await getFrontmostFinderPath();
  if (finderPath) {
    recommendations.add(path.normalize(finderPath));
  }

  recommendations.add(path.normalize(cwd));
  for (const directory of allowedDirectories) {
    recommendations.add(path.normalize(directory));
  }

  return Array.from(recommendations);
}

async function getFrontmostFinderPath(): Promise<string | undefined> {
  if (process.platform !== "darwin") {
    return undefined;
  }

  try {
    const result = await collectCommandOutput("osascript", [
      "-e",
      'tell application "Finder" to if (count of Finder windows) > 0 then POSIX path of (target of front window as alias)',
    ]);
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

async function collectCommandOutput(command: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "ignore"],
      env: process.env,
    });

    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      reject(new Error(`Command failed (${command} ${args.join(" ")}): exit code ${code ?? "unknown"}`));
    });
  });
}

function launchDetached(command: string, args: string[], cwd?: string): void {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parseAttachPort(attachUrl: string): number {
  try {
    const parsed = new URL(attachUrl);
    return Number(parsed.port || "9222");
  } catch {
    return 9222;
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function formatLocalTimestamp(value: Date): string {
  const year = value.getFullYear();
  const month = padTwo(value.getMonth() + 1);
  const day = padTwo(value.getDate());
  const hours = padTwo(value.getHours());
  const minutes = padTwo(value.getMinutes());
  const seconds = padTwo(value.getSeconds());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timeZone}`;
}

function formatUtcTimestamp(value: Date): string {
  const year = value.getUTCFullYear();
  const month = padTwo(value.getUTCMonth() + 1);
  const day = padTwo(value.getUTCDate());
  const hours = padTwo(value.getUTCHours());
  const minutes = padTwo(value.getUTCMinutes());
  const seconds = padTwo(value.getUTCSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC+00:00`;
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

function extractRegionCode(locale: string): string | undefined {
  const match = locale.match(/[-_]([A-Z]{2})\b/);
  return match?.[1];
}

function getCountryName(region: string): string | undefined {
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(region) || undefined;
  } catch {
    return undefined;
  }
}

function extractCityFromTimeZone(timeZone: string): string | undefined {
  const segments = timeZone.split("/");
  const citySegment = segments.at(-1);
  if (!citySegment || citySegment === "UTC" || citySegment === "GMT") {
    return undefined;
  }

  return citySegment.replace(/_/g, " ");
}

function inferCountryFromTimeZone(timeZone: string): string | undefined {
  const explicit: Record<string, string> = {
    "America/New_York": "United States",
    "America/Chicago": "United States",
    "America/Denver": "United States",
    "America/Los_Angeles": "United States",
    "America/Phoenix": "United States",
    "America/Anchorage": "United States",
    "Pacific/Honolulu": "United States",
    "Europe/London": "United Kingdom",
    "Europe/Paris": "France",
    "Asia/Tokyo": "Japan",
  };
  return explicit[timeZone];
}

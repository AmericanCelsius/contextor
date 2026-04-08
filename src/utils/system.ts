import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

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

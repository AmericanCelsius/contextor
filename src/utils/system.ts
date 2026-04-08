import { spawn } from "node:child_process";
import path from "node:path";

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

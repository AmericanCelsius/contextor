import { spawn } from "node:child_process";

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

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

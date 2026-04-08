import React from "react";
import { render } from "ink";

import { ContextorOrchestrator } from "../core/orchestrator";
import { ContextorTuiApp } from "./app";

interface StartTuiOptions {
  projectRoot: string;
  configPath?: string;
}

export async function startTui(options: StartTuiOptions): Promise<void> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    throw new Error("Contextor TUI requires an interactive terminal.");
  }

  const orchestrator = await ContextorOrchestrator.create(options.projectRoot, options.configPath);
  const restoreTerminal = enterAlternateScreen();
  const instance = render(<ContextorTuiApp orchestrator={orchestrator} />);

  try {
    await instance.waitUntilExit();
  } finally {
    restoreTerminal();
  }
}

function enterAlternateScreen(): () => void {
  process.stdout.write("\u001B[?1049h\u001B[?25l");
  return () => {
    process.stdout.write("\u001B[?25h\u001B[?1049l");
  };
}

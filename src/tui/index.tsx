import React from "react";
import { render } from "ink";

import { ContextorOrchestrator } from "../core/orchestrator";
import { clearTerminalViewport, closeActiveTerminalWindow, installTuiRuntimeSink, requestTerminalFullscreen } from "../utils/system";
import { ContextorTuiApp } from "./app";

interface StartTuiOptions {
  projectRoot: string;
  configPath?: string;
  offline?: boolean;
  fullscreen?: boolean;
}

export async function startTui(options: StartTuiOptions): Promise<void> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    throw new Error("Contextor TUI requires an interactive terminal.");
  }

  const orchestrator = await ContextorOrchestrator.create(options.projectRoot, options.configPath);
  const config = orchestrator.getConfig();
  if (options.fullscreen || config.offlineMode.autoFullscreenTerminal) {
    await requestTerminalFullscreen();
  }

  const restoreRuntimeSink = await installTuiRuntimeSink(orchestrator.getConfig().outputDirectory);
  const restoreTerminal = enterAlternateScreen();
  let closeWindowAfterExit = false;
  const instance = render(
    <ContextorTuiApp
      orchestrator={orchestrator}
      initialOfflineMode={options.offline || config.offlineMode.enabledByDefault}
      onConfirmedQuit={() => {
        closeWindowAfterExit = true;
      }}
    />,
  );

  try {
    await instance.waitUntilExit();
  } finally {
    restoreRuntimeSink();
    restoreTerminal();
    if (closeWindowAfterExit) {
      await closeActiveTerminalWindow();
    }
  }
}

function enterAlternateScreen(): () => void {
  process.stdout.write("\u001B[?1049h\u001B[?25l");
  clearTerminalViewport();
  return () => {
    process.stdout.write("\u001B[?25h\u001B[?1049l");
  };
}

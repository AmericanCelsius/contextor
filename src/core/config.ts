import path from "node:path";

import { ContextorConfig, OfflineModeConfig } from "./types";
import { pathExists, readJsonFile, resolveProjectPath } from "../utils/files";

const DEFAULT_CONFIG_PATH = path.join("config", "contextor.config.json");
type RawContextorConfig = Omit<ContextorConfig, "offlineMode"> & { offlineMode?: Partial<OfflineModeConfig> };

export async function loadConfig(projectRoot: string, configPath?: string): Promise<ContextorConfig> {
  const targetPath = resolveProjectPath(projectRoot, configPath ?? DEFAULT_CONFIG_PATH);
  if (!(await pathExists(targetPath))) {
    throw new Error(`Contextor config not found at ${targetPath}`);
  }

  const rawConfig = await readJsonFile<RawContextorConfig>(targetPath);

  return {
    ...rawConfig,
    allowedDirectories: rawConfig.allowedDirectories.map((directory) => resolveProjectPath(projectRoot, directory)),
    outputDirectory: resolveProjectPath(projectRoot, rawConfig.outputDirectory),
    browser: {
      ...rawConfig.browser,
      userDataDir: resolveProjectPath(projectRoot, rawConfig.browser.userDataDir),
      executablePath: rawConfig.browser.executablePath
        ? resolveProjectPath(projectRoot, rawConfig.browser.executablePath)
        : undefined,
    },
    offlineMode: {
      enabledByDefault: false,
      disableBrowserPanels: true,
      promptToOpenOutputFolder: true,
      autoFullscreenTerminal: false,
      ...rawConfig.offlineMode,
    },
  };
}

import fs from "node:fs/promises";
import path from "node:path";

import { RunLogger } from "../core/logger";
import { ContextCompileInput, ContextCompileResult, RunDirectories } from "../core/types";
import { markdownToPlainText } from "../utils/markdown";
import { writeJsonFile } from "../utils/files";
import { renderContextMarkdown } from "./markdownRenderer";

export class ContextCompiler {
  constructor(private readonly logger: RunLogger) {}

  async compile(runDirectories: RunDirectories, input: ContextCompileInput): Promise<ContextCompileResult> {
    const contextMarkdownPath = path.join(runDirectories.root, "context.md");
    const contextTextPath = path.join(runDirectories.root, "context.txt");
    const manifestPath = path.join(runDirectories.manifests, "sources.json");

    const markdown = renderContextMarkdown(input);
    const text = markdownToPlainText(markdown);
    const artifactPaths = input.browserSources.flatMap((source) => Object.values(source.artifacts));

    await Promise.all([
      fs.writeFile(contextMarkdownPath, markdown, "utf8"),
      fs.writeFile(contextTextPath, `${text}\n`, "utf8"),
      writeJsonFile(manifestPath, {
        generatedAt: new Date().toISOString(),
        workflow: input.workflow,
        goal: input.goal,
        browserSources: input.browserSources,
        fileSources: input.fileSources,
        communicationNotes: input.communicationNotes,
        actionableNotes: input.actionableNotes,
        extras: input.manifestExtras ?? {},
      }),
    ]);

    await this.logger.info("Context compiled", {
      contextMarkdownPath,
      contextTextPath,
      manifestPath,
    });

    return {
      runDir: runDirectories.root,
      contextMarkdownPath,
      contextTextPath,
      manifestPath,
      artifactPaths,
      logPath: this.logger.logPath,
    };
  }
}

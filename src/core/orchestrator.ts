import { BrowserAdapter } from "../adapters/browserAdapter";
import { FilesystemAdapter } from "../adapters/filesystemAdapter";
import { ContextCompiler } from "../compiler/contextCompiler";
import { loadConfig } from "./config";
import { RunLogger } from "./logger";
import {
  CompileFolderOptions,
  CompileGoalOptions,
  CompileTabsOptions,
  ContextorConfig,
  ExportCurrentPageOptions,
  RecentRunSummary,
  SocialAuditOptions,
  WorkflowResult,
} from "./types";
import { createRunDirectories, listRecentRuns } from "../utils/files";
import { runCompileFolderWorkflow } from "../workflows/compileFolderWorkflow";
import { runCompileTabsWorkflow } from "../workflows/compileTabsWorkflow";
import { runExportCurrentPageWorkflow } from "../workflows/exportCurrentPageWorkflow";
import { runInstagramAuditWorkflow } from "../workflows/instagramAuditWorkflow";

export class ContextorOrchestrator {
  private constructor(
    private readonly projectRoot: string,
    private readonly config: ContextorConfig,
  ) {}

  static async create(projectRoot = process.cwd(), configPath?: string): Promise<ContextorOrchestrator> {
    const config = await loadConfig(projectRoot, configPath);
    return new ContextorOrchestrator(projectRoot, config);
  }

  getConfig(): ContextorConfig {
    return this.config;
  }

  async compileTabs(options: CompileTabsOptions): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory);
    const logger = new RunLogger(runDirectories);
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await logger.info("Starting tabs workflow", options);
      return await runCompileTabsWorkflow({
        browserAdapter,
        compiler,
        logger,
        runDirectories,
        options,
      });
    } finally {
      await browserAdapter.dispose();
    }
  }

  async compileFolder(options: CompileFolderOptions): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory);
    const logger = new RunLogger(runDirectories);
    const filesystemAdapter = new FilesystemAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    await logger.info("Starting folder workflow", options);
    return runCompileFolderWorkflow({
      filesystemAdapter,
      compiler,
      logger,
      runDirectories,
      options,
    });
  }

  async exportCurrentPage(options: ExportCurrentPageOptions): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory);
    const logger = new RunLogger(runDirectories);
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await logger.info("Starting page export workflow", options);
      return await runExportCurrentPageWorkflow({
        browserAdapter,
        compiler,
        logger,
        runDirectories,
        options,
      });
    } finally {
      await browserAdapter.dispose();
    }
  }

  async socialAudit(options: SocialAuditOptions): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory);
    const logger = new RunLogger(runDirectories);
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await logger.info("Starting social audit workflow", options);
      return await runInstagramAuditWorkflow({
        browserAdapter,
        compiler,
        logger,
        runDirectories,
        options,
        enabledStrategies: this.config.strategies.enabled,
      });
    } finally {
      await browserAdapter.dispose();
    }
  }

  async compile(options: CompileGoalOptions): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory);
    const logger = new RunLogger(runDirectories);
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const filesystemAdapter = new FilesystemAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await logger.info("Starting generic compile workflow", options);
      const browserSources =
        options.includeTabs || options.allTabs || options.match
          ? await browserAdapter.capturePages(
              {
                all: options.allTabs ?? false,
                current: !options.allTabs && !options.match,
                match: options.match ? new RegExp(options.match, "i") : undefined,
              },
              runDirectories,
              { includePdf: false },
            )
          : [];

      const fileSources = options.folderPath
        ? await filesystemAdapter.compileDirectory(options.folderPath, options.goal, 15)
        : [];

      if (browserSources.length === 0 && fileSources.length === 0) {
        throw new Error("The compile workflow produced no browser or file sources.");
      }

      const result = await compiler.compile(runDirectories, {
        goal: options.goal,
        workflow: "compile",
        browserSources,
        fileSources,
        communicationNotes: browserSources
          .filter((source) => ["gmail", "portal"].includes(source.strategy))
          .map((source) => `${source.strategy} source captured from ${source.title}`),
        actionableNotes: [
          "Use this combined context as the dense starting point for downstream LLM prompting.",
          "Open the per-source artifacts if the summary omitted needed detail.",
        ],
      });

      return {
        ...result,
        workflow: "compile",
        summary: `Compiled ${browserSources.length} browser source(s) and ${fileSources.length} file source(s)`,
      };
    } finally {
      await browserAdapter.dispose();
    }
  }

  async listRecentRuns(limit = 10): Promise<RecentRunSummary[]> {
    return listRecentRuns(this.config.outputDirectory, limit);
  }
}

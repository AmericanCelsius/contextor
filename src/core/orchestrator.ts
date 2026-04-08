import { BrowserAdapter } from "../adapters/browserAdapter";
import { FilesystemAdapter } from "../adapters/filesystemAdapter";
import { ContextCompiler } from "../compiler/contextCompiler";
import { loadConfig } from "./config";
import { NullLogger, RunLogger } from "./logger";
import {
  BrowserConnectionDiagnostics,
  CompileFolderOptions,
  CompileGoalOptions,
  CompileTabsOptions,
  ContextorConfig,
  CopyFolderOptions,
  ExportCurrentPageOptions,
  LatestLogSummary,
  RecentRunSummary,
  RunObserver,
  SocialAuditOptions,
  WorkflowResult,
} from "./types";
import { createRunDirectories, listRecentRuns, readLogTail } from "../utils/files";
import { runCompileFolderWorkflow } from "../workflows/compileFolderWorkflow";
import { runCompileTabsWorkflow } from "../workflows/compileTabsWorkflow";
import { runCopyFolderWorkflow } from "../workflows/copyFolderWorkflow";
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

  getProjectRoot(): string {
    return this.projectRoot;
  }

  async compileTabs(options: CompileTabsOptions, observe?: RunObserver): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory, {
      workflow: "tabs",
      goal: options.goal,
    });
    const logger = new RunLogger(runDirectories, {
      onWrite: (entry) =>
        observe?.({
          kind: "log",
          workflow: "tabs",
          goal: options.goal,
          runDir: runDirectories.root,
          logEntry: entry,
        }),
    });
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await observe?.({
        kind: "run-started",
        workflow: "tabs",
        goal: options.goal,
        runDir: runDirectories.root,
      });
      await logger.info("Starting tabs workflow", options);
      const result = await runCompileTabsWorkflow({
        browserAdapter,
        compiler,
        logger,
        runDirectories,
        options,
      });
      await observe?.({
        kind: "run-completed",
        workflow: "tabs",
        goal: options.goal,
        runDir: runDirectories.root,
        summary: result.summary,
      });
      return result;
    } catch (error) {
      await observe?.({
        kind: "run-failed",
        workflow: "tabs",
        goal: options.goal,
        runDir: runDirectories.root,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await browserAdapter.dispose();
    }
  }

  async compileFolder(options: CompileFolderOptions, observe?: RunObserver, signal?: AbortSignal): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory, {
      workflow: "folder",
      goal: options.goal,
    });
    const logger = new RunLogger(runDirectories, {
      onWrite: (entry) =>
        observe?.({
          kind: "log",
          workflow: "folder",
          goal: options.goal,
          runDir: runDirectories.root,
          logEntry: entry,
        }),
    });
    const filesystemAdapter = new FilesystemAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await observe?.({
        kind: "run-started",
        workflow: "folder",
        goal: options.goal,
        runDir: runDirectories.root,
      });
      await logger.info("Starting folder workflow", options);
      const result = await runCompileFolderWorkflow({
        filesystemAdapter,
        compiler,
        logger,
        runDirectories,
        options,
        observe,
        signal,
      });
      await observe?.({
        kind: "run-completed",
        workflow: "folder",
        goal: options.goal,
        runDir: runDirectories.root,
        summary: result.summary,
      });
      return result;
    } catch (error) {
      await observe?.({
        kind: "run-failed",
        workflow: "folder",
        goal: options.goal,
        runDir: runDirectories.root,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async copyFolder(options: CopyFolderOptions, observe?: RunObserver, signal?: AbortSignal): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory, {
      workflow: "directory-copy",
      goal: options.goal,
    });
    const logger = new RunLogger(runDirectories, {
      onWrite: (entry) =>
        observe?.({
          kind: "log",
          workflow: "directory-copy",
          goal: options.goal,
          runDir: runDirectories.root,
          logEntry: entry,
        }),
    });
    const filesystemAdapter = new FilesystemAdapter(this.config, logger);

    try {
      await observe?.({
        kind: "run-started",
        workflow: "directory-copy",
        goal: options.goal,
        runDir: runDirectories.root,
      });
      await logger.info("Starting directory copy workflow", options);
      const result = await runCopyFolderWorkflow({
        filesystemAdapter,
        logger,
        runDirectories,
        options,
        observe,
        signal,
      });
      await observe?.({
        kind: "run-completed",
        workflow: "directory-copy",
        goal: options.goal,
        runDir: runDirectories.root,
        summary: result.summary,
      });
      return result;
    } catch (error) {
      await observe?.({
        kind: "run-failed",
        workflow: "directory-copy",
        goal: options.goal,
        runDir: runDirectories.root,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async exportCurrentPage(options: ExportCurrentPageOptions, observe?: RunObserver): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory, {
      workflow: "page-export",
      goal: options.goal,
    });
    const logger = new RunLogger(runDirectories, {
      onWrite: (entry) =>
        observe?.({
          kind: "log",
          workflow: "page-export",
          goal: options.goal,
          runDir: runDirectories.root,
          logEntry: entry,
        }),
    });
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await observe?.({
        kind: "run-started",
        workflow: "page-export",
        goal: options.goal,
        runDir: runDirectories.root,
      });
      await logger.info("Starting page export workflow", options);
      const result = await runExportCurrentPageWorkflow({
        browserAdapter,
        compiler,
        logger,
        runDirectories,
        options,
      });
      await observe?.({
        kind: "run-completed",
        workflow: "page-export",
        goal: options.goal,
        runDir: runDirectories.root,
        summary: result.summary,
      });
      return result;
    } catch (error) {
      await observe?.({
        kind: "run-failed",
        workflow: "page-export",
        goal: options.goal,
        runDir: runDirectories.root,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await browserAdapter.dispose();
    }
  }

  async socialAudit(options: SocialAuditOptions, observe?: RunObserver): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory, {
      workflow: "instagram-audit",
      goal: options.goal,
    });
    const logger = new RunLogger(runDirectories, {
      onWrite: (entry) =>
        observe?.({
          kind: "log",
          workflow: "instagram-audit",
          goal: options.goal,
          runDir: runDirectories.root,
          logEntry: entry,
        }),
    });
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await observe?.({
        kind: "run-started",
        workflow: "instagram-audit",
        goal: options.goal,
        runDir: runDirectories.root,
      });
      await logger.info("Starting social audit workflow", options);
      const result = await runInstagramAuditWorkflow({
        browserAdapter,
        compiler,
        logger,
        runDirectories,
        options,
        enabledStrategies: this.config.strategies.enabled,
      });
      await observe?.({
        kind: "run-completed",
        workflow: "instagram-audit",
        goal: options.goal,
        runDir: runDirectories.root,
        summary: result.summary,
      });
      return result;
    } catch (error) {
      await observe?.({
        kind: "run-failed",
        workflow: "instagram-audit",
        goal: options.goal,
        runDir: runDirectories.root,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await browserAdapter.dispose();
    }
  }

  async compile(options: CompileGoalOptions, observe?: RunObserver): Promise<WorkflowResult> {
    const runDirectories = await createRunDirectories(this.config.outputDirectory, {
      workflow: "compile",
      goal: options.goal,
    });
    const logger = new RunLogger(runDirectories, {
      onWrite: (entry) =>
        observe?.({
          kind: "log",
          workflow: "compile",
          goal: options.goal,
          runDir: runDirectories.root,
          logEntry: entry,
        }),
    });
    const browserAdapter = new BrowserAdapter(this.config, logger);
    const filesystemAdapter = new FilesystemAdapter(this.config, logger);
    const compiler = new ContextCompiler(logger);

    try {
      await observe?.({
        kind: "run-started",
        workflow: "compile",
        goal: options.goal,
        runDir: runDirectories.root,
      });
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
              { includePdf: false, requireAttachedSession: true },
            )
          : [];

      const fileSources = options.folderPath
        ? await filesystemAdapter.compileDirectory(options.folderPath, options.goal, undefined, {
            onProgress: (progress) =>
              observe?.({
                kind: "progress",
                workflow: "compile",
                goal: options.goal,
                runDir: runDirectories.root,
                progress: {
                  phase: progress.phase,
                  current: progress.current,
                  total: progress.total,
                  unit: "files",
                  details: progress.details,
                },
              }),
          })
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

      const workflowResult = {
        ...result,
        workflow: "compile",
        summary: `Compiled ${browserSources.length} browser source(s) and ${fileSources.length} file source(s)`,
      };
      await observe?.({
        kind: "run-completed",
        workflow: "compile",
        goal: options.goal,
        runDir: runDirectories.root,
        summary: workflowResult.summary,
      });
      return workflowResult;
    } catch (error) {
      await observe?.({
        kind: "run-failed",
        workflow: "compile",
        goal: options.goal,
        runDir: runDirectories.root,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await browserAdapter.dispose();
    }
  }

  async listRecentRuns(limit = 10): Promise<RecentRunSummary[]> {
    return listRecentRuns(this.config.outputDirectory, limit);
  }

  async getLatestLogSummary(maxLines = 80): Promise<LatestLogSummary> {
    const latestRun = (await this.listRecentRuns(1))[0];
    if (!latestRun?.logPath) {
      return { lines: [] };
    }

    return {
      runDir: latestRun.runDir,
      logPath: latestRun.logPath,
      lines: await readLogTail(latestRun.logPath, maxLines),
    };
  }

  async inspectBrowser(options: { all?: boolean; current?: boolean; match?: string } = { all: true }): Promise<BrowserConnectionDiagnostics> {
    const browserAdapter = new BrowserAdapter(this.config, new NullLogger());

    try {
      return browserAdapter.inspectConnection({
        all: options.all,
        current: options.current,
        match: options.match ? new RegExp(options.match, "i") : undefined,
      });
    } finally {
      await browserAdapter.dispose();
    }
  }
}

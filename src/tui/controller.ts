import path from "node:path";

import { ContextorOrchestrator } from "../core/orchestrator";
import { RunEvent } from "../core/types";
import { launchChromeDebugBrowser, openPathInShell } from "../utils/system";
import { autocompletePathInput, inspectPathInput } from "../utils/files";
import { DashboardSnapshot, TuiActionId, TuiPathStatus, TuiWorkflowExecutionResult } from "./types";

export async function loadDashboardSnapshot(orchestrator: ContextorOrchestrator): Promise<DashboardSnapshot> {
  const [browser, recentRuns, latestLog] = await Promise.all([
    orchestrator.inspectBrowser({ all: true }),
    orchestrator.listRecentRuns(8),
    orchestrator.getLatestLogSummary(20),
  ]);

  return {
    browser,
    recentRuns,
    latestLog,
    config: orchestrator.getConfig(),
  };
}

export async function executeWorkflow(
  orchestrator: ContextorOrchestrator,
  actionId: TuiActionId,
  values: Record<string, string>,
  snapshot: DashboardSnapshot,
  onEvent?: (event: RunEvent) => void | Promise<void>,
  options: { signal?: AbortSignal } = {},
): Promise<TuiWorkflowExecutionResult> {
  const events: RunEvent[] = [];
  const observe = async (event: RunEvent): Promise<void> => {
    events.push(event);
    await onEvent?.(event);
  };

  switch (actionId) {
    case "tabs": {
      const scope = values.scope || "all";
      const result = await orchestrator.compileTabs(
        {
          goal: values.goal || "summarize my current browser context",
          all: scope === "all",
          current: scope === "current",
          match: scope === "match" ? values.match || undefined : undefined,
        },
        observe,
        options.signal,
      );
      return { result, events };
    }
    case "task-console":
      return {
        result: {
          summary: `Prompt console staged (${values.taskScope || "browser"} / ${values.taskMode || "preview"}): ${truncate(values.taskPrompt || "No task prompt provided.", 96)}. Arbitrary connector-backed execution is not enabled in v0.2.2.`,
        },
        events,
      };
    case "folder":
      if (!values.folderPath) {
        throw new Error("Folder Path is required.");
      }
      return {
        result: await orchestrator.compileFolder(
        {
          goal: values.goal || "summarize this project folder",
          folderPath: values.folderPath,
          limit: parseFolderLimit(values.limit),
        },
        observe,
        options.signal,
      ),
        events,
      };
    case "directory-copy":
      if (!values.folderPath) {
        throw new Error("Folder Path is required.");
      }
      return {
        result: await orchestrator.copyFolder(
          {
            goal: values.goal || "create a literal directory copy for downstream review",
            folderPath: values.folderPath,
            format: parseCopyFormat(values.format),
          },
          observe,
          options.signal,
        ),
        events,
      };
    case "page-export":
      return {
        result: await orchestrator.exportCurrentPage(
          {
            goal: values.goal || "export this current page for downstream LLM use",
            current: true,
            mode: values.mode || "linkedin",
          },
          observe,
        ),
        events,
      };
    case "instagram-audit":
      return {
        result: await orchestrator.socialAudit(
          {
            platform: "instagram",
            mode: "non-mutuals",
            dryRun: true,
            allowAccountActions: false,
            confirm: false,
            goal: values.goal || "review likely Instagram non-mutual accounts in read-only mode",
          },
          observe,
        ),
        events,
      };
    case "open-output": {
      const runsRoot = path.join(snapshot.config.outputDirectory, "runs");
      openPathInShell(runsRoot);
      return { result: { summary: `Opened ${runsRoot}` }, events };
    }
    case "launch-browser": {
      const summary = await launchChromeDebugBrowser(
        orchestrator.getProjectRoot(),
        snapshot.config.browser.attachUrl,
        snapshot.config.browser.userDataDir,
      );
      return { result: { summary }, events };
    }
    default:
      return { result: { summary: "No workflow executed." }, events };
  }
}

function parseFolderLimit(value: string | undefined): number | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseCopyFormat(value: string | undefined): "md" | "txt" | "both" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "md" || normalized === "txt") {
    return normalized;
  }

  return "both";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export async function getFolderPathStatus(orchestrator: ContextorOrchestrator, rawValue: string): Promise<TuiPathStatus> {
  const inspection = await inspectPathInput(rawValue, orchestrator.getConfig().allowedDirectories);
  if (!inspection.normalizedValue) {
    return {
      state: "idle",
      message: inspection.message,
      matches: [],
    };
  }

  if (!inspection.exists) {
    return {
      state: inspection.matches.length > 0 ? "warn" : "error",
      message: inspection.message,
      resolvedPath: inspection.resolvedPath,
      matches: inspection.matches,
    };
  }

  if (!inspection.isDirectory || !inspection.withinAllowedRoots) {
    return {
      state: "warn",
      message: inspection.message,
      resolvedPath: inspection.resolvedPath,
      matches: inspection.matches,
    };
  }

  return {
    state: "ok",
    message: inspection.message,
    resolvedPath: inspection.resolvedPath,
    matches: inspection.matches,
  };
}

export async function completeFolderPath(
  orchestrator: ContextorOrchestrator,
  rawValue: string,
): Promise<{ value: string; status: TuiPathStatus }> {
  const completion = await autocompletePathInput(rawValue);
  const status = await getFolderPathStatus(orchestrator, completion.completedValue);

  return {
    value: completion.completedValue,
    status: {
      ...status,
      message: completion.message,
      matches: completion.matches,
    },
  };
}

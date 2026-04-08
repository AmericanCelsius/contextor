import { ContextorOrchestrator } from "../core/orchestrator";
import { RunEvent } from "../core/types";
import { openPathInShell } from "../utils/system";
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
      );
      return { result, events };
    }
    case "folder":
      if (!values.folderPath) {
        throw new Error("Folder Path is required.");
      }
      return {
        result: await orchestrator.compileFolder(
          {
            goal: values.goal || "summarize this project folder",
            folderPath: values.folderPath,
            limit: Number(values.limit || "15"),
          },
          observe,
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
      const latestRun = snapshot.recentRuns[0];
      if (!latestRun) {
        throw new Error("No previous runs exist yet.");
      }

      openPathInShell(latestRun.runDir);
      return { result: { summary: `Opened ${latestRun.runDir}` }, events };
    }
    default:
      return { result: { summary: "No workflow executed." }, events };
  }
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

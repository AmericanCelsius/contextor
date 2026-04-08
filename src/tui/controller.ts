import { ContextorOrchestrator } from "../core/orchestrator";
import { WorkflowResult } from "../core/types";
import { openPathInShell } from "../utils/system";
import { DashboardSnapshot, TuiActionId } from "./types";

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
): Promise<WorkflowResult | { summary: string }> {
  switch (actionId) {
    case "tabs": {
      const scope = values.scope || "all";
      return orchestrator.compileTabs({
        goal: values.goal || "summarize my current browser context",
        all: scope === "all",
        current: scope === "current",
        match: scope === "match" ? values.match || undefined : undefined,
      });
    }
    case "folder":
      if (!values.folderPath) {
        throw new Error("Folder Path is required.");
      }
      return orchestrator.compileFolder({
        goal: values.goal || "summarize this project folder",
        folderPath: values.folderPath,
        limit: Number(values.limit || "15"),
      });
    case "page-export":
      return orchestrator.exportCurrentPage({
        goal: values.goal || "export this current page for downstream LLM use",
        current: true,
        mode: values.mode || "linkedin",
      });
    case "instagram-audit":
      return orchestrator.socialAudit({
        platform: "instagram",
        mode: "non-mutuals",
        dryRun: true,
        allowAccountActions: false,
        confirm: false,
        goal: values.goal || "review likely Instagram non-mutual accounts in read-only mode",
      });
    case "open-output": {
      const latestRun = snapshot.recentRuns[0];
      if (!latestRun) {
        throw new Error("No previous runs exist yet.");
      }

      openPathInShell(latestRun.runDir);
      return { summary: `Opened ${latestRun.runDir}` };
    }
    default:
      return { summary: "No workflow executed." };
  }
}

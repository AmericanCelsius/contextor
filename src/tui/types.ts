import {
  BrowserConnectionDiagnostics,
  ContextorConfig,
  LatestLogSummary,
  RecentRunSummary,
  WorkflowResult,
} from "../core/types";

export type TuiPanelView = "browser" | "runs" | "logs" | "config";

export type TuiActionId =
  | "tabs"
  | "folder"
  | "page-export"
  | "instagram-audit"
  | "open-output"
  | "view-logs"
  | "view-runs"
  | "view-config";

export interface TuiFormOption {
  label: string;
  value: string;
}

export interface TuiFormField {
  id: string;
  label: string;
  type: "text" | "select";
  value: string;
  placeholder?: string;
  options?: TuiFormOption[];
  hint?: string;
}

export interface TuiAction {
  id: TuiActionId;
  label: string;
  shortLabel: string;
  description: string;
  panelView?: TuiPanelView;
  formTitle?: string;
  submitLabel?: string;
  createFields?: () => TuiFormField[];
}

export interface DashboardSnapshot {
  browser: BrowserConnectionDiagnostics;
  recentRuns: RecentRunSummary[];
  latestLog: LatestLogSummary;
  config: ContextorConfig;
}

export interface TuiRunState {
  state: "idle" | "running" | "success" | "error";
  title: string;
  message: string;
  result?: WorkflowResult;
}

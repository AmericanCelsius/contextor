import {
  BrowserConnectionDiagnostics,
  ContextorConfig,
  LatestLogSummary,
  RecentRunSummary,
  RunEvent,
  WorkflowResult,
} from "../core/types";

export type TuiPanelView = "browser" | "runs" | "logs" | "config";

export type TuiActionId =
  | "tabs"
  | "folder"
  | "page-export"
  | "instagram-audit"
  | "launch-browser"
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

export interface TuiFormInsight {
  tone: "neutral" | "ok" | "warn" | "error";
  label: string;
  details: string;
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
  state: "idle" | "running" | "success" | "error" | "aborted";
  title: string;
  message: string;
  result?: WorkflowResult;
  runDir?: string;
  liveLogs?: string[];
  progressLabel?: string;
  eventCount?: number;
  progressCurrent?: number;
  progressTotal?: number;
  progressUnit?: string;
  progressPhase?: string;
  actionId?: TuiActionId;
  abortable?: boolean;
  abortRequested?: boolean;
}

export interface TuiInputTrace {
  label: string;
  action: string;
  at: string;
}

export interface TuiPathStatus {
  state: "idle" | "checking" | "ok" | "warn" | "error";
  message: string;
  resolvedPath?: string;
  matches: string[];
  recommendedPaths?: string[];
}

export interface TuiWorkflowExecutionResult {
  result: WorkflowResult | { summary: string };
  events: RunEvent[];
}

export interface TuiConfirmationState {
  type: "folder-submit" | "abort-run";
  title: string;
  message: string;
  details: string[];
  confirmLabel: string;
  cancelLabel: string;
}

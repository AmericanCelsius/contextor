export type SourceKind = "browser" | "file";

export interface BrowserSource {
  sourceType: "browser";
  id: string;
  title: string;
  url: string;
  text: string;
  markdown: string;
  excerpt: string;
  summary: string;
  keyPoints: string[];
  capturedAt: string;
  strategy: string;
  notes: string[];
  artifacts: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface FileSource {
  sourceType: "file";
  id: string;
  path: string;
  name: string;
  extension: string;
  modifiedTime: string;
  size: number;
  extractedText: string;
  excerpt: string;
  summary: string;
  keyPoints: string[];
  score: number;
  duplicateOf?: string;
}

export interface RunDirectories {
  name: string;
  createdAt: string;
  root: string;
  logs: string;
  artifacts: string;
  manifests: string;
}

export interface RunManifest {
  name: string;
  createdAt: string;
  workflow: string;
  goal: string;
  runDir: string;
}

export interface ContextCompileInput {
  goal: string;
  workflow: string;
  browserSources: BrowserSource[];
  fileSources: FileSource[];
  communicationNotes: string[];
  actionableNotes: string[];
  manifestExtras?: Record<string, unknown>;
}

export interface RuntimeEnvironmentInfo {
  localTimestamp: string;
  utcTimestamp: string;
  timeZone: string;
  approximateLocation?: string;
  approximateLocationNote?: string;
}

export interface ContextCompileResult {
  runDir: string;
  contextMarkdownPath: string;
  contextTextPath: string;
  manifestPath: string;
  artifactPaths: string[];
  logPath: string;
}

export interface WorkflowResult extends ContextCompileResult {
  workflow: string;
  summary: string;
}

export interface LatestLogSummary {
  runDir?: string;
  logPath?: string;
  lines: string[];
}

export interface RunLogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  data?: unknown;
  line: string;
}

export interface RunProgress {
  phase: "indexing" | "extracting" | "compiling" | "complete";
  current: number;
  total: number;
  unit: string;
  details?: string;
}

export interface RunEvent {
  kind: "run-started" | "log" | "progress" | "run-completed" | "run-failed";
  workflow: string;
  goal?: string;
  runDir: string;
  summary?: string;
  error?: string;
  logEntry?: RunLogEntry;
  progress?: RunProgress;
}

export type RunObserver = (event: RunEvent) => void | Promise<void>;

export interface CompileTabsOptions {
  goal: string;
  all?: boolean;
  current?: boolean;
  match?: string;
}

export interface CompileFolderOptions {
  goal: string;
  folderPath: string;
  limit?: number;
}

export interface CopyFolderOptions {
  goal: string;
  folderPath: string;
  format: "md" | "txt" | "both";
  includeHidden?: boolean;
  chunkMarkdown?: boolean;
  chunkLineTarget?: number;
  chunkByteTarget?: number;
}

export interface ExportCurrentPageOptions {
  goal: string;
  mode?: string;
  current?: boolean;
}

export interface CompileGoalOptions {
  goal: string;
  folderPath?: string;
  includeTabs?: boolean;
  allTabs?: boolean;
  match?: string;
}

export interface SocialAuditOptions {
  platform: "instagram";
  mode: "non-mutuals";
  dryRun: boolean;
  allowAccountActions: boolean;
  confirm: boolean;
  goal: string;
}

export interface RecentRunSummary {
  runDir: string;
  createdAt: string;
  name?: string;
  workflow?: string;
  goal?: string;
  contextMarkdownPath?: string;
  logPath?: string;
  artifacts: string[];
  manifests: string[];
}

export interface RedactionConfig {
  enabled: boolean;
  maskEmails: boolean;
  maskTokens: boolean;
  maskCookies: boolean;
  maxExcerptLength: number;
}

export interface OfflineModeConfig {
  enabledByDefault: boolean;
  disableBrowserPanels: boolean;
  promptToOpenOutputFolder: boolean;
  autoFullscreenTerminal: boolean;
}

export interface BrowserConfig {
  attachUrl: string;
  mode: "attach-or-launch" | "attach-only" | "launch-only";
  channel?: string;
  executablePath?: string;
  userDataDir: string;
  maxExpandRounds: number;
  maxScrollPasses: number;
}

export interface SocialAuditConfig {
  maxScrollRounds: number;
  listPageTimeoutMs: number;
  brandKeywords: string[];
  publicFigureKeywords: string[];
  dryRunDefault: boolean;
  requireExplicitAccountActions: boolean;
}

export interface ContextorConfig {
  allowedDirectories: string[];
  outputDirectory: string;
  browser: BrowserConfig;
  strategies: {
    enabled: string[];
  };
  redaction: RedactionConfig;
  offlineMode: OfflineModeConfig;
  socialAudit: SocialAuditConfig;
  safety: {
    readOnlyBrowserByDefault: boolean;
    allowAccountActions: boolean;
    requireConfirmFlag: boolean;
  };
}

export interface PageSelection {
  current?: boolean;
  all?: boolean;
  match?: RegExp;
}

export interface BrowserPageSummary {
  title: string;
  url: string;
  type: string;
}

export interface BrowserConnectionDiagnostics {
  attachUrl: string;
  browserMode: BrowserConfig["mode"];
  endpointReachable: boolean;
  attached: boolean;
  source: "cdp" | "launch" | "unavailable";
  launchedFallback: boolean;
  attachError?: string;
  totalTargets: number;
  usableTargets: number;
  matchingTargets: number;
  ignoredTargets: number;
  selectionLabel: string;
  pages: BrowserPageSummary[];
  detectedProfiles: string[];
  issues: string[];
  suggestions: string[];
}

export interface FileCandidate {
  path: string;
  name: string;
  extension: string;
  modifiedTimeMs: number;
  size: number;
}

export interface DirectoryCopyEntry {
  path: string;
  relativePath: string;
  pathWithinRoot: string;
  name: string;
  extension: string;
  modifiedTime: string;
  size: number;
  content: string;
  contentKind: "text" | "skipped" | "error";
  note?: string;
}

export interface DirectoryCopyBundle {
  rootPath: string;
  rootName: string;
  directories: string[];
  entries: DirectoryCopyEntry[];
  totalFiles: number;
  includedFiles: number;
  skippedFiles: number;
}

export interface InstagramAccount {
  username: string;
  displayName: string;
  rowText: string;
  inferredCategory: "person" | "brand_or_org" | "public_figure";
  isLikelyMutual: boolean;
  sourceList: "followers" | "following" | "unknown";
}

export interface InstagramAuditPageData {
  pageUrl: string;
  ownerHandle: string;
  listType: "followers" | "following" | "unknown";
  accounts: InstagramAccount[];
}

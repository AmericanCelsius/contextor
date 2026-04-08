import path from "node:path";

import React from "react";
import { Box, Newline, Text } from "ink";

import { CONTEXTOR_VERSION } from "../core/version";
import { TUI_THEME } from "./theme";
import {
  DashboardSnapshot,
  TuiAction,
  TuiConfirmationState,
  TuiFormField,
  TuiFormInsight,
  TuiInputTrace,
  TuiPanelView,
  TuiRunState,
} from "./types";

const SCAN_FRAMES = ["[>....]", "[=>...]", "[==>..]", "[===>.]", "[====>]", "[.====]"];
const SIGNAL_FRAMES = ["●○○", "●●○", "●●●", "○●●"];

export function BootSplash({ tick }: { tick: number }): React.JSX.Element {
  const frame = tick % 2;
  const beacon = SCAN_FRAMES[tick % SCAN_FRAMES.length]!;
  const stars = frame === 0 ? "·  *   ·  *" : "*  ·   *  ·";
  const art =
    frame === 0
      ? [
          "   ______            __            __            ",
          "  / ____/___  ____  / /____  _  __/ /_____  _____",
          " / /   / __ \\/ __ \\/ __/ _ \\| |/_/ __/ __ \\/ ___/",
          "/ /___/ /_/ / / / / /_/  __/>  </ /_/ /_/ / /    ",
          "\\____/\\____/_/ /_/\\__/\\___/_/|_|\\__/\\____/_/     ",
        ]
      : [
          "  _____ ____  _   _ _____ _____ _____ _____ ____  ",
          " / ____/ __ \\| \\ | |_   _/ ____|_   _/ ____/ __ \\ ",
          "| |   | |  | |  \\| | | || |      | || |   | |  | |",
          "| |   | |  | | . ` | | || |      | || |   | |  | |",
          "| |___| |__| | |\\  |_| || |____ _| || |___| |__| |",
          " \\_____\\____/|_| \\_|_____\\_____|_____\\_____\\____/ ",
        ];

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
      <Text color={TUI_THEME.accentSoft}>Contextor v{CONTEXTOR_VERSION}</Text>
      <Text color={TUI_THEME.muted}>{stars}</Text>
      <Newline />
      {art.map((line, index) => (
        <Text key={`${index}-${line}`} color={index % 2 === 0 ? TUI_THEME.accent : TUI_THEME.title}>
          {line}
        </Text>
      ))}
      <Newline />
      <Text color={TUI_THEME.text}>Booting mission panels, browser diagnostics, path sensors, and recent runs...</Text>
      <Text color={TUI_THEME.ok}>
        {beacon} Terminal animation layer online. Press Enter, Esc, or Space to skip.
      </Text>
    </Box>
  );
}

export function QuitSplash({ tick }: { tick: number }): React.JSX.Element {
  const frame = SCAN_FRAMES[tick % SCAN_FRAMES.length]!;
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
      <Text color={TUI_THEME.accent}>Contextor shutdown sequence</Text>
      <Newline />
      <Text color={TUI_THEME.ok}>{frame}</Text>
      <Text color={TUI_THEME.text}>Restoring the original terminal screen...</Text>
      <Text color={TUI_THEME.muted}>v{CONTEXTOR_VERSION} baseline preserved. v0.2.1 session closing.</Text>
    </Box>
  );
}

export function ConfirmQuitPane({ tick }: { tick: number }): React.JSX.Element {
  const frame = SCAN_FRAMES[tick % SCAN_FRAMES.length]!;
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
      <Panel title="QUIT CONFIRMATION" active width={72} minHeight={10}>
        <Text color={TUI_THEME.warn}>{frame} Quit the current Contextor session?</Text>
        <Newline />
        <Text color={TUI_THEME.text}>Press Enter or q to confirm.</Text>
        <Text color={TUI_THEME.muted}>Press Esc, n, or c to cancel and return to the dashboard.</Text>
      </Panel>
    </Box>
  );
}

export function ConfirmActionPane(props: { tick: number; confirmation: TuiConfirmationState }): React.JSX.Element {
  const frame = SCAN_FRAMES[props.tick % SCAN_FRAMES.length]!;
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
      <Panel title={props.confirmation.title} active width={92} minHeight={14}>
        <Text color={TUI_THEME.warn}>{frame} {props.confirmation.message}</Text>
        <Newline />
        {props.confirmation.details.map((detail) => (
          <Text key={detail} color={TUI_THEME.text}>
            {truncate(detail, 86)}
          </Text>
        ))}
        <Newline />
        <Text color={TUI_THEME.ok}>Enter: {props.confirmation.confirmLabel}</Text>
        <Text color={TUI_THEME.muted}>Esc / n / c: {props.confirmation.cancelLabel}</Text>
      </Panel>
    </Box>
  );
}

export function Panel(props: {
  title: string;
  width?: number | string;
  minHeight?: number;
  active?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box
      borderStyle="round"
      borderColor={props.active ? TUI_THEME.accent : TUI_THEME.border}
      flexDirection="column"
      paddingX={1}
      paddingY={0}
      width={props.width}
      minHeight={props.minHeight}
    >
      <Text color={props.active ? TUI_THEME.accentSoft : TUI_THEME.title}>{props.title}</Text>
      <Box marginTop={1} flexDirection="column">
        {props.children}
      </Box>
    </Box>
  );
}

export function ActionMenu(props: {
  actions: TuiAction[];
  selectedIndex: number;
  lastInput?: TuiInputTrace | null;
}): React.JSX.Element {
  return (
    <Panel title="COMMAND GRID" active width={34} minHeight={24}>
      {props.actions.map((action, index) => {
        const selected = index === props.selectedIndex;
        return (
          <Box key={action.id} marginBottom={1} flexDirection="column">
            <Text color={selected ? TUI_THEME.accentSoft : TUI_THEME.text} inverse={selected}>
              {selected ? ">" : " "} {index + 1}. {action.label}
            </Text>
            <Text color={TUI_THEME.muted}>   {action.description}</Text>
          </Box>
        );
      })}
      <Newline />
      <Text color={TUI_THEME.title}>Input Echo</Text>
      {props.lastInput ? (
        <Text color={TUI_THEME.muted}>
          {props.lastInput.label} :: {props.lastInput.action}
        </Text>
      ) : (
        <Text color={TUI_THEME.muted}>No command key captured yet.</Text>
      )}
    </Panel>
  );
}

export function WorkspacePane(props: {
  selectedAction: TuiAction;
  runState: TuiRunState;
  tick: number;
}): React.JSX.Element {
  const { runState } = props;
  const progressBar = renderProgressBar(
    runState.progressCurrent,
    runState.progressTotal,
    props.tick,
    runState.state === "success",
  );
  const completionPulse = SIGNAL_FRAMES[props.tick % SIGNAL_FRAMES.length]!;

  return (
    <Panel title="MISSION CONTROL" width="100%" minHeight={24} active>
      <Text color={TUI_THEME.accentSoft}>{props.selectedAction.label}</Text>
      <Text color={TUI_THEME.muted}>{props.selectedAction.description}</Text>
      <Newline />

      {runState.state === "running" ? (
        <Box flexDirection="column">
          <Text color={TUI_THEME.accentSoft}>Progress</Text>
          <Text color={TUI_THEME.ok}>{progressBar}</Text>
          <Text color={TUI_THEME.text}>
            {renderProgressNumbers(runState.progressCurrent, runState.progressTotal, runState.progressUnit)}
          </Text>
          {runState.progressPhase ? (
            <Text color={TUI_THEME.muted}>Phase: {runState.progressPhase}</Text>
          ) : null}
          <Text color={TUI_THEME.text}>{runState.progressLabel || runState.message}</Text>
          {runState.runDir ? <Text color={TUI_THEME.muted}>Run: {runState.runDir}</Text> : null}
          <Text color={TUI_THEME.muted}>
            {runState.abortable
              ? runState.abortRequested
                ? "Abort requested. Contextor will stop after the current file operation completes."
                : "Press x to open the abort prompt while this workflow is running."
              : "Navigation is locked while the workflow is executing."}
          </Text>
          <Newline />
          <Text color={TUI_THEME.accentSoft}>Live Log Tail</Text>
          {(runState.liveLogs ?? []).slice(-8).map((line, index) => (
            <Text key={`${index}-${line}`} color={TUI_THEME.muted}>
              {truncate(line, 94)}
            </Text>
          ))}
        </Box>
      ) : runState.state === "aborted" ? (
        <Box flexDirection="column">
          <Text color={TUI_THEME.warn}>Workflow aborted</Text>
          <Text color={TUI_THEME.text}>{runState.message}</Text>
          {runState.runDir ? <Text color={TUI_THEME.muted}>Run: {runState.runDir}</Text> : null}
          <Newline />
          {(runState.liveLogs ?? []).slice(-6).map((line, index) => (
            <Text key={`${index}-${line}`} color={TUI_THEME.muted}>
              {truncate(line, 94)}
            </Text>
          ))}
        </Box>
      ) : runState.state === "error" ? (
        <Box flexDirection="column">
          <Text color={TUI_THEME.error}>Execution error</Text>
          <Text color={TUI_THEME.text}>{runState.message}</Text>
          {runState.runDir ? <Text color={TUI_THEME.muted}>Run: {runState.runDir}</Text> : null}
          <Newline />
          {(runState.liveLogs ?? []).slice(-6).map((line, index) => (
            <Text key={`${index}-${line}`} color={TUI_THEME.muted}>
              {truncate(line, 94)}
            </Text>
          ))}
        </Box>
      ) : runState.result ? (
        <Box flexDirection="column">
          <Text color={TUI_THEME.ok}>{completionPulse} Workflow complete</Text>
          <Text color={TUI_THEME.ok}>{runState.result.summary}</Text>
          <Text color={TUI_THEME.text}>Run directory: {runState.result.runDir}</Text>
          <Text color={TUI_THEME.text}>Context: {runState.result.contextMarkdownPath}</Text>
          <Text color={TUI_THEME.text}>Manifest: {runState.result.manifestPath}</Text>
          <Newline />
          <Text color={TUI_THEME.accentSoft}>Completion Signal</Text>
          <Text color={TUI_THEME.ok}>{renderProgressBar(runState.progressTotal, runState.progressTotal, props.tick, true)}</Text>
          <Text color={TUI_THEME.muted}>Done. Press another command or o to open the output folder.</Text>
          <Newline />
          <Text color={TUI_THEME.accentSoft}>Artifacts</Text>
          {runState.result.artifactPaths.length === 0 ? (
            <Text color={TUI_THEME.muted}>No extra artifacts for this run.</Text>
          ) : (
            runState.result.artifactPaths.slice(0, 6).map((artifactPath) => (
              <Text key={artifactPath} color={TUI_THEME.muted}>
                - {truncate(artifactPath, 92)}
              </Text>
            ))
          )}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color={TUI_THEME.text}>{runState.message}</Text>
          <Newline />
          <Text color={TUI_THEME.accentSoft}>Operator notes</Text>
          <Text color={TUI_THEME.muted}>- Browser, portal, and social workflows stay read-only by default.</Text>
          <Text color={TUI_THEME.muted}>- Folder path checks and browser attach indicators now animate inside the terminal.</Text>
          <Text color={TUI_THEME.muted}>- Use Enter to launch a form. Use Esc to back out of form mode.</Text>
        </Box>
      )}
    </Panel>
  );
}

export function FormPane(props: {
  title: string;
  submitLabel: string;
  fields: TuiFormField[];
  activeFieldIndex: number;
  activeTextCursorIndex: number;
  insights: TuiFormInsight[];
  suggestions: string[];
  activeSuggestionIndex: number;
  tick: number;
}): React.JSX.Element {
  return (
    <Panel title={props.title} width="100%" minHeight={24} active>
      {props.fields.map((field, index) => {
        const active = index === props.activeFieldIndex;
        const displayValue =
          field.value.length > 0 ? field.value : field.placeholder || "";
        const renderedValue =
          active && field.type === "text"
            ? renderValueWithCursor(displayValue, field.value.length > 0, props.activeTextCursorIndex)
            : displayValue || "";
        return (
          <Box key={field.id} flexDirection="column" marginBottom={1}>
            <Text color={active ? TUI_THEME.accentSoft : TUI_THEME.title}>
              {active ? ">" : " "} {field.label}
            </Text>
            <Text color={field.value.length > 0 ? TUI_THEME.text : TUI_THEME.muted} inverse={active}>
              {renderedValue || " "}
            </Text>
            {field.hint ? <Text color={TUI_THEME.muted}>{field.hint}</Text> : null}
          </Box>
        );
      })}
      <Newline />
      <Text color={TUI_THEME.accentSoft}>Preview / Validation</Text>
      {props.insights.length === 0 ? (
        <Text color={TUI_THEME.muted}>No live preview available for this form yet.</Text>
      ) : (
        props.insights.map((insight, index) => (
          <Box key={`${index}-${insight.label}`} flexDirection="column" marginBottom={1}>
            <Text color={toneColor(insight.tone)}>
              {SCAN_FRAMES[(props.tick + index) % SCAN_FRAMES.length]} {insight.label}
            </Text>
            <Text color={TUI_THEME.muted}>{truncate(insight.details, 96)}</Text>
          </Box>
        ))
      )}
      {props.suggestions.length > 0 ? (
        <>
          <Newline />
          <Text color={TUI_THEME.accentSoft}>Path Suggestions</Text>
          {props.suggestions.slice(0, 8).map((suggestion, index) => (
            <Text key={suggestion} color={index === props.activeSuggestionIndex ? TUI_THEME.accentSoft : TUI_THEME.muted} inverse={index === props.activeSuggestionIndex}>
              {index === props.activeSuggestionIndex ? ">" : " "} {truncate(suggestion, 94)}
            </Text>
          ))}
        </>
      ) : null}
      <Newline />
      <Text color={TUI_THEME.ok}>Enter: {props.submitLabel}</Text>
      <Text color={TUI_THEME.muted}>Tab: accept path suggestion or autocomplete • Shift+Tab: previous field</Text>
      <Text color={TUI_THEME.muted}>Left/Right: move cursor • Up/Down: field or suggestion nav • Ctrl+U: clear field • Esc: back</Text>
    </Panel>
  );
}

export function InfoPane(props: {
  view: TuiPanelView;
  snapshot: DashboardSnapshot | null;
  tick: number;
}): React.JSX.Element {
  const { snapshot } = props;

  if (!snapshot) {
    return (
      <Panel title="INTEL PANEL" width={48} minHeight={24}>
        <Text color={TUI_THEME.muted}>Loading dashboard snapshot...</Text>
      </Panel>
    );
  }

  return (
    <Panel title={`INTEL PANEL :: ${props.view.toUpperCase()}`} width={48} minHeight={24} active>
      {props.view === "browser" ? <BrowserStatus snapshot={snapshot} tick={props.tick} /> : null}
      {props.view === "runs" ? <RecentRuns snapshot={snapshot} /> : null}
      {props.view === "logs" ? <LatestLogs snapshot={snapshot} /> : null}
      {props.view === "config" ? <ConfigSummary snapshot={snapshot} /> : null}
    </Panel>
  );
}

export function FooterBar(props: {
  panelView: TuiPanelView;
  formMode: boolean;
  loading: boolean;
  lastInput?: TuiInputTrace | null;
}): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={TUI_THEME.border} paddingX={1} paddingY={0} marginTop={1} flexDirection="column">
      <Text color={TUI_THEME.muted}>
        ↑↓ move • ←→ / Tab switch • Enter run • Esc back • Ctrl+U clear field • x abort folder run • g launch browser • r refresh • o open output • l logs • u runs • c config • b browser • q confirm quit
      </Text>
      <Text color={TUI_THEME.accentSoft}>
        panel={props.panelView} {props.formMode ? "| form=active" : "| form=idle"} {props.loading ? "| refresh=busy" : ""}
        {props.lastInput ? ` | last=${props.lastInput.label} @ ${props.lastInput.at}` : ""}
      </Text>
    </Box>
  );
}

function BrowserStatus(props: { snapshot: DashboardSnapshot; tick: number }): React.JSX.Element {
  const browser = props.snapshot.browser;
  const signal = SIGNAL_FRAMES[props.tick % SIGNAL_FRAMES.length]!;
  const samplePages = browser.pages.slice(0, 10);

  return (
    <Box flexDirection="column">
      <Text color={browser.endpointReachable ? TUI_THEME.ok : TUI_THEME.error}>
        {signal} {browser.endpointReachable ? "Chrome attach endpoint reachable" : "Chrome attach endpoint unavailable"}
      </Text>
      <Text color={TUI_THEME.text}>Mode: {browser.browserMode}</Text>
      <Text color={TUI_THEME.text}>Attach URL: {browser.attachUrl}</Text>
      <Text color={TUI_THEME.text}>
        Tabs: {browser.usableTargets} usable / {browser.totalTargets} total / {browser.matchingTargets} match current scope
      </Text>
      <Newline />
      {browser.issues.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={TUI_THEME.accentSoft}>Issues</Text>
          {browser.issues.map((issue) => (
            <Text key={issue} color={TUI_THEME.muted}>
              - {truncate(issue, 44)}
            </Text>
          ))}
        </Box>
      ) : null}
      {browser.suggestions.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={TUI_THEME.accentSoft}>Suggestions</Text>
          {browser.suggestions.map((suggestion) => (
            <Text key={suggestion} color={TUI_THEME.muted}>
              - {truncate(suggestion, 44)}
            </Text>
          ))}
        </Box>
      ) : null}
      <Text color={TUI_THEME.accentSoft}>Attached scopes / sample contexts</Text>
      {samplePages.length === 0 ? (
        <Text color={TUI_THEME.muted}>No attached tabs are visible yet.</Text>
      ) : (
        samplePages.map((page, index) => (
          <Box key={`${page.url}-${page.title}`} flexDirection="column" marginBottom={1}>
            <Text color={TUI_THEME.text}>
              {String(index + 1).padStart(2, "0")}. {truncate(page.title || page.url, 44)}
            </Text>
            <Text color={TUI_THEME.muted}>{truncate(page.url, 44)}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}

function RecentRuns({ snapshot }: { snapshot: DashboardSnapshot }): React.JSX.Element {
  if (snapshot.recentRuns.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color={TUI_THEME.muted}>No runs yet.</Text>
        <Text color={TUI_THEME.muted}>Launch a workflow from the command grid to populate this panel.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {snapshot.recentRuns.slice(0, 7).map((run) => (
        <Box key={run.runDir} flexDirection="column" marginBottom={1}>
          <Text color={TUI_THEME.ok}>{run.workflow || "run"} :: {truncate(run.name || path.basename(run.runDir), 36)}</Text>
          <Text color={TUI_THEME.muted}>{run.createdAt}</Text>
          {run.goal ? <Text color={TUI_THEME.muted}>{truncate(run.goal, 44)}</Text> : null}
        </Box>
      ))}
    </Box>
  );
}

function LatestLogs({ snapshot }: { snapshot: DashboardSnapshot }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text color={TUI_THEME.ok}>{snapshot.latestLog.logPath || "No log file yet."}</Text>
      <Newline />
      {snapshot.latestLog.lines.length === 0 ? (
        <Text color={TUI_THEME.muted}>No log lines available.</Text>
      ) : (
        snapshot.latestLog.lines.slice(-12).map((line, index) => (
          <Text key={`${index}-${line}`} color={TUI_THEME.muted}>
            {truncate(line, 44)}
          </Text>
        ))
      )}
    </Box>
  );
}

function ConfigSummary({ snapshot }: { snapshot: DashboardSnapshot }): React.JSX.Element {
  const config = snapshot.config;
  return (
    <Box flexDirection="column">
      <Text color={TUI_THEME.ok}>Output: {config.outputDirectory}</Text>
      <Text color={TUI_THEME.text}>Allowed roots</Text>
      {config.allowedDirectories.slice(0, 5).map((directory) => (
        <Text key={directory} color={TUI_THEME.muted}>
          - {truncate(directory, 44)}
        </Text>
      ))}
      <Newline />
      <Text color={TUI_THEME.text}>Browser</Text>
      <Text color={TUI_THEME.muted}>mode={config.browser.mode}</Text>
      <Text color={TUI_THEME.muted}>attach={config.browser.attachUrl}</Text>
      <Text color={TUI_THEME.muted}>profile={truncate(config.browser.userDataDir, 42)}</Text>
      <Newline />
      <Text color={TUI_THEME.text}>Safety</Text>
      <Text color={TUI_THEME.muted}>readOnlyBrowserByDefault={String(config.safety.readOnlyBrowserByDefault)}</Text>
      <Text color={TUI_THEME.muted}>allowAccountActions={String(config.safety.allowAccountActions)}</Text>
      <Text color={TUI_THEME.muted}>dryRunDefault={String(config.socialAudit.dryRunDefault)}</Text>
    </Box>
  );
}

function renderProgressBar(
  current: number | undefined,
  total: number | undefined,
  tick: number,
  complete = false,
): string {
  const width = 18;
  const ratio = total && total > 0 ? Math.min(1, (current ?? 0) / total) : 0;
  const baseProgress = complete ? 1 : ratio;
  const filled = Math.round(width * baseProgress);
  const pulseIndex = complete ? width - 1 : tick % width;
  const cells = Array.from({ length: width }, (_, index) => {
    if (index < filled) {
      return index === pulseIndex ? "▓" : "█";
    }

    return index === pulseIndex ? "▒" : "░";
  });
  return `[${cells.join("")}] ${Math.round(baseProgress * 100)}%`;
}

function renderProgressNumbers(current: number | undefined, total: number | undefined, unit = "items"): string {
  if (!total || total <= 0) {
    return `0/0 (0%) ${unit}`;
  }

  const safeCurrent = Math.min(current ?? 0, total);
  return `${safeCurrent}/${total} (${Math.round((safeCurrent / total) * 100)}%) ${unit}`;
}

function toneColor(tone: TuiFormInsight["tone"]): string {
  switch (tone) {
    case "ok":
      return TUI_THEME.ok;
    case "warn":
      return TUI_THEME.warn;
    case "error":
      return TUI_THEME.error;
    default:
      return TUI_THEME.accentSoft;
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function renderValueWithCursor(value: string, hasRealValue: boolean, cursorIndex: number): string {
  const source = value || " ";
  const safeIndex = Math.max(0, Math.min(cursorIndex, source.length));
  const left = source.slice(0, safeIndex);
  const cursor = safeIndex < source.length ? source[safeIndex] : " ";
  const right = source.slice(safeIndex + (safeIndex < source.length ? 1 : 0));
  return `${left}${hasRealValue ? "" : ""}▏${cursor}${right}`;
}

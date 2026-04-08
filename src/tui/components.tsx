import path from "node:path";

import React from "react";
import { Box, Newline, Text } from "ink";

import { CONTEXTOR_VERSION } from "../core/version";
import { TUI_THEME } from "./theme";
import { DashboardSnapshot, TuiAction, TuiFormField, TuiPanelView, TuiRunState } from "./types";

export function BootSplash({ frameIndex }: { frameIndex: number }): React.JSX.Element {
  const frames = [
    [
      "   ▄████▄   ▒█████   ███▄    █ ▄▄▄█████▓▓█████ ▒██   ██▒▄▄▄█████▓ ▒█████   ██▀███  ",
      "  ▒██▀ ▀█  ▒██▒  ██▒ ██ ▀█   █ ▓  ██▒ ▓▒▓█   ▀ ▒▒ █ █ ▒░▓  ██▒ ▓▒▒██▒  ██▒▓██ ▒ ██▒",
      "  ▒▓█    ▄ ▒██░  ██▒▓██  ▀█ ██▒▒ ▓██░ ▒░▒███   ░░  █   ░▒ ▓██░ ▒░▒██░  ██▒▓██ ░▄█ ▒",
      "  ▒▓▓▄ ▄██▒▒██   ██░▓██▒  ▐▌██▒░ ▓██▓ ░ ▒▓█  ▄  ░ █ █ ▒ ░ ▓██▓ ░ ▒██   ██░▒██▀▀█▄  ",
      "  ▒ ▓███▀ ░░ ████▓▒░▒██░   ▓██░  ▒██▒ ░ ░▒████▒▒██▒ ▒██▒  ▒██▒ ░ ░ ████▓▒░░██▓ ▒██▒",
    ],
    [
      "   ______            __            __            ",
      "  / ____/___  ____  / /____  _  __/ /_____  _____",
      " / /   / __ \\/ __ \\/ __/ _ \\| |/_/ __/ __ \\/ ___/",
      "/ /___/ /_/ / / / / /_/  __/>  </ /_/ /_/ / /    ",
      "\\____/\\____/_/ /_/\\__/\\___/_/|_|\\__/\\____/_/     ",
    ],
  ];

  const frame = frames[frameIndex % frames.length]!;

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
      <Text color={TUI_THEME.accentSoft}>Contextor v{CONTEXTOR_VERSION}</Text>
      <Newline />
      {frame.map((line, index) => (
        <Text key={`${index}-${line}`} color={index % 2 === 0 ? TUI_THEME.accent : TUI_THEME.title}>
          {line}
        </Text>
      ))}
      <Newline />
      <Text color={TUI_THEME.text}>Retro-futurist context console booting...</Text>
      <Text color={TUI_THEME.muted}>Press Enter to skip splash.</Text>
      <Newline />
      <Text color={TUI_THEME.ok}>[■□□] Loading panels, browser diagnostics, recent runs, and logs.</Text>
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
      <Box justifyContent="space-between">
        <Text color={props.active ? TUI_THEME.accentSoft : TUI_THEME.title}>{props.title}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {props.children}
      </Box>
    </Box>
  );
}

export function ActionMenu(props: {
  actions: TuiAction[];
  selectedIndex: number;
}): React.JSX.Element {
  return (
    <Panel title="COMMAND GRID" active width={34} minHeight={20}>
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
    </Panel>
  );
}

export function WorkspacePane(props: {
  selectedAction: TuiAction;
  runState: TuiRunState;
  spinnerFrame: string;
}): React.JSX.Element {
  const { runState } = props;

  return (
    <Panel title="MISSION CONTROL" width="100%" minHeight={20} active>
      <Text color={TUI_THEME.accentSoft}>{props.selectedAction.label}</Text>
      <Text color={TUI_THEME.muted}>{props.selectedAction.description}</Text>
      <Newline />

      {runState.state === "running" ? (
        <Box flexDirection="column">
          <Text color={TUI_THEME.ok}>
            {props.spinnerFrame} Workflow in progress
          </Text>
          <Text color={TUI_THEME.text}>{runState.message}</Text>
          <Text color={TUI_THEME.muted}>Input is locked while the workflow is running.</Text>
        </Box>
      ) : runState.state === "error" ? (
        <Box flexDirection="column">
          <Text color={TUI_THEME.error}>Execution error</Text>
          <Text color={TUI_THEME.text}>{runState.message}</Text>
          <Newline />
          <Text color={TUI_THEME.muted}>Hint: use the Browser panel to verify Chrome attach status before retrying.</Text>
        </Box>
      ) : runState.result ? (
        <Box flexDirection="column">
          <Text color={TUI_THEME.ok}>{runState.result.summary}</Text>
          <Text color={TUI_THEME.text}>Run directory: {runState.result.runDir}</Text>
          <Text color={TUI_THEME.text}>Context: {runState.result.contextMarkdownPath}</Text>
          <Text color={TUI_THEME.text}>Manifest: {runState.result.manifestPath}</Text>
          <Newline />
          <Text color={TUI_THEME.accentSoft}>Artifacts</Text>
          {runState.result.artifactPaths.length === 0 ? (
            <Text color={TUI_THEME.muted}>No extra artifacts for this run.</Text>
          ) : (
            runState.result.artifactPaths.slice(0, 6).map((artifactPath) => (
              <Text key={artifactPath} color={TUI_THEME.muted}>
                - {artifactPath}
              </Text>
            ))
          )}
          <Newline />
          <Text color={TUI_THEME.muted}>Press o to open the latest output folder.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color={TUI_THEME.text}>{runState.message}</Text>
          <Newline />
          <Text color={TUI_THEME.accentSoft}>Operator notes</Text>
          <Text color={TUI_THEME.muted}>- Contextor is read-only by default for browser, portal, and social workflows.</Text>
          <Text color={TUI_THEME.muted}>- Use Enter to launch a form-backed action, or arrow keys to inspect other panels.</Text>
          <Text color={TUI_THEME.muted}>- The TUI is the primary GUI surface in v{CONTEXTOR_VERSION}.</Text>
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
}): React.JSX.Element {
  return (
    <Panel title={props.title} width="100%" minHeight={20} active>
      {props.fields.map((field, index) => {
        const active = index === props.activeFieldIndex;
        const displayValue = field.value.length > 0 ? field.value : field.placeholder || "";
        return (
          <Box key={field.id} flexDirection="column" marginBottom={1}>
            <Text color={active ? TUI_THEME.accentSoft : TUI_THEME.title}>
              {active ? ">" : " "} {field.label}
            </Text>
            <Text color={field.value.length > 0 ? TUI_THEME.text : TUI_THEME.muted} inverse={active}>
              {displayValue || " "}
            </Text>
            {field.hint ? <Text color={TUI_THEME.muted}>{field.hint}</Text> : null}
          </Box>
        );
      })}
      <Newline />
      <Text color={TUI_THEME.ok}>Enter: {props.submitLabel}</Text>
      <Text color={TUI_THEME.muted}>Tab / Shift+Tab: move field • Left/Right: change select values • Esc: cancel</Text>
    </Panel>
  );
}

export function InfoPane(props: {
  view: TuiPanelView;
  snapshot: DashboardSnapshot | null;
}): React.JSX.Element {
  const { snapshot } = props;

  if (!snapshot) {
    return (
      <Panel title="INTEL PANEL" width={42} minHeight={20}>
        <Text color={TUI_THEME.muted}>Loading dashboard snapshot...</Text>
      </Panel>
    );
  }

  return (
    <Panel title={`INTEL PANEL :: ${props.view.toUpperCase()}`} width={42} minHeight={20} active>
      {props.view === "browser" ? <BrowserStatus snapshot={snapshot} /> : null}
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
}): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={TUI_THEME.border} paddingX={1} paddingY={0} marginTop={1}>
      <Text color={TUI_THEME.muted}>
        ↑↓ select • Enter run • Tab switch • r refresh • o open latest output • l logs • u runs • c config • b browser • q quit
      </Text>
      <Text color={TUI_THEME.accentSoft}>
        {" "}
        | panel={props.panelView} {props.formMode ? "| form=active" : "| form=idle"} {props.loading ? "| refresh=busy" : ""}
      </Text>
    </Box>
  );
}

function BrowserStatus({ snapshot }: { snapshot: DashboardSnapshot }): React.JSX.Element {
  const browser = snapshot.browser;
  return (
    <Box flexDirection="column">
      <Text color={browser.endpointReachable ? TUI_THEME.ok : TUI_THEME.error}>
        {browser.endpointReachable ? "Attach endpoint reachable" : "Attach endpoint unavailable"}
      </Text>
      <Text color={TUI_THEME.text}>Mode: {browser.browserMode}</Text>
      <Text color={TUI_THEME.text}>Attach URL: {browser.attachUrl}</Text>
      <Text color={TUI_THEME.text}>
        Tabs: {browser.usableTargets} usable / {browser.totalTargets} total
      </Text>
      <Text color={TUI_THEME.text}>
        Selection view: {browser.selectionLabel} • matches: {browser.matchingTargets}
      </Text>
      <Newline />
      {browser.issues.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={TUI_THEME.accentSoft}>Issues</Text>
          {browser.issues.map((issue) => (
            <Text key={issue} color={TUI_THEME.muted}>
              - {issue}
            </Text>
          ))}
        </Box>
      ) : null}
      <Text color={TUI_THEME.accentSoft}>Sample tabs</Text>
      {browser.pages.length === 0 ? (
        <Text color={TUI_THEME.muted}>No attached tab titles available.</Text>
      ) : (
        browser.pages.map((page) => (
          <Text key={`${page.url}-${page.title}`} color={TUI_THEME.muted}>
            - {truncate(page.title || page.url, 34)}
          </Text>
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
          <Text color={TUI_THEME.ok}>{run.createdAt}</Text>
          <Text color={TUI_THEME.muted}>{truncate(run.runDir, 36)}</Text>
          <Text color={TUI_THEME.muted}>
            artifacts={run.artifacts.length} manifests={run.manifests.length}
          </Text>
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
            {truncate(line, 38)}
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
      {config.allowedDirectories.slice(0, 4).map((directory) => (
        <Text key={directory} color={TUI_THEME.muted}>
          - {truncate(directory, 36)}
        </Text>
      ))}
      <Newline />
      <Text color={TUI_THEME.text}>Browser</Text>
      <Text color={TUI_THEME.muted}>mode={config.browser.mode}</Text>
      <Text color={TUI_THEME.muted}>attach={config.browser.attachUrl}</Text>
      <Text color={TUI_THEME.muted}>profile={truncate(config.browser.userDataDir, 34)}</Text>
      <Newline />
      <Text color={TUI_THEME.text}>Safety</Text>
      <Text color={TUI_THEME.muted}>readOnlyBrowserByDefault={String(config.safety.readOnlyBrowserByDefault)}</Text>
      <Text color={TUI_THEME.muted}>allowAccountActions={String(config.safety.allowAccountActions)}</Text>
      <Text color={TUI_THEME.muted}>dryRunDefault={String(config.socialAudit.dryRunDefault)}</Text>
    </Box>
  );
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

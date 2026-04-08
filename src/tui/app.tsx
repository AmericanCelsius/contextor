import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";

import { ContextorOrchestrator } from "../core/orchestrator";
import { CONTEXTOR_VERSION } from "../core/version";
import { TUI_ACTIONS } from "./actions";
import { loadDashboardSnapshot, executeWorkflow } from "./controller";
import { ActionMenu, BootSplash, FooterBar, FormPane, InfoPane, WorkspacePane } from "./components";
import { TUI_THEME } from "./theme";
import { DashboardSnapshot, TuiAction, TuiFormField, TuiPanelView, TuiRunState } from "./types";

const PANEL_ORDER: TuiPanelView[] = ["browser", "runs", "logs", "config"];
const SPINNER_FRAMES = ["[■□□]", "[■■□]", "[■■■]", "[□■■]"];

export function ContextorTuiApp(props: { orchestrator: ContextorOrchestrator }): React.JSX.Element {
  const { exit } = useApp();
  const terminalWidth = process.stdout.columns ?? 120;
  const compactLayout = terminalWidth < 150;

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [activePanelView, setActivePanelView] = useState<TuiPanelView>("browser");
  const [bootVisible, setBootVisible] = useState(true);
  const [bootFrameIndex, setBootFrameIndex] = useState(0);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const [activeFormAction, setActiveFormAction] = useState<TuiAction | null>(null);
  const [formFields, setFormFields] = useState<TuiFormField[]>([]);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [runState, setRunState] = useState<TuiRunState>({
    state: "idle",
    title: "Ready",
    message: "Choose a workflow from the command grid to launch Contextor inside the terminal.",
  });

  const selectedAction = TUI_ACTIONS[selectedActionIndex]!;

  useEffect(() => {
    const frameTimer = setTimeout(() => setBootFrameIndex(1), 280);
    const hideTimer = setTimeout(() => setBootVisible(false), 950);
    return () => {
      clearTimeout(frameTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    void refreshDashboard();
    const interval = setInterval(() => {
      void refreshDashboard();
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (runState.state !== "running") {
      return;
    }

    const interval = setInterval(() => {
      setSpinnerIndex((current) => (current + 1) % SPINNER_FRAMES.length);
    }, 120);
    return () => clearInterval(interval);
  }, [runState.state]);

  useInput((input, key) => {
    if (bootVisible) {
      if (key.return || key.escape || input === " ") {
        setBootVisible(false);
      }
      return;
    }

    if (runState.state === "running") {
      return;
    }

    if (activeFormAction) {
      handleFormInput(input, key);
      return;
    }

    if (input === "q" || key.escape) {
      exit();
      return;
    }

    if (key.upArrow) {
      const nextIndex = selectedActionIndex === 0 ? TUI_ACTIONS.length - 1 : selectedActionIndex - 1;
      setSelectedActionIndex(nextIndex);
      setRunState({
        state: "idle",
        title: "Ready",
        message: TUI_ACTIONS[nextIndex]!.description,
      });
      return;
    }

    if (key.downArrow) {
      const nextIndex = selectedActionIndex === TUI_ACTIONS.length - 1 ? 0 : selectedActionIndex + 1;
      setSelectedActionIndex(nextIndex);
      setRunState({
        state: "idle",
        title: "Ready",
        message: TUI_ACTIONS[nextIndex]!.description,
      });
      return;
    }

    if (key.rightArrow || input === "tab") {
      setActivePanelView(nextPanelView(activePanelView, 1));
      return;
    }

    if (key.leftArrow) {
      setActivePanelView(nextPanelView(activePanelView, -1));
      return;
    }

    if (input === "r") {
      void refreshDashboard();
      return;
    }

    if (input === "l") {
      setActivePanelView("logs");
      return;
    }

    if (input === "u") {
      setActivePanelView("runs");
      return;
    }

    if (input === "c") {
      setActivePanelView("config");
      return;
    }

    if (input === "b") {
      setActivePanelView("browser");
      return;
    }

    if (input === "o") {
      void handleAction(findAction("open-output"));
      return;
    }

    if (key.return) {
      void handleAction(selectedAction);
    }
  });

  async function refreshDashboard(): Promise<void> {
    setLoadingSnapshot(true);
    try {
      const nextSnapshot = await loadDashboardSnapshot(props.orchestrator);
      setSnapshot(nextSnapshot);
    } catch (error) {
      setRunState({
        state: "error",
        title: "Dashboard refresh failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function handleAction(action: TuiAction): Promise<void> {
    if (action.createFields) {
      setActiveFormAction(action);
      setFormFields(action.createFields());
      setActiveFieldIndex(0);
      setRunState({
        state: "idle",
        title: action.label,
        message: action.description,
      });
      return;
    }

    if (action.panelView) {
      setActivePanelView(action.panelView);
      setRunState({
        state: "idle",
        title: action.label,
        message: `Focused the ${action.panelView} panel.`,
      });
      return;
    }

    if (!snapshot) {
      return;
    }

    setRunState({
      state: "running",
      title: action.label,
      message: action.description,
    });

    try {
      const result = await executeWorkflow(props.orchestrator, action.id, {}, snapshot);
      await refreshDashboard();
      if ("workflow" in result) {
        setRunState({
          state: "success",
          title: action.label,
          message: result.summary,
          result,
        });
      } else {
        setRunState({
          state: "idle",
          title: action.label,
          message: result.summary,
        });
      }
    } catch (error) {
      setRunState({
        state: "error",
        title: action.label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function handleFormInput(
    input: string,
    key: {
      return?: boolean;
      escape?: boolean;
      tab?: boolean;
      shift?: boolean;
      upArrow?: boolean;
      downArrow?: boolean;
      leftArrow?: boolean;
      rightArrow?: boolean;
      backspace?: boolean;
      delete?: boolean;
      ctrl?: boolean;
      meta?: boolean;
    },
  ): void {
    const currentField = formFields[activeFieldIndex];
    if (!currentField || !activeFormAction) {
      return;
    }

    if (key.escape) {
      setActiveFormAction(null);
      setFormFields([]);
      setActiveFieldIndex(0);
      return;
    }

    if (key.tab) {
      const direction = key.shift ? -1 : 1;
      setActiveFieldIndex((current) => wrapIndex(current + direction, formFields.length));
      return;
    }

    if (key.upArrow && currentField.type === "text") {
      setActiveFieldIndex((current) => wrapIndex(current - 1, formFields.length));
      return;
    }

    if (key.downArrow && currentField.type === "text") {
      setActiveFieldIndex((current) => wrapIndex(current + 1, formFields.length));
      return;
    }

    if (currentField.type === "select" && (key.leftArrow || key.rightArrow || key.upArrow || key.downArrow)) {
      const options = currentField.options ?? [];
      if (options.length === 0) {
        return;
      }

      const currentIndex = options.findIndex((option) => option.value === currentField.value);
      const delta = key.leftArrow || key.upArrow ? -1 : 1;
      const nextIndex = wrapIndex((currentIndex === -1 ? 0 : currentIndex) + delta, options.length);
      updateField(currentField.id, options[nextIndex]!.value);
      return;
    }

    if (key.return) {
      void submitForm();
      return;
    }

    if (currentField.type !== "text") {
      return;
    }

    if (key.backspace || key.delete) {
      updateField(currentField.id, currentField.value.slice(0, -1));
      return;
    }

    if ((key.ctrl || key.meta) && input.length === 1) {
      return;
    }

    if (input.length > 0 && input !== "\t" && input !== "\r" && input !== "\n") {
      updateField(currentField.id, `${currentField.value}${input}`);
    }
  }

  function updateField(fieldId: string, nextValue: string): void {
    setFormFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, value: nextValue } : field)),
    );
  }

  async function submitForm(): Promise<void> {
    if (!activeFormAction || !snapshot) {
      return;
    }

    const values = Object.fromEntries(formFields.map((field) => [field.id, field.value]));
    setRunState({
      state: "running",
      title: activeFormAction.label,
      message: `Running ${activeFormAction.label.toLowerCase()}...`,
    });

    try {
      const result = await executeWorkflow(props.orchestrator, activeFormAction.id, values, snapshot);
      setActiveFormAction(null);
      setFormFields([]);
      setActiveFieldIndex(0);
      await refreshDashboard();

      if ("workflow" in result) {
        setRunState({
          state: "success",
          title: activeFormAction.label,
          message: result.summary,
          result,
        });
      } else {
        setRunState({
          state: "idle",
          title: activeFormAction.label,
          message: result.summary,
        });
      }
    } catch (error) {
      setRunState({
        state: "error",
        title: activeFormAction.label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (bootVisible) {
    return <BootSplash frameIndex={bootFrameIndex} />;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header snapshot={snapshot} />
      <Box marginTop={1} flexDirection={compactLayout ? "column" : "row"}>
        <ActionMenu actions={TUI_ACTIONS} selectedIndex={selectedActionIndex} />
        <Box marginLeft={compactLayout ? 0 : 1} marginTop={compactLayout ? 1 : 0} flexGrow={1} flexDirection="column">
          {activeFormAction ? (
            <FormPane
              title={activeFormAction.formTitle || activeFormAction.label}
              submitLabel={activeFormAction.submitLabel || "Submit"}
              fields={formFields}
              activeFieldIndex={activeFieldIndex}
            />
          ) : (
            <WorkspacePane
              selectedAction={selectedAction}
              runState={runState}
              spinnerFrame={SPINNER_FRAMES[spinnerIndex]!}
            />
          )}
        </Box>
        <Box marginLeft={compactLayout ? 0 : 1} marginTop={compactLayout ? 1 : 0}>
          <InfoPane view={activePanelView} snapshot={snapshot} />
        </Box>
      </Box>
      <FooterBar panelView={activePanelView} formMode={Boolean(activeFormAction)} loading={loadingSnapshot} />
    </Box>
  );
}

function Header({ snapshot }: { snapshot: DashboardSnapshot | null }): React.JSX.Element {
  const browserText = snapshot
    ? snapshot.browser.endpointReachable
      ? `browser online • ${snapshot.browser.usableTargets} tab(s)`
      : "browser attach offline"
    : "loading browser status";

  return (
    <Box borderStyle="double" borderColor={TUI_THEME.border} paddingX={1} paddingY={0} justifyContent="space-between">
      <Box flexDirection="column">
        <Text color={TUI_THEME.accent}>Contextor v{CONTEXTOR_VERSION}</Text>
        <Text color={TUI_THEME.text}>Terminal-contained local context console</Text>
      </Box>
      <Box flexDirection="column" alignItems="flex-end">
        <Text color={snapshot?.browser.endpointReachable ? TUI_THEME.ok : TUI_THEME.warn}>{browserText}</Text>
        <Text color={TUI_THEME.muted}>Ink-first TUI • browser web dashboard deprecated</Text>
      </Box>
    </Box>
  );
}

function nextPanelView(current: TuiPanelView, delta: number): TuiPanelView {
  const currentIndex = PANEL_ORDER.indexOf(current);
  return PANEL_ORDER[wrapIndex(currentIndex + delta, PANEL_ORDER.length)]!;
}

function wrapIndex(nextIndex: number, length: number): number {
  if (length === 0) {
    return 0;
  }

  return (nextIndex + length) % length;
}

function findAction(id: TuiAction["id"]): TuiAction {
  return TUI_ACTIONS.find((action) => action.id === id)!;
}

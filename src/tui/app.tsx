import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";

import { ContextorOrchestrator } from "../core/orchestrator";
import { CONTEXTOR_VERSION } from "../core/version";
import { BrowserPageSummary, RunEvent, WorkflowResult } from "../core/types";
import { clearTerminalViewport, getRecommendedFolderPaths, getRuntimeEnvironmentInfo } from "../utils/system";
import { TUI_ACTIONS } from "./actions";
import { completeFolderPath, executeWorkflow, getFolderPathStatus, loadDashboardSnapshot } from "./controller";
import { ActionMenu, BootSplash, ConfirmActionPane, ConfirmQuitPane, CornerBadge, FooterBar, FormPane, InfoPane, QuitSplash, WorkspacePane } from "./components";
import { TUI_THEME } from "./theme";
import {
  DashboardSnapshot,
  TuiAction,
  TuiConfirmationState,
  TuiFormField,
  TuiFormInsight,
  TuiInputTrace,
  TuiPanelView,
  TuiPathStatus,
  TuiRunState,
} from "./types";

const PANEL_ORDER: TuiPanelView[] = ["browser", "runs", "logs", "config"];

export function ContextorTuiApp(props: { orchestrator: ContextorOrchestrator }): React.JSX.Element {
  const { exit } = useApp();
  const terminalWidth = process.stdout.columns ?? 120;
  const terminalRows = process.stdout.rows ?? 40;
  const compactLayout = terminalWidth < 150 || terminalRows < 42;
  const reducedWidthLayout = !compactLayout && (terminalWidth < 176 || terminalRows < 50);
  const panelMinHeight = terminalRows < 34 ? 14 : terminalRows < 44 ? 18 : 24;
  const menuWidth = compactLayout ? "100%" : reducedWidthLayout ? 30 : 34;
  const infoWidth = compactLayout ? "100%" : reducedWidthLayout ? 40 : 48;

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [activePanelView, setActivePanelView] = useState<TuiPanelView>("browser");
  const [bootVisible, setBootVisible] = useState(true);
  const [quitConfirmVisible, setQuitConfirmVisible] = useState(false);
  const [confirmationState, setConfirmationState] = useState<TuiConfirmationState | null>(null);
  const [quitting, setQuitting] = useState(false);
  const [tick, setTick] = useState(0);
  const [activeFormAction, setActiveFormAction] = useState<TuiAction | null>(null);
  const [pendingFormSubmission, setPendingFormSubmission] = useState<{
    action: TuiAction;
    values: Record<string, string>;
  } | null>(null);
  const [formFields, setFormFields] = useState<TuiFormField[]>([]);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [activeTextCursorIndex, setActiveTextCursorIndex] = useState(0);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [lastInput, setLastInput] = useState<TuiInputTrace | null>(null);
  const [runAbortController, setRunAbortController] = useState<AbortController | null>(null);
  const [recommendedFolderPaths, setRecommendedFolderPaths] = useState<string[]>([]);
  const [folderPathStatus, setFolderPathStatus] = useState<TuiPathStatus>({
    state: "idle",
    message: "Enter a folder path. Quotes and bracketed names are accepted.",
    matches: [],
    recommendedPaths: [],
  });
  const [runState, setRunState] = useState<TuiRunState>({
    state: "idle",
    title: "Ready",
    message: "Choose a workflow from the command grid to launch Contextor inside the terminal.",
    liveLogs: [],
    eventCount: 0,
  });

  const selectedAction = TUI_ACTIONS[selectedActionIndex]!;
  const activeFormUsesFolderPath = actionHasFolderPath(activeFormAction);
  const folderFieldValue = activeFormUsesFolderPath ? findFieldValue(formFields, "folderPath") : "";

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((current) => current + 1);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hideTimer = setTimeout(() => setBootVisible(false), 1600);
    return () => clearTimeout(hideTimer);
  }, []);

  useEffect(() => {
    if (!bootVisible) {
      clearTerminalViewport();
    }
  }, [bootVisible]);

  useEffect(() => {
    if (!quitting) {
      return;
    }

    const timer = setTimeout(() => exit(), 520);
    return () => clearTimeout(timer);
  }, [exit, quitting]);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    if (runState.state === "running") {
      return;
    }

    const interval = setInterval(() => {
      void refreshDashboard();
    }, 6000);
    return () => clearInterval(interval);
  }, [runState.state]);

  useEffect(() => {
    if (!activeFormUsesFolderPath) {
      setFolderPathStatus({
        state: "idle",
        message: "Enter a folder path. Quotes and bracketed names are accepted.",
        matches: [],
        recommendedPaths: recommendedFolderPaths,
      });
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        if (!folderFieldValue.trim()) {
          setFolderPathStatus({
            state: "idle",
            message: "Enter a folder path. Quotes and bracketed names are accepted.",
            matches: [],
            recommendedPaths: recommendedFolderPaths,
          });
          return;
        }

        setFolderPathStatus((current) => ({ ...current, state: "checking", message: "Checking path..." }));
        const status = await getFolderPathStatus(props.orchestrator, folderFieldValue);
        setFolderPathStatus({ ...status, recommendedPaths: recommendedFolderPaths });
      })();
    }, 120);

    return () => clearTimeout(timer);
  }, [activeFormUsesFolderPath, folderFieldValue, props.orchestrator, recommendedFolderPaths]);

  useEffect(() => {
    const nextSuggestions = folderPathStatus.matches.length > 0 ? folderPathStatus.matches : recommendedFolderPaths;
    if (nextSuggestions.length === 0) {
      setActiveSuggestionIndex(0);
      return;
    }

    setActiveSuggestionIndex((current) => Math.min(current, nextSuggestions.length - 1));
  }, [folderPathStatus.matches, recommendedFolderPaths]);

  const formInsights = useMemo(
    () => buildFormInsights(activeFormAction, formFields, snapshot, folderPathStatus, recommendedFolderPaths),
    [activeFormAction, formFields, snapshot, folderPathStatus, recommendedFolderPaths],
  );
  const runtimeInfo = useMemo(() => getRuntimeEnvironmentInfo(), [tick]);

  useInput((input, key) => {
    const label = describeInput(input, key);

    if (bootVisible) {
      if (key.return || key.escape || input === " ") {
        recordInput(label, "Skip boot animation");
        setBootVisible(false);
      }
      return;
    }

    if (quitting) {
      return;
    }

    if (quitConfirmVisible) {
      if (key.return || input === "q") {
        recordInput(label, "Confirm quit");
        setQuitConfirmVisible(false);
        setQuitting(true);
        return;
      }

      if (key.escape || input === "n" || input === "c") {
        recordInput(label, "Cancel quit");
        setQuitConfirmVisible(false);
      }
      return;
    }

    if (confirmationState) {
      if (key.return) {
        if (confirmationState.type === "workflow-submit" && pendingFormSubmission) {
          recordInput(label, `Confirm ${pendingFormSubmission.action.label}`);
          setConfirmationState(null);
          void beginWorkflow(pendingFormSubmission.action, pendingFormSubmission.values);
          return;
        }

        if (confirmationState.type === "abort-run") {
          recordInput(label, "Confirm workflow abort");
          setConfirmationState(null);
          setRunState((current) => ({
            ...current,
            abortRequested: true,
            progressLabel: "Abort requested. Stopping after the current browser or filesystem step...",
            message: "Abort requested. Contextor will stop after the current browser or filesystem step completes.",
          }));
          runAbortController?.abort();
          return;
        }
      }

      if (key.escape || input === "n" || input === "c") {
        recordInput(label, "Cancel confirmation");
        setConfirmationState(null);
      }
      return;
    }

    if (runState.state === "running") {
      if (runState.abortable && input === "x" && !runState.abortRequested) {
        recordInput(label, "Open abort confirmation");
        setConfirmationState({
          type: "abort-run",
          title: "ABORT WORKFLOW",
          message: "Abort the current workflow?",
          details: [
            `Workflow: ${runState.title}`,
            runState.runDir ? `Run: ${runState.runDir}` : "A filesystem workflow is active.",
            "Contextor will stop after the current file operation completes.",
          ],
          confirmLabel: "Abort run",
          cancelLabel: "Return to workflow",
        });
        return;
      }

      if (label) {
        recordInput(label, "Input ignored while workflow is running");
      }
      return;
    }

    if (activeFormAction) {
      handleFormInput(input, key, label);
      return;
    }

    if (input === "q") {
      recordInput(label, "Open quit confirmation");
      setQuitConfirmVisible(true);
      return;
    }

    if (key.escape) {
      recordInput(label, "Open quit confirmation");
      setQuitConfirmVisible(true);
      return;
    }

    if (key.upArrow) {
      const nextIndex = selectedActionIndex === 0 ? TUI_ACTIONS.length - 1 : selectedActionIndex - 1;
      setSelectedActionIndex(nextIndex);
      recordInput(label, `Selected ${TUI_ACTIONS[nextIndex]!.label}`);
      setRunState({
        state: "idle",
        title: "Ready",
        message: TUI_ACTIONS[nextIndex]!.description,
        liveLogs: [],
        eventCount: 0,
      });
      return;
    }

    if (key.downArrow) {
      const nextIndex = selectedActionIndex === TUI_ACTIONS.length - 1 ? 0 : selectedActionIndex + 1;
      setSelectedActionIndex(nextIndex);
      recordInput(label, `Selected ${TUI_ACTIONS[nextIndex]!.label}`);
      setRunState({
        state: "idle",
        title: "Ready",
        message: TUI_ACTIONS[nextIndex]!.description,
        liveLogs: [],
        eventCount: 0,
      });
      return;
    }

    if (key.rightArrow || key.tab || input === "\t") {
      setActivePanelView(nextPanelView(activePanelView, 1));
      recordInput(label, `Focused ${nextPanelView(activePanelView, 1)} panel`);
      return;
    }

    if (key.leftArrow) {
      setActivePanelView(nextPanelView(activePanelView, -1));
      recordInput(label, `Focused ${nextPanelView(activePanelView, -1)} panel`);
      return;
    }

    if (input === "r") {
      recordInput(label, "Refresh dashboard snapshot");
      void refreshDashboard();
      return;
    }

    if (input === "l") {
      setActivePanelView("logs");
      recordInput(label, "Focused logs panel");
      return;
    }

    if (input === "u") {
      setActivePanelView("runs");
      recordInput(label, "Focused recent runs panel");
      return;
    }

    if (input === "c") {
      setActivePanelView("config");
      recordInput(label, "Focused config panel");
      return;
    }

    if (input === "b") {
      setActivePanelView("browser");
      recordInput(label, "Focused browser panel");
      return;
    }

    if (input === "g") {
      recordInput(label, "Launch Chrome debug browser");
      void handleAction(findAction("launch-browser"));
      return;
    }

    if (input === "o") {
      recordInput(label, "Open latest output folder");
      void handleAction(findAction("open-output"));
      return;
    }

    if (key.return) {
      recordInput(label, `Open ${selectedAction.label}`);
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
        liveLogs: [],
        eventCount: 0,
      });
    } finally {
      setLoadingSnapshot(false);
    }
  }

  function recordInput(label: string, action: string): void {
    if (!label) {
      return;
    }

    setLastInput({
      label,
      action,
      at: new Date().toLocaleTimeString(),
    });
  }

  async function beginWorkflow(action: TuiAction, values: Record<string, string>): Promise<void> {
    if (!snapshot) {
      return;
    }

    const abortController = isAbortableAction(action.id) ? new AbortController() : null;
    setRunAbortController(abortController);
    setPendingFormSubmission(null);
    setActiveFormAction(null);
    setFormFields([]);
    setActiveFieldIndex(0);
    setActiveTextCursorIndex(0);
    setActiveSuggestionIndex(0);
    setRunState({
      state: "running",
      title: action.label,
      message: values.goal ? `Running ${action.label.toLowerCase()} for "${values.goal}"...` : action.description,
      progressLabel: "Preparing workflow...",
      liveLogs: [],
      eventCount: 0,
      progressCurrent: 0,
      progressTotal: 0,
      progressUnit: undefined,
      progressPhase: undefined,
      actionId: action.id,
      abortable: isAbortableAction(action.id),
      abortRequested: false,
    });

    try {
      const execution = await executeWorkflow(props.orchestrator, action.id, values, snapshot, handleRunEvent, {
        signal: abortController?.signal,
      });
      await refreshDashboard();

      if (isWorkflowResult(execution.result)) {
        const workflowResult = execution.result;
        setRunState((current) => ({
          ...current,
          state: "success",
          title: action.label,
          message: workflowResult.summary,
          result: workflowResult,
          runDir: workflowResult.runDir,
          progressLabel: "Workflow complete.",
          progressCurrent: current.progressTotal ?? current.progressCurrent,
          progressTotal: current.progressTotal,
          progressUnit: current.progressUnit,
          abortable: false,
          abortRequested: false,
        }));
      } else {
        setRunState({
          state: "idle",
          title: action.label,
          message: execution.result.summary,
          liveLogs: [],
          eventCount: execution.events.length,
          actionId: action.id,
          abortable: false,
          abortRequested: false,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const aborted = isAbortMessage(message) || abortController?.signal.aborted;
      setRunState((current) => ({
        ...current,
        state: aborted ? "aborted" : "error",
        title: action.label,
        message,
        progressLabel: aborted ? "Workflow aborted." : current.progressLabel,
        abortable: false,
      }));
    } finally {
      setRunAbortController(null);
      setConfirmationState((current) => (current?.type === "abort-run" ? null : current));
    }
  }

  async function handleAction(action: TuiAction): Promise<void> {
    if (action.createFields) {
      setConfirmationState(null);
      setPendingFormSubmission(null);
      const nextFields = action.createFields();
      setActiveFormAction(action);
      setFormFields(nextFields);
      setActiveFieldIndex(0);
      setActiveTextCursorIndex((nextFields[0]?.value ?? "").length);
      setActiveSuggestionIndex(0);
      setRunState({
        state: "idle",
        title: action.label,
        message: action.description,
        liveLogs: [],
        eventCount: 0,
      });
      if (actionHasFolderPath(action)) {
        void primeFolderForm(nextFields);
      }
      return;
    }

    if (action.panelView) {
      setConfirmationState(null);
      setActivePanelView(action.panelView);
      setRunState({
        state: "idle",
        title: action.label,
        message: `Focused the ${action.panelView} panel.`,
        liveLogs: [],
        eventCount: 0,
      });
      return;
    }

    if (!snapshot) {
      return;
    }
    setConfirmationState(null);
    await beginWorkflow(action, {});
  }

  async function primeFolderForm(initialFields: TuiFormField[]): Promise<void> {
    const recommendations = await getRecommendedFolderPaths(props.orchestrator.getConfig().allowedDirectories);
    setRecommendedFolderPaths(recommendations);

    const currentFolderValue = findFieldValue(initialFields, "folderPath");
    const suggestedPath = currentFolderValue || recommendations[0] || "";
    if (!suggestedPath) {
      return;
    }

    updateField("folderPath", suggestedPath);
    setActiveTextCursorIndex(suggestedPath.length);
    const status = await getFolderPathStatus(props.orchestrator, suggestedPath);
    setFolderPathStatus({
      ...status,
      recommendedPaths: recommendations,
    });
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
    label: string,
  ): void {
    const currentField = formFields[activeFieldIndex];
    if (!currentField || !activeFormAction) {
      return;
    }

    if (key.escape) {
      recordInput(label, "Close active form");
      setActiveFormAction(null);
      setFormFields([]);
      setActiveFieldIndex(0);
      setActiveTextCursorIndex(0);
      setActiveSuggestionIndex(0);
      return;
    }

    const folderSuggestions = folderPathStatus.matches.length > 0 ? folderPathStatus.matches : recommendedFolderPaths;

    if (currentField.id === "folderPath" && key.tab && !key.shift) {
      if (folderSuggestions.length > 0) {
        recordInput(label, "Accept folder suggestion");
        void selectFolderSuggestion(folderSuggestions[activeSuggestionIndex] ?? folderSuggestions[0] ?? "");
      } else {
        recordInput(label, "Autocomplete folder path");
        void autocompleteActiveFolderPath(currentField.id);
      }
      return;
    }

    if (key.tab) {
      const direction = key.shift ? -1 : 1;
      const nextIndex = wrapIndex(activeFieldIndex + direction, formFields.length);
      setActiveFieldIndex(nextIndex);
      setActiveTextCursorIndex((formFields[nextIndex]?.value ?? "").length);
      recordInput(label, key.shift ? "Move to previous field" : "Move to next field");
      return;
    }

    if (currentField.id === "folderPath" && currentField.type === "text" && folderSuggestions.length > 0 && key.upArrow) {
      setActiveSuggestionIndex((current) => wrapIndex(current - 1, folderSuggestions.length));
      recordInput(label, "Move to previous folder suggestion");
      return;
    }

    if (currentField.id === "folderPath" && currentField.type === "text" && folderSuggestions.length > 0 && key.downArrow) {
      setActiveSuggestionIndex((current) => wrapIndex(current + 1, folderSuggestions.length));
      recordInput(label, "Move to next folder suggestion");
      return;
    }

    if (key.upArrow && currentField.type === "text") {
      const nextIndex = wrapIndex(activeFieldIndex - 1, formFields.length);
      setActiveFieldIndex(nextIndex);
      setActiveTextCursorIndex((formFields[nextIndex]?.value ?? "").length);
      recordInput(label, "Move to previous field");
      return;
    }

    if (key.downArrow && currentField.type === "text") {
      const nextIndex = wrapIndex(activeFieldIndex + 1, formFields.length);
      setActiveFieldIndex(nextIndex);
      setActiveTextCursorIndex((formFields[nextIndex]?.value ?? "").length);
      recordInput(label, "Move to next field");
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
      recordInput(label, `${currentField.label}: ${options[nextIndex]!.label}`);
      return;
    }

    if (key.return) {
      if (actionHasFolderPath(activeFormAction)) {
        recordInput(label, `Open ${activeFormAction.label} confirmation`);
        void submitForm(true);
      } else {
        recordInput(label, `Submit ${activeFormAction.label}`);
        void submitForm(false);
      }
      return;
    }

    if (currentField.type !== "text") {
      return;
    }

    if (key.leftArrow) {
      setActiveTextCursorIndex((current) => Math.max(0, current - 1));
      recordInput(label, "Move cursor left");
      return;
    }

    if (key.rightArrow) {
      setActiveTextCursorIndex((current) => Math.min(currentField.value.length, current + 1));
      recordInput(label, "Move cursor right");
      return;
    }

    if (isBackspaceKey(input, key)) {
      if (activeTextCursorIndex === 0) {
        return;
      }

      const nextValue =
        currentField.value.slice(0, activeTextCursorIndex - 1) + currentField.value.slice(activeTextCursorIndex);
      updateField(currentField.id, nextValue);
      setActiveTextCursorIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (isForwardDeleteKey(input, key)) {
      const nextValue =
        currentField.value.slice(0, activeTextCursorIndex) + currentField.value.slice(activeTextCursorIndex + 1);
      updateField(currentField.id, nextValue);
      return;
    }

    if (isClearFieldShortcut(input, key)) {
      updateField(currentField.id, "");
      setActiveTextCursorIndex(0);
      if (currentField.id === "folderPath") {
        setFolderPathStatus({
          state: "idle",
          message: "Enter a folder path. Quotes and bracketed names are accepted.",
          matches: [],
          recommendedPaths: recommendedFolderPaths,
        });
      }
      recordInput(describeInput(input, key) || "Ctrl+U", `Clear ${currentField.label}`);
      return;
    }

    if ((key.ctrl || key.meta) && input.length === 1) {
      return;
    }

    if (input.length > 0 && input !== "\t" && input !== "\r" && input !== "\n") {
      const nextValue =
        currentField.value.slice(0, activeTextCursorIndex) + input + currentField.value.slice(activeTextCursorIndex);
      updateField(currentField.id, nextValue);
      setActiveTextCursorIndex((current) => current + input.length);
    }
  }

  async function autocompleteActiveFolderPath(fieldId: string): Promise<void> {
    const currentValue = findFieldValue(formFields, fieldId);
    const completion = await completeFolderPath(props.orchestrator, currentValue);
    updateField(fieldId, completion.value);
    setActiveTextCursorIndex(completion.value.length);
    setFolderPathStatus({
      ...completion.status,
      message: completion.status.message,
      matches: completion.status.matches,
      recommendedPaths: recommendedFolderPaths,
    });
  }

  async function selectFolderSuggestion(nextValue: string): Promise<void> {
    if (!nextValue) {
      return;
    }

    updateField("folderPath", nextValue);
    setActiveTextCursorIndex(nextValue.length);
    const status = await getFolderPathStatus(props.orchestrator, nextValue);
    setFolderPathStatus({
      ...status,
      recommendedPaths: recommendedFolderPaths,
    });
  }

  function updateField(fieldId: string, nextValue: string): void {
    setFormFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, value: nextValue } : field)),
    );
  }

  async function submitForm(requireConfirmation: boolean): Promise<void> {
    if (!activeFormAction || !snapshot) {
      return;
    }

    const values = Object.fromEntries(formFields.map((field) => [field.id, field.value]));
    if (actionHasFolderPath(activeFormAction)) {
      if (folderPathStatus.state !== "ok") {
        setRunState({
          state: "error",
          title: activeFormAction.label,
          message: "Folder Path must resolve to an allowed directory before the compile can start.",
          liveLogs: [],
          eventCount: 0,
          actionId: activeFormAction.id,
          abortable: false,
          abortRequested: false,
        });
        return;
      }

      if (requireConfirmation) {
        setPendingFormSubmission({ action: activeFormAction, values });
        setConfirmationState({
          type: "workflow-submit",
          title: `CONFIRM ${activeFormAction.label.toUpperCase()}`,
          message: `Start ${activeFormAction.label.toLowerCase()}?`,
          details: buildFolderWorkflowConfirmationDetails(activeFormAction, values, folderPathStatus.resolvedPath),
          confirmLabel: `Start ${activeFormAction.shortLabel}`,
          cancelLabel: "Return to the form",
        });
        return;
      }
    }

    await beginWorkflow(activeFormAction, values);
  }

  function handleRunEvent(event: RunEvent): void {
    setRunState((current) => {
      if (event.kind === "run-started") {
        return {
          ...current,
          state: "running",
          runDir: event.runDir,
          progressLabel: `Starting ${event.workflow} workflow...`,
          liveLogs: [],
          eventCount: 1,
          progressCurrent: 0,
          progressTotal: 0,
          progressUnit: undefined,
          progressPhase: undefined,
        };
      }

      if (event.kind === "progress") {
        return {
          ...current,
          state: "running",
          runDir: event.runDir,
          progressLabel: event.progress?.details || current.progressLabel || current.message,
          progressCurrent: event.progress?.current ?? current.progressCurrent,
          progressTotal: event.progress?.total ?? current.progressTotal,
          progressUnit: event.progress?.unit ?? current.progressUnit,
          progressPhase: event.progress?.phase ?? current.progressPhase,
        };
      }

      if (event.kind === "log") {
        const nextLogs = [...(current.liveLogs ?? []), event.logEntry?.line ?? ""].slice(-10);
        return {
          ...current,
          state: "running",
          runDir: event.runDir,
          progressLabel: event.logEntry?.message || current.progressLabel || current.message,
          liveLogs: nextLogs,
          eventCount: (current.eventCount ?? 0) + 1,
        };
      }

      if (event.kind === "run-failed") {
        return {
          ...current,
          state: "error",
          runDir: event.runDir,
          progressLabel: "Workflow failed.",
          message: event.error || current.message,
          abortable: false,
        };
      }

      return {
        ...current,
        runDir: event.runDir,
        progressLabel: event.summary || "Workflow complete.",
        abortable: false,
        abortRequested: false,
      };
    });
  }

  if (bootVisible) {
    return <BootSplash tick={tick} />;
  }

  if (confirmationState) {
    return <ConfirmActionPane tick={tick} confirmation={confirmationState} />;
  }

  if (quitConfirmVisible) {
    return <ConfirmQuitPane tick={tick} />;
  }

  if (quitting) {
    return <QuitSplash tick={tick} />;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header snapshot={snapshot} loading={loadingSnapshot} tick={tick} compact={compactLayout} />
      <Box marginTop={1} flexDirection={compactLayout ? "column" : "row"}>
        <ActionMenu
          actions={TUI_ACTIONS}
          selectedIndex={selectedActionIndex}
          lastInput={lastInput}
          width={menuWidth}
          minHeight={panelMinHeight}
          tick={tick}
          active={!activeFormAction}
        />
        <Box marginLeft={compactLayout ? 0 : 1} marginTop={compactLayout ? 1 : 0} flexGrow={1} flexDirection="column">
          {activeFormAction ? (
            <FormPane
              actionId={activeFormAction.id}
              title={activeFormAction.formTitle || activeFormAction.label}
              submitLabel={activeFormAction.submitLabel || "Submit"}
              fields={formFields}
              activeFieldIndex={activeFieldIndex}
              activeTextCursorIndex={activeTextCursorIndex}
              insights={formInsights}
              suggestions={folderPathStatus.matches.length > 0 ? folderPathStatus.matches : recommendedFolderPaths}
              activeSuggestionIndex={activeSuggestionIndex}
              tick={tick}
              minHeight={panelMinHeight}
            />
          ) : (
            <WorkspacePane selectedAction={selectedAction} runState={runState} tick={tick} minHeight={panelMinHeight} />
          )}
        </Box>
        <Box marginLeft={compactLayout ? 0 : 1} marginTop={compactLayout ? 1 : 0}>
          <InfoPane view={activePanelView} snapshot={snapshot} tick={tick} width={infoWidth} minHeight={panelMinHeight} />
        </Box>
      </Box>
      <FooterBar
        panelView={activePanelView}
        formMode={Boolean(activeFormAction)}
        loading={loadingSnapshot}
        runtimeInfo={runtimeInfo}
        lastInput={lastInput}
        compact={compactLayout}
      />
    </Box>
  );
}

function Header(props: { snapshot: DashboardSnapshot | null; loading: boolean; tick: number; compact: boolean }): React.JSX.Element {
  const browserText = props.snapshot
    ? props.snapshot.browser.endpointReachable
      ? `browser online • ${props.snapshot.browser.usableTargets} tab(s)`
      : "browser attach offline"
    : "loading browser status";

  return (
    <Box borderStyle="double" borderColor={TUI_THEME.border} paddingX={1} paddingY={0} justifyContent="space-between">
      <Box flexDirection="column">
        <Text color={TUI_THEME.accent}>Contextor v{CONTEXTOR_VERSION}</Text>
        <Text color={TUI_THEME.text}>Terminal-contained local context console</Text>
      </Box>
      <Box flexDirection={props.compact ? "column" : "row"} alignItems="flex-end">
        <Box flexDirection="column" alignItems="flex-end" marginRight={props.compact ? 0 : 2}>
          <Text color={props.snapshot?.browser.endpointReachable ? TUI_THEME.ok : TUI_THEME.warn}>{browserText}</Text>
          <Text color={TUI_THEME.muted}>{props.loading ? "dashboard refresh active" : "input echo + animation layer active"}</Text>
        </Box>
        <CornerBadge tick={props.tick} browserOnline={Boolean(props.snapshot?.browser.endpointReachable)} />
      </Box>
    </Box>
  );
}

function buildFormInsights(
  action: TuiAction | null,
  fields: TuiFormField[],
  snapshot: DashboardSnapshot | null,
  folderPathStatus: TuiPathStatus,
  recommendedFolderPaths: string[],
): TuiFormInsight[] {
  if (!action) {
    return [];
  }

  const insights: TuiFormInsight[] = [];

  if (actionHasFolderPath(action)) {
    const limitValue = findFieldValue(fields, "limit") || "all";
    insights.push({
      tone: folderPathTone(folderPathStatus.state),
      label: "Folder path sensor",
      details: folderPathStatus.resolvedPath
        ? `${folderPathStatus.message} :: ${folderPathStatus.resolvedPath}`
        : folderPathStatus.message,
    });

    if (folderPathStatus.matches.length > 0) {
      insights.push({
        tone: "neutral",
        label: "Autocomplete candidates",
        details: folderPathStatus.matches.slice(0, 3).join(" | "),
      });
    }

    if (recommendedFolderPaths.length > 0) {
      insights.push({
        tone: "neutral",
        label: "Recommended path seed",
        details: recommendedFolderPaths[0]!,
      });
    }

    if (action.id === "folder") {
      insights.push({
        tone: limitValue.trim().toLowerCase() === "all" ? "ok" : "neutral",
        label: "File limit",
        details:
          limitValue.trim().toLowerCase() === "all"
            ? "all supported files will be scanned and ranked."
            : `Contextor will stop after the top ${limitValue.trim()} file sources.`,
      });
    }

  if (action.id === "directory-copy") {
      const formatValue = findFieldValue(fields, "format") || "both";
      insights.push({
        tone: "ok",
        label: "Literal copy mode",
        details:
          formatValue === "md"
            ? "Markdown is the requested primary format. Contextor also writes a text companion."
            : formatValue === "txt"
              ? "Text is the requested primary format. Contextor also writes a markdown companion."
              : "Contextor will write both markdown and text root outputs for the directory copy.",
      });
    }
  }

  if (action.id === "task-console") {
    const taskScope = findFieldValue(fields, "taskScope") || "browser";
    const taskMode = findFieldValue(fields, "taskMode") || "preview";
    const taskPrompt = findFieldValue(fields, "taskPrompt");
    insights.push({
      tone: taskMode === "preview" ? "warn" : "neutral",
      label: "Execution state",
      details:
        taskMode === "preview"
          ? "Prompt console is staged only in v0.2.2. No arbitrary agent execution is enabled yet."
          : "Future agentic mode is planned, but not connected in this release.",
    });
    insights.push({
      tone: snapshot?.browser.endpointReachable ? "ok" : "warn",
      label: "Available context surface",
      details:
        taskScope === "folder"
          ? "Folder-first mission selected. Reuse the folder workflows when connectors arrive."
          : taskScope === "hybrid"
            ? `${snapshot?.browser.pages.length ?? 0} browser tab(s) currently visible plus local folder workflows.`
            : `${snapshot?.browser.pages.length ?? 0} browser tab(s) currently visible for a future browser-first task.`,
    });
    insights.push({
      tone: "warn",
      label: "Legacy Instagram audit",
      details: "Removed from the main dashboard path. The fallback workflow remains in code and CLI if needed later.",
    });
    if (taskPrompt.trim()) {
      insights.push({
        tone: "ok",
        label: "Prompt length",
        details: `${taskPrompt.trim().length} character(s) staged in the mission prompt.`,
      });
    }
  }

  if (!snapshot) {
    return insights;
  }

  if (action.id === "tabs") {
    const scope = findFieldValue(fields, "scope") || "all";
    const rawMatch = findFieldValue(fields, "match");
    const preview = previewBrowserSelection(snapshot.browser.pages, scope, rawMatch);
    insights.push({
      tone: snapshot.browser.endpointReachable ? "ok" : "error",
      label: "Browser attach preview",
      details: snapshot.browser.endpointReachable
        ? `${preview.count} candidate tab(s). ${preview.details}`
        : "Chrome attach endpoint is offline.",
    });
  }

  if (action.id === "page-export") {
    const firstPage = snapshot.browser.pages[0];
    insights.push({
      tone: snapshot.browser.endpointReachable ? "ok" : "error",
      label: "Current page export preview",
      details: firstPage
        ? `${firstPage.title || firstPage.url} :: ${firstPage.url}`
        : "No attached page is visible yet.",
    });
  }

  return insights;
}

function previewBrowserSelection(pages: BrowserPageSummary[], scope: string, rawMatch: string): { count: number; details: string } {
  if (scope === "current") {
    const page = pages[0];
    return {
      count: page ? 1 : 0,
      details: page ? `Current target preview: ${page.title || page.url}` : "No current page preview available.",
    };
  }

  if (scope === "match") {
    try {
      const matcher = new RegExp(rawMatch, "i");
      const matched = pages.filter((page) => matcher.test(`${page.title} ${page.url}`));
      return {
        count: matched.length,
        details:
          matched.length > 0
            ? matched.slice(0, 4).map((page) => page.title || page.url).join(" | ")
            : "No attached tabs match the current regex.",
      };
    } catch {
      return {
        count: 0,
        details: "The current match regex is invalid.",
      };
    }
  }

  return {
    count: pages.length,
    details:
      pages.length > 0 ? pages.slice(0, 4).map((page) => page.title || page.url).join(" | ") : "No attached tabs visible.",
  };
}

function describeInput(
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
): string {
  if (isClearFieldShortcut(input, key)) {
    return key.meta ? "Cmd+K" : "Ctrl+U";
  }
  if (isBackspaceKey(input, key)) {
    return "Backspace";
  }
  if (isForwardDeleteKey(input, key)) {
    return "Delete";
  }
  if (key.upArrow) {
    return "Up";
  }
  if (key.downArrow) {
    return "Down";
  }
  if (key.leftArrow) {
    return "Left";
  }
  if (key.rightArrow) {
    return "Right";
  }
  if (key.tab && key.shift) {
    return "Shift+Tab";
  }
  if (key.tab) {
    return "Tab";
  }
  if (key.return) {
    return "Enter";
  }
  if (key.escape) {
    return "Esc";
  }
  if (key.backspace) {
    return "Backspace";
  }
  if (key.delete) {
    return "Delete";
  }
  if (input === " ") {
    return "Space";
  }
  if (input.length === 1) {
    return input;
  }

  return "";
}

function isBackspaceKey(
  input: string,
  key: {
    backspace?: boolean;
    delete?: boolean;
  },
): boolean {
  return key.backspace === true || input === "\u007f" || input === "\u0008" || (key.delete === true && !isForwardDeleteKey(input, key));
}

function isForwardDeleteKey(
  input: string,
  key: {
    delete?: boolean;
  },
): boolean {
  return key.delete === true && (input === "\u001b[3~" || input === "\u001b[3;5~");
}

function isClearFieldShortcut(
  input: string,
  key: {
    ctrl?: boolean;
    meta?: boolean;
  },
): boolean {
  return input === "\u0015" || (key.ctrl === true && input.toLowerCase() === "u") || (key.meta === true && input.toLowerCase() === "k");
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

function findFieldValue(fields: TuiFormField[], fieldId: string): string {
  return fields.find((field) => field.id === fieldId)?.value ?? "";
}

function actionHasFolderPath(action: TuiAction | null): boolean {
  return action?.id === "folder" || action?.id === "directory-copy";
}

function isAbortableAction(actionId: TuiAction["id"] | undefined): boolean {
  return actionId === "tabs" || actionId === "folder" || actionId === "directory-copy";
}

function buildFolderWorkflowConfirmationDetails(
  action: TuiAction,
  values: Record<string, string>,
  resolvedPath: string | undefined,
): string[] {
  const details = [
    `Folder: ${resolvedPath || values.folderPath}`,
    `Goal: ${values.goal || action.description}`,
  ];

  if (action.id === "folder") {
    details.push(`File limit: ${(values.limit || "all").trim() || "all"}`);
  }

  if (action.id === "directory-copy") {
    details.push(`Requested format: ${(values.format || "both").trim() || "both"}`);
  }

  return details;
}

function folderPathTone(state: TuiPathStatus["state"]): TuiFormInsight["tone"] {
  switch (state) {
    case "ok":
      return "ok";
    case "warn":
      return "warn";
    case "error":
      return "error";
    default:
      return "neutral";
  }
}

function isWorkflowResult(
  result: { summary: string } | WorkflowResult,
): result is WorkflowResult {
  return "workflow" in result && "runDir" in result && "contextMarkdownPath" in result;
}

function isAbortMessage(message: string): boolean {
  return /aborted by operator/i.test(message) || /abort(ed)?/i.test(message);
}

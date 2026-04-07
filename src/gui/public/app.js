const statusState = document.querySelector("#status-state");
const statusMessage = document.querySelector("#status-message");
const latestResult = document.querySelector("#latest-result");
const runsList = document.querySelector("#runs-list");
const logOutput = document.querySelector("#log-output");
const configOutput = document.querySelector("#config-output");

const forms = [
  {
    element: document.querySelector("#tabs-form"),
    endpoint: "/api/run/tabs",
    buildPayload: (formData) => ({
      goal: formData.get("goal"),
      match: formData.get("match"),
      all: true,
    }),
  },
  {
    element: document.querySelector("#folder-form"),
    endpoint: "/api/run/folder",
    buildPayload: (formData) => ({
      goal: formData.get("goal"),
      folderPath: formData.get("folderPath"),
    }),
  },
  {
    element: document.querySelector("#page-form"),
    endpoint: "/api/run/page-export",
    buildPayload: (formData) => ({
      goal: formData.get("goal"),
      mode: formData.get("mode"),
    }),
  },
  {
    element: document.querySelector("#audit-form"),
    endpoint: "/api/run/social-audit",
    buildPayload: (formData) => ({
      goal: formData.get("goal"),
    }),
  },
];

for (const { element, endpoint, buildPayload } of forms) {
  element.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(element);
    await runWorkflow(endpoint, buildPayload(formData));
  });
}

document.querySelector("#open-latest-output").addEventListener("click", async () => {
  await postJson("/api/open-latest-output", {});
});

document.querySelector("#open-latest-log").addEventListener("click", async () => {
  await postJson("/api/open-latest-log", {});
});

document.querySelector("#refresh-button").addEventListener("click", async () => {
  await refreshDashboard();
});

async function runWorkflow(endpoint, payload) {
  try {
    setStatus("RUNNING", "Workflow in progress...");
    const result = await postJson(endpoint, payload);
    latestResult.textContent = JSON.stringify(result, null, 2);
    setStatus("SUCCESS", result.summary || "Workflow completed.");
    await refreshDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus("ERROR", message);
    latestResult.textContent = message;
  }
}

async function refreshDashboard() {
  const [status, runs, logs, config] = await Promise.all([
    fetchJson("/api/status"),
    fetchJson("/api/runs"),
    fetchJson("/api/logs/latest"),
    fetchJson("/api/config"),
  ]);

  setStatus(status.state.toUpperCase(), status.message || "No workflow is running.");
  latestResult.textContent = status.result ? JSON.stringify(status.result, null, 2) : "No run completed yet.";
  renderRuns(runs.runs || []);
  logOutput.textContent = (logs.lines || []).join("\n") || "No logs loaded yet.";
  configOutput.textContent = JSON.stringify(config, null, 2);
}

function renderRuns(runs) {
  if (runs.length === 0) {
    runsList.innerHTML = "<p class='microcopy'>No runs yet.</p>";
    return;
  }

  runsList.innerHTML = runs
    .map(
      (run) => `
        <article class="run-card">
          <div>
            <h3>${escapeHtml(run.createdAt)}</h3>
            <p>${escapeHtml(run.runDir)}</p>
          </div>
          <div class="run-buttons">
            <button type="button" data-open-path="${escapeAttribute(run.runDir)}">Open Folder</button>
            ${
              run.contextMarkdownPath
                ? `<button type="button" data-copy-path="${escapeAttribute(run.contextMarkdownPath)}">Copy context.md path</button>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");

  runsList.querySelectorAll("[data-open-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      await postJson("/api/open-path", { path: button.getAttribute("data-open-path") });
    });
  });

  runsList.querySelectorAll("[data-copy-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.getAttribute("data-copy-path");
      if (!target) {
        return;
      }

      await navigator.clipboard.writeText(target);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy context.md path";
      }, 1500);
    });
  });
}

function setStatus(state, message) {
  statusState.textContent = state;
  statusMessage.textContent = message;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

refreshDashboard().catch((error) => {
  setStatus("ERROR", error instanceof Error ? error.message : String(error));
});

import fs from "node:fs/promises";
import { Server } from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

import express from "express";

import { ContextorOrchestrator } from "../core/orchestrator";
import { RecentRunSummary, WorkflowResult } from "../core/types";
import { pathExists, readLogTail } from "../utils/files";

interface StartGuiOptions {
  projectRoot: string;
  configPath?: string;
  port?: number;
  host?: string;
}

interface RunStatus {
  state: "idle" | "running" | "success" | "error";
  workflow?: string;
  message?: string;
  result?: WorkflowResult;
  error?: string;
}

export async function startGuiServer(options: StartGuiOptions): Promise<{
  app: express.Express;
  port: number;
  host: string;
  server: Server;
}> {
  const app = express();
  const orchestrator = await ContextorOrchestrator.create(options.projectRoot, options.configPath);
  const publicDir = await resolvePublicDir(options.projectRoot);

  let status: RunStatus = { state: "idle" };

  app.use(express.json());
  app.use(express.static(publicDir));

  app.get("/api/status", async (_request, response) => {
    response.json(status);
  });

  app.get("/api/config", async (_request, response) => {
    response.json(orchestrator.getConfig());
  });

  app.get("/api/runs", async (request, response) => {
    const limit = Number(request.query.limit ?? 8);
    const runs = await orchestrator.listRecentRuns(limit);
    response.json({ runs });
  });

  app.get("/api/logs/latest", async (_request, response) => {
    const latestRun = (await orchestrator.listRecentRuns(1))[0];
    if (!latestRun?.logPath) {
      response.json({ lines: [] });
      return;
    }

    response.json({
      runDir: latestRun.runDir,
      logPath: latestRun.logPath,
      lines: await readLogTail(latestRun.logPath, 120),
    });
  });

  app.post("/api/run/tabs", async (request, response) => {
    await runExclusive(response, status, (nextStatus) => {
      status = nextStatus;
    }, async () =>
      orchestrator.compileTabs({
        goal: request.body.goal || "summarize the currently open browser context",
        all: Boolean(request.body.all ?? true),
        current: Boolean(request.body.current ?? false),
        match: request.body.match || undefined,
      }),
    );
  });

  app.post("/api/run/folder", async (request, response) => {
    await runExclusive(response, status, (nextStatus) => {
      status = nextStatus;
    }, async () =>
      orchestrator.compileFolder({
        goal: request.body.goal || "summarize the selected local folder",
        folderPath: request.body.folderPath,
        limit: Number(request.body.limit ?? 15),
      }),
    );
  });

  app.post("/api/run/page-export", async (request, response) => {
    await runExclusive(response, status, (nextStatus) => {
      status = nextStatus;
    }, async () =>
      orchestrator.exportCurrentPage({
        goal: request.body.goal || "export the current page for downstream LLM use",
        current: true,
        mode: request.body.mode || "generic",
      }),
    );
  });

  app.post("/api/run/social-audit", async (request, response) => {
    await runExclusive(response, status, (nextStatus) => {
      status = nextStatus;
    }, async () =>
      orchestrator.socialAudit({
        platform: "instagram",
        mode: "non-mutuals",
        goal: request.body.goal || "review likely Instagram non-mutual accounts in read-only mode",
        dryRun: true,
        allowAccountActions: false,
        confirm: false,
      }),
    );
  });

  app.post("/api/open-path", async (request, response) => {
    const targetPath = String(request.body.path || "");
    if (!targetPath || !(await pathExists(targetPath))) {
      response.status(404).json({ error: "Path not found." });
      return;
    }

    openPath(targetPath);
    response.json({ ok: true });
  });

  app.post("/api/open-latest-output", async (_request, response) => {
    const latestRun = (await orchestrator.listRecentRuns(1))[0];
    if (!latestRun) {
      response.status(404).json({ error: "No runs found." });
      return;
    }

    openPath(latestRun.runDir);
    response.json({ ok: true, path: latestRun.runDir });
  });

  app.post("/api/open-latest-log", async (_request, response) => {
    const latestRun = (await orchestrator.listRecentRuns(1))[0];
    if (!latestRun?.logPath) {
      response.status(404).json({ error: "No log file found." });
      return;
    }

    openPath(latestRun.logPath);
    response.json({ ok: true, path: latestRun.logPath });
  });

  app.use(async (_request, response) => {
    response.sendFile(path.join(publicDir, "index.html"));
  });

  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4317;

  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(port, host, () => resolve(listener));
  });

  return { app, port, host, server };
}

async function resolvePublicDir(projectRoot: string): Promise<string> {
  const distCandidate = path.join(__dirname, "public");
  if (await pathExists(distCandidate)) {
    return distCandidate;
  }

  return path.join(projectRoot, "src", "gui", "public");
}

async function runExclusive(
  response: express.Response,
  status: RunStatus,
  setStatus: (nextStatus: RunStatus) => void,
  task: () => Promise<WorkflowResult>,
): Promise<void> {
  if (status.state === "running") {
    response.status(409).json({ error: "Another Contextor workflow is already running." });
    return;
  }

  setStatus({ state: "running", message: "Workflow in progress..." });

  try {
    const result = await task();
    setStatus({
      state: "success",
      workflow: result.workflow,
      message: result.summary,
      result,
    });
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus({
      state: "error",
      error: message,
      message,
    });
    response.status(500).json({ error: message });
  }
}

function openPath(targetPath: string): void {
  if (process.platform === "darwin") {
    const child = spawn("open", [targetPath], { detached: true, stdio: "ignore" });
    child.unref();
    return;
  }

  const command = process.platform === "win32" ? "explorer.exe" : "xdg-open";
  const child = spawn(command, [targetPath], { detached: true, stdio: "ignore" });
  child.unref();
}

if (require.main === module) {
  startGuiServer({
    projectRoot: process.cwd(),
    port: Number(process.env.PORT || 4317),
    host: process.env.HOST || "127.0.0.1",
  })
    .then(async ({ host, port, server }) => {
      const indexPath = path.join(process.cwd(), "output", ".contextor-gui");
      await fs.mkdir(path.dirname(indexPath), { recursive: true });
      await fs.writeFile(indexPath, `http://${host}:${port}\n`, "utf8");
      console.log(`Contextor GUI available at http://${host}:${port}`);
      await new Promise<void>((resolve) => {
        const shutdown = () => {
          server.close(() => resolve());
        };

        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
      });
    })
    .catch((error) => {
      console.error(`Contextor GUI failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}

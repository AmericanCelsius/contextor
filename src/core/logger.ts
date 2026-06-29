import fs from "node:fs/promises";
import path from "node:path";

import { RunDirectories, RunLogEntry } from "./types";
import { applyDefaultSecretRedactions } from "./redaction";

export interface Logger {
  info(message: string, data?: unknown): Promise<void>;
  warn(message: string, data?: unknown): Promise<void>;
  error(message: string, data?: unknown): Promise<void>;
}

export class RunLogger {
  readonly logPath: string;

  private readonly lines: string[] = [];

  constructor(
    private readonly directories: RunDirectories,
    private readonly options: { onWrite?: (entry: RunLogEntry) => void | Promise<void> } = {},
  ) {
    this.logPath = path.join(directories.logs, "run.log");
  }

  async info(message: string, data?: unknown): Promise<void> {
    await this.write("INFO", message, data);
  }

  async warn(message: string, data?: unknown): Promise<void> {
    await this.write("WARN", message, data);
  }

  async error(message: string, data?: unknown): Promise<void> {
    await this.write("ERROR", message, data);
  }

  async getLines(): Promise<string[]> {
    return [...this.lines];
  }

  private async write(level: string, message: string, data?: unknown): Promise<void> {
    const timestamp = new Date().toISOString();
    const line = applyDefaultSecretRedactions(
      `[${timestamp}] [${level}] ${message}${data === undefined ? "" : ` ${JSON.stringify(data)}`}`,
    );
    const entry: RunLogEntry = {
      timestamp,
      level: level as RunLogEntry["level"],
      message,
      data,
      line,
    };
    this.lines.push(line);
    await fs.appendFile(this.logPath, `${line}\n`, "utf8");
    await this.options.onWrite?.(entry);
  }
}

export class NullLogger implements Logger {
  async info(): Promise<void> {}

  async warn(): Promise<void> {}

  async error(): Promise<void> {}
}

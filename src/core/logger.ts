import fs from "node:fs/promises";
import path from "node:path";

import { RunDirectories } from "./types";

export interface Logger {
  info(message: string, data?: unknown): Promise<void>;
  warn(message: string, data?: unknown): Promise<void>;
  error(message: string, data?: unknown): Promise<void>;
}

export class RunLogger {
  readonly logPath: string;

  private readonly lines: string[] = [];

  constructor(private readonly directories: RunDirectories) {
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
    const line = `[${new Date().toISOString()}] [${level}] ${message}${data === undefined ? "" : ` ${JSON.stringify(data)}`}`;
    this.lines.push(line);
    await fs.appendFile(this.logPath, `${line}\n`, "utf8");
  }
}

export class NullLogger implements Logger {
  async info(): Promise<void> {}

  async warn(): Promise<void> {}

  async error(): Promise<void> {}
}

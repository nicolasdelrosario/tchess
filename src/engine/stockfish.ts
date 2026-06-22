import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";
import type { Difficulty } from "../types.js";

const stockfishSkillByElo = new Map<number, number>([
  [800, 0],
  [1000, 2],
  [1200, 5],
  [1500, 8],
  [1800, 12],
  [2200, 18]
]);

const stockfishUciElo = (elo: number) => Math.min(3190, Math.max(1320, elo));

export function resolveStockfishCommand(): string {
  if (process.env.STOCKFISH_PATH) {
    return process.env.STOCKFISH_PATH;
  }

  const engineDir = dirname(fileURLToPath(import.meta.url));
  const bundled = join(engineDir, "..", "..", "vendor", "stockfish", `${process.platform}-${process.arch}`, "stockfish");

  return existsSync(bundled) ? bundled : "stockfish";
}

export function stockfishSourceLabel(command = resolveStockfishCommand()): string {
  if (process.env.STOCKFISH_PATH && command === process.env.STOCKFISH_PATH) {
    return "external path";
  }

  return command === "stockfish" ? "system path" : "bundled sf18";
}

export class StockfishUnavailableError extends Error {
  constructor(command: string) {
    super(
      `Stockfish could not be started from "${command}". Install stockfish, set STOCKFISH_PATH, or add a bundled binary for this platform.`
    );
    this.name = "StockfishUnavailableError";
  }
}

export class StockfishEngine {
  private readonly command: string;
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly events = new EventEmitter();

  constructor(command = resolveStockfishCommand()) {
    this.command = command;
  }

  async start(difficulty: Difficulty): Promise<void> {
    if (this.process) {
      return;
    }

    this.process = spawn(this.command, [], { stdio: "pipe" });
    this.process.once("error", () => {
      this.process = null;
      this.events.emit("startup-error");
    });
    this.process.once("exit", (code, signal) => {
      this.process = null;
      this.events.emit("exit", code, signal);
    });

    const reader = readline.createInterface({ input: this.process.stdout });
    reader.on("line", (line) => this.events.emit("line", line.trim()));
    this.process.once("exit", () => reader.close());

    this.process.stderr.on("data", (chunk) => {
      this.events.emit("stderr", chunk.toString());
    });

    await this.waitForStartup();
    this.write("uci");
    await this.waitForLine("uciok", 5_000);
    this.trySetOption(`setoption name Skill Level value ${stockfishSkillByElo.get(difficulty.elo) ?? 5}`);
    this.trySetOption("setoption name UCI_LimitStrength value true");
    this.trySetOption(`setoption name UCI_Elo value ${stockfishUciElo(difficulty.elo)}`);
    await this.ready();
  }

  async bestMove(fen: string, difficulty: Difficulty): Promise<string> {
    if (!this.process) {
      await this.start(difficulty);
    }

    this.write(`position fen ${fen}`);
    this.write(`go movetime ${difficulty.moveTimeMs}`);
    const line = await this.waitForPrefix("bestmove ", Math.max(5_000, difficulty.moveTimeMs + 5_000));
    const [, move] = line.split(" ");

    if (!move || move === "(none)") {
      throw new Error("Stockfish did not return a playable move.");
    }

    return move;
  }

  stop(): void {
    if (!this.process) {
      return;
    }

    this.write("quit");
    this.process.kill();
    this.process = null;
  }

  private write(command: string): void {
    this.process?.stdin.write(`${command}\n`);
  }

  private trySetOption(command: string): void {
    this.write(command);
  }

  private async ready(): Promise<void> {
    this.write("isready");
    await this.waitForLine("readyok", 5_000);
  }

  private waitForStartup(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new StockfishUnavailableError(this.command)), 1_000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.events.off("startup-error", onError);
        this.events.off("exit", onExit);
      };

      const onError = () => {
        cleanup();
        reject(new StockfishUnavailableError(this.command));
      };

      const onExit = () => {
        cleanup();
        reject(new StockfishUnavailableError(this.command));
      };

      this.events.once("startup-error", onError);
      this.events.once("exit", onExit);
      setTimeout(() => {
        cleanup();
        resolve();
      }, 50);
    });
  }

  private waitForLine(expected: string, timeoutMs: number): Promise<string> {
    return this.waitFor((line) => line === expected, timeoutMs);
  }

  private waitForPrefix(prefix: string, timeoutMs: number): Promise<string> {
    return this.waitFor((line) => line.startsWith(prefix), timeoutMs);
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for Stockfish response."));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        this.events.off("line", onLine);
        this.events.off("exit", onExit);
        this.events.off("startup-error", onStartupError);
      };

      const onLine = (line: string) => {
        if (!predicate(line)) {
          return;
        }

        cleanup();
        resolve(line);
      };

      const onExit = () => {
        cleanup();
        reject(new Error("Stockfish exited before returning a move."));
      };

      const onStartupError = () => {
        cleanup();
        reject(new StockfishUnavailableError(this.command));
      };

      this.events.on("line", onLine);
      this.events.once("exit", onExit);
      this.events.once("startup-error", onStartupError);
    });
  }
}

import { describe, expect, it } from "vitest";
import { ChessGame, parseMoveInput } from "../src/game/chessGame.js";

describe("ChessGame", () => {
  it("parses coordinate moves", () => {
    expect(parseMoveInput("e2e4")).toEqual({ from: "e2", to: "e4", promotion: undefined });
    expect(parseMoveInput("e7-e8q")).toEqual({ from: "e7", to: "e8", promotion: "q" });
    expect(parseMoveInput("nope")).toBeNull();
  });

  it("applies legal moves and rejects illegal moves", () => {
    const game = new ChessGame();

    expect(game.tryMove({ from: "e2", to: "e4" })).not.toBeNull();
    expect(game.snapshot().turn).toBe("black");
    expect(game.tryMove({ from: "e4", to: "e5" })).toBeNull();
  });

  it("detects checkmate", () => {
    const game = new ChessGame();

    game.move({ from: "f2", to: "f3" });
    game.move({ from: "e7", to: "e5" });
    game.move({ from: "g2", to: "g4" });
    game.move({ from: "d8", to: "h4" });

    expect(game.snapshot().isGameOver).toBe(true);
    expect(game.snapshot().status).toContain("checkmated");
  });

  it("supports undo", () => {
    const game = new ChessGame();
    game.move({ from: "e2", to: "e4" });

    expect(game.undo()?.san).toBe("e4");
    expect(game.snapshot().turn).toBe("white");
  });
});

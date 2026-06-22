import { describe, expect, it } from "vitest";
import { ChessGame } from "../src/game/chessGame.js";
import { getPieceGlyph, orderedSquares, renderBoardText } from "../src/ui/board.js";

describe("board rendering", () => {
  it("orders squares from each perspective", () => {
    expect(orderedSquares("white")[0]).toBe("a8");
    expect(orderedSquares("white")[63]).toBe("h1");
    expect(orderedSquares("black")[0]).toBe("h1");
    expect(orderedSquares("black")[63]).toBe("a8");
  });

  it("renders the starting board", () => {
    const game = new ChessGame();
    const rendered = renderBoardText(game.snapshot(), "white");

    expect(rendered).toContain("8  ♜  ♞  ♝  ♛  ♚  ♝  ♞  ♜ ");
    expect(rendered).toContain("1  ♜  ♞  ♝  ♛  ♚  ♝  ♞  ♜ ");
    expect(rendered).toContain("   a  b  c  d  e  f  g  h ");
  });

  it("uses unicode piece icons", () => {
    expect(getPieceGlyph("p")).toBe("♙");
    expect(getPieceGlyph("k")).toBe("♚");
  });
});

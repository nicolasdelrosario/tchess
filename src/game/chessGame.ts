import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { Side } from "../types.js";

export type MoveInput = {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
};

export type GameSnapshot = {
  fen: string;
  turn: Side;
  board: ReturnType<Chess["board"]>;
  history: Move[];
  status: string;
  isGameOver: boolean;
  isCheck: boolean;
};

const colorToSide = (color: Color): Side => (color === "w" ? "white" : "black");

export class ChessGame {
  private readonly chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  snapshot(): GameSnapshot {
    return {
      fen: this.chess.fen(),
      turn: colorToSide(this.chess.turn()),
      board: this.chess.board(),
      history: this.chess.history({ verbose: true }),
      status: this.status(),
      isGameOver: this.chess.isGameOver(),
      isCheck: this.chess.isCheck()
    };
  }

  move(input: MoveInput): Move {
    return this.chess.move(input);
  }

  tryMove(input: MoveInput): Move | null {
    try {
      return this.chess.move(input);
    } catch {
      return null;
    }
  }

  undo(): Move | null {
    return this.chess.undo();
  }

  legalMoves(from?: Square): Move[] {
    return this.chess.moves({ square: from, verbose: true });
  }

  pieceAt(square: Square): { type: PieceSymbol; color: Color } | false {
    return this.chess.get(square) ?? false;
  }

  status(): string {
    if (this.chess.isCheckmate()) {
      return `${colorToSide(this.chess.turn())} is checkmated`;
    }

    if (this.chess.isStalemate()) {
      return "Draw by stalemate";
    }

    if (this.chess.isThreefoldRepetition()) {
      return "Draw by threefold repetition";
    }

    if (this.chess.isInsufficientMaterial()) {
      return "Draw by insufficient material";
    }

    if (this.chess.isDraw()) {
      return "Draw";
    }

    if (this.chess.isCheck()) {
      return `${colorToSide(this.chess.turn())} is in check`;
    }

    return `${colorToSide(this.chess.turn())} to move`;
  }
}

export function parseMoveInput(raw: string): MoveInput | null {
  const normalized = raw.trim().toLowerCase();
  const match = normalized.match(/^([a-h][1-8])\s*-?\s*([a-h][1-8])\s*([qrbn])?$/);

  if (!match) {
    return null;
  }

  return {
    from: match[1] as Square,
    to: match[2] as Square,
    promotion: match[3] as MoveInput["promotion"]
  };
}

export function sideToColor(side: Side): Color {
  return side === "white" ? "w" : "b";
}

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { Color, PieceSymbol, Square } from "chess.js";
import type { GameSnapshot } from "../game/chessGame.js";
import type { Side } from "../types.js";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

const pieceGlyphs: Record<PieceSymbol, string> = {
  p: "♙",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚"
};

const pieceGlyphsByColor: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔"
  },
  b: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚"
  }
};

// Piece block art adapted from chess-tui's MIT-licensed DEFAULT piece style.
const pieceArt: Record<PieceSymbol, string[]> = {
  p: ["     ", " ▄▇▄ ", " ▜█▛ ", "▄███▄", "▔▔▔▔▔"],
  n: ["  ▅ ▅  ", " ▟▛███▖", "▝▀▜███▊", " ▗███▛ ", " ▀▀▀▀▀ "],
  b: ["▗▅  ▖", "██▍ █", "███▍█", "▝███▘", "▀▀▀▀▀"],
  r: ["▗▄ ▃ ▄▖", "▐█▄█▄█▌", "▝▜███▛▘", " ▟███▙ ", "▝▀▀▀▀▀▘"],
  q: ["▗  ▂  ▖", "▐▙▟█▙▟▌", " ▜███▛ ", " ▗███▖ ", "▝▀▀▀▀▀▘"],
  k: ["  ▂▃╋▃▂  ", " ▐█████▋ ", "  ▜███▛  ", "   ▟█▙   ", "  ▀▀▀▀▀  "]
};

const compactPieceArt: Record<PieceSymbol, string[]> = {
  p: ["  ▂  ", " ▆█▆ ", " ▔▔▔ "],
  n: [" ▄▟▟▖", " ▂█▛▘", "▝▀▀▀▘"],
  b: [" ▆▖▆ ", " ▐▙▌ ", " ▀▀▀ "],
  r: [" ▅ ▅ ", " ███ ", "▝▀▀▀▘"],
  q: [" ▆▄▆ ", " ▗█▖ ", " ▀▀▀ "],
  k: ["▗▂╋▂▖", " ▀█▀ ", " ▀▀▀ "]
};

type SquareRenderState = "normal" | "selected" | "last-move" | "check";

const ANSI_RESET = "\x1b[0m";

export const ANSI_BOARD_COLORS = {
  lightSquareEmpty: "\x1b[48;5;146m",
  darkSquareEmpty: "\x1b[48;5;60m",
  lightSquareWithPiece: "\x1b[48;5;146m",
  darkSquareWithPiece: "\x1b[48;5;60m",
  selectedSquare: "\x1b[48;5;117m",
  lastMoveSquare: "\x1b[48;5;180m",
  checkSquare: "\x1b[48;5;204m",
  legalSquare: "\x1b[48;5;114m",
  whitePieceOnLight: "\x1b[38;5;231m",
  whitePieceOnDark: "\x1b[38;5;231m",
  blackPieceOnLight: "\x1b[38;5;16m",
  blackPieceOnDark: "\x1b[38;5;16m",
  legalMarker: "\x1b[38;5;15m",
  coordinate: "\x1b[38;5;245m"
};

const BOARD_ART_HEIGHT = 5;
const COMPACT_ART_HEIGHT = 3;

export function orderedSquares(perspective: Side): Square[] {
  const shownRanks = perspective === "white" ? [...ranks].reverse() : [...ranks];
  const shownFiles = perspective === "white" ? [...files] : [...files].reverse();

  return shownRanks.flatMap((rank) => shownFiles.map((file) => `${file}${rank}` as Square));
}

export function getPieceGlyph(type: PieceSymbol): string {
  return pieceGlyphs[type];
}

export function renderBoardText(snapshot: GameSnapshot, perspective: Side): string {
  const squares = orderedSquares(perspective);
  const rows: string[] = [];
  const shownFiles = perspective === "white" ? [...files] : [...files].reverse();

  for (let row = 0; row < 8; row += 1) {
    const rowSquares = squares.slice(row * 8, row * 8 + 8);
    const cells = rowSquares.map((square) => {
      const piece = pieceAt(snapshot, square);
      return ` ${piece ? getPieceGlyph(piece.type as PieceSymbol) : " "} `;
    });
    rows.push(`${rowSquares[0][1]} ${cells.join("")}`);
  }

  rows.push(`  ${shownFiles.map((file) => ` ${file} `).join("")}`);
  return rows.join("\n");
}

export function renderSquare(
  file: number,
  rank: number,
  piece: string | null,
  state: SquareRenderState
): string {
  const isLight = (file + rank) % 2 === 1;
  const background = getAnsiBackground(isLight, Boolean(piece), state);
  const foreground = piece ? getAnsiPieceForeground(piece, isLight) : "";

  return `${background}${foreground} ${piece ?? " "} ${ANSI_RESET}`;
}

export const ChessBoard = React.memo(function ChessBoard({
  snapshot,
  perspective,
  selected,
  cursor,
  legalTargets = [],
  cellWidth = 4,
  cellHeight
}: {
  snapshot: GameSnapshot;
  perspective: Side;
  selected?: Square | null;
  cursor?: Square | null;
  legalTargets?: Square[];
  cellWidth?: number;
  cellHeight?: number;
}) {
  const board = useMemo(
    () => renderBoardBlock(snapshot, perspective, {
      selected,
      cursor,
      legalTargets,
      cellWidth,
      cellHeight
    }),
    [cellHeight, cellWidth, cursor, legalTargets, perspective, selected, snapshot]
  );

  return (
    <Box>
      <Text>{board}</Text>
    </Box>
  );
});

export function renderBoardBlock(
  snapshot: GameSnapshot,
  perspective: Side,
  {
    selected = null,
    cursor = null,
    legalTargets = [],
    cellWidth = 4,
    cellHeight
  }: {
    selected?: Square | null;
    cursor?: Square | null;
    legalTargets?: Square[];
    cellWidth?: number;
    cellHeight?: number;
  } = {}
): string {
  const squares = orderedSquares(perspective);
  const shownFiles = perspective === "white" ? [...files] : [...files].reverse();
  const legalTargetSet = new Set(legalTargets);
  const resolvedCellHeight = cellHeight ?? (cellWidth >= 8 ? BOARD_ART_HEIGHT : COMPACT_ART_HEIGHT);
  const labelRow = Math.floor(resolvedCellHeight / 2);
  const lastMove = snapshot.history.at(-1);
  const rows = [
    `   ${shownFiles
      .map((file) => `${ANSI_BOARD_COLORS.coordinate}${centerCell(file, cellWidth)}${ANSI_RESET}`)
      .join("")}`
  ];

  for (let row = 0; row < 8; row += 1) {
    const rowSquares = squares.slice(row * 8, row * 8 + 8);
    const renderedSquares = rowSquares.map((square) => {
      const piece = pieceAt(snapshot, square);
      const isLastMove = Boolean(lastMove && (square === lastMove.from || square === lastMove.to));
      const isLegalTarget = legalTargetSet.has(square);
      const state = getSquareRenderState(snapshot, square, {
        isCursor: square === cursor,
        isLastMove,
        isLegalTarget,
        isSelected: square === selected
      });
      const fileIndex = files.indexOf(square[0] as (typeof files)[number]);
      const rankIndex = ranks.indexOf(square[1] as (typeof ranks)[number]);

      if (resolvedCellHeight === 1) {
        return [renderGlyphSquare(fileIndex, rankIndex, piece, state, isLegalTarget, cellWidth)];
      }

      return piece
        ? renderPieceSquare(fileIndex, rankIndex, piece.type as PieceSymbol, piece.color, state, cellWidth, resolvedCellHeight)
        : renderEmptySquare(fileIndex, rankIndex, state, isLegalTarget, cellWidth, resolvedCellHeight);
    });

    for (let squareLine = 0; squareLine < resolvedCellHeight; squareLine += 1) {
      const rankLabel = squareLine === labelRow
        ? `${ANSI_BOARD_COLORS.coordinate}${rowSquares[0][1]}${ANSI_RESET}  `
        : "   ";
      rows.push(`${rankLabel}${renderedSquares.map((lines) => lines[squareLine]).join("")}`);
    }
  }

  return rows.join("\n");
}

function getSquareRenderState(
  snapshot: GameSnapshot,
  square: Square,
  state: { isCursor: boolean; isLastMove: boolean; isLegalTarget: boolean; isSelected: boolean }
): SquareRenderState {
  if (isKingInCheck(snapshot, square)) return "check";
  if (state.isSelected || state.isCursor || state.isLegalTarget) return "selected";
  if (state.isLastMove) return "last-move";
  return "normal";
}

function getAnsiBackground(isLight: boolean, hasPiece: boolean, state: SquareRenderState): string {
  if (state === "check") return ANSI_BOARD_COLORS.checkSquare;
  if (state === "selected") return ANSI_BOARD_COLORS.selectedSquare;
  if (state === "last-move") return ANSI_BOARD_COLORS.lastMoveSquare;
  if (isLight) {
    return hasPiece ? ANSI_BOARD_COLORS.lightSquareWithPiece : ANSI_BOARD_COLORS.lightSquareEmpty;
  }

  return hasPiece ? ANSI_BOARD_COLORS.darkSquareWithPiece : ANSI_BOARD_COLORS.darkSquareEmpty;
}

function getAnsiPieceForeground(piece: string, isLight: boolean): string {
  const isWhitePiece = "♙♘♗♖♕♔".includes(piece);
  if (isWhitePiece) {
    return isLight ? ANSI_BOARD_COLORS.whitePieceOnLight : ANSI_BOARD_COLORS.whitePieceOnDark;
  }

  return isLight ? ANSI_BOARD_COLORS.blackPieceOnLight : ANSI_BOARD_COLORS.blackPieceOnDark;
}

function getColoredPieceGlyph(type: PieceSymbol, color: Color): string {
  return pieceGlyphsByColor[color][type];
}

function renderPieceSquare(
  file: number,
  rank: number,
  type: PieceSymbol,
  color: Color,
  state: SquareRenderState,
  width: number,
  height: number
): string[] {
  const isLight = (file + rank) % 2 === 1;
  const background = getAnsiBackground(isLight, true, state);
  const foreground = color === "w"
    ? isLight ? ANSI_BOARD_COLORS.whitePieceOnLight : ANSI_BOARD_COLORS.whitePieceOnDark
    : isLight ? ANSI_BOARD_COLORS.blackPieceOnLight : ANSI_BOARD_COLORS.blackPieceOnDark;
  const art = normalizeArt(height >= BOARD_ART_HEIGHT ? pieceArt[type] : compactPieceArt[type], width, height);

  return art.map((line) => `${background}${foreground}${line}${ANSI_RESET}`);
}

function renderGlyphSquare(
  file: number,
  rank: number,
  piece: { type: PieceSymbol; color: Color } | null,
  state: SquareRenderState,
  isLegalTarget: boolean,
  width: number
): string {
  const isLight = (file + rank) % 2 === 1;
  const background = isLegalTarget ? ANSI_BOARD_COLORS.legalSquare : getAnsiBackground(isLight, Boolean(piece), state);
  const foreground = piece
    ? piece.color === "w"
      ? isLight ? ANSI_BOARD_COLORS.whitePieceOnLight : ANSI_BOARD_COLORS.whitePieceOnDark
      : isLight ? ANSI_BOARD_COLORS.blackPieceOnLight : ANSI_BOARD_COLORS.blackPieceOnDark
    : isLegalTarget ? ANSI_BOARD_COLORS.legalMarker : "";
  const content = piece ? getColoredPieceGlyph(piece.type, piece.color) : isLegalTarget ? "•" : "";

  return `${background}${foreground}${centerCell(content, width)}${ANSI_RESET}`;
}

function renderEmptySquare(
  file: number,
  rank: number,
  state: SquareRenderState,
  isLegalTarget: boolean,
  width: number,
  height: number
): string[] {
  const isLight = (file + rank) % 2 === 1;
  const background = isLegalTarget ? ANSI_BOARD_COLORS.legalSquare : getAnsiBackground(isLight, false, state);
  const foreground = isLegalTarget ? ANSI_BOARD_COLORS.legalMarker : "";
  const targetRow = Math.floor(height / 2);

  return Array.from({ length: height }, (_, row) => {
    const content = isLegalTarget && row === targetRow ? centerCell("•", width) : " ".repeat(width);
    return `${background}${foreground}${content}${ANSI_RESET}`;
  });
}

function normalizeArt(art: string[], width: number, height: number): string[] {
  const croppedArt = art.map((line) => centerCell(clipVisible(line, width), width));
  const topPadding = Math.max(0, Math.floor((height - croppedArt.length) / 2));
  const bottomPadding = Math.max(0, height - croppedArt.length - topPadding);

  return [
    ...Array.from({ length: topPadding }, () => " ".repeat(width)),
    ...croppedArt.slice(0, height),
    ...Array.from({ length: bottomPadding }, () => " ".repeat(width))
  ].slice(0, height);
}

function clipVisible(value: string, width: number): string {
  return Array.from(value).slice(0, width).join("");
}

function centerCell(value: string, width: number): string {
  const visibleLength = Array.from(value).length;
  const left = Math.floor((width - visibleLength) / 2);
  const right = Math.max(0, width - visibleLength - left);
  return `${" ".repeat(Math.max(0, left))}${value}${" ".repeat(right)}`;
}

function pieceAt(snapshot: GameSnapshot, square: Square) {
  const fileIndex = files.indexOf(square[0] as (typeof files)[number]);
  const rankIndex = ranks.indexOf(square[1] as (typeof ranks)[number]);
  return snapshot.board[7 - rankIndex][fileIndex];
}

function isKingInCheck(snapshot: GameSnapshot, square: Square): boolean {
  if (!snapshot.isCheck) {
    return false;
  }

  const piece = pieceAt(snapshot, square);
  const checkedColor: Color = snapshot.turn === "white" ? "w" : "b";
  return piece?.type === "k" && piece.color === checkedColor;
}

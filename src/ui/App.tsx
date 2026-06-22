import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { Move, PieceSymbol, Square } from "chess.js";
import { ChessGame, parseMoveInput, type GameSnapshot } from "../game/chessGame.js";
import { DIFFICULTIES, getDifficultyByElo } from "../game/difficulties.js";
import { StockfishEngine, StockfishUnavailableError, stockfishSourceLabel } from "../engine/stockfish.js";
import type { Difficulty, GameMode, PlayerSideChoice, Side } from "../types.js";
import type { CliConfig } from "../cliArgs.js";
import { ChessBoard, orderedSquares, renderBoardText } from "./board.js";

type Step = "home" | "playing";

type Selection = {
  mode: GameMode;
  side: PlayerSideChoice;
  difficulty: Difficulty;
};

const sideChoices: PlayerSideChoice[] = ["white", "black", "random"];

const wordmark = [
  "████████╗ ██████╗██╗  ██╗███████╗███████╗███████╗",
  "╚══██╔══╝██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝",
  "   ██║   ██║     ███████║█████╗  ███████╗███████╗",
  "   ██║   ██║     ██╔══██║██╔══╝  ╚════██║╚════██║",
  "   ██║   ╚██████╗██║  ██║███████╗███████║███████║",
  "   ╚═╝    ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝"
];

const theme = {
  base: "#1E1E2E",
  surface0: "#313244",
  surface1: "#45475A",
  surface2: "#585B70",
  overlay0: "#6C7086",
  subtext0: "#A6ADC8",
  subtext1: "#BAC2DE",
  text: "#CDD6F4",
  lavender: "#B4BEFE",
  blue: "#89B4FA",
  sky: "#89DCEB",
  green: "#A6E3A1",
  yellow: "#F9E2AF",
  peach: "#FAB387",
  red: "#F38BA8",
  mauve: "#CBA6F7"
};

type HomeAction = {
  command: string;
  label: string;
  detail: string;
  selection: Selection;
};

function nextValue<T>(values: readonly T[], current: T): T {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length] ?? values[0];
}

export function App({ config }: { config: CliConfig }) {
  const { exit } = useApp();
  const [selection, setSelection] = useState<Selection>({
    mode: config.mode ?? "local",
    side: config.side ?? "white",
    difficulty: getDifficultyByElo(config.elo ?? 1200)
  });
  const [step, setStep] = useState<Step>(config.mode && config.side ? "playing" : "home");

  const choose = (patch: Partial<Selection>) => {
    setSelection((current) => ({ ...current, ...patch }));
  };

  if (step === "home") {
    return (
      <HomeScreen
        selection={selection}
        onChoose={choose}
        onStart={(nextSelection) => {
          setSelection(nextSelection);
          setStep("playing");
        }}
        onExit={exit}
      />
    );
  }

  return <GameScreen selection={selection} onExit={exit} />;
}

function HomeScreen({
  selection,
  onChoose,
  onStart,
  onExit
}: {
  selection: Selection;
  onChoose: (patch: Partial<Selection>) => void;
  onStart: (selection: Selection) => void;
  onExit: () => void;
}) {
  const { stdout } = useStdout();
  const [index, setIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("Type /new ai or press Enter on a command.");
  const [introStep, setIntroStep] = useState(0);
  const engineSource = useMemo(() => stockfishSourceLabel(), []);
  const preview = useMemo(() => new ChessGame().snapshot(), []);
  const screenWidth = stdout.columns ?? 100;
  const homeWidth = Math.min(100, screenWidth);
  const homeOffset = Math.max(0, Math.floor((screenWidth - homeWidth) / 2));
  const promptWidth = Math.max(70, homeWidth - 8);
  const actions = useMemo<HomeAction[]>(
    () => [
      {
        command: "/new ai",
        label: "Play vs Stockfish",
        detail: `${labelForOption(selection.side)} · ${selection.difficulty.label} ${selection.difficulty.elo}`,
        selection: { ...selection, mode: "ai" }
      },
      {
        command: "/new local",
        label: "Local 1 vs 1",
        detail: "same keyboard · board flips by turn",
        selection: { ...selection, mode: "local" }
      },
      {
        command: "/side",
        label: "Cycle side",
        detail: labelForOption(selection.side),
        selection
      },
      {
        command: "/elo",
        label: "Cycle strength",
        detail: `${selection.difficulty.label} · ${selection.difficulty.elo} Elo`,
        selection
      }
    ],
    [selection]
  );

  useEffect(() => {
    const timers = [80, 170, 260, 350].map((delay, timerIndex) =>
      setTimeout(() => setIntroStep(timerIndex + 1), delay)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onExit();
      return;
    }

    if (key.upArrow || input === "k") {
      setIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.downArrow || input === "j") {
      setIndex((current) => Math.min(actions.length - 1, current + 1));
      return;
    }

    if (key.tab) {
      setIndex((current) => (current + 1) % actions.length);
      return;
    }

    if (key.backspace || key.delete) {
      setPrompt((current) => current.slice(0, -1));
      return;
    }

    if (key.return) {
      if (prompt.trim().length > 0) {
        runHomeCommand(prompt);
        setPrompt("");
        return;
      }

      runAction(actions[index]);
      return;
    }

    if (/^[a-z0-9/\s-]$/i.test(input)) {
      setPrompt((current) => `${current}${input}`.slice(0, 44));
    }
  });

  const runAction = (action: HomeAction) => {
    if (action.command === "/side") {
      const nextSide = nextValue(sideChoices, selection.side);
      onChoose({ side: nextSide });
      setMessage(`Side set to ${labelForOption(nextSide)}.`);
      return;
    }

    if (action.command === "/elo") {
      const nextDifficulty = nextValue(DIFFICULTIES, selection.difficulty);
      onChoose({ difficulty: nextDifficulty });
      setMessage(`Strength set to ${nextDifficulty.label} ${nextDifficulty.elo}.`);
      return;
    }

    onStart(action.selection);
  };

  const runHomeCommand = (raw: string) => {
    const command = raw.trim().toLowerCase();
    const eloMatch = command.match(/^\/?elo\s+(\d+)$/);
    const sideMatch = command.match(/^\/?side\s+(white|black|random)$/);

    if (command === "/new ai" || command === "new ai" || command === "ai") {
      onStart({ ...selection, mode: "ai" });
      return;
    }

    if (command === "/new local" || command === "new local" || command === "local") {
      onStart({ ...selection, mode: "local" });
      return;
    }

    if (command === "/side" || command === "side") {
      runAction(actions[2]);
      return;
    }

    if (sideMatch) {
      const side = sideMatch[1] as PlayerSideChoice;
      onChoose({ side });
      setMessage(`Side set to ${labelForOption(side)}.`);
      return;
    }

    if (command === "/elo" || command === "elo") {
      runAction(actions[3]);
      return;
    }

    if (eloMatch) {
      const difficulty = getDifficultyByElo(Number(eloMatch[1]));
      onChoose({ difficulty });
      setMessage(`Strength set to ${difficulty.label} ${difficulty.elo}.`);
      return;
    }

    if (command === "/help" || command === "help") {
      setMessage("Commands: /new ai, /new local, /side black, /elo 1500.");
      return;
    }

    setMessage(`Unknown command: ${raw}`);
  };

  return (
    <Box flexDirection="column" paddingX={1} width={homeWidth} marginLeft={homeOffset}>
      <Box justifyContent="space-between" paddingX={1}>
        <Text color="gray">terminal chess</Text>
        <Text color="gray">v0.1 · local</Text>
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor={theme.surface0} paddingX={2} paddingY={1} flexDirection="column">
        <Box justifyContent="center">
          <Box flexDirection="column">
            {wordmark.map((line, lineIndex) => (
              <Text key={line} color={lineIndex < 2 ? theme.overlay0 : theme.text} bold>
                {line}
              </Text>
            ))}
          </Box>
        </Box>

        <Box marginTop={1} justifyContent="center">
          <Text color={theme.sky}>Stockfish ready</Text>
          <Text color="gray"> · {engineSource} · offline engine</Text>
        </Box>

        {introStep >= 1 && (
          <Box marginTop={2} justifyContent="center">
            <Text color="gray">Fast start</Text>
          </Box>
        )}

        {introStep >= 2 && (
          <Box marginTop={1} flexDirection="column">
            {actions.map((action, actionIndex) => (
              <Box key={action.command}>
                <Box width={14}>
                  <Text color={actionIndex === index ? theme.sky : theme.overlay0}>
                    {actionIndex === index ? "› " : "  "}
                    {action.command}
                  </Text>
                </Box>
                <Box width={24}>
                  <Text color={actionIndex === index ? theme.text : "gray"}>{action.label}</Text>
                </Box>
                <Text color="gray">{action.detail}</Text>
              </Box>
            ))}
          </Box>
        )}

        {introStep >= 3 && (
          <Box marginTop={2}>
            <Box width={45} flexDirection="column">
              <Text color={theme.text} bold>Recent</Text>
              <Box marginTop={1} borderStyle="single" borderColor={theme.surface0} paddingX={1} paddingY={1} flexDirection="column">
                <Text color="gray">No saved games yet.</Text>
                <Text color="gray">Start a match and this space becomes your session history.</Text>
              </Box>
            </Box>

            <Box marginLeft={3} flexDirection="column">
              <Text color={theme.text} bold>Board preview</Text>
              <Box marginTop={1}>
                <Text color="gray">{renderBoardText(preview, "white")}</Text>
              </Box>
            </Box>
          </Box>
        )}

        {introStep >= 4 && (
          <Box marginTop={1} flexDirection="column">
            <Box borderStyle="single" borderColor={theme.surface1} paddingX={1} width={promptWidth}>
              <Text color={theme.sky}>{"> "}</Text>
              <Text color={theme.text}>{prompt || actions[index]?.command || "/new ai"}</Text>
            </Box>
            <Box justifyContent="space-between" width={promptWidth}>
              <Text color="gray">enter start · ↑↓ select · tab next · /help · q quit</Text>
              <Text color="gray">
                {labelForOption(selection.side)} · {selection.difficulty.elo} Elo
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      <Box marginTop={1} paddingX={1}>
        <Text color={message.startsWith("Unknown") ? "red" : "gray"}>{message}</Text>
      </Box>
    </Box>
  );
}

function GameScreen({ selection, onExit }: { selection: Selection; onExit: () => void }) {
  const { stdout } = useStdout();
  const [game] = useState(() => new ChessGame());
  const [snapshot, setSnapshot] = useState(() => game.snapshot());
  const [cursorIndex, setCursorIndex] = useState(() => orderedSquares("white").indexOf("e2"));
  const [selected, setSelected] = useState<Square | null>(null);
  const [typedMove, setTypedMove] = useState("");
  const [message, setMessage] = useState("");
  const [thinking, setThinking] = useState(false);
  const [blockedAiFen, setBlockedAiFen] = useState<string | null>(null);

  const playerSide = useMemo<Side>(() => {
    if (selection.side === "random") {
      return Math.random() > 0.5 ? "white" : "black";
    }

    return selection.side;
  }, [selection.side]);

  const engine = useMemo(() => new StockfishEngine(), []);
  const aiSide: Side = playerSide === "white" ? "black" : "white";
  const perspective: Side =
    selection.mode === "local" ? snapshot.turn : playerSide;
  const squares = orderedSquares(perspective);
  const cursor = squares[cursorIndex] ?? squares[0];
  const isAiTurn =
    selection.mode === "ai" &&
    snapshot.turn === aiSide &&
    !snapshot.isGameOver &&
    blockedAiFen !== snapshot.fen;
  const screenWidth = stdout.columns ?? 160;
  const screenHeight = stdout.rows ?? 40;
  const shellWidth = Math.min(220, screenWidth);
  const shellOffset = Math.max(0, Math.floor((screenWidth - shellWidth) / 2));
  const shellInnerWidth = Math.max(72, shellWidth - 4);
  const fixedChromeHeight = 12;
  const boardHeightFor = (height: number, details: boolean) => fixedChromeHeight + 1 + height * 8 + (details ? 4 : 0);
  const fitsBoard = (height: number, details = false) => boardHeightFor(height, details) < screenHeight;
  const boardCellHeight = fitsBoard(5) ? 5 : fitsBoard(3) ? 3 : 1;
  const useLargeBoard = boardCellHeight === 5;
  const showBoardDetails = boardCellHeight > 1 && fitsBoard(boardCellHeight, true);
  const showSidePanels = screenHeight >= 44 && boardCellHeight > 1;
  const leftRailWidth = showSidePanels && shellWidth >= 150 ? 24 : 0;
  const rightRailWidth = showSidePanels ? shellWidth >= 180 ? 66 : shellWidth >= 130 ? 44 : 34 : 0;
  const boardGap = leftRailWidth > 0 ? 2 : 0;
  const boardAreaWidth = Math.max(43, shellInnerWidth - leftRailWidth - rightRailWidth - boardGap - 2);
  const maxCellWidth = useLargeBoard ? 11 : boardCellHeight === 1 ? 3 : 7;
  const minCellWidth = boardCellHeight === 1 ? 3 : 5;
  const cellWidth = Math.min(maxCellWidth, Math.max(minCellWidth, Math.floor((boardAreaWidth - 3) / 8)));
  const boardWidth = 3 + cellWidth * 8;
  const engineSource = useMemo(() => stockfishSourceLabel(), []);
  const typedSource = typedMove.match(/^([a-h][1-8])/)?.[1] as Square | undefined;
  const activeSelected = selected ?? typedSource ?? null;
  const legalTargets = useMemo(() => {
    if (!activeSelected) {
      return [];
    }

    return game.legalMoves(activeSelected).map((move) => move.to);
  }, [activeSelected, game, snapshot.fen]);
  const lastMove = snapshot.history.at(-1);
  const evaluation = getEvaluationState(snapshot, thinking);
  const topStatus = gameStatusLabel(snapshot, selection, thinking, aiSide, evaluation.label);
  const statusColor = gameStatusColor(snapshot, thinking);
  const captures = capturedPieces(snapshot.history);
  const palette = paletteState({
    typedMove,
    selected: activeSelected,
    cursor,
    legalTargets,
    snapshot,
    message,
    thinking,
    isAiTurn
  });

  useEffect(() => {
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    if (!isAiTurn || thinking) {
      return;
    }

    setThinking(true);
    setMessage("Stockfish is thinking...");

    engine
      .bestMove(snapshot.fen, selection.difficulty)
      .then((uciMove) => {
        const parsed = parseMoveInput(uciMove);
        if (!parsed) {
          setMessage(`Stockfish returned an invalid move: ${uciMove}`);
          return;
        }

        const move = game.tryMove(parsed);
        if (!move) {
          setMessage(`Stockfish move was illegal: ${uciMove}`);
          return;
        }

        setSnapshot(game.snapshot());
        setSelected(null);
        setBlockedAiFen(null);
        setMessage(`Stockfish played ${move.san}`);
      })
      .catch((error: unknown) => {
        setBlockedAiFen(snapshot.fen);
        if (error instanceof StockfishUnavailableError) {
          setMessage(error.message);
        } else if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage("Stockfish failed unexpectedly.");
        }
      })
      .finally(() => setThinking(false));
  }, [aiSide, engine, game, isAiTurn, selection.difficulty, snapshot.fen, thinking]);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onExit();
      return;
    }

    if (thinking || isAiTurn || snapshot.isGameOver) {
      return;
    }

    if (input === "u" && selection.mode === "local") {
      const undone = game.undo();
      if (undone) {
        setSnapshot(game.snapshot());
        setMessage(`Undid ${undone.san}`);
      }
      return;
    }

    if (key.leftArrow || input === "h") {
      setCursorIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.rightArrow || input === "l") {
      setCursorIndex((current) => Math.min(63, current + 1));
      return;
    }

    if (key.upArrow || input === "k") {
      setCursorIndex((current) => Math.max(0, current - 8));
      return;
    }

    if (key.downArrow || input === "j") {
      setCursorIndex((current) => Math.min(63, current + 8));
      return;
    }

    if (key.backspace || key.delete) {
      setTypedMove((current) => current.slice(0, -1));
      return;
    }

    if (key.return) {
      if (typedMove.length > 0) {
        submitMove(typedMove);
        setTypedMove("");
        return;
      }

      selectOrMove(cursor);
      return;
    }

    if (/^[a-h1-8qrbn:=\s-]$/i.test(input)) {
      setTypedMove((current) => `${current}${input}`.slice(0, 24));
    }
  });

  const submitMove = (raw: string) => {
    const command = raw.trim().toLowerCase();
    if (command.startsWith(":")) {
      setMessage(command === ":help" ? "Commands: :help, :resign, q quit." : `Command unavailable: ${raw}`);
      return;
    }

    const parsed = parseMoveInput(raw);
    if (!parsed) {
      setMessage(`Invalid input: ${raw}`);
      return;
    }

    const move = game.tryMove(parsed);
    if (!move) {
      setMessage(`Illegal move: ${raw}`);
      return;
    }

    setSnapshot(game.snapshot());
    setSelected(null);
    setBlockedAiFen(null);
    setMessage(`Played ${move.san}`);
  };

  const selectOrMove = (square: Square) => {
    if (!selected) {
      const piece = game.pieceAt(square);
      if (!piece) {
        setMessage("Select a piece first.");
        return;
      }

      if ((piece.color === "w" ? "white" : "black") !== snapshot.turn) {
        setMessage("That piece cannot move this turn.");
        return;
      }

      setSelected(square);
      setMessage(`Selected ${square}`);
      return;
    }

    const move = game.tryMove({ from: selected, to: square, promotion: "q" });
    if (!move) {
      setMessage(`Illegal move: ${selected}${square}`);
      setSelected(null);
      return;
    }

    setSnapshot(game.snapshot());
    setSelected(null);
    setBlockedAiFen(null);
    setMessage(`Played ${move.san}`);
  };

  return (
    <Box flexDirection="column" width={shellWidth} marginLeft={shellOffset}>
      <Box justifyContent="space-between" paddingX={1} borderStyle="single" borderColor={theme.surface0}>
        <Text color={statusColor} bold>{topStatus}</Text>
        <Text color={evaluation.color} bold>{evaluation.compact}</Text>
        <Text color={thinking ? theme.sky : "gray"}>
          {selection.mode === "ai" ? `ENGINE ${thinking ? "◐" : "READY"} ${selection.difficulty.moveTimeMs}ms` : "ENGINE OFF"}
        </Text>
        <Text color="gray">{selection.mode === "ai" ? "ENGINE MATCH" : "LOCAL BOARD"}</Text>
        <Text color="gray">? help  esc menu  q quit</Text>
      </Box>

      <Box borderStyle="round" borderColor={theme.surface0} paddingX={1} paddingY={1} flexDirection="column">
        <Box>
          {leftRailWidth > 0 && (
            <Box flexDirection="column" width={leftRailWidth} marginRight={boardGap}>
              <CaptureRail captures={captures} snapshot={snapshot} />
            </Box>
          )}

          <Box flexDirection="column" width={boardWidth}>
            {showBoardDetails && <CaptureTray label="Captured by White" pieces={captures.byWhite} width={boardWidth} />}
            <ChessBoard
              snapshot={snapshot}
              perspective={perspective}
              selected={activeSelected}
              cursor={cursor}
              legalTargets={legalTargets}
              cellWidth={cellWidth}
              cellHeight={boardCellHeight}
            />
            {showBoardDetails && <CaptureTray label="Captured by Black" pieces={captures.byBlack} width={boardWidth} capturedColor="white" />}
            {showBoardDetails && (
              <Box marginTop={1}>
                <Text color="gray">
                  Last {lastMove ? `${lastMove.from}→${lastMove.to} ${lastMove.san}` : "none"} · Legal {legalTargets.length > 0 ? legalTargets.slice(0, 8).join(" ") : "--"}
                </Text>
              </Box>
            )}
          </Box>

          {showSidePanels && (
            <Box marginLeft={2} flexDirection="column" width={rightRailWidth}>
              <AnalysisRail
                selection={selection}
                snapshot={snapshot}
                thinking={thinking}
                engineSource={engineSource}
                evaluation={evaluation}
                lastMove={lastMove}
              />
            </Box>
          )}
        </Box>

        <Box marginTop={1} borderStyle="single" borderColor={palette.borderColor} paddingX={1} width={shellInnerWidth}>
          <Text color={palette.promptColor} bold>{palette.prompt}</Text>
          <Text color={theme.text}>{typedMove || palette.placeholder}</Text>
          <Text color="gray">  {palette.suggestions}</Text>
        </Box>

        <Box justifyContent="space-between" width={shellInnerWidth}>
          <Text color={palette.messageColor}>{palette.feedback}</Text>
          <Text color="gray">{activeSelected ? `selected ${activeSelected}` : `cursor ${cursor}`}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function CaptureRail({
  captures,
  snapshot
}: {
  captures: CaptureSummary;
  snapshot: GameSnapshot;
}) {
  return (
    <Box flexDirection="column">
      <Text color={theme.text} bold>WHITE</Text>
      <Text color="gray">clock --:--</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Captured</Text>
        <Text color={theme.text}>{pieceTray(captures.byWhite) || "--"}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Material</Text>
        <Text color={captures.material === 0 ? "gray" : captures.material > 0 ? theme.sky : theme.red}>
          {materialLabel(captures.material)}
        </Text>
      </Box>
      <Box marginTop={2} flexDirection="column">
        <Text color={theme.text} bold>BLACK</Text>
        <Text color="gray">clock --:--</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Captured</Text>
        <Text color={theme.subtext1}>{pieceTray(captures.byBlack, "white") || "--"}</Text>
      </Box>
      <Box marginTop={2} flexDirection="column">
        <Text color={gameStatusColor(snapshot, false)} bold>{snapshot.status}</Text>
        <Text color="gray">review-ready board</Text>
      </Box>
    </Box>
  );
}

function CaptureTray({
  label,
  pieces,
  width,
  capturedColor = "black"
}: {
  label: string;
  pieces: PieceSymbol[];
  width: number;
  capturedColor?: "white" | "black";
}) {
  return (
    <Box width={width} justifyContent="space-between">
      <Text color="gray">{label}</Text>
      <Text color={theme.text}>{pieceTray(pieces, capturedColor) || "--"}</Text>
    </Box>
  );
}

function AnalysisRail({
  selection,
  snapshot,
  thinking,
  engineSource,
  evaluation,
  lastMove
}: {
  selection: Selection;
  snapshot: GameSnapshot;
  thinking: boolean;
  engineSource: string;
  evaluation: EvaluationState;
  lastMove?: Move;
}) {
  const moves = formatMoves(snapshot.history);

  return (
    <Box flexDirection="column">
      {snapshot.isGameOver ? <GameOverPanel snapshot={snapshot} lastMove={lastMove} /> : <EvalPanel evaluation={evaluation} thinking={thinking} />}

      <RailSection title="BEST LINE">
        {selection.mode === "ai" ? (
          <>
            <Text color={thinking ? theme.sky : "gray"}>{thinking ? "Stockfish searching..." : "Engine ready. Make a move."}</Text>
            <Text color="gray">{selection.difficulty.label} · {selection.difficulty.elo} Elo · {engineSource}</Text>
          </>
        ) : (
          <Text color="gray">Engine off in local board.</Text>
        )}
      </RailSection>

      <RailSection title="MOVES">
        {moves.length > 0 ? moves.map((move) => <MoveRow key={move.ply} row={move} />) : <EmptyMoves />}
      </RailSection>
    </Box>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.text} bold>{title}</Text>
      <Box flexDirection="column" marginTop={0}>
        {children}
      </Box>
    </Box>
  );
}

type EvaluationState = {
  label: string;
  compact: string;
  color: string;
  side: "white" | "black" | "neutral";
};

type CaptureSummary = {
  byWhite: PieceSymbol[];
  byBlack: PieceSymbol[];
  material: number;
};

type MoveRowData = {
  ply: number;
  moveNumber: number;
  white: string;
  black: string;
  active: "white" | "black";
};

function EvalPanel({ evaluation, thinking }: { evaluation: EvaluationState; thinking: boolean }) {
  const rows = ["+4.0", "+3.0", "+2.0", "+1.0", " 0.0", "-1.0", "-2.0", "-3.0", "-4.0"];
  const activeRow = evaluation.side === "white" ? "+1.0" : evaluation.side === "black" ? "-1.0" : " 0.0";

  return (
    <RailSection title="EVALUATION">
      {rows.map((row) => (
        <Box key={row}>
          <Box width={5}>
            <Text color="gray">{row}</Text>
          </Box>
          <Text color={row === " 0.0" ? "gray" : evaluation.color}>┃</Text>
          <Text color={row === activeRow ? evaluation.color : "gray"}>
            {row === activeRow ? `██████ ${evaluation.label}${thinking ? " thinking" : ""}` : row === " 0.0" ? "────────" : ""}
          </Text>
        </Box>
      ))}
    </RailSection>
  );
}

function GameOverPanel({ snapshot, lastMove }: { snapshot: GameSnapshot; lastMove?: Move }) {
  const finalMoveNumber = Math.ceil(snapshot.history.length / 2);

  return (
    <RailSection title="GAME OVER">
      <Text color={theme.yellow} bold>{outcomeLabel(snapshot).toUpperCase()}</Text>
      <Text color="gray">Final move: {lastMove ? `${finalMoveNumber}. ${lastMove.san}` : "--"}</Text>
      <Text color="gray">←/→ review planned · n new · q quit</Text>
    </RailSection>
  );
}

function EmptyMoves() {
  return (
    <>
      <Text color="gray">No moves yet.</Text>
      <Text color="gray">Try e2e4, d2d4, g1f3, c2c4.</Text>
    </>
  );
}

const MoveRow = React.memo(function MoveRow({ row }: { row: MoveRowData }) {
  const activeColor = theme.text;
  const whiteColor = row.active === "white" ? activeColor : "gray";
  const blackColor = row.active === "black" ? activeColor : "gray";

  return (
    <Box>
      <Box width={4}>
        <Text color="gray">{row.moveNumber.toString().padStart(2, " ")}</Text>
      </Box>
      <Box width={12}>
        <Text color={whiteColor} bold={row.active === "white"}>
          {row.active === "white" ? "▸ " : "  "}{decorateSan(row.white).padEnd(8)}
        </Text>
      </Box>
      <Text color={blackColor} bold={row.active === "black"}>
        {row.active === "black" ? "▸ " : "  "}{decorateSan(row.black)}
      </Text>
    </Box>
  );
});

function gameStatusLabel(
  snapshot: GameSnapshot,
  selection: Selection,
  thinking: boolean,
  aiSide: Side,
  evalLabel: string
): string {
  if (snapshot.isGameOver) {
    return `tchess  ${outcomeLabel(snapshot).toUpperCase()}`;
  }

  if (thinking) {
    return `tchess  ${aiSide.toUpperCase()} THINKING  ${evalLabel}`;
  }

  if (snapshot.isCheck) {
    return `tchess  ${snapshot.turn.toUpperCase()} IN CHECK  ${evalLabel}`;
  }

  return `tchess  ${snapshot.turn.toUpperCase()} TO MOVE  ${evalLabel}  ${selection.mode === "ai" ? "ENGINE MATCH" : "LOCAL BOARD"}`;
}

function outcomeLabel(snapshot: GameSnapshot): string {
  if (snapshot.status.includes("checkmated")) {
    return `checkmate · ${snapshot.turn === "white" ? "black" : "white"} wins`;
  }

  return snapshot.status.toLowerCase();
}

function gameStatusColor(snapshot: GameSnapshot, thinking: boolean): string {
  if (snapshot.isGameOver) return theme.yellow;
  if (snapshot.isCheck) return theme.red;
  if (thinking) return theme.sky;
  return theme.green;
}

function messageColor(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("illegal") || normalized.includes("invalid") || normalized.includes("failed") || normalized.includes("timed out")) {
    return theme.red;
  }

  if (normalized.includes("stockfish") || normalized.includes("selected")) {
    return theme.sky;
  }

  return "gray";
}

function labelForOption(option: string): string {
  if (option === "ai") return "Player vs Stockfish";
  if (option === "local") return "Local 1 vs 1";
  if (option === "white") return "White";
  if (option === "black") return "Black";
  if (option === "random") return "Random";
  return option;
}

function getEvaluationState(snapshot: GameSnapshot, thinking: boolean): EvaluationState {
  if (snapshot.isGameOver && snapshot.status.includes("checkmated")) {
    const winner = snapshot.turn === "white" ? "black" : "white";
    return {
      label: `M0 ${winner}`,
      compact: "M0 █████",
      color: theme.red,
      side: winner
    };
  }

  if (snapshot.isGameOver) {
    return { label: "final", compact: "final ▱▱▱▱▱", color: theme.yellow, side: "neutral" };
  }

  if (thinking) {
    return { label: "eval ...", compact: "eval ◐◐◐", color: theme.sky, side: "neutral" };
  }

  return { label: "eval --", compact: "eval -- ▱▱▱▱▱", color: "gray", side: "neutral" };
}

function capturedPieces(history: Move[]): CaptureSummary {
  const byWhite: PieceSymbol[] = [];
  const byBlack: PieceSymbol[] = [];

  for (const move of history) {
    if (!move.captured) {
      continue;
    }

    if (move.color === "w") {
      byWhite.push(move.captured as PieceSymbol);
    } else {
      byBlack.push(move.captured as PieceSymbol);
    }
  }

  byWhite.sort(comparePieces);
  byBlack.sort(comparePieces);

  return {
    byWhite,
    byBlack,
    material: materialValue(byWhite) - materialValue(byBlack)
  };
}

function pieceTray(pieces: PieceSymbol[], capturedColor: "white" | "black" = "black"): string {
  const glyphsByColor: Record<"white" | "black", Record<PieceSymbol, string>> = {
    white: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
    black: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" }
  };

  if (pieces.length <= 10) {
    return pieces.map((piece) => glyphsByColor[capturedColor][piece]).join(" ");
  }

  return (["q", "r", "b", "n", "p"] as PieceSymbol[])
    .map((piece) => {
      const count = pieces.filter((captured) => captured === piece).length;
      return count > 0 ? `${glyphsByColor[capturedColor][piece]}x${count}` : "";
    })
    .filter(Boolean)
    .join(" ");
}

function materialLabel(material: number): string {
  if (material === 0) return "Even";
  return material > 0 ? `White +${material}` : `Black +${Math.abs(material)}`;
}

function comparePieces(left: PieceSymbol, right: PieceSymbol): number {
  const order: Record<PieceSymbol, number> = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 };
  return order[left] - order[right];
}

function materialValue(pieces: PieceSymbol[]): number {
  const values: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return pieces.reduce((total, piece) => total + values[piece], 0);
}

function formatMoves(history: Move[]): MoveRowData[] {
  const rows: MoveRowData[] = [];

  for (let index = 0; index < history.length; index += 2) {
    const white = history[index];
    const black = history[index + 1];
    rows.push({
      ply: black ? index + 2 : index + 1,
      moveNumber: index / 2 + 1,
      white: white?.san ?? "",
      black: black?.san ?? "",
      active: black || !white ? "black" : "white"
    });
  }

  return rows.slice(-14);
}

function decorateSan(san: string): string {
  if (!san) return "";
  return san;
}

function paletteState({
  typedMove,
  selected,
  cursor,
  legalTargets,
  snapshot,
  message,
  thinking,
  isAiTurn
}: {
  typedMove: string;
  selected: Square | null;
  cursor: Square;
  legalTargets: Square[];
  snapshot: GameSnapshot;
  message: string;
  thinking: boolean;
  isAiTurn: boolean;
}) {
  const normalized = message.toLowerCase();
  const isError = normalized.includes("illegal") || normalized.includes("invalid") || normalized.includes("failed") || normalized.includes("timed out");
  const commandMode = typedMove.trim().startsWith(":");
  const legalPreview = legalTargets.slice(0, 8).join(" ");

  if (snapshot.isGameOver) {
    return {
      prompt: "REVIEW › ",
      promptColor: theme.yellow,
      borderColor: theme.yellow,
      placeholder: "q",
      suggestions: "game over · q quit",
      feedback: outcomeLabel(snapshot),
      messageColor: theme.yellow
    };
  }

  if (thinking || isAiTurn) {
    return {
      prompt: "WAIT › ",
      promptColor: theme.sky,
      borderColor: theme.sky,
      placeholder: "",
      suggestions: "engine thinking",
      feedback: message || "Stockfish is thinking...",
      messageColor: theme.sky
    };
  }

  if (commandMode) {
    return {
      prompt: "CMD  › ",
      promptColor: theme.sky,
      borderColor: theme.surface1,
      placeholder: ":help",
      suggestions: ":help  :resign",
      feedback: message || "enter command · esc/q leaves game",
      messageColor: messageColor(message)
    };
  }

  return {
    prompt: "MOVE › ",
    promptColor: isError ? theme.red : theme.sky,
    borderColor: isError ? theme.red : selected ? theme.green : theme.surface1,
    placeholder: selected ? `${selected}` : `${cursor}`,
    suggestions: selected ? `legal: ${legalPreview || "--"}` : "type e2e4 or select with enter",
    feedback: message || (selected ? `piece ${selected} selected · choose target` : "coordinate move · arrows/hjkl move cursor · enter select/play"),
    messageColor: isError ? theme.red : messageColor(message)
  };
}

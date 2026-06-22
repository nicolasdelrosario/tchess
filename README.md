# Terminal Chess

Terminal Chess is a Node.js + TypeScript chess TUI inspired by apps like LazyVim and opencode.

## Features

- Run with `chess`.
- Local 1 vs 1 play.
- Player vs Stockfish AI.
- Choose white, black, or random side.
- Terminal board flips for local multiplayer and black-side games.
- Styled panels, highlighted board squares, move list, and Unicode chess pieces.
- Coordinate input such as `e2e4`, `g1f3`, or `e7e8q`.
- No Lichess integration.

## Usage

```sh
npm install
npm run build
npm link
chess
```

You can also start a game directly with flags:

```sh
chess --mode ai --side white --elo 1200
```

Available flags:

- `--mode local|ai`
- `--side white|black|random`
- `--elo 800|1000|1200|1500|1800|2200`

In the app:

- `?` or `:help` shows the command hints.
- `:resign` resigns the current game.
- `q` or `Esc` exits.

## Stockfish

AI mode needs a Stockfish-compatible UCI engine.
The app resolves the engine in this order:

1. `STOCKFISH_PATH`
2. `stockfish` on your `PATH`
3. A local binary at `vendor/stockfish/<platform>-<arch>/stockfish` if you place one there manually

Recommended setup:

- Install Stockfish from your package manager or the official Stockfish downloads page.
- If the binary is not on your `PATH`, export `STOCKFISH_PATH` to the full executable path.

Examples:

```sh
# macOS with Homebrew
brew install stockfish
export STOCKFISH_PATH="$(command -v stockfish)"
```

```sh
# Custom install
export STOCKFISH_PATH=/path/to/stockfish
chess
```

Any compatible UCI engine can be used through `STOCKFISH_PATH`.
The repository does not ship the engine binary itself because GitHub rejects files over 100 MB.

Stockfish is distributed under the GPL license. The bundled license copy is in `vendor/stockfish/COPYING.txt`.

## Development

```sh
npm run dev
npm test
```

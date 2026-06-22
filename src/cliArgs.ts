import meow from "meow";
import { getDifficultyByElo } from "./game/difficulties.js";
import type { GameMode, PlayerSideChoice } from "./types.js";

export type CliConfig = {
  mode?: GameMode;
  side?: PlayerSideChoice;
  elo?: number;
};

export function parseCliArgs(argv = process.argv.slice(2)): CliConfig {
  const cli = meow(
    `
    Usage
      $ chess
      $ chess --mode ai --side white --elo 1200

    Options
      --mode   local | ai
      --side   white | black | random
      --elo    800 | 1000 | 1200 | 1500 | 1800 | 2200
    `,
    {
      importMeta: import.meta,
      argv,
      flags: {
        mode: {
          type: "string",
          choices: ["local", "ai"]
        },
        side: {
          type: "string",
          choices: ["white", "black", "random"]
        },
        elo: {
          type: "number",
          default: 1200
        }
      }
    }
  );

  return {
    mode: cli.flags.mode as GameMode | undefined,
    side: cli.flags.side as PlayerSideChoice | undefined,
    elo: getDifficultyByElo(cli.flags.elo).elo
  };
}

export type Side = "white" | "black";
export type PlayerSideChoice = Side | "random";
export type GameMode = "local" | "ai";

export type Difficulty = {
  label: string;
  elo: number;
  moveTimeMs: number;
  depth: number;
};

import type { Difficulty } from "../types.js";

export const DIFFICULTIES: Difficulty[] = [
  { label: "Beginner", elo: 800, moveTimeMs: 250, depth: 2 },
  { label: "Casual", elo: 1000, moveTimeMs: 350, depth: 3 },
  { label: "Club", elo: 1200, moveTimeMs: 500, depth: 5 },
  { label: "Strong", elo: 1500, moveTimeMs: 750, depth: 7 },
  { label: "Expert", elo: 1800, moveTimeMs: 1000, depth: 9 },
  { label: "Master", elo: 2200, moveTimeMs: 1500, depth: 12 }
];

export function getDifficultyByElo(elo: number): Difficulty {
  return DIFFICULTIES.reduce((closest, current) => {
    return Math.abs(current.elo - elo) < Math.abs(closest.elo - elo) ? current : closest;
  }, DIFFICULTIES[0]);
}

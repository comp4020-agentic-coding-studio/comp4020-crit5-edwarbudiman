// The rules, with no DOM in sight. Everything the spec tests care about lives
// here as plain data in and plain data out, so a round can be played in a test
// without a browser, and the render layer can be rewritten without touching a
// rule.

export type ColorId = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export const COLORS: readonly ColorId[] = ["red", "orange", "yellow", "green", "blue", "purple"];

/** The ink each name is painted in. Saturated and far apart, so the swatch a
 *  player reaches for is never a judgement call about hue — the difficulty
 *  belongs to the word fighting the colour, not to telling two blues apart. */
export const INK: Record<ColorId, string> = {
  red: "#FF3B3B",
  orange: "#FF8A1E",
  yellow: "#FFD400",
  green: "#25C46A",
  blue: "#3D8BFF",
  purple: "#B06BFF",
};

export const START_MS = 10_000;
/** The bar tops out, so banking a huge buffer early can't outrun the decay. */
export const MAX_MS = 15_000;
export const WRONG_PENALTY_MS = 2_500;

const BONUS_START_MS = 2_000;
const BONUS_DECAY_MS = 60;
/** Below a practised adult's Stroop response (~700–1100ms), which is what
 *  makes a run finite however good the player gets. */
export const BONUS_FLOOR_MS = 600;

/** What one correct answer buys, at a given score. */
export function bonusFor(score: number): number {
  return Math.max(BONUS_FLOOR_MS, BONUS_START_MS - score * BONUS_DECAY_MS);
}

/** How many swatches are on the board. Mastery needs somewhere to go, and a
 *  wider board is the one escalation that needs no explaining. */
export function optionCountFor(score: number): number {
  if (score < 10) return 3;
  if (score < 25) return 4;
  return 5;
}

export interface Round {
  /** The word on screen. */
  word: ColorId;
  /** The colour it is painted in — the answer. */
  ink: ColorId;
  options: ColorId[];
}

export type Status = "ready" | "playing" | "over";

export interface Game {
  status: Status;
  timeMs: number;
  score: number;
  best: number;
  round: Round;
  rng: () => number;
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Four rounds in five carry a conflict, because a board where the word and
 *  the ink agree teaches nothing and a board that never agrees stops being a
 *  choice. The word, when it disagrees, is always on the board as the decoy —
 *  that decoy is the game. */
export function dealRound(score: number, rng: () => number): Round {
  const ink = pick(COLORS, rng);
  const congruent = rng() < 0.2;
  const word = congruent ? ink : pick(COLORS.filter((c) => c !== ink), rng);

  const options: ColorId[] = [ink];
  if (word !== ink) options.push(word);

  const rest = COLORS.filter((c) => !options.includes(c));
  const wanted = optionCountFor(score);
  for (const c of shuffle(rest, rng)) {
    if (options.length >= wanted) break;
    options.push(c);
  }

  return { word, ink, options: shuffle(options, rng) };
}

export function createGame(rng: () => number = Math.random, best = 0): Game {
  return {
    status: "ready",
    timeMs: START_MS,
    score: 0,
    best,
    round: dealRound(0, rng),
    rng,
  };
}

export function start(game: Game): Game {
  return game.status === "ready" ? { ...game, status: "playing" } : game;
}

/** Drains the clock. Only a running game loses time, so the opening board sits
 *  still until someone moves — a stranger gets to look before the pressure. */
export function tick(game: Game, dtMs: number): Game {
  if (game.status !== "playing") return game;

  const timeMs = Math.max(0, game.timeMs - dtMs);
  return timeMs === 0 ? { ...game, timeMs, status: "over" } : { ...game, timeMs };
}

export interface Answered {
  game: Game;
  correct: boolean;
  /** The ink of the round just answered, so the screen can flash it. */
  ink: ColorId;
}

export function answer(game: Game, choice: ColorId): Answered {
  if (game.status === "over") return { game, correct: false, ink: game.round.ink };

  const running = start(game);
  const correct = choice === running.round.ink;
  const ink = running.round.ink;

  const timeMs = correct
    ? Math.min(MAX_MS, running.timeMs + bonusFor(running.score))
    : Math.max(0, running.timeMs - WRONG_PENALTY_MS);

  const score = correct ? running.score + 1 : running.score;

  return {
    game: {
      ...running,
      score,
      best: Math.max(running.best, score),
      timeMs,
      status: timeMs === 0 ? "over" : "playing",
      round: dealRound(score, running.rng),
    },
    correct,
    ink,
  };
}

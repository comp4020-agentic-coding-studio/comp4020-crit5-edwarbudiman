// The rules, with no DOM in sight. Everything the spec tests care about lives
// here as plain data in and plain data out, so a round can be played in a test
// without a browser, and the render layer can be rewritten without touching a
// rule.

import { confusable, worstCaseDistance } from "./cvd";

export type ColorId = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export const COLORS: readonly ColorId[] = ["red", "orange", "yellow", "green", "blue", "purple"];

/** The ink each name is painted in. Saturated and far apart, so the swatch a
 *  player reaches for is never a judgement call about hue — the difficulty
 *  belongs to the word fighting the colour, not to telling two blues apart.
 *
 *  Measured, not picked. The first palette looked right and measured badly:
 *  under deuteranopia — the commonest deficiency — blue and purple sat 6.8
 *  apart in Lab, which is not a colour choice, it is a coin toss. Purple is
 *  now lifted well clear of blue in lightness, which is the one channel a
 *  red-green deficiency leaves intact.
 *
 *  Two pairs still measure close (red/orange, orange/yellow) and no vivid,
 *  nameable palette fixes that — hues that adjacent can only be separated by
 *  pushing one of them so pale it stops reading as its own name, and here the
 *  word IS the colour name, so a peach labelled ORANGE is worse than any
 *  collision. Solving it in the palette also failed a second way: the search
 *  drove every colour light enough that red had no legible panel left at all.
 *  So the guarantee lives in `dealRound` instead — only three of the six are
 *  ever on screen, and a confusable pair is simply never dealt together. */
export const INK: Record<ColorId, string> = {
  red: "#FF4136",
  orange: "#FF9F1C",
  yellow: "#FFE14D",
  green: "#2ECC71",
  blue: "#2B7FFF",
  purple: "#C89BFF",
};

export const GROUND = "#191B1F";

/** Three swatches, always. A wider board taxes the hand (fingers have to move
 *  and re-find their place) rather than the eye, and this is a game about the
 *  eye. Fingers rest on 1/2/3 for the whole run, so the only thing that ever
 *  gets harder is the seeing. */
export const OPTION_COUNT = 3;

export function optionCountFor(_score: number): number {
  return OPTION_COUNT;
}

export const START_MS = 8_000;
/** The bar tops out, so banking a buffer early can't outrun the decay. */
export const MAX_MS = 10_000;
export const WRONG_PENALTY_MS = 2_000;

/** Difficulty moves in tiers of ten, not on every answer. Ramping
 *  continuously meant the clock got quicker *inside* a tier, so a good run
 *  never got a stable stretch to bank time in — the pressure rose faster than
 *  skill could, and runs died at the same place every time. Stepping it means
 *  ten rounds at a fixed speed you can settle into, then a jolt you feel. */
export const TIER_SIZE = 10;

export function tierFor(score: number): number {
  return Math.floor(score / TIER_SIZE);
}

const BONUS_START_MS = 1_800;
const BONUS_STEP_MS = 300;
/** Below a practised adult's Stroop response (~700–1100ms), which is what
 *  makes a run finite however good the player gets. */
export const BONUS_FLOOR_MS = 550;

const DRAIN_STEP = 0.25;
export const DRAIN_CAP = 2.4;

/** What one correct answer buys, at a given score. */
export function bonusFor(score: number): number {
  return Math.max(BONUS_FLOOR_MS, BONUS_START_MS - tierFor(score) * BONUS_STEP_MS);
}

/** How fast the clock empties. The shrinking payout alone is a pressure you
 *  have to do arithmetic to notice; a bar that visibly moves quicker is one
 *  you feel the moment a tier turns over. */
export function drainRateFor(score: number): number {
  return Math.min(DRAIN_CAP, 1 + tierFor(score) * DRAIN_STEP);
}

/* --- difficulty layers ---------------------------------------------------- */

export type LayerId = "glitch" | "panel" | "letters" | "drift" | "strobe";

export interface Layer {
  id: LayerId;
  /** The score this layer switches on at. */
  from: number;
  /** Flip to false to cut a layer without touching anything that uses it. */
  enabled: boolean;
}

/** The difficulty ladder, as data. Reorder the rows, move a threshold or flip
 *  `enabled` and the whole game follows — nothing else reads a hard-coded
 *  score. `letters` in particular is here on probation: degrading the word may
 *  well make the game EASIER, because a word you can't read can't fight you,
 *  and this table is how it gets cut in one edit if playing proves that. */
export const LAYERS: Layer[] = [
  { id: "glitch", from: 5, enabled: true },
  { id: "panel", from: 6, enabled: true },
  { id: "letters", from: 7, enabled: true },
  { id: "drift", from: 8, enabled: true },
  // Needs `panel` to be on as well — it beats that rectangle between two
  // hues, so on its own it has nothing to drive.
  { id: "strobe", from: 9, enabled: true },
];

export function activeLayers(score: number, table: Layer[] = LAYERS): Set<LayerId> {
  return new Set(table.filter((l) => l.enabled && score >= l.from).map((l) => l.id));
}

/* --- contrast ------------------------------------------------------------- */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** How much of the panel's colour survives the mix into the ground. At full
 *  saturation NO pair of these six colours reaches 3:1 against each other —
 *  they all sit at similar luminance — so the panel has to be a dark tint for
 *  the word on top of it to stay readable. 0.18 is the measured ceiling. */
export const PANEL_TINT = 0.18;

export function panelColor(color: ColorId, tint: number = PANEL_TINT): string {
  const [r, g, b] = rgb(INK[color]);
  const [gr, gg, gb] = rgb(GROUND);
  return toHex([r * tint + gr * (1 - tint), g * tint + gg * (1 - tint), b * tint + gb * (1 - tint)]);
}

/** The floor the panel layer must clear to stay legible. */
export const MIN_PANEL_CONTRAST = 3;

/* --- rounds --------------------------------------------------------------- */

export interface Round {
  /** The word on screen. */
  word: ColorId;
  /** The colour it is painted in — the answer. */
  ink: ColorId;
  options: ColorId[];
  /** The tinted rectangle behind the word, once that layer is on. */
  panel: ColorId | null;
  /** The second tint the panel beats between, once the strobe layer is on. */
  panelAlt: ColorId | null;
  /** Indices of letters hidden from the word, once that layer is on. */
  hidden: number[];
}

export type Status = "ready" | "playing" | "over";

export interface Game {
  status: Status;
  timeMs: number;
  score: number;
  best: number;
  round: Round;
  layers: Set<LayerId>;
  rng: () => number;
  table: Layer[];
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
export function dealRound(score: number, rng: () => number, table: Layer[] = LAYERS): Round {
  const on = activeLayers(score, table);

  const ink = pick(COLORS, rng);
  const congruent = rng() < 0.2;
  // The word is forced onto the board as the decoy, so it has to clear the
  // same bar as any other swatch — picking it before checking would smuggle a
  // confusable pair past the filter below.
  const legible = COLORS.filter((c) => c !== ink && !confusable(INK[c], INK[ink]));
  const word = congruent || legible.length === 0 ? ink : pick(legible, rng);

  const options: ColorId[] = [ink];
  if (word !== ink) options.push(word);

  // Only three of the six are ever on screen, so the palette doesn't have to
  // be globally separable — the BOARD does. Two colours that a colour-blind
  // player could confuse simply never get dealt together, which keeps the
  // palette vivid and still leaves thirteen of the twenty possible boards.
  //
  // The test has to be against what's on the board SO FAR, not against the
  // board we started with: on a congruent round the word adds nothing, both
  // remaining slots get filled from the same list, and a pair that is fine
  // beside the ink can still be confusable with each other.
  const remaining = shuffle(
    COLORS.filter((c) => !options.includes(c)),
    rng,
  );

  for (const c of remaining) {
    if (options.length >= OPTION_COUNT) break;
    if (options.every((chosen) => !confusable(INK[c], INK[chosen]))) options.push(c);
  }

  // Only reachable if someone edits INK into a palette that can't fill a safe
  // board at all. Take the least-bad colour rather than the next one in line,
  // so a broken palette degrades instead of dealing the worst possible pair.
  while (options.length < OPTION_COUNT) {
    const left = remaining.filter((c) => !options.includes(c));
    const safest = left.reduce((best, c) =>
      Math.min(...options.map((o) => worstCaseDistance(INK[c], INK[o]))) >
      Math.min(...options.map((o) => worstCaseDistance(INK[best], INK[o])))
        ? c
        : best,
    );
    options.push(safest);
  }

  // The panel is a third colour where one is available: two colours to hold
  // apart is the load, so reusing the ink or the word wastes the layer.
  let panel: ColorId | null = null;
  let panelAlt: ColorId | null = null;
  if (on.has("panel")) {
    // A panel the word can't be read against is not difficulty, it's a bug,
    // so the choice is filtered by measured contrast rather than trusted.
    const legiblePanel = (c: ColorId) =>
      contrast(INK[ink], panelColor(c)) >= MIN_PANEL_CONTRAST;

    const thirds = COLORS.filter((c) => c !== ink && c !== word && legiblePanel(c));
    const fallback = COLORS.filter((c) => c !== ink && legiblePanel(c));
    const choices = thirds.length ? thirds : fallback;
    panel = choices.length ? pick(choices, rng) : null;

    // The strobe beats the panel between two hues rather than on and off: a
    // background that flashes to nothing is a luminance strobe, and this game
    // is not worth giving anyone a seizure over. Two dark tints keep the
    // luminance swing small and the word legible on both.
    if (on.has("strobe") && panel) {
      const others = COLORS.filter(
        (c) => c !== ink && c !== panel && contrast(INK[ink], panelColor(c)) >= MIN_PANEL_CONTRAST,
      );
      panelAlt = others.length ? pick(others, rng) : null;
    }
  }

  // One letter, never the first: the opening letter carries most of the word's
  // shape, and hiding it turns reading into guessing rather than into effort.
  const hidden: number[] = [];
  if (on.has("letters") && word.length > 3) {
    hidden.push(1 + Math.floor(rng() * (word.length - 1)));
  }

  return { word, ink, options: shuffle(options, rng), panel, panelAlt, hidden };
}

export function createGame(
  rng: () => number = Math.random,
  best = 0,
  table: Layer[] = LAYERS,
): Game {
  return {
    status: "ready",
    timeMs: START_MS,
    score: 0,
    best,
    round: dealRound(0, rng, table),
    layers: activeLayers(0, table),
    rng,
    table,
  };
}

export function start(game: Game): Game {
  return game.status === "ready" ? { ...game, status: "playing" } : game;
}

/** Drains the clock, faster the better you are. Only a running game loses
 *  time, so the opening board sits still until someone moves — a stranger
 *  gets to look before the pressure starts. */
export function tick(game: Game, dtMs: number): Game {
  if (game.status !== "playing") return game;

  const timeMs = Math.max(0, game.timeMs - dtMs * drainRateFor(game.score));
  return timeMs === 0 ? { ...game, timeMs, status: "over" } : { ...game, timeMs };
}

export interface Answered {
  game: Game;
  correct: boolean;
  /** True when this was the free opening move. */
  free: boolean;
  /** The ink of the round just answered, so the screen can flash it. */
  ink: ColorId;
}

export function answer(game: Game, choice: ColorId): Answered {
  if (game.status === "over") {
    return { game, correct: false, free: false, ink: game.round.ink };
  }

  // The opening move is free. Nobody has been told the rule — it is the whole
  // point of the brief that nobody can be — so the first guess buys the
  // lesson instead of a punishment, and the run starts properly afterwards.
  const free = game.status === "ready";
  const running = start(game);
  const correct = choice === running.round.ink;
  const ink = running.round.ink;

  const score = correct && !free ? running.score + 1 : running.score;
  const timeMs = free
    ? running.timeMs
    : correct
      ? Math.min(MAX_MS, running.timeMs + bonusFor(running.score))
      : Math.max(0, running.timeMs - WRONG_PENALTY_MS);

  return {
    game: {
      ...running,
      score,
      best: Math.max(running.best, score),
      timeMs,
      status: timeMs === 0 ? "over" : "playing",
      round: dealRound(score, running.rng, running.table),
      layers: activeLayers(score, running.table),
    },
    correct,
    free,
    ink,
  };
}

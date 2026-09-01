// The render and input layer. Every rule lives in game.ts; this file only
// turns a Game into pixels and a keypress into an answer.

import * as sound from "./audio";
import {
  type ColorId,
  type Game,
  INK,
  MAX_MS,
  answer,
  createGame,
  panelColor,
  tick,
} from "./game";
import { readScores, recordScore } from "./scores";

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
};

const fieldEl = el("field");
const stageEl = el("stage");
const wordEl = el("word");
const swatchesEl = el("swatches");
const scoreEl = el("score");
const clockEl = el<HTMLElement>("clock-fill");
const clockTrack = clockEl.parentElement!;
const verdictEl = el("verdict");
const verdictScoreEl = el("verdict-score");
const againEl = el<HTMLButtonElement>("again");
const recordsEl = el("records");
const recordsListEl = el("records-list");

/** Keycaps under each swatch. Position, not colour — the mapping stays put
 *  even though the colours are reshuffled every round. */
const KEYS = ["1", "2", "3"];

/** How long the opening board waits before showing the answer once. */
const HINT_AFTER_MS = 4_000;
/** Ignores input for a beat after death, so the keypress that lost the run
 *  doesn't immediately start the next one. */
const RESTART_LOCKOUT_MS = 700;

/** Dev-only: `?score=25` drops you straight into a tier so a difficulty layer
 *  can be looked at without surviving to it first. Stripped from the build —
 *  `import.meta.env.DEV` is false in `vite build`, so this cannot ship. */
function debugScore(): number {
  if (!import.meta.env.DEV) return 0;
  const raw = new URLSearchParams(window.location.search).get("score");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

let scores = readScores();
let game: Game = createGame();
let lastFrame = performance.now();
let hintTimer: number | undefined;
let showHint = false;
let deadAt = 0;
let lastTickSecond = Infinity;

/** Applied once at startup so a dev override survives the first render. */
function seed(g: Game): Game {
  const forced = debugScore();
  return forced ? answerless(g, forced) : g;
}

/** Puts the game at a score without playing it, for the dev override only.
 *  Runs until the score actually lands rather than counting answers: the
 *  opening move is free, so N correct answers only reach N-1. */
function answerless(g: Game, score: number): Game {
  let next = g;
  for (let i = 0; i < score + 5 && next.score < score; i++) {
    next = answer(next, next.round.ink).game;
  }
  return { ...next, timeMs: MAX_MS, status: "ready" };
}

game = seed(game);

/* --- rendering ------------------------------------------------------------ */

function renderWord(): void {
  const { word, hidden } = game.round;
  const letters = word.toUpperCase().split("");

  // Letters are spans so one can be hidden without reflowing the rest.
  wordEl.replaceChildren(
    ...letters.map((letter, i) => {
      const span = document.createElement("span");
      span.textContent = letter;
      if (hidden.includes(i)) span.className = "gone";
      return span;
    }),
  );

  // Lets the phone breakpoint size the type to this word's length instead of
  // to the longest word in the palette. Harmless on desktop, which uses a
  // fixed clamp.
  wordEl.style.setProperty("--len", String(letters.length));

  // The accessible name stays the whole word: a screen reader is not playing
  // a perception game, and reading it "GR EN" would be nonsense.
  wordEl.setAttribute("aria-label", word);
}

function renderSwatches(): void {
  const { options } = game.round;

  if (swatchesEl.children.length !== options.length) {
    swatchesEl.replaceChildren(
      ...options.map((_, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "swatch";
        button.style.setProperty("--beat", `${i * 130}ms`);

        const chip = document.createElement("span");
        chip.className = "swatch__chip";

        const key = document.createElement("span");
        key.className = "swatch__key";
        key.textContent = KEYS[i];

        button.append(chip, key);
        button.addEventListener("click", () => respond(i));
        return button;
      }),
    );
  }

  options.forEach((color, i) => {
    const button = swatchesEl.children[i] as HTMLElement;
    button.style.setProperty("--chip", INK[color]);
    button.setAttribute("aria-label", color);
    button.classList.toggle("swatch--hint", showHint && color === game.round.ink);
  });
}

function renderRecords(): void {
  const visible = game.status !== "playing" && scores.length > 0;
  recordsEl.hidden = !visible;
  if (!visible) return;

  recordsListEl.replaceChildren(
    ...scores.map((score) => {
      const item = document.createElement("li");
      item.textContent = String(score);
      return item;
    }),
  );
}

function render(): void {
  const { round, score, status, timeMs, layers } = game;

  renderWord();
  document.body.style.setProperty("--ink", INK[round.ink]);
  stageEl.style.setProperty("--panel", round.panel ? panelColor(round.panel) : "transparent");
  stageEl.style.setProperty(
    "--panel-alt",
    round.panelAlt ? panelColor(round.panelAlt) : "transparent",
  );
  stageEl.classList.toggle("stage--drift", layers.has("drift"));
  stageEl.classList.toggle("stage--strobe", Boolean(round.panelAlt));
  scoreEl.textContent = String(score);

  clockEl.style.setProperty("--fill", String(timeMs / MAX_MS));
  clockTrack.classList.toggle("clock--urgent", status === "playing" && timeMs <= 3_000);

  document.body.classList.toggle("is-ready", status === "ready");
  fieldEl.setAttribute("aria-hidden", status === "over" ? "true" : "false");

  verdictEl.hidden = status !== "over";
  verdictScoreEl.textContent = String(score);

  renderSwatches();
  renderRecords();
}

/** Restarts the glitch animation. Re-adding a class only replays an animation
 *  if the element is reflowed in between. */
function replayGlitch(): void {
  wordEl.classList.remove("word--glitch");
  void wordEl.offsetWidth;
  wordEl.classList.add("word--glitch");
}

function flash(className: string, ms: number): void {
  document.body.classList.add(className);
  window.setTimeout(() => document.body.classList.remove(className), ms);
}

/* --- input ---------------------------------------------------------------- */

function armHint(): void {
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    if (game.status !== "ready") return;
    showHint = true;
    render();
  }, HINT_AFTER_MS);
}

function respond(index: number): void {
  if (game.status === "over") return restart();

  const choice: ColorId | undefined = game.round.options[index];
  if (!choice) return;

  sound.prime();
  window.clearTimeout(hintTimer);
  showHint = false;

  const wasReady = game.status === "ready";
  const result = answer(game, choice);
  game = result.game;

  // The flash reports the round that was just answered, so it has to be
  // painted with that round's ink rather than the freshly dealt one.
  document.body.style.setProperty("--flash", INK[result.ink]);

  if (result.correct) {
    flash("is-correct", 120);
    sound.correct(game.score);
  } else {
    flash("is-wrong", 260);
    sound.wrong();
  }

  if (wasReady) lastFrame = performance.now();
  if (game.status === "over") die();

  render();
  if (game.layers.has("glitch") && game.status === "playing") replayGlitch();
}

function die(): void {
  deadAt = performance.now();
  clockTrack.classList.remove("clock--urgent");
  scores = recordScore(game.score);
  sound.over();
  window.setTimeout(() => againEl.focus(), 60);
}

function restart(): void {
  if (performance.now() - deadAt < RESTART_LOCKOUT_MS) return;

  game = seed(createGame(Math.random, game.best));
  showHint = false;
  lastTickSecond = Infinity;
  lastFrame = performance.now();
  armHint();
  render();
}

againEl.addEventListener("click", restart);

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const index = KEYS.indexOf(event.key);
  if (index !== -1 && index < game.round.options.length) {
    event.preventDefault();
    respond(index);
    return;
  }

  // On the ending screen anything restarts, so a player who just lost can go
  // again without hunting for the button.
  if (game.status === "over" && (event.key === " " || event.key === "Enter")) {
    event.preventDefault();
    restart();
  }
});

/* --- the loop ------------------------------------------------------------- */

function frame(now: number): void {
  const dt = Math.min(now - lastFrame, 250); // a backgrounded tab shouldn't kill a run
  lastFrame = now;

  if (game.status === "playing") {
    const before = game.status;
    game = tick(game, dt);

    const secondsLeft = Math.ceil(game.timeMs / 1000);
    if (game.timeMs <= 3_000 && game.timeMs > 0 && secondsLeft !== lastTickSecond) {
      lastTickSecond = secondsLeft;
      sound.tick(game.timeMs / 1000);
    }

    if (before === "playing" && game.status === "over") die();
    render();
  }

  requestAnimationFrame(frame);
}

armHint();
render();
requestAnimationFrame(frame);

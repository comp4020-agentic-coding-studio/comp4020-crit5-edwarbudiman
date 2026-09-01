// The render and input layer. Every rule lives in game.ts; this file only
// turns a Game into pixels and a keypress into an answer.

import * as sound from "./audio";
import { type ColorId, type Game, INK, MAX_MS, answer, createGame, tick } from "./game";

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
};

const fieldEl = el("field");
const wordEl = el("word");
const swatchesEl = el("swatches");
const scoreEl = el("score");
const clockEl = el<HTMLElement>("clock-fill");
const clockTrack = clockEl.parentElement!;
const verdictEl = el("verdict");
const verdictScoreEl = el("verdict-score");
const againEl = el<HTMLButtonElement>("again");

/** Keycaps under each swatch. Position, not colour — the mapping stays put
 *  even though the colours are reshuffled every round. */
const KEYS = ["1", "2", "3", "4", "5"];

/** How long the opening board waits before showing the answer once. */
const HINT_AFTER_MS = 4_000;
/** Ignores input for a beat after death, so the keypress that lost the run
 *  doesn't immediately start the next one. */
const RESTART_LOCKOUT_MS = 700;

let game: Game = createGame();
let lastFrame = performance.now();
let hintTimer: number | undefined;
let showHint = false;
let deadAt = 0;
let lastTickSecond = Infinity;

/* --- rendering ------------------------------------------------------------ */

function renderSwatches(): void {
  const { options } = game.round;

  // Reuse the buttons when the board hasn't changed size: rebuilding every
  // round would throw away keyboard focus mid-run.
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

function render(): void {
  const { round, score, status, timeMs } = game;

  wordEl.textContent = round.word.toUpperCase();
  document.body.style.setProperty("--ink", INK[round.ink]);
  scoreEl.textContent = String(score);

  clockEl.style.setProperty("--fill", String(timeMs / MAX_MS));
  clockTrack.classList.toggle("clock--urgent", status === "playing" && timeMs <= 3_000);

  document.body.classList.toggle("is-ready", status === "ready");
  fieldEl.setAttribute("aria-hidden", status === "over" ? "true" : "false");

  verdictEl.hidden = status !== "over";
  verdictScoreEl.textContent = String(score);

  renderSwatches();
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
}

function die(): void {
  deadAt = performance.now();
  clockTrack.classList.remove("clock--urgent");
  sound.over();
  window.setTimeout(() => againEl.focus(), 60);
}

function restart(): void {
  if (performance.now() - deadAt < RESTART_LOCKOUT_MS) return;

  game = createGame(Math.random, game.best);
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

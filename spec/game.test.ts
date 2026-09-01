import { describe, expect, it } from "vitest";
import {
  BONUS_FLOOR_MS,
  answer,
  bonusFor,
  createGame,
  optionCountFor,
  start,
  tick,
} from "../game";

// CONTRACT TESTS — they answer crit 5's published spec ("A game") and retire
// with it. Every assertion here is about the rules a player meets, not about
// how the module is built, so a rewrite of the render layer leaves them alone.
//
// A seeded generator keeps rounds reproducible: the same seed always deals the
// same word/ink pair, so a failure is a failure and not a coin toss.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Fast-forwards a run to a given score by always answering with the ink. */
function playPerfectly(score: number) {
  let game = start(createGame(seeded(7)));
  for (let i = 0; i < score; i++) {
    game = answer(game, game.round.ink).game;
  }
  return game;
}

describe("the rule: the ink is the answer, the word is the lie", () => {
  // This is the one rule under focused test. It is the whole game: a round
  // where the word and the ink disagree has exactly one correct swatch, and it
  // is the ink. If this inverts, the game is no longer a Stroop task.
  it("accepts the ink colour", () => {
    const game = start(createGame(seeded(1)));
    expect(answer(game, game.round.ink).correct).toBe(true);
  });

  it("rejects the word, whenever the word disagrees with the ink", () => {
    let game = start(createGame(seeded(1)));
    let conflicts = 0;

    // Walk a run's worth of rounds and check every conflicting one.
    for (let i = 0; i < 60; i++) {
      const { word, ink, options } = game.round;
      if (word !== ink && options.includes(word)) {
        conflicts++;
        expect(
          answer(game, word).correct,
          `round ${i}: word "${word}" in ${ink} ink must not be accepted`,
        ).toBe(false);
      }
      game = answer(game, game.round.ink).game;
    }

    // A run that never puts the word on the board is not a Stroop task, so
    // assert the interference actually shows up rather than vacuously passing.
    expect(conflicts, "the word should appear as a decoy regularly").toBeGreaterThan(10);
  });
});

describe("a wrong move is possible, and it costs", () => {
  it("takes time away for a wrong answer", () => {
    const game = start(createGame(seeded(2)));
    const wrong = game.round.options.find((c) => c !== game.round.ink)!;

    expect(answer(game, wrong).game.timeMs).toBeLessThan(game.timeMs);
  });

  it("can be lost outright by answering wrongly enough", () => {
    let game = start(createGame(seeded(3)));

    for (let i = 0; i < 40 && game.status === "playing"; i++) {
      const wrong = game.round.options.find((c) => c !== game.round.ink)!;
      game = answer(game, wrong).game;
    }

    expect(game.status).toBe("over");
  });
});

describe("solving buys time", () => {
  it("adds time for a correct answer", () => {
    const game = start(createGame(seeded(4)));

    expect(answer(game, game.round.ink).game.timeMs).toBeGreaterThan(game.timeMs);
  });

  it("pays less for each answer as the score climbs", () => {
    // Assert the payout curve itself rather than two observed time deltas: the
    // clock is capped, so a delta comparison can pass on the cap alone and
    // would keep passing if the decay were deleted.
    expect(bonusFor(20)).toBeLessThan(bonusFor(0));
    expect(bonusFor(200)).toBe(BONUS_FLOOR_MS);
  });

  it("is still paying out on the very first answer", () => {
    const early = playPerfectly(0);
    expect(answer(early, early.round.ink).game.timeMs).toBeGreaterThan(early.timeMs);
  });
});

describe("play ends somewhere", () => {
  it("ends on its own when nobody moves", () => {
    let game = start(createGame(seeded(5)));

    // Drain in 100ms steps; a run that survives five minutes of silence is a
    // screensaver, not a game.
    for (let i = 0; i < 3000 && game.status === "playing"; i++) {
      game = tick(game, 100);
    }

    expect(game.status).toBe("over");
    expect(game.timeMs).toBe(0);
  });

  it("is bounded even under perfect play, because the payout falls below human reaction time", () => {
    // Stroop responses land around 700–1100ms for a practised adult. Once a
    // correct answer buys back less than that, the bar loses ground on every
    // round no matter how well you play, so the run has an end.
    expect(BONUS_FLOOR_MS).toBeLessThan(700);
  });
});

describe("the board a stranger sees", () => {
  it("always offers the ink, exactly once, among distinct choices", () => {
    let game = start(createGame(seeded(6)));

    for (let i = 0; i < 40; i++) {
      const { options, ink } = game.round;
      expect(options.filter((c) => c === ink)).toHaveLength(1);
      expect(new Set(options).size, "duplicate swatches are unanswerable").toBe(options.length);
      game = answer(game, ink).game;
    }
  });

  it("widens the board as the player gets good, so mastery has somewhere to go", () => {
    expect(optionCountFor(30)).toBeGreaterThan(optionCountFor(0));
  });
});

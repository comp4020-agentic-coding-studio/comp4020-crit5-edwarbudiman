import { describe, expect, it } from "vitest";
import {
  BONUS_FLOOR_MS,
  COLORS,
  type Game,
  DRAIN_CAP,
  INK,
  LAYERS,
  MIN_PANEL_CONTRAST,
  OPTION_COUNT,
  PANEL_TINT,
  START_MS,
  TIER_SIZE,
  activeLayers,
  answer,
  bonusFor,
  contrast,
  createGame,
  dealRound,
  drainRateFor,
  optionCountFor,
  panelColor,
  start,
  tick,
} from "../game";
import { KEEP, mergeScore } from "../scores";

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

/** Fast-forwards a run to a given score by always answering with the ink.
 *  Burns the free opening move first so the score is what it says. */
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

describe("the opening move is free", () => {
  // Nobody can be told the rule, so the first guess buys the lesson instead of
  // a punishment. It starts the clock and nothing else.
  it("costs nothing when it is wrong", () => {
    const fresh = createGame(seeded(11));
    const wrong = fresh.round.options.find((c) => c !== fresh.round.ink)!;
    const after = answer(fresh, wrong);

    expect(after.free).toBe(true);
    expect(after.game.timeMs).toBe(START_MS);
    expect(after.game.score).toBe(0);
    expect(after.game.status).toBe("playing");
  });

  it("earns nothing when it is right", () => {
    const fresh = createGame(seeded(11));
    const after = answer(fresh, fresh.round.ink);

    expect(after.correct).toBe(true);
    expect(after.game.score).toBe(0);
    expect(after.game.timeMs).toBe(START_MS);
  });

  it("only applies once", () => {
    const fresh = createGame(seeded(11));
    const second = answer(fresh, fresh.round.ink).game;

    expect(answer(second, second.round.ink).free).toBe(false);
    expect(answer(second, second.round.ink).game.score).toBe(1);
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

describe("solving buys time, on a shrinking payout", () => {
  it("adds time for a correct answer", () => {
    const game = start(createGame(seeded(4)));
    const played = answer(game, game.round.ink).game; // burn the free move

    expect(answer(played, played.round.ink).game.timeMs).toBeGreaterThan(played.timeMs);
  });

  it("pays less for each answer as the score climbs", () => {
    // Assert the payout curve itself rather than two observed time deltas: the
    // clock is capped, so a delta comparison can pass on the cap alone and
    // would keep passing if the decay were deleted.
    expect(bonusFor(20)).toBeLessThan(bonusFor(0));
    expect(bonusFor(200)).toBe(BONUS_FLOOR_MS);
  });
});

describe("the clock speeds up as you get good", () => {
  it("drains faster at a higher score", () => {
    expect(drainRateFor(20)).toBeGreaterThan(drainRateFor(0));
    expect(drainRateFor(0)).toBe(1);
  });

  it("holds one speed for a whole tier, then steps", () => {
    // The point of a tier: ten rounds at a fixed speed you can settle into
    // and bank time in. Ramping on every answer meant the clock got quicker
    // mid-tier, pressure outran skill, and runs died at the same score every
    // time. A player has to be able to feel the change arrive.
    for (let score = 0; score < TIER_SIZE; score++) {
      expect(drainRateFor(score), `score ${score} is still tier 0`).toBe(drainRateFor(0));
      expect(bonusFor(score)).toBe(bonusFor(0));
    }

    expect(drainRateFor(TIER_SIZE)).toBeGreaterThan(drainRateFor(TIER_SIZE - 1));
    expect(bonusFor(TIER_SIZE)).toBeLessThan(bonusFor(TIER_SIZE - 1));
  });

  it("leaves the first two tiers survivable, so 20 isn't a wall", () => {
    // A round answered at a practised 900ms must not cost more than it pays
    // before tier 2, or the run is lost to arithmetic rather than to the
    // player. Measured against the response time the game is actually built
    // around.
    const net = (score: number) => bonusFor(score) - 900 * drainRateFor(score);

    expect(net(0)).toBeGreaterThan(0);
    expect(net(15), "tier 1 should still be winnable at a steady pace").toBeGreaterThan(0);
    expect(net(60), "and the top must still be unwinnable").toBeLessThan(0);
  });

  it("stops accelerating somewhere, so it never becomes unplayable noise", () => {
    expect(drainRateFor(10_000)).toBe(DRAIN_CAP);
  });

  it("empties a full bar faster at a high score than at a low one", () => {
    const drain = (score: number) => {
      let game: Game = { ...playPerfectly(0), score, timeMs: START_MS, status: "playing" };
      let ms = 0;
      while (game.status === "playing" && ms < 120_000) {
        game = tick(game, 50);
        ms += 50;
      }
      return ms;
    };

    expect(drain(30)).toBeLessThan(drain(0));
  });
});

describe("play ends somewhere", () => {
  it("ends on its own when nobody moves", () => {
    let game = start(createGame(seeded(5)));

    for (let i = 0; i < 3000 && game.status === "playing"; i++) {
      game = tick(game, 100);
    }

    expect(game.status).toBe("over");
    expect(game.timeMs).toBe(0);
  });

  it("is bounded even under perfect play, because the payout falls below human reaction time", () => {
    // Stroop responses land around 700–1100ms for a practised adult. Once a
    // correct answer buys back less than that — against a bar that is also
    // draining faster than real time — the run has an end.
    expect(BONUS_FLOOR_MS).toBeLessThan(700);
  });
});

describe("the board a stranger sees", () => {
  it("never changes size, so the hand never has to move", () => {
    let game = start(createGame(seeded(6)));

    for (let i = 0; i < 60; i++) {
      expect(game.round.options).toHaveLength(OPTION_COUNT);
      game = answer(game, game.round.ink).game;
    }

    expect(optionCountFor(0)).toBe(optionCountFor(500));
  });

  it("always offers the ink, exactly once, among distinct choices", () => {
    let game = start(createGame(seeded(6)));

    for (let i = 0; i < 40; i++) {
      const { options, ink } = game.round;
      expect(options.filter((c) => c === ink)).toHaveLength(1);
      expect(new Set(options).size, "duplicate swatches are unanswerable").toBe(options.length);
      game = answer(game, ink).game;
    }
  });
});

describe("difficulty arrives in layers", () => {
  it("starts clean, so the first rounds teach the rule and nothing else", () => {
    expect(activeLayers(0).size).toBe(0);
  });

  it("turns each layer on at its own score, and never turns one off", () => {
    for (const layer of LAYERS.filter((l) => l.enabled)) {
      expect(activeLayers(layer.from - 1).has(layer.id)).toBe(false);
      expect(activeLayers(layer.from).has(layer.id)).toBe(true);
      expect(activeLayers(layer.from + 100).has(layer.id)).toBe(true);
    }
  });

  it("is driven entirely by the table, so a layer can be cut in one edit", () => {
    const table = [{ id: "glitch" as const, from: 10, enabled: false }];
    expect(activeLayers(999, table).size).toBe(0);
  });

  it("keeps the word readable when letters start going missing", () => {
    // The first letter carries most of a word's shape. Hiding it turns reading
    // into guessing, which is a different game.
    const table = [{ id: "letters" as const, from: 0, enabled: true }];
    for (let i = 0; i < 80; i++) {
      const round = dealRound(0, seeded(100 + i), table);
      for (const index of round.hidden) {
        expect(index).toBeGreaterThan(0);
        expect(index).toBeLessThan(round.word.length);
      }
      expect(round.hidden.length).toBeLessThan(round.word.length - 1);
    }
  });
});

describe("sensor: the panel layer stays readable", () => {
  // A difficulty layer that makes the word unreadable is not difficulty, it is
  // a bug. This one is measured, not eyeballed.
  it("clears the contrast floor for every ink on every panel", () => {
    for (const ink of COLORS) {
      for (const panel of COLORS) {
        if (ink === panel) continue;
        const ratio = contrast(INK[ink], panelColor(panel));
        expect(ratio, `${ink} on a ${panel} panel is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          MIN_PANEL_CONTRAST,
        );
      }
    }
  });

  it("would fail at full saturation, which is why the panel is a tint", () => {
    // Documents the finding rather than trusting it: at tint 1 the six colours
    // sit at such similar luminance that not one pair is legible.
    const legible = COLORS.flatMap((ink) =>
      COLORS.filter((p) => p !== ink && contrast(INK[ink], panelColor(p, 1)) >= MIN_PANEL_CONTRAST),
    );
    expect(legible).toHaveLength(0);
    expect(PANEL_TINT).toBeLessThan(0.2);
  });
});

describe("the top three", () => {
  it("keeps the highest scores, highest first", () => {
    expect(mergeScore([9, 4, 2], 7)).toEqual([9, 7, 4]);
  });

  it("never grows past three", () => {
    let table: number[] = [];
    for (const score of [1, 8, 3, 12, 5, 40]) table = mergeScore(table, score);

    expect(table).toHaveLength(KEEP);
    expect(table).toEqual([40, 12, 8]);
  });

  it("keeps a tie rather than collapsing it", () => {
    expect(mergeScore([5, 5], 5)).toEqual([5, 5, 5]);
  });
});

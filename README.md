# Ink

A small browser game for COMP4020 crit 5. Static HTML, CSS and TypeScript on
Vite, deployed to GitHub Pages.

The deployed site is the deliverable. This file is for whoever opens the repo,
and it deliberately says nothing about what to do on the screen — the brief
forbids explaining the game anywhere, and a README that quietly did the
teaching would be the loophole rather than the answer. `spec/` is where the
promises live.

## Running it

```sh
mise install                # the Node and pnpm this repo is pinned to
mise exec -- pnpm install   # a bare `pnpm` may resolve to an older major
mise exec -- pnpm dev       # local dev server
mise exec -- pnpm check     # typecheck, build, tests
mise exec -- pnpm check:evidence
```

## What's where

- `game.ts` — every rule, with no DOM. Pure functions in and out, so a round can
  be played in a test without a browser.
- `main.ts` — render and input only. Turns a `Game` into pixels and a keypress
  into an answer.
- `audio.ts` — Web Audio tones. Each one reports a state rather than decorating
  a moment.
- `styles.css` — the interface is achromatic on purpose; the only chroma on
  screen belongs to the game.
- `spec/game.test.ts` — the contract tests for this week's published spec. They
  retire with the brief.
- `spec/no-instructions.test.ts` — a sensor, not a contract. It reads the built
  page and this file, and it carries forward.
- `spec/invariants.test.ts` — shipped with the template; true of any good site.
- `PROCESS.md`, `reflections/crit-5.md` — the process record and the week's
  reflection.

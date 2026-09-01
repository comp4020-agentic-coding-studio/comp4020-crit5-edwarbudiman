# Process overview

## What I built

**Ink** is a one-mechanic browser game. A colour word sits in the middle of the
screen painted in a different colour, and a row of unlabelled swatches sits
under it. Matching the ink buys time on a clock that never stops; matching the
word — the thing your eye wants to do — costs it. The payout shrinks as the
score climbs, so skill extends a run but cannot save it, and the board widens
from three swatches to five as you get good. The whole design answers one line
of the brief: no instructions anywhere.

## The moments that mattered

### 1. The no-tutorial rule decided the interface, not the aesthetics

My first sketch had three buttons labelled with colour names. Playing that in my
head, the first move is genuinely ambiguous — *red* on a button could mean the
word or the ink, and a stranger has no way to tell which game they're in. The
obvious fix was a one-line hint on the opening screen, which the brief forbids.
Instead I made the options **solid swatches with no text**, so "pick a colour"
is the only readable move, and then made the whole interface achromatic —
graphite ground, neutral type, neutral clock — so the only chroma on screen
belongs to the game. An accent colour in the chrome would have competed with the
mechanic for the eye. I checked it by opening the built page cold at 1440×900
and 500px and asking what a first-time player could possibly do.
[`81d5aa7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/81d5aa7)

### 2. The sensor that reads the README, and what happened when it cried wolf

"No instructions anywhere, on screen or off" is testable, so I wrote a sensor
that scans the built page *and* `README.md` for tutorial-shaped copy, because a
how-to that moves off the screen and into the repo is the loophole the spec
closes. It went red immediately — on its own filename, quoted in a file list.
The routine fix is to reword the README. I changed the **sensor** instead, so it
strips code spans and fenced blocks before matching: a filename is an
identifier, not an explanation, and a sensor that cries wolf gets deleted within
a week. It stays as harness for next week; the contract tests in
`spec/game.test.ts` retire with this brief.
[`34140c3...81d5aa7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/compare/34140c3...81d5aa7)

### 3. The change that only playing could produce

The field was a two-row grid: word centred in the leftover space, swatch row
near the bottom. It photographs well. It plays badly — on a 900px-tall viewport
each round costs a look down to the row and back up to the word, and with three
seconds left that saccade is the difference between answering and not. No test
could have found this; I found it by losing runs. Both now sit in one centred
cluster, and on a phone the cluster drops into the thumb's arc instead.
[`fdc2d59`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/fdc2d59)

### 4. A correction that landed in the harness rather than in a retry

`pnpm install` failed with `ERR_PNPM_INVALID_WORKSPACE_CONFIGURATION`, which
reads like a broken repo. It wasn't: the shell's `pnpm` is 8.13.1 while
`mise.toml` pins 11.9.0, and pnpm 8 demands a `packages:` key pnpm 11 doesn't.
Rather than remember it, I wrote the diagnosis into `CLAUDE.md` alongside the
rules carried forward from crit 4, so the next agent in this repo reads it
before it wastes the same ten minutes.
[`ed1aa8e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/ed1aa8e)

## How I grounded it

The rules live in `game.ts` with no DOM, so the contract tests play real rounds
without a browser — including the one rule under focused test, that the ink
scores and the word does not, checked across sixty consecutive rounds. I then
verified the same rule in Chrome against the live DOM, because a green unit test
proves the module, not the wiring: a word reading YELLOW in red ink, with the
yellow swatch pressed, left the score unmoved.

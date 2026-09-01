# Process overview

## What I built

**Ink** is a one-mechanic browser game. A colour word sits in the middle of the
screen painted in a different colour, and three unlabelled swatches sit under
it. Matching the ink buys time on a clock that never stops; matching the word —
the thing your eye wants to do — costs it. Difficulty arrives in tiers of ten:
the clock steps faster, the payout steps smaller, and layers switch on that
attack the reading rather than the rules. The whole design answers one line of
the brief: no instructions anywhere.

## The moments that mattered

### 1. The no-tutorial rule decided the interface, not the aesthetics

My first sketch had three buttons labelled with colour names. Played through in
my head, the first move is ambiguous — *red* on a button could mean the word or
the ink, and a stranger has no way to tell which game they're in. The obvious
fix is a one-line hint, which the brief forbids. Instead the options became
**solid swatches with no text**, so "pick a colour" is the only readable move,
and then the whole interface went achromatic — graphite ground, neutral type,
neutral clock — so the only chroma on screen belongs to the game. An accent
colour in the chrome would have competed with the mechanic for the eye.
[`81d5aa7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/81d5aa7)

### 2. Measuring the thing I couldn't perceive

The whole mechanic is telling one colour from another, so I asked what the game
does for a colour-blind player. Simulating protanopia, deuteranopia and
tritanopia and measuring distance in Lab answered it: **blue and purple sat 6.8
apart under deuteranopia, red and orange 7.9 under tritanopia.** Under 10 is a
coin toss, and deuteranopia is the commonest deficiency — roughly 8% of men
couldn't have played this fairly. Playing it myself could never have found that,
which is the whole argument for the sensor.

Two obvious fixes both failed, and the failures were the useful part. Optimising
the palette for separation produced a pale pink labelled RED — useless, because
here the word *is* the colour name. Forcing every ink legible on every panel
tint drove the palette so light that red had no legible panel at all. So the
guarantee moved out of the palette and into the dealer: only three of six
colours are ever on screen, so a confusable pair is simply **never dealt
together**, and thirteen of the twenty boards survive.

Writing that sensor then caught a bug in my own code — the safe-colour filter
tested against the board it *started* with, so a congruent round could fill both
free slots from one list and deal a confusable pair anyway. It failed on a real
`[red, blue, orange]` board at 10.6.
[`7d3c543`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/7d3c543)

### 3. The changes only playing could produce

Two, and neither was visible in the code. The field was a two-row grid — word
centred, swatches near the bottom — which photographs well and plays badly: at
three seconds left, the look down and back is the difference between answering
and not.
[`fdc2d59`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/fdc2d59)

Then runs kept dying at the same score. The clock was accelerating on every
correct answer, so it got quicker *inside* a tier and pressure outran skill —
measured at a practised 900ms response, the curve went net negative at score 10
and was bleeding a second a round by 20. Stepping both the clock and the payout
once per ten gives a stretch you can settle into and a jolt you feel. Two tests
pin the shape rather than the constants, so retuning the numbers can't silently
undo it.
[`18a7323`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/18a7323)

### 4. Corrections that landed in the harness, not in a retry

The no-instructions sensor went red on its own filename, quoted in a file list.
The routine fix is rewording the README; I changed the **sensor** to strip code
spans instead, because a sensor that cries wolf gets deleted within a week.
Same shape twice more: `pnpm install` failing against a stale shell `pnpm` went
into `CLAUDE.md` rather than into my memory, and the difficulty ladder became a
table of `{id, from, enabled}` so a layer moves or dies in one edit instead of a
search-and-replace.
[`ed1aa8e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/ed1aa8e),
[`2f4d468`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-edwarbudiman/commit/2f4d468)

## How I grounded it

The rules live in `game.ts` with no DOM, so the tests play real rounds without a
browser — including the one rule under focused test, that the ink scores and the
word does not, across sixty consecutive rounds. I then checked the same rule in
Chrome against the live DOM, because a green unit test proves the module, not
the wiring: YELLOW in red ink, yellow swatch pressed, score unmoved. The phone
breakpoint needed its own rig (`scripts/viewport.html`) after the window manager
refused to shrink Chrome below ~500px — an iframe has its own viewport, so the
media queries fire for real.

One test I had to distrust: seeding the generator with consecutive integers
gives nearly identical first draws, so 400 "different" seeds were only ever
dealing two of the six colours. The sampling looked thorough and wasn't.

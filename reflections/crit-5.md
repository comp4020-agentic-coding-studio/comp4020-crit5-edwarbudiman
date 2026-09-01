# Crit 5 — Ink

## What was the breakthrough that moved the work forward?

Realising that the no-tutorial rule was a *design* constraint and not a
*writing* constraint. My instinct was to keep the interface I had in mind and
find the smallest sentence that would make it legible — which is exactly the
move the brief forbids, just in a smaller font. The breakthrough was inverting
it: if the screen can't explain itself, the explanation has to be deleted from
the design rather than compressed. Labelled buttons became unlabelled swatches,
and once the swatches carried the meaning, every other colour on the page became
noise, so the entire interface went achromatic. One constraint I'd read as an
obstacle turned out to be the thing that produced the visual identity.

The second, smaller breakthrough was watching a check fail and fixing the check.
My no-instructions sensor went red on its own filename. Rewording the README
would have taken thirty seconds; teaching the sensor that code spans aren't
prose took five minutes and left me with something worth carrying into next
week. The slow fix was the only one that compounded.

## What did this work change about who I want to be as a software developer?

I've been treating tests as proof that code works. This week they were cheaper
than that and also more useful, and the split turned out to run in both
directions.

Some things only playing could find. Runs kept dying at the same score, and no
test would ever have told me why — the clock was speeding up on every answer, so
pressure outran skill inside a tier. The gap between the word and the swatches
was invisible in every screenshot and obvious ten seconds into a real run.

But the most important defect went the other way, and that's the part that
changed my mind. I asked what the game does for a colour-blind player and then
*measured* it instead of squinting at it — two of my colours were 6.8 apart
under deuteranopia, which is a coin toss, for roughly 8% of men. I cannot
perceive that. No amount of careful playing would have surfaced it, and I had
been quietly treating my own eyes as the acceptance criteria. Writing the check
then caught a bug in my own filter that I'd have shipped otherwise.

So: use the thing for the claims that need a person, and measure the ones where
being the person is exactly what disqualifies you.

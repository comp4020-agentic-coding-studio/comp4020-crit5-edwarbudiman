// Colour vision deficiency, measured rather than guessed.
//
// This game asks you to tell one colour from another under time pressure, so
// a palette that collapses for a colour-blind player doesn't make the game
// harder for them — it makes it a coin toss. Around 8% of men have some form
// of red-green deficiency, which is more people than will ever see this at a
// crit.
//
// The simulation is Viénot, Brettel & Mollon (1999): convert to LMS cone
// response, flatten the missing cone's axis, convert back. Distances are
// CIE76 in Lab — coarse next to CIEDE2000, but the question here is "could
// these two be confused", not "which is the better match", and a single
// threshold answers it.

export type Vision = "normal" | "protan" | "deutan" | "tritan";

export const VISIONS: readonly Vision[] = ["normal", "protan", "deutan", "tritan"];

function toRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(channels: number[]): string {
  return `#${channels
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function toLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toGamma(c: number): number {
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
}

/** What `hex` looks like to someone with the given vision. */
export function simulate(hex: string, vision: Vision): string {
  if (vision === "normal") return hex;

  const [r, g, b] = toRgb(hex).map(toLinear);

  let L = 17.8824 * r + 43.5161 * g + 4.11935 * b;
  let M = 3.45565 * r + 27.1554 * g + 3.86714 * b;
  let S = 0.0299566 * r + 0.184309 * g + 1.46709 * b;

  if (vision === "protan") L = 2.02344 * M - 2.52581 * S;
  if (vision === "deutan") M = 0.494207 * L + 1.24827 * S;
  if (vision === "tritan") S = -0.395913 * L + 0.801109 * M;

  return toHex(
    [
      0.080944 * L - 0.130504 * M + 0.116721 * S,
      -0.010222 * L + 0.054019 * M - 0.113614 * S,
      -0.000365 * L - 0.004125 * M + 0.693513 * S,
    ].map(toGamma),
  );
}

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map(toLinear);

  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function distance(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** How far apart two colours are for the vision that separates them least —
 *  the only number that matters when anyone might be playing. */
export function worstCaseDistance(a: string, b: string): number {
  return Math.min(...VISIONS.map((v) => distance(simulate(a, v), simulate(b, v))));
}

/** Below this, two colours on the same board are a guess rather than a
 *  choice. Chosen against the measured palette: every pair clears it, and the
 *  two that only just clear it are kept off the same board entirely. */
export const SAFE_DISTANCE = 20;

export function confusable(a: string, b: string): boolean {
  return worstCaseDistance(a, b) < SAFE_DISTANCE;
}

// Sound is the second channel the game teaches through: a rising pitch for a
// streak, a flat thud for a mistake, and a tick that only starts when the
// clock is nearly out. Nothing here is decorative — each sound reports a state
// the player would otherwise have to watch the bar to notice.

let ctx: AudioContext | null = null;

/** Browsers refuse to start audio without a gesture, and the first gesture in
 *  this game is also the first move, so the context is built on demand. */
function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOptions {
  from: number;
  to?: number;
  durationMs: number;
  type?: OscillatorType;
  gain?: number;
}

function tone({ from, to = from, durationMs, type = "sine", gain = 0.18 }: ToneOptions): void {
  const audio = context();
  if (!audio) return;

  const now = audio.currentTime;
  const seconds = durationMs / 1000;

  const osc = audio.createOscillator();
  const amp = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, now + seconds);

  // A short attack and an exponential tail: a hard stop on a raw oscillator
  // clicks, and a click reads as a bug rather than a sound.
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

  osc.connect(amp).connect(audio.destination);
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

/** Climbs a semitone per correct answer, so a streak is audible before the
 *  score is read. Caps an octave up, where it stops being pleasant. */
export function correct(streak: number): void {
  const semitone = Math.min(streak, 12);
  const base = 523.25 * Math.pow(2, semitone / 12);
  tone({ from: base, to: base * 1.5, durationMs: 110, type: "triangle", gain: 0.16 });
}

export function wrong(): void {
  tone({ from: 150, to: 90, durationMs: 240, type: "sawtooth", gain: 0.12 });
}

/** The last three seconds. Pitch and volume both rise as the bar empties. */
export function tick(secondsLeft: number): void {
  const urgency = 1 - secondsLeft / 3;
  tone({
    from: 760 + urgency * 340,
    durationMs: 55,
    type: "square",
    gain: 0.05 + urgency * 0.06,
  });
}

export function over(): void {
  tone({ from: 320, to: 70, durationMs: 700, type: "sawtooth", gain: 0.16 });
}

/** Warms the context up on the first gesture so the first sound isn't late. */
export function prime(): void {
  context();
}

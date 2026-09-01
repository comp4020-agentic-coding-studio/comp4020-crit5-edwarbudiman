// The top three, kept on the player's own machine.

const KEY = "ink.scores.v1";
export const KEEP = 3;

/** Pure: where a score lands in the table. Separated from storage so the rule
 *  ("best three, highest first") is testable without a browser. */
export function mergeScore(scores: number[], score: number): number[] {
  return [...scores, score].sort((a, b) => b - a).slice(0, KEEP);
}

/** Storage can throw outright, not just come back empty — a browser set to
 *  block site data raises on the property access itself. A crash here would
 *  take the whole game down on load, so every path returns a usable value. */
export function readScores(): number[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).slice(0, KEEP);
  } catch {
    return [];
  }
}

export function recordScore(score: number): number[] {
  const next = mergeScore(readScores(), score);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Nothing to do: the run still counts for this session, it just won't
    // outlive the tab.
  }
  return next;
}

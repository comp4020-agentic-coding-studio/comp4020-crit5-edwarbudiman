import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// SENSOR — this one is harness, not contract. Crit 5 forbids instructions, but
// the standard it encodes ("if you had to explain it, the interface failed")
// outlives the brief, so it comes forward into the next repo rather than
// retiring with the week.
//
// It reads the BUILT page, the same as the invariants, plus the README —
// because a how-to-play that moves off the screen and into the repo is the
// exact loophole the spec closes.
const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

/** Text a person actually reads: markup, scripts and styles stripped out. */
function visibleText(html: string): string {
  const { document } = new JSDOM(html).window;
  for (const el of document.querySelectorAll("script, style, template")) el.remove();
  return (document.body?.textContent ?? "").replace(/\s+/g, " ").trim();
}

// Phrases that only ever appear when an interface has given up on teaching
// itself. Each is a shape, not a single wording, so paraphrasing doesn't slip
// past: it is the act of explaining that fails, not the choice of words.
const TUTORIAL = [
  /how\s+to\s+play/i,
  /instructions?\b/i,
  /\btutorial\b/i,
  /\bthe\s+rules?\s+(are|of)\b/i,
  /your\s+(goal|objective|aim|job)\s+is/i,
  /the\s+(goal|objective|aim)\s+is/i,
  /\b(click|tap|press|hit|choose|pick|select|match|type)\b[^.!?]{0,40}\bto\s+(start|begin|play|win|score|continue|answer)\b/i,
  /use\s+(the\s+)?(arrow|number|[a-z]\s*[,/]\s*[a-z])\s*keys?/i,
  /\bwelcome\s+to\b/i,
  /\bget\s+started\b/i,
  /\bcorrect\s+colou?r\s+is\b/i,
  /\bignore\s+the\s+word\b/i,
];

const pages = files()
  .filter((path) => path.endsWith(".html"))
  .map((path) => ({
    name: relative(DIST, path).split(sep).join("/"),
    html: readFileSync(path, "utf8"),
  }));

describe("sensor: the interface explains nothing", () => {
  it("built at least one page", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const { name, html } of pages) {
    const text = visibleText(html);

    describe(name, () => {
      for (const pattern of TUTORIAL) {
        it(`carries no tutorial copy matching ${pattern}`, () => {
          expect(text.match(pattern)?.[0], "the opening screen has to do this job").toBe(undefined);
        });
      }

      it("stays close to wordless", () => {
        // A screen that teaches itself has almost nothing to read. The budget
        // is deliberately loose — it catches a paragraph of prose creeping in,
        // not a well-chosen label.
        expect(text.length, `visible copy: ${JSON.stringify(text)}`).toBeLessThan(300);
      });
    });
  }
});

describe("sensor: the README doesn't stand in for the interface", () => {
  const readme = resolve("README.md");

  it("exists", () => {
    expect(existsSync(readme)).toBe(true);
  });

  for (const pattern of TUTORIAL) {
    it(`carries no tutorial copy matching ${pattern}`, () => {
      const prose = readFileSync(readme, "utf8");
      expect(prose.match(pattern)?.[0], "explaining it in the repo is still explaining it").toBe(
        undefined,
      );
    });
  }
});

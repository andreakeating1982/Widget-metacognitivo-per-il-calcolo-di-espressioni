import { describe, expect, it } from "vitest";
import { bracketLike, classifyPrintedBracket } from "./printedBracket";
import { BRACKET_FIXTURES } from "./printedBracket.fixtures";
import type { Glyph, InkField } from "./ocrReconcile";

/** Maschera binaria + glifo dal disegno ASCII (# = inchiostro), con un margine di 6 px. */
function fromAscii(rows: string[]): { field: InkField; glyph: Glyph } {
  const pad = 6;
  const w = rows[0]!.length + 2 * pad;
  const h = rows.length + 2 * pad;
  const mask = new Uint8Array(w * h);
  let area = 0;
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === "#") {
        mask[(y + pad) * w + x + pad] = 1;
        area++;
      }
    }),
  );
  return {
    field: { w, h, mask },
    glyph: { x0: pad, y0: pad, x1: pad + rows[0]!.length - 1, y1: pad + rows.length - 1, blobs: 1, area },
  };
}

/** altezza cifra con cui sono state renderizzate le fixture */
const HD = 28;

describe("tipo di parentesi stampata dai pixel (font reali, cifra alta 28 px)", () => {
  for (const [font, glyphs] of Object.entries(BRACKET_FIXTURES)) {
    for (const ch of ["(", ")", "[", "]", "{", "}"] as const) {
      it(`${font}: «${ch}» → «${ch}»`, () => {
        const { field, glyph } = fromAscii(glyphs[ch]!);
        expect(bracketLike(glyph, HD)).toBe(true);
        const r = classifyPrintedBracket(field, glyph);
        expect(r?.kind).toBe(ch);
        // abbastanza netto da poter correggere Tesseract (BR_OVERRIDE_MARGIN = 0,06)
        expect(r!.margin).toBeGreaterThanOrEqual(0.06);
      });
    }
    it(`${font}: una barra «|» non è una parentesi`, () => {
      const { field, glyph } = fromAscii(glyphs["|"]!);
      expect(bracketLike(glyph, HD)).toBe(false);
      // anche forzando il classificatore, una barra non deve diventare `(` o `{`
      const r = classifyPrintedBracket(field, glyph);
      expect(r === null || r.kind === "[" || r.kind === "]").toBe(true);
    });
  }

  it("una cifra (altezza di una cifra) non è «da parentesi»", () => {
    expect(bracketLike({ x0: 0, y0: 0, x1: 17, y1: 27 }, HD)).toBe(false); // 18×28
  });

  it("una forma troppo larga o troppo bassa non è «da parentesi»", () => {
    expect(bracketLike({ x0: 0, y0: 0, x1: 29, y1: 37 }, HD)).toBe(false); // larga quasi quanto alta
    expect(bracketLike({ x0: 0, y0: 0, x1: 5, y1: 19 }, HD)).toBe(false); // bassa
  });
});

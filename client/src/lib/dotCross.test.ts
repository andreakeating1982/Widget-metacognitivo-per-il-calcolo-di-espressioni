// Test PERMANENTE (5/10 sera): una «x» piccola le cui due diagonali si ATTRAVERSANO
// (senza giunzione di estremità) NON è un paio di puntini di moltiplicazione.
// Prima lo stadio puntini la mangiava («x(x+1)» → «:(:+1)», «(x+1)x» → «(1+1)\cdot»):
// `touchesOther` vede solo le giunzioni, e ciascuna diagonale (≤ 34 px, aspetto ≤ 3)
// passava per «puntino isolato». Un puntino vero non attraversa mai altro inchiostro.
import { describe, expect, it } from "vitest";
import { rewriteDotSigns } from "./dotSigns";
import type { SimpleStroke } from "./dotSigns";

const line = (x0: number, y0: number, x1: number, y1: number, n = 14): SimpleStroke => ({
  points: Array.from({ length: n }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / (n - 1),
    y: y0 + ((y1 - y0) * i) / (n - 1),
  })),
  lineWidth: 3,
});
/** «x» fatta di due diagonali che si incrociano al centro (senza giunzioni). */
const xGlyph = (x0: number, yMid: number, size: number): SimpleStroke[] => [
  line(x0, yMid - size / 2, x0 + size, yMid + size / 2),
  line(x0 + size, yMid - size / 2, x0, yMid + size / 2),
];
/** cifra «1» alta (asta verticale) per fissare altezza e centro della riga */
const one = (x: number): SimpleStroke => line(x, 20, x, 110, 20);
const dot = (cx: number, cy: number, r = 3): SimpleStroke => ({
  points: [
    { x: cx - r, y: cy },
    { x: cx, y: cy - r },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
  ],
  lineWidth: 3,
});

describe("x piccola con diagonali incrociate ≠ puntini", () => {
  for (const size of [22, 28, 32]) {
    it(`x di ${size} px fra due cifre alte: resta nell'inchiostro, nessun puntino`, () => {
      const ink = [one(10), ...xGlyph(50, 78, size), one(110)];
      const r = rewriteDotSigns(ink);
      expect(r.loneDots).toBe(0);
      expect(r.colons).toBe(0);
      expect(r.strokes).toHaveLength(ink.length);
    });
  }

  it("x piccola subito dopo una tonda alta (x(x+1)) resta intera", () => {
    const tonda: SimpleStroke = {
      points: Array.from({ length: 24 }, (_, i) => {
        const t = i / 23;
        return { x: 40 - 18 * Math.sin(Math.PI * t), y: 20 + 90 * t };
      }),
      lineWidth: 3,
    };
    const ink = [...xGlyph(10, 78, 26), tonda, one(70)];
    const r = rewriteDotSigns(ink);
    expect(r.loneDots).toBe(0);
    expect(r.strokes).toHaveLength(ink.length);
  });

  it("un puntino vero a metà altezza fra due cifre resta un puntino", () => {
    const ink = [one(10), dot(45, 70), one(80)];
    const r = rewriteDotSigns(ink);
    expect(r.loneDots).toBe(1);
    expect(r.strokes).toHaveLength(2);
  });

  it("due puntini impilati restano un « : » (non si incrociano)", () => {
    const ink = [one(10), dot(45, 62), dot(45, 92), one(80)];
    const r = rewriteDotSigns(ink);
    expect(r.colons).toBe(1);
  });
});

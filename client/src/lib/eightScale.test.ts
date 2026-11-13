import { describe, expect, it } from "vitest";
import { synthDetailed, type SpacingStyle } from "./bench/synthInk";
import { horizontalExtentAt, isEightStroke, rowCrossings } from "./inkSigns";

/**
 * Regressione 6/10 — rilevatore degli OTTO a piccola scala (inkSigns.ts).
 *
 * 1. `horizontalExtentAt` ora INTERPOLA le intersezioni dei segmenti con la riga centrale: con pochi
 *    punti la fascia ±10% conteneva un solo lato di un anello e l'estensione risultava ~0
 *    (uno «0» o l'occhiello di una «b» sembravano un 8 con la vita strozzata).
 * 2. La strozzatura richiede `rowCrossings ≥ 2`: una vera VITA ha due tratti che attraversano il
 *    centro; l'occhiello di una «b» disegnato come arco `)` lo attraversa una volta sola
 *    (`3a(b+1)` → `3a(18+1)`, `(a+b)(a-b)` → `(a+18)…`).
 * Misurato col modello (catalogo, H=38 interi): 72% → 76%, 0 peggiorate; scala normale IDENTICA.
 */
type Pt = { x: number; y: number };
const box = (pts: Pt[]) => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};
const ellipse = (n: number, a: number, b: number, phase = 0): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = phase + (2 * Math.PI * i) / n;
    return { x: 50 + a * Math.cos(t), y: 50 + b * Math.sin(t) };
  });

describe("rowCrossings", () => {
  it("una retta verticale attraversa la riga centrale una volta", () => {
    expect(rowCrossings([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }], 10)).toBe(1);
  });
  it("un anello chiuso la attraversa due volte", () => {
    // (fase 0,3 rad: i vertici non cadono ESATTAMENTE sulla riga, che per costruzione conta come «sotto»)
    expect(rowCrossings(ellipse(24, 8, 16, 0.3), 50)).toBe(2);
  });
  it("un tratto che non arriva alla riga non la attraversa", () => {
    expect(rowCrossings([{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 1 }], 10)).toBe(0);
  });
  it("un 8 disegnato in un solo tratto la attraversa almeno due volte", () => {
    const eight: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (2 * Math.PI * i) / 40;
      eight.push({ x: 50 + 8 * Math.sin(2 * t), y: 50 - 16 * Math.cos(t) });
    }
    expect(rowCrossings(eight, 50)).toBeGreaterThanOrEqual(2);
  });
});

describe("horizontalExtentAt: interpolazione", () => {
  it("con punti radi (nessuno nella fascia) misura comunque la larghezza al centro", () => {
    // ellisse a 8 punti ruotata di 22,5°: nessun punto cade entro ±10% dell'altezza dal centro
    const pts = ellipse(8, 8, 16, Math.PI / 8);
    const b = box(pts);
    const inBand = pts.filter((p) => Math.abs(p.y - b.cy) <= 0.1 * b.h);
    expect(inBand).toHaveLength(0); // (il vecchio calcolo restituiva −1)
    const ext = horizontalExtentAt(pts, b.cy, 0.1 * b.h);
    expect(ext).toBeGreaterThan(0.9 * 16); // larghezza vera dell'ellisse = 2a = 16
  });
  it("la vita di un 8 resta stretta", () => {
    const eight: Pt[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (2 * Math.PI * i) / 60;
      eight.push({ x: 50 + 8 * Math.sin(2 * t), y: 50 - 16 * Math.cos(t) });
    }
    const b = box(eight);
    expect(horizontalExtentAt(eight, b.cy, 0.1 * b.h)).toBeLessThan(0.4 * b.w);
  });
});

const at38 = (expr: string, style: SpacingStyle, seed: number) => {
  const { strokes, owners } = synthDetailed(expr, { seed, style, H: 38 });
  for (const st of strokes) for (const p of st.points) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
  return { strokes, owners };
};

describe("isEightStroke a H=38 con pixel interi (casi reali del banco)", () => {
  it("l'8 di `14-8` è riconosciuto", () => {
    const { strokes, owners } = at38("14-8", "normal", 9276);
    const idx = owners.map((o, i) => (o.ch === "8" ? i : -1)).filter((i) => i >= 0);
    expect(idx.length).toBeGreaterThan(0);
    expect(idx.some((i) => isEightStroke(strokes[i] as never, box(strokes[i]!.points)))).toBe(true);
  });
  it.each([
    ["3a(b+1)", 1574],
    ["(a+b)(a-b)", 9714],
  ] as [string, number][])("la «b» di %s (seme %i) NON è un otto", (expr, seed) => {
    const { strokes, owners } = at38(expr, "normal", seed);
    const idx = owners.map((o, i) => (o.ch === "b" ? i : -1)).filter((i) => i >= 0);
    expect(idx.length).toBeGreaterThan(0);
    for (const i of idx) expect(isEightStroke(strokes[i] as never, box(strokes[i]!.points))).toBe(false);
  });
});

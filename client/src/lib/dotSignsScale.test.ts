import { describe, expect, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./bench/synthInk";
import { runGeometry } from "./recognizePipeline";

/**
 * Regressione 6/10 — soglia RELATIVA dei «piccoli segni» (`SMALL_REL`, dotSigns.ts).
 *
 * `SMALL_MAX = 34 px` è tarato su cifre alte ~60 px. Con la scrittura PICCOLA del canvas (cifre di
 * 33–45 px, coordinate a pixel interi come gli eventi del mouse) una cifra a tratto singolo (un «3»
 * di 16×33 px) rientrava fra i puntini: veniva TOLTA dall'inchiostro e al suo posto tornava `\cdot`
 * (`(-3)` → `(-\cdot)`, `[2][3]` → `[2][\cdot]`, `{2+1}3` → `{2+1}\cdot`), e due cifre piccole
 * impilate potevano passare per « : ». Un puntino è sempre molto più piccolo del tratto più alto.
 * Misurato col modello (catalogo, H=38 interi): 72% → 76% (con la regola dell'otto), 0 peggiorate;
 * a scala normale il banco è IDENTICO (88% → 88%).
 */
const at38 = (expr: string, style: SpacingStyle, seed: number) => {
  const strokes = synthExpression(expr, { seed, style, H: 38 });
  for (const st of strokes) for (const p of st.points) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
  return strokes;
};

describe("dotSigns: una cifra piccola non è un puntino (H=38, pixel interi)", () => {
  const cases: [string, SpacingStyle, number][] = [
    ["(-3)", "normal", 1332],
    ["[2][3]", "normal", 1624],
    ["{2+1}3", "normal", 9515],
  ];
  it.each(cases)("%s (%s, seme %i): nessun puntino, nessun due-punti, tratti intatti", (expr, style, seed) => {
    const strokes = at38(expr, style, seed);
    const g = runGeometry(strokes as never);
    expect(g.rewritten.dots).toHaveLength(0);
    expect(g.rewritten.colons).toBe(0);
    // nessun tratto sparisce nello stadio dei puntini: restano tutti quelli usciti dalle parentesi
    expect(g.rewritten.strokes).toHaveLength(g.brk.strokes.length);
  });

  it("due cifre piccole non diventano « : » (2^2+3^2)", () => {
    const g = runGeometry(at38("2^2+3^2", "normal", 9506) as never);
    expect(g.rewritten.colons).toBe(0);
    expect(g.rewritten.divSigns).toBe(0);
  });
});

describe("dotSigns: il puntino VERO si riconosce ancora (nessuna regressione)", () => {
  it("3*4 a cifre normali: un puntino", () => {
    const g = runGeometry(synthExpression("3*4", { seed: 7, style: "normal" }) as never);
    expect(g.rewritten.dots.length).toBe(1);
  });

  it("3*4 a H=38 con pixel interi: un puntino", () => {
    const g = runGeometry(at38("3*4", "normal", 7) as never);
    expect(g.rewritten.dots.length).toBe(1);
  });

  it("12:3 a cifre normali: due-punti riconosciuto", () => {
    const g = runGeometry(synthExpression("12:3", { seed: 3, style: "normal" }) as never);
    expect(g.rewritten.colons + g.rewritten.divSigns).toBeGreaterThanOrEqual(1);
  });
});

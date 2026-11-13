import { describe, expect, it } from "vitest";
import { canonizzaEspressione, trascrizioneFedele } from "./costruisci";
import { evaluateNumericExpression, canParseExpression } from "../client/src/lib/espressioni";
import { sameSourceStructure } from "../client/src/lib/progressiveExpression";

/* 10/11 — la trascrizione della foto è ora fedele (radici con INDICE
 * NEGATIVO, es. 0,3per⁻³√(ab^-1)), ma la costruzione dell'esercizio
 * falliva: canonizzaEspressione trasformava l'apice dell'INDICE in una
 * potenza del numero precedente (0,3per⁻³√ → 0,\overline{3}^-3√).
 * NESSUN risultato dell'esercizio qui: solo fedeltà e verificabilità. */

describe("canonizzaEspressione — l'indice della radice non è una potenza", () => {
  it("conserva l'apice (anche negativo) immediatamente prima di √", () => {
    expect(canonizzaEspressione("0,3per⁻³√(ab^-1)")).toBe("0,3per⁻³√(ab^-1)");
    expect(canonizzaEspressione("⁻³√8+2⁻²")).toBe("⁻³√8+2^-2");
    expect(canonizzaEspressione("⁵√x")).toBe("⁵√x");
  });
});

describe("trascrizioneFedele — indice Unicode ⁻³√ ≡ \\sqrt[-3]{}", () => {
  it("riconosce la stessa radice scritta in notazione app e in LaTeX", () => {
    expect(
      trascrizioneFedele("0,3per⁻³√(ab^-1)-0,3per⁻³√(ab^-1)", "0,3\\overline{3}\\sqrt[-3]{ab^{-1}}-0,3\\overline{3}\\sqrt[-3]{ab^{-1}}"),
    ).toBe(true);
  });
});

describe("motore — la radice con indice negativo resta leggibile e valutabile", () => {
  it("il parser accetta la notazione canonica con indice Unicode", () => {
    expect(canParseExpression("0,3per⁻³√(ab^-1)-0,3per⁻³√(ab^-1)")).toBe(true);
  });
  it("la valutazione numerica gestisce l'indice negativo (⁻³√27 = 1/3)", () => {
    expect(evaluateNumericExpression("⁻³√27")).toBeCloseTo(1 / 3, 9);
  });
  it("stessa struttura tra notazione canonica (come inviata dal client) e LaTeX", () => {
    expect(sameSourceStructure("0,3\\overline{3}⁻³√(ab^-1)", "0,3\\overline{3}\\sqrt[-3]{ab^{-1}}")).toBe(true);
  });
});


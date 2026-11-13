import { describe, expect, it } from "vitest";
import { analyzeExpression } from "./espressioni";

/** Replica la selezione del punto 4 in EspressioniExercises.tsx (dopo la
 *  correzione 26/9): le divisioni della catena e l'inizio del «calcolo in
 *  ordine» si cercano SOLO dopo l'ultimo passo di parentesi. */
function chainSelection(steps: ReturnType<typeof analyzeExpression>["steps"]) {
  const parenKinds = ["paren-value", "paren-sign", "paren-mul", "paren-prod", "paren-div", "paren-unwrap"];
  let lastParenIdx = 0;
  for (let i = steps.length - 1; i > 0; i--) {
    if (parenKinds.includes(steps[i]!.kind)) {
      lastParenIdx = i;
      break;
    }
  }
  const firstChainIdx = steps.findIndex(
    (s, i) => i > lastParenIdx && (s.kind === "div-num" || s.kind === "fold-add-num"),
  );
  const chainStartLatex = firstChainIdx > 0 ? steps[firstChainIdx - 1]!.latex : null;
  const chainSteps = steps.filter(
    (s, i) => i > lastParenIdx && (s.kind === "div-num" || s.kind === "fold-add-num"),
  );
  return { lastParenIdx, firstChainIdx, chainStartLatex, chainSteps };
}

describe("punto 4 — calcolo in ordine con parentesi (segnalazione 26/9)", () => {
  it("27 : (4 : 2 − 5 − 3) + 48 : (6² − 2³): parte SENZA parentesi e non rifà 4 : 2", () => {
    const a = analyzeExpression("27 : (4 : 2 - 5 - 3) + 48 : (6^2 - 2^3)");
    const sel = chainSelection(a.steps);
    // l'inizio del punto 4 è l'espressione SENZA parentesi
    expect(sel.chainStartLatex).toBe("27 : -6 + 48 : 28");
    // la prima operazione della catena NON è la divisione interna 4 : 2
    expect(sel.chainSteps[0]!.opLatex).toBe("27 : -6");
    // le divisioni esterne sono entrambe nella catena
    const ops = sel.chainSteps.map((s) => s.opLatex);
    expect(ops).toContain("48 : 28");
    expect(ops).not.toContain("4 : 2");
  });

  it("27 : 3 + 48 : 28 (senza parentesi): comportamento invariato", () => {
    const a = analyzeExpression("27 : 3 + 48 : 28");
    const sel = chainSelection(a.steps);
    expect(sel.chainStartLatex).toBe("27 : 3 + 48 : 28");
    expect(sel.chainSteps.map((s) => s.opLatex)).toEqual([
      "27 : 3",
      "48 : 28",
      "9 + \\dfrac{12}{7}",
    ]);
  });

  it("(2 + 3) · 4 + 1: parte dai prodotti già svolti", () => {
    const a = analyzeExpression("(2 + 3) \\cdot 4 + 1");
    const sel = chainSelection(a.steps);
    expect(sel.chainStartLatex).toBe("20 + 1");
    expect(sel.chainSteps[0]!.opLatex).toBe("20 + 1");
  });
});

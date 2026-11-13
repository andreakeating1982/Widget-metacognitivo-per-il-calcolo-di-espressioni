/** Diagnosi mirata: fedeltà della trascrizione per il LaTeX reale dell'IA
 *  (tentativo 1) e forme (2)^2 vs 2^2; divisione : vs /. */
import { trascrizioneFedele } from "../server/costruisci.ts";
import { sameSourceStructure } from "../client/src/lib/progressiveExpression.ts";
import { normalizeInput, parseExpression, printLatex } from "../client/src/lib/espressioni.ts";

const aiTentativo1 =
  "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[2^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}";

function shapeStr(raw: string): string {
  try {
    const n = parseExpression(normalizeInput(raw, true));
    const s = JSON.stringify(n, (_k, v) => (typeof v === "bigint" ? String(v) : v));
    return s.slice(0, 400);
  } catch (e) {
    return "ERRORE " + (e instanceof Error ? e.message : String(e));
  }
}

const inputSlash = "(2√3-2√2-2+√18-√12-√6)/(2[(2)^2-(√6)^2])";
const inputDue = "(2√3-2√2-2+√18-√12-√6):(2[(2)^2-(√6)^2])";

console.log("fedele input/ ↔ AI tentativo 1:", trascrizioneFedele(inputSlash, aiTentativo1));
console.log("fedele input: ↔ AI tentativo 1:", trascrizioneFedele(inputDue, aiTentativo1));
console.log("\n── shape input (/):", shapeStr(inputSlash));
console.log("\n── shape AI:", shapeStr(aiTentativo1));
console.log("\n── sameSourceStructure diretto:",
  sameSourceStructure(inputSlash, aiTentativo1));

/** Diagnosi «espressione con radicali non si costruisce» (foto non_funziona.png).
 *  Testa TUTTI i pezzi dell'espressione attraverso la catena di contoGiusto:
 *  rationalPolyEquals → exactNumericEquality → valoreBigint → valore → polinomio. */
import { exactNumericEquality } from "../client/src/lib/numericRadicalEquality.ts";
import {
  evaluateNumericExpression,
  rationalPolyEquals,
  latexValue,
  normalizeInput,
  parseExpression,
} from "../client/src/lib/espressioni.ts";
import { valoreBigint, trascrizioneFedele } from "../server/costruisci.ts";

const coppie: Array<[string, string, string]> = [
  // [descrizione, op, answer]
  ["√18 = 3√2 (tastiera)", "\\sqrt{18}", "3\\sqrt{2}"],
  ["√18 = 3√2 (simboli √)", "√18", "3√2"],
  ["√12 = 2√3", "\\sqrt{12}", "2\\sqrt{3}"],
  ["(√6)² = 6 (tastiera)", "(\\sqrt{6})^{2}", "6"],
  ["(√6)² = 6 (simboli)", "(√6)²", "6"],
  ["2² = 4", "(2)^{2}", "4"],
  ["numeratore completo", "2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}", "\\sqrt{2}-2-\\sqrt{6}"],
  ["numeratore con √", "2√3-2√2-2+√18-√12-√6", "√2-2-√6"],
  ["denominatore", "2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]", "-4"],
  ["frazione completa (LaTeX)",
    "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}",
    "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}"],
  ["frazione completa (−4 come −2²)",
    "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}",
    "-\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{4}"],
  ["frazione con quadre tastiera", "(2√3-2√2-2+√18-√12-√6)/(2[2²-(√6)²])", "(√2-2-√6)/(-4)"],
];

function analisi(s: string) {
  let parse = "ok", rpe: boolean | null = null, ene: boolean | null = null;
  let evn: number | null = null, lv: number | null = null, big = "null";
  try { parseExpression(normalizeInput(s)); } catch (e) { parse = "ERRORE: " + (e instanceof Error ? e.message : String(e)); }
  try { rpe = rationalPolyEquals(s, s); } catch { rpe = "throw" as unknown as null; }
  try { ene = exactNumericEquality(s, s); } catch (e) { ene = "throw: " + (e instanceof Error ? e.message : String(e)) as unknown as null; }
  try { evn = evaluateNumericExpression(s); } catch { evn = null; }
  try { lv = latexValue(s); } catch { lv = null; }
  try { big = String(valoreBigint(s)); } catch { big = "throw"; }
  return { parse, rationalPolyEquals_sé: rpe, exactNumeric_sé: ene, evaluateNumeric: evn, latexValue: lv, bigint: big };
}

console.log("═══ ANALISI SINGOLI PEZZI (self-comparison deve essere true) ═══");
for (const [, op] of coppie) {
  console.log("—", op.slice(0, 60));
  console.log("  ", JSON.stringify(analisi(op)));
}

console.log("\n═══ CONFRONTI op ↔ answer ═══");
for (const [desc, op, an] of coppie) {
  let efe: boolean | null = null;
  try { efe = exactNumericEquality(op, an); } catch (e) { efe = ("throw: " + (e instanceof Error ? e.message : String(e))) as unknown as null; }
  console.log(`${efe === true ? "✅" : efe === false ? "❌" : "⚠️ "} ${desc} → exactNumericEquality=${JSON.stringify(efe)}`);
}

console.log("\n═══ trascrizioneFedele (input studente ↔ LaTeX IA) ═══");
const inputStudente = "(2√3-2√2-2+√18-√12-√6)/(2[2²-(√6)²])";
for (const latex of [
  "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}",
  "\\frac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[2^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}",
]) {
  console.log(`  fedele=${trascrizioneFedele(inputStudente, latex)} ← ${latex.slice(0, 70)}…`);
}

/** Diagnosi strutturale: replaceExpressionStep e sameResultStructure sui radicali. */
import {
  replaceExpressionStep,
  sameResultStructure,
  sameSourceStructure,
} from "../client/src/lib/progressiveExpression.ts";

const riga0 =
  "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}";

const passi: Array<[string, string]> = [
  ["\\sqrt{18}", "3\\sqrt{2}"],
  ["\\sqrt{12}", "2\\sqrt{3}"],
  ["2\\sqrt{3}-2\\sqrt{3}", "0"],
  ["-2\\sqrt{2}+3\\sqrt{2}", "\\sqrt{2}"],
  ["2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]", "2\\left[4-6\\right]"],
  ["2\\left[4-6\\right]", "-4"],
  ["2\\left(4-6\\right)", "-4"],
  [
    "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}",
    "\\dfrac{2+\\sqrt{6}-\\sqrt{2}}{4}",
  ],
];

let riga = riga0;
console.log("RIGA 0:", riga);
for (const [op, an] of passi) {
  const succ = replaceExpressionStep(riga, op, an);
  console.log(`\n— op=${op}\n  an=${an}\n  → ${succ === null ? "NULL (non collegabile!)" : succ}`);
  if (succ !== null) riga = succ;
}

console.log("\n═══ sameResultStructure ultima riga ↔ varianti del risultato ═══");
for (const finale of [
  riga,
  "\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{-4}",
  "-\\dfrac{\\sqrt{2}-2-\\sqrt{6}}{4}",
  "\\dfrac{2+\\sqrt{6}-\\sqrt{2}}{4}",
]) {
  console.log(`  ${sameResultStructure(riga, finale)} ← ${finale}`);
}

console.log("\n═══ sameSourceStructure input ↔ varianti LaTeX ═══");
for (const [inp, lx] of [
  ["(2√3-2√2-2+√18-√12-√6)/(2[2^2-(√6)^2])", "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}"],
  ["(2√3-2√2-2+√18-√12-√6)/(2[2^2-(√6)^2])", "\\frac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\left(2^{2}-\\left(\\sqrt{6}\\right)^{2}\\right)}"],
  ["(2√3-2√2-2+√18-√12-√6)/(2[2^2-(√6)^2])", "\\dfrac{2\\sqrt{3}-2\\sqrt{2}-2+\\sqrt{18}-\\sqrt{12}-\\sqrt{6}}{2\\cdot\\left[\\left(2\\right)^{2}-\\left(\\sqrt{6}\\right)^{2}\\right]}"],
] as Array<[string, string]>) {
  console.log(`  ${sameSourceStructure(inp, lx)} ← ${lx.slice(0, 75)}…`);
}

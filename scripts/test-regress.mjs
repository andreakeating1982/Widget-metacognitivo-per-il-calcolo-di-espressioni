// Test di regressione (25/10) — espressioni senza esponenti negativi
import { analyzeExpression } from "../client/src/lib/espressioni.ts";

const cases = [
  "3 · (2+2) - 2 · (4 + 2)",
  "27 : 3 + 48 : 28",
  "2^3 + 3^2",
  "(3/7 : 9/14)² - 7/12 · 2",
  "4x - 2x + 3x",
  "(2+3)^2",
  "5 - (2 - 8)",
  "1/2 + 1/3",
  "6 : 2 · 3",
  "2 · 3^2",
];

for (const raw of cases) {
  try {
    const a = analyzeExpression(raw);
    console.log(`OK   ${raw}  →  ${a.finalLatex}  (${a.steps.length} passi)`);
  } catch (e) {
    console.log(`FAIL ${raw}  →  ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Riproduce il caso della foto: (1/3)^-6 : (1/6)^-3 + 1/6
import { analyzeExpression } from "../client/src/lib/espressioni.ts";

const variants = [
  "(1/3)^-6 : (1/6)^-3 + 1/6",
  "(1/3)^-6 : (1/6)^-3",
  "(1/6)^-3 + 1/6",
];

for (const v of variants) {
  console.log("\n========================================");
  console.log("ESPRESSIONE:", v);
  try {
    const a = analyzeExpression(v);
    console.log("kind:", a.kind);
    for (const s of a.steps) {
      console.log(`--- [${s.kind}]`);
      console.log("  title:", s.title);
      console.log("  latex:", s.latex);
      if ("detail" in s && s.detail) console.log("  detail:", s.detail);
      if ("ask" in s && s.ask) console.log("  ask:", JSON.stringify(s.ask));
      if ("expected" in s && s.expected !== undefined)
        console.log("  expected:", JSON.stringify(s.expected));
    }
  } catch (e) {
    console.log("ERRORE:", e.message);
  }
}

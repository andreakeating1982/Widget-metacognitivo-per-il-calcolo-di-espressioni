import { reduceOnce, parseExpression, normalizeInput, printLatex } from "../client/src/lib/espressioni.ts";

// Replica di reduceSilently per il caso (1/3)^-2
let cur = parseExpression(normalizeInput("\\left(\\frac{1}{3}\\right)^{-2}"));
console.log("START:", printLatex(cur));
for (let i = 0; i < 12; i++) {
  let r = null;
  try {
    r = reduceOnce(cur, true, false, false, false);
  } catch (e) {
    console.log(i, "THROW:", e instanceof Error ? e.message : e);
    break;
  }
  if (!r) {
    console.log(i, "STOP — nodo finale:", cur.k, printLatex(cur));
    break;
  }
  console.log(i, r.kind, "| op=", r.opLatex ?? "-", "| ans=", r.answer ? r.answer.n + "/" + r.answer.d : "-", "|", printLatex(r.node));
  cur = r.node;
}

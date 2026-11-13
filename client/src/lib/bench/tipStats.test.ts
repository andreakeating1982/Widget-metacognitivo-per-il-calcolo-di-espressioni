// Statistiche della «punta» (curlyTip) per classe vera: quante tonde/cifre risultano graffe e
// con quali misure (rapporto |uMid|/|uSh|, endWidth, corners, rise, g).
//   GEO_AUDIT=1 [GEO_SEEDS=150] npx vitest run src/lib/bench/tipStats.test.ts
import { describe, it } from "vitest";
import { synthExpression } from "./synthInk";
import { profileOf, curlyTip, digitLike } from "../bracketProfile";

const ON = !!process.env.GEO_AUDIT;
const q = (xs: number[], p: number): number => {
  const a = xs.filter((x) => isFinite(x)).sort((m, n) => m - n);
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))]! : NaN;
};
const f = (x: number): string => (isFinite(x) ? x.toFixed(2) : " nan");

describe.skipIf(!ON)("statistiche punta", () => {
  it("per classe", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.GEO_SEEDS ?? 150);
    const classes: Record<string, string> = {
      "(": "(", ")": ")", "[": "[", "]": "]", "{": "{", "}": "}", "2": "2", "3": "3", "5": "5", "7": "7",
    };
    const rows: string[] = [];
    for (const [name, e] of Object.entries(classes)) {
      const A: number[] = [], B: number[] = [];
      const rB: number[] = [], eB: number[] = [], cB: number[] = [], riseB: number[] = [], gB: number[] = [], aspB: number[] = [], depthB: number[] = [];
      let n = 0, tA = 0, tB = 0, bDigit = 0;
      for (let s = 1; s <= seeds; s++) {
        const strokes = synthExpression(e, { seed: s * 131 + e.charCodeAt(0), style: "normal" });
        const p = profileOf(strokes as any);
        if (!p) continue;
        n++;
        const t = curlyTip(p);
        if (t === "A") { tA++; A.push(p.endWidth); }
        if (t === "B") {
          tB++;
          if (digitLike(p)) bDigit++;
          rB.push(Math.abs(p.uMid) / Math.max(1e-6, Math.abs(p.uSh)));
          eB.push(p.endWidth); cB.push(p.corners); riseB.push(p.rise); gB.push(p.g); aspB.push(p.aspect); depthB.push(p.depth);
        }
      }
      const t = (xs: number[]) => `${f(q(xs, 0.1))} ${f(q(xs, 0.5))} ${f(q(xs, 0.9))}`;
      rows.push(`${name.padEnd(3)} n=${String(n).padStart(3)} tipA=${String(tA).padStart(3)} tipB=${String(tB).padStart(3)} (di cui digitLike ${bDigit}) | B: ratio ${t(rB)} | endW ${t(eB)} | corners ${t(cB)} | rise ${t(riseB)} | g ${t(gB)} | asp ${t(aspB)} | depth ${t(depthB)} | A.endW ${t(A)}`);
    }
    console.log("\n" + rows.join("\n"));
  });
});

// Distribuzione delle misure del profilo per classe vera (parentesi e cifre).
//   GEO_AUDIT=1 [GEO_SEEDS=80] npx vitest run src/lib/bench/profileStats.test.ts
import { describe, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { profileOf } from "../bracketProfile";

const ON = !!process.env.GEO_AUDIT;
const q = (xs: number[], p: number): number => {
  const a = xs.filter((x) => isFinite(x)).sort((m, n) => m - n);
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))]! : NaN;
};
const f = (x: number): string => (isFinite(x) ? x.toFixed(2) : " nan");

describe.skipIf(!ON)("statistiche profilo", () => {
  it("per classe", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.GEO_SEEDS ?? 80);
    const classes: Record<string, string[]> = {
      "( round": ["("], ") round": [")"], "[ square": ["["], "] square": ["]"], "{ curly": ["{"], "} curly": ["}"],
      "cifre 0": ["0"], "cifre 2": ["2"], "cifre 3": ["3"], "cifre 5": ["5"], "cifre 6": ["6"], "cifre 7": ["7"], "cifre 8": ["8"], "cifre 9": ["9"], "cifre 4": ["4"], "cifre 1": ["1"],
    };
    const styles: SpacingStyle[] = ["normal"];
    const rows: string[] = [`${"classe".padEnd(10)} n   | depth p10/50/90 | g p10/50/90     | flat p10/50/90  | asym p10/50/90  | closed | aspect p10/50/90 | open% | rise p10/50/90`];
    for (const [name, exprs] of Object.entries(classes)) {
      const depth: number[] = [], g: number[] = [], flat: number[] = [], asym: number[] = [], asp: number[] = [], rise: number[] = [];
      let closed = 0, open = 0, n = 0;
      for (const e of exprs) for (const st of styles) for (let s = 1; s <= seeds; s++) {
        const strokes = synthExpression(e, { seed: s * 131 + e.charCodeAt(0), style: st });
        const p = profileOf(strokes as any);
        if (!p) continue;
        n++;
        rise.push(p.rise); depth.push(p.depth); g.push(p.g); flat.push(p.flat); asym.push(p.asym); asp.push(p.aspect);
        if (p.closed) closed++;
        if (p.open) open++;
      }
      const t = (xs: number[]) => `${f(q(xs, 0.1))} ${f(q(xs, 0.5))} ${f(q(xs, 0.9))}`;
      rows.push(`${name.padEnd(10)} ${String(n).padStart(3)} | ${t(depth)}  | ${t(g)}  | ${t(flat)}  | ${t(asym)}  | ${String(Math.round((100 * closed) / n)).padStart(3)}%   | ${t(asp)}  | ${Math.round((100 * open) / n)} | ${t(rise)}`);
    }
    console.log("\n" + rows.join("\n"));
  });
});

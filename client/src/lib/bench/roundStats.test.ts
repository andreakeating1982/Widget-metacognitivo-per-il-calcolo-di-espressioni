// Misure del profilo delle candidate TONDE: vere («(» «)») e false (cifre/lettere classificate tonda).
//   GEO_AUDIT=1 [GEO_SEEDS=200] npx vitest run src/lib/bench/roundStats.test.ts
import { describe, it } from "vitest";
import { synthDetailed, type SpacingStyle } from "./synthInk";
import { shapeCandidates } from "../squareBrackets";
import { profileOf } from "../bracketProfile";

const ON = !!process.env.GEO_AUDIT;
const q = (xs: number[], p: number): number => {
  const a = xs.filter((x) => isFinite(x)).sort((m, n) => m - n);
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))]! : NaN;
};
const f = (x: number): string => (isFinite(x) ? x.toFixed(2) : " nan");

describe.skipIf(!ON)("statistiche candidate tonde", () => {
  it("vere e false", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.GEO_SEEDS ?? 200);
    const styles: SpacingStyle[] = ["normal", "tight"];
    const out: string[] = [];
    for (const b of (process.env.GEO_TARGETS ?? "()3ay")) {
      const asp: number[] = [], g: number[] = [], depth: number[] = [], rise: number[] = [], hr: number[] = [], endW: number[] = [], asym: number[] = [];
      let n = 0, hit = 0;
      for (const style of styles) {
        for (let s = 1; s <= seeds; s++) {
          const expr = `2${b}2`;
          const { strokes, owners } = synthDetailed(expr, { seed: s * 1013 + b.charCodeAt(0), style });
          const idxB = owners.map((o, i) => (o.ch === b ? i : -1)).filter((i) => i >= 0);
          let x0 = Infinity, x1 = -Infinity;
          for (const i of idxB) for (const p of strokes[i]!.points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
          n++;
          const cands = shapeCandidates(strokes as any).filter((c) => c.kind === "round" && c.gb.x1 >= x0 - 2 && c.gb.x0 <= x1 + 2 && (c.gb.x0 + c.gb.x1) / 2 >= x0 - 4 && (c.gb.x0 + c.gb.x1) / 2 <= x1 + 4);
          if (cands.length === 0) continue;
          hit++;
          const p = profileOf(idxB.map((i) => strokes[i]!) as any);
          if (!p) continue;
          asp.push(p.aspect); g.push(p.g); depth.push(p.depth); rise.push(p.rise); endW.push(p.endWidth); asym.push(p.asym);
          // altezza relativa ai «2» del contesto
          const others = owners.map((o, i) => (o.ch === "2" ? i : -1)).filter((i) => i >= 0);
          let h2 = 0;
          for (const i of others) { const ys = strokes[i]!.points.map((pt) => pt.y); h2 = Math.max(h2, Math.max(...ys) - Math.min(...ys)); }
          const ys = idxB.flatMap((i) => strokes[i]!.points.map((pt) => pt.y));
          hr.push((Math.max(...ys) - Math.min(...ys)) / Math.max(1, h2));
        }
      }
      const t = (xs: number[]) => `${f(q(xs, 0.05))} ${f(q(xs, 0.5))} ${f(q(xs, 0.95))}`;
      out.push(`${b} candidata-tonda ${hit}/${n} | asp ${t(asp)} | g ${t(g)} | depth ${t(depth)} | rise ${t(rise)} | endW ${t(endW)} | asym ${t(asym)} | h/h2 ${t(hr)}`);
    }
    console.log("\n" + out.join("\n"));
  });
});

// Sonda: per un tratto di un caso sintetico stampa il profilo x(y) a bande e le decisioni di shapeCandidates.
//   SHAPE=1 SHAPE_LIST="(2+3)|normal|9299|5;..." npx vitest run src/lib/bench/shapeProbe.test.ts
import fs from "node:fs";
import { describe, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { rewriteBrackets, shapeCandidates } from "../squareBrackets";
import { profileOf, classifyProfile, curlyTip, digitLike } from "../bracketProfile";

const ON = !!process.env.SHAPE;

function bands(pts: { x: number; y: number }[]): string {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const h = y1 - y0 || 1;
  const out: string[] = [];
  for (let b = 0; b < 10; b++) {
    const lo = y0 + (b / 10) * h, hi = y0 + ((b + 1) / 10) * h;
    const xs = pts.filter((p) => p.y >= lo && p.y <= hi).map((p) => p.x);
    out.push(xs.length ? (xs.reduce((a, c) => a + c, 0) / xs.length).toFixed(1) : "—");
  }
  return out.join(" ");
}

function bandMean(pts: { x: number; y: number }[], t0: number, t1: number): number {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const lo = y0 + t0 * (y1 - y0), hi = y0 + t1 * (y1 - y0);
  const xs = pts.filter((p) => p.y >= lo && p.y <= hi).map((p) => p.x);
  if (xs.length) return xs.reduce((a, c) => a + c, 0) / xs.length;
  return NaN;
}

describe.skipIf(!ON)("shape probe", () => {
  it("per tratto", () => {
    // SHAPE_JSON=<file>[:<idx>] (+ SHAPE_IDX=T|<n>, default T): tratti esportati / catturati dal canvas reale
    const work: { expr: string; style: string; seed: string | number; idx: string; strokes: any[] }[] = [];
    if (process.env.SHAPE_JSON) {
      const [file, jidx] = process.env.SHAPE_JSON.split(":") as [string, string | undefined];
      for (const [i, c] of JSON.parse(fs.readFileSync(file, "utf8")).entries()) {
        if (!jidx || Number(jidx) === i) work.push({ expr: c.expr, style: c.style, seed: c.seed, idx: process.env.SHAPE_IDX ?? "T", strokes: c.strokes });
      }
    }
    for (const sp of (process.env.SHAPE_LIST ?? "").split(";").filter(Boolean)) {
      const [expr, style, seed, idx = "T"] = sp.split("|") as [string, SpacingStyle, string, string?];
      const strokes = synthExpression(expr, { seed: Number(seed), style, ...(process.env.SHAPE_H ? { H: Number(process.env.SHAPE_H) } : {}) }) as any[];
      // SHAPE_ROUND=1: punti a pixel INTERI (come gli eventi mouse); SHAPE_H=<px>: altezza delle cifre
      if (process.env.SHAPE_ROUND) for (const st of strokes) for (const pt of st.points) { pt.x = Math.round(pt.x); pt.y = Math.round(pt.y); }
      work.push({ expr, style, seed, idx, strokes });
    }
    for (const { expr, style, seed, idx, strokes } of work) {
      const hOf = (st: any) => { let a = Infinity, b = -Infinity; for (const p of st.points) { a = Math.min(a, p.y); b = Math.max(b, p.y); } return b - a; };
      const hMax = Math.max(...strokes.map(hOf));
      const list = idx === "T" ? strokes.map((_, i) => i).filter((i) => hOf(strokes[i]) >= 0.5 * hMax) : [Number(idx)];
      console.log(`SHAPE ===== «${expr}» ${style} ${seed}: ${strokes.length} tratti`);
      for (const k of list) {
        const s = strokes[k];
        const pts = s.points;
        let x0 = Infinity, x1 = -Infinity;
        for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
        const endTop = bandMean(pts, 0, 0.12), endBot = bandMean(pts, 0.88, 1), midX = bandMean(pts, 0.44, 0.56);
        const mid1 = bandMean(pts, 0.15, 0.25), mid2 = bandMean(pts, 0.75, 0.85);
        const devTop = endTop - midX, devBot = endBot - midX;
        console.log(`SHAPE #${k} x[${x0.toFixed(0)}..${x1.toFixed(0)}] h=${hOf(s).toFixed(0)} n=${pts.length} bande: ${bands(pts)}`);
        {
          const pr = profileOf([s] as any);
          if (pr) {
            const pq = classifyProfile(pr);
            console.log(`SHAPE    PROFILO asp ${pr.aspect.toFixed(2)} asym ${pr.asym.toFixed(2)} flat ${pr.flat.toFixed(2)} g ${pr.g.toFixed(2)} rise ${pr.rise.toFixed(2)} uMid ${pr.uMid.toFixed(1)} uSh ${pr.uSh.toFixed(1)} tip ${curlyTip(pr)} corners ${pr.corners} endW ${pr.endWidth.toFixed(2)} depth ${pr.depth.toFixed(3)} digit ${digitLike(pr)} → ${pq ? pq.kind + (pq.isOpen ? "(" : ")") + " conf " + pq.conf : "—"}`);
          }
        }
        console.log(`SHAPE    endTop=${endTop.toFixed(1)} endBot=${endBot.toFixed(1)} midX=${midX.toFixed(1)} mid1=${mid1.toFixed(1)} mid2=${mid2.toFixed(1)} devTop=${devTop.toFixed(1)} devBot=${devBot.toFixed(1)} | mid1-mid=${(mid1 - midX).toFixed(1)} (vs ${(0.35 * Math.abs(devTop)).toFixed(1)}) mid2-mid=${(mid2 - midX).toFixed(1)} (vs ${(0.35 * Math.abs(devBot)).toFixed(1)})`);
      }
      const c = shapeCandidates(strokes as any);
      console.log(`SHAPE   candidati: ${c.map((k) => `[${k.idxs.join(",")}] ${k.kind}${k.isOpen ? " aperta" : " chiusa"} ${k.strength}`).join(" | ") || "nessuno"}`);
        {
          const rb = rewriteBrackets(strokes as any);
          console.log(`SHAPE   ESTRATTE: ${rb.brackets.map((b) => (b.isOpen ? "" : "/") + b.kind[0]).join(" ") || "—"} | restano ${rb.strokes.length}/${(strokes as any[]).length} tratti`);
        }
    }
  });
});

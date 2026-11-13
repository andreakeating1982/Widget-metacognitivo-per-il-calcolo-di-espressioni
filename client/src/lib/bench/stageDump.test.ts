// Sonda: per ogni tratto di un caso sintetico dice quale STADIO geometrico lo toglie.
//   DUMP=1 DUMP_LIST="x[x+1]|normal|9590;..." CANVAS_MODULE=… npx vitest run src/lib/bench/stageDump.test.ts
import fs from "node:fs";
import { describe, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { runGeometry } from "../recognizePipeline";
import { extractSuperscripts } from "../supScript";

const ON = !!process.env.DUMP;

describe.skipIf(!ON)("dump stadi", () => {
  it("per tratto", () => {
    const specs = (process.env.DUMP_LIST ?? "").split(";").filter(Boolean);
    // DUMP_JSON=<file>[:<idx>]: tratti esportati (public/__test/strokes.json o un caso catturato dal canvas reale)
    const jsonCases: { expr: string; style: string; seed: number; strokes: any[] }[] = [];
    if (process.env.DUMP_JSON) {
      const [file, idx] = process.env.DUMP_JSON.split(":") as [string, string | undefined];
      const all = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [i, c] of all.entries()) if (!idx || Number(idx) === i) jsonCases.push(c);
    }
    const work: { expr: string; style: string; seed: string | number; strokes: any[] }[] = jsonCases.map((c) => ({ expr: c.expr, style: c.style, seed: c.seed, strokes: c.strokes }));
    for (const sp of specs) {
      const [expr, style, seed] = sp.split("|") as [string, SpacingStyle, string];
      const strokes = synthExpression(expr, { seed: Number(seed), style, ...(process.env.DUMP_H ? { H: Number(process.env.DUMP_H) } : {}) }) as any[];
      // DUMP_H=<px>: altezza delle cifre; DUMP_ROUND=1: punti a pixel INTERI (come gli eventi mouse)
      if (process.env.DUMP_ROUND) for (const st of strokes) for (const pt of st.points) { pt.x = Math.round(pt.x); pt.y = Math.round(pt.y); }
      work.push({ expr, style, seed, strokes });
    }
    for (const { expr, style, seed, strokes } of work) {
      const g = runGeometry(strokes as any);
      const stages: [string, any[]][] = [
        ["parentesi", g.brk.strokes],
        ["puntini", g.rewritten.strokes],
        ["frazioni", g.fr.strokes],
        ["radici", g.rad.strokes],
        ["otto", g.eights.strokes],
        ["uguale", g.eq.strokes],
        ["meno", g.minus.strokes],
      ];
      console.log(`DUMP «${expr}» ${style} ${seed}: ${strokes.length} tratti; puntini=${g.rewritten.dots.length} (cx ${g.rewritten.dots.map((d: any) => d.cx.toFixed(0)).join(",")}) due-punti=${g.rewritten.colons} ÷=${g.rewritten.divSigns}`);
      // apici (stessa chiamata della pipeline: inchiostro dopo gli stadi, senza basi virtuali)
      try {
        const sp2 = extractSuperscripts(g.minus.strokes.length >= g.eq.strokes.length ? g.eq.strokes : g.eq.strokes, []);
        for (const u of sp2.sups as any[]) {
          const ids = (u.strokes ?? []).map((st: any) => strokes.indexOf(st));
          console.log(`DUMP   apice: tratti [${ids.join(",")}] baseX=${(u.baseX ?? NaN).toFixed?.(0)} baseKey=${u.baseKey} ${JSON.stringify(Object.keys(u))}`);
        }
      } catch (e) { console.log("DUMP   apici: errore", String(e)); }
      strokes.forEach((s, i) => {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of s.points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        const gone = stages.find(([, arr]) => !arr.includes(s));
        console.log(`DUMP   #${i} x[${x0.toFixed(0)}..${x1.toFixed(0)}] y[${y0.toFixed(0)}..${y1.toFixed(0)}] w=${(x1 - x0).toFixed(0)} h=${(y1 - y0).toFixed(0)} n=${s.points.length} → ${gone ? "TOLTO da " + gone[0] : "resta"}`);
      });
    }
  });
});

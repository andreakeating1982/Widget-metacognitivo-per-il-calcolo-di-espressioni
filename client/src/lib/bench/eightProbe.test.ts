/**
 * Sonda del rilevatore degli OTTO (senza modello): per ogni tratto chiuso di un'espressione sintetica
 * stampa misure e firme di `isEightStroke` (estensione al centro, autointersezioni, stelo sinistro).
 *
 *   EIGHT=1 EIGHT_H=38 EIGHT_ROUND=1 EIGHT_LIST="3a(b+1)|normal|1574;(a+b)(a-b)|normal|9714" npx vitest run src/lib/bench/eightProbe.test.ts
 */
import { describe, expect, it } from "vitest";
import { synthDetailed, type SpacingStyle } from "./synthInk";
import { countSelfCrossings, horizontalExtentAt, isEightStroke } from "../inkSigns";

const ON = !!process.env.EIGHT;

const bboxOf = (strokes: { points: { x: number; y: number }[] }[]) => {
  const xs = strokes.flatMap((s) => s.points.map((p) => p.x));
  const ys = strokes.flatMap((s) => s.points.map((p) => p.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

describe.skipIf(!ON)("sonda otto", () => {
  it("stampa", () => {
    const H = process.env.EIGHT_H ? Number(process.env.EIGHT_H) : undefined;
    const lines: string[] = [];
    for (const item of (process.env.EIGHT_LIST ?? "").split(";").filter(Boolean)) {
      const [expr, style, seed] = item.split("|");
      const { strokes, owners } = synthDetailed(expr!, { seed: Number(seed), style: style as SpacingStyle, ...(H ? { H } : {}) });
      if (process.env.EIGHT_ROUND) for (const st of strokes) for (const p of st.points) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
      lines.push(`EIGHT «${expr}» ${style} ${seed}`);
      strokes.forEach((st, i) => {
        const b = bboxOf([st]);
        const w = b.x1 - b.x0;
        const h = b.y1 - b.y0;
        if (h < 22) return;
        const cy = (b.y0 + b.y1) / 2;
        const mid = horizontalExtentAt(st.points, cy, 0.1 * h);
        const hits = countSelfCrossings(st as never);
        lines.push(
          `EIGHT   #${i} «${owners[i]?.ch}» w=${w} h=${h} n=${st.points.length} mid=${mid.toFixed(1)} (${(mid / w).toFixed(2)}·w) incroci=${hits.length} [${hits.map((c) => c.ys.toFixed(2)).join(",")}] isEight=${isEightStroke(st as never, b)}`,
        );
      });
    }
    console.log("\n" + lines.join("\n"));
    expect(lines.length).toBeGreaterThan(0);
  });
});

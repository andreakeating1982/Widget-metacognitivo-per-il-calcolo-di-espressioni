// Sonda: stampa i punti di alcuni tratti di un caso sintetico.
//   PTS=1 PTS_LIST="expr|style|seed|idx,idx" npx vitest run src/lib/bench/ptsProbe.test.ts
import { describe, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./synthInk";

describe.skipIf(!process.env.PTS)("pts probe", () => {
  it("stampa", () => {
    for (const sp of (process.env.PTS_LIST ?? "").split(";").filter(Boolean)) {
      const [expr, style, seed, idxs] = sp.split("|") as [string, SpacingStyle, string, string];
      const strokes = synthExpression(expr, { seed: Number(seed), style }) as any[];
      for (const k of idxs.split(",").map(Number)) {
        const pts = strokes[k].points as { x: number; y: number }[];
        console.log(`PTS «${expr}» ${style} ${seed} #${k} n=${pts.length}: ${pts.map((p) => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(" ")}`);
      }
    }
  });
});

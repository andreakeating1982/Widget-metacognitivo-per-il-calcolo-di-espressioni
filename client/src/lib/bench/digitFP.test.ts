// Falsi positivi su CIFRE ISOLATE e su coppie/terne semplici (senza modello).
//   GEO_AUDIT=1 [GEO_SEEDS=40] npx vitest run src/lib/bench/digitFP.test.ts
import fs from "node:fs";
import { describe, it } from "vitest";
import { synthExpression, strokesToPng } from "./synthInk";
import { shapeCandidates } from "../squareBrackets";

const ON = !!process.env.GEO_AUDIT;
describe.skipIf(!ON)("falsi positivi parentesi su cifre", () => {
  it("cifre isolate", { timeout: 600_000 }, async () => {
    const seeds = Number(process.env.GEO_SEEDS ?? 40);
    const exprs = (process.env.GEO_EXPRS ?? "0,1,2,3,4,5,6,7,8,9,12,23,45,67,89,10,x,2x,3x").split(",");
    const dump = process.env.GEO_DUMP;
    const canvasMod = dump ? await import(/* @vite-ignore */ process.env.CANVAS_MODULE ?? "@napi-rs/canvas") : null;
    if (dump) fs.mkdirSync(dump, { recursive: true });
    const lines: string[] = [];
    for (const e of exprs) {
      let fp = 0;
      const kinds: Record<string, number> = {};
      let dumped = 0;
      for (let s = 1; s <= seeds; s++) {
        for (const style of ["normal", "tight"] as const) {
          const strokes = synthExpression(e, { seed: s * 977, style });
          const c = shapeCandidates(strokes as any);
          if (c.length) {
            fp++;
            const k = c.map((x) => `${x.isOpen ? "" : "/"}${x.kind[0]}${x.strength[0]}`).join("");
            kinds[k] = (kinds[k] ?? 0) + 1;
            if (dump && dumped < 3) {
              await strokesToPng(strokes, canvasMod, `${dump}/fp_${e}_${s}_${style}_${k}.png`);
              dumped++;
            }
          }
        }
      }
      lines.push(`${e.padEnd(4)} falsi positivi ${String(fp).padStart(3)}/${seeds * 2}  ${JSON.stringify(kinds)}`);
    }
    console.log("\n" + lines.join("\n"));
  });
});

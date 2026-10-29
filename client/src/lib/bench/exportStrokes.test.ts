/**
 * Esporta tratti SINTETICI (gli stessi del banco) in un file JSON, per riprodurli nel browser con
 * eventi mouse sul canvas di MathDrawCanvas e collaudare l'intera pipeline col modello reale
 * (onnxruntime-web) invece di Node.
 *
 *   EXPORT_STROKES=1 [EXPORT_OUT=/percorso.json] [EXPORT_CASES='[{"expr":"[(2)]","seed":1470,"style":"tight"}]']
 *     npx vitest run src/lib/bench/exportStrokes.test.ts
 *
 * Senza EXPORT_CASES usa un elenco di casi con parentesi consecutive e parentesi + numeri. Le cifre
 * sono alte `H` px (default 38) perché il canvas dell'app è alto ~128 px e le parentesi sono 1,15–1,55 H.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./synthInk";

const ENABLED = !!process.env.EXPORT_STROKES;

interface Case {
  expr: string;
  seed: number;
  style?: SpacingStyle;
  H?: number;
  sloppy?: number;
}

const DEFAULT_CASES: Case[] = [
  { expr: "[(2)]", seed: 1470, style: "tight" },
  { expr: "{[(3+2)]}", seed: 11, style: "normal" },
  { expr: "{[(3+2)]*4}", seed: 12, style: "tight" },
  { expr: "(2+3)*(4-1)", seed: 13, style: "normal" },
  { expr: "3*(2+4)", seed: 14, style: "touch" },
  { expr: "2^3+4^2", seed: 15, style: "normal" },
  { expr: "(6:3)^2", seed: 16, style: "normal" },
  { expr: "{(2+3)*[4-1]}", seed: 17, style: "tight" },
];

describe.skipIf(!ENABLED)("exportStrokes", () => {
  it("scrive i tratti dei casi in un JSON", () => {
    const cases: Case[] = process.env.EXPORT_CASES ? JSON.parse(process.env.EXPORT_CASES) : DEFAULT_CASES;
    const out = cases.map((c) => ({
      expr: c.expr,
      seed: c.seed,
      style: c.style ?? "normal",
      strokes: synthExpression(c.expr, { seed: c.seed, H: c.H ?? 38, style: c.style ?? "normal", sloppy: c.sloppy ?? 0.35 }),
    }));
    const file = process.env.EXPORT_OUT ?? "/tmp/strokes.json";
    fs.writeFileSync(file, JSON.stringify(out));
    console.log(`EXPORT ${out.length} casi, ${out.reduce((n, c) => n + c.strokes.length, 0)} tratti → ${file}`);
    expect(out.length).toBeGreaterThan(0);
  });
});

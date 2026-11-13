// Sonda sul MODELLO: come legge l'inchiostro RIMASTO (dopo l'estrazione delle parentesi) in varianti.
//   PROBE=1 PROBE_LIST="x[x+1]|normal|1671;..." CANVAS_MODULE=… npx vitest run src/lib/bench/modelProbe.test.ts
// Varianti: V0 = come lo vede la pipeline; V1 = vuoti larghi chiusi (spazio fra colonne ≤ 0,3 altezze);
//           V2 = V1 + riga ricentrata verticalmente sull'altezza delle cifre alte.
import { describe, it } from "vitest";
import { loadNodeEngine } from "./nodeEngine";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { runGeometry, recognizeInk } from "../recognizePipeline";
import { finalizePiece } from "../recognizePiece";
import { extractSuperscripts } from "../supScript";

const ON = !!process.env.PROBE;
if (process.env.GAP_FRAC !== undefined) (globalThis as { __MODEL_GAP_FRAC?: number }).__MODEL_GAP_FRAC = Number(process.env.GAP_FRAC);
type P = { x: number; y: number };
type S = { points: P[]; lineWidth?: number };

function bboxOf(st: S[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of st) for (const p of s.points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  return { x0, x1, y0, y1 };
}

/** chiude i vuoti orizzontali fra colonne di inchiostro */
function closeGaps(st: S[], maxGapFrac: number): S[] {
  const bb = bboxOf(st);
  const H = bb.y1 - bb.y0;
  const maxGap = maxGapFrac * H;
  const idx = st.map((_, i) => i).sort((a, b) => bboxOf([st[a]!]).x0 - bboxOf([st[b]!]).x0);
  const shift = new Array<number>(st.length).fill(0);
  let reach = -Infinity;
  let acc = 0;
  for (const i of idx) {
    const b = bboxOf([st[i]!]);
    if (reach !== -Infinity && b.x0 - reach > maxGap) acc += b.x0 - reach - maxGap;
    shift[i] = acc;
    reach = Math.max(reach, b.x1);
  }
  return st.map((s, i) => ({ ...s, points: s.points.map((p) => ({ x: p.x - shift[i]!, y: p.y })) }));
}

describe.skipIf(!ON)("sonda modello", () => {
  it("varianti", { timeout: 300_000 }, async () => {
    const { deps } = await loadNodeEngine();
    const specs = (process.env.PROBE_LIST ?? "").split(";").filter(Boolean);
    const read = async (st: S[]) => {
      if (st.length === 0) return "(vuoto)";
      const rr = await deps.engine.recognize(deps.preprocessStrokes(st as any), deps.vocab, "expression");
      return finalizePiece({ latex: rr?.latex ?? "" } as any, st as any);
    };
    for (const sp of specs) {
      const [expr, style, seed] = sp.split("|") as [string, SpacingStyle, string];
      const strokes = synthExpression(expr, { seed: Number(seed), style });
      const g = runGeometry(strokes as any);
      const sup = extractSuperscripts(g.eq.strokes as any);
      const rest = sup.strokes as S[];
      console.log(`PROBE «${expr}» ${style} ${seed}: eq=${g.eq.strokes.length} minus=${g.minus.strokes.length} sup.strokes=${sup.strokes.length} apici=${sup.sups.length} ${sup.sups.map((c: any) => `[base ${c.baseIndex}/${c.baseCount}]`).join(" ")}`);
      if (process.env.PROBE_BOX) {
        const eqs = g.eq.strokes as S[];
        const kept = new Set(rest);
        eqs.forEach((st, i) => { const b = bboxOf([st]); console.log(`PROBE   tratto ${i} x[${b.x0.toFixed(0)}..${b.x1.toFixed(0)}] y[${b.y0.toFixed(0)}..${b.y1.toFixed(0)}] h=${(b.y1 - b.y0).toFixed(0)} ${kept.has(st) ? "resta" : "→ APICE"}`); });
        sup.sups.forEach((c: any) => { const b = bboxOf(c.strokes); console.log(`PROBE   apice box x[${b.x0.toFixed(0)}..${b.x1.toFixed(0)}] y[${b.y0.toFixed(0)}..${b.y1.toFixed(0)}] base ${c.baseIndex}/${c.baseCount}`); });
      }
      {
        const rr0 = await deps.engine.recognize(deps.preprocessStrokes(rest as any), deps.vocab, "expression");
        const toks = rr0?.tokenIds && deps.decodeToTokenArray ? deps.decodeToTokenArray(rr0.tokenIds, deps.vocab) : [];
        (globalThis as any).__PIPE_DEBUG = true;
        const full = await recognizeInk(deps, strokes as any, "expression");
        (globalThis as any).__PIPE_DEBUG = false;
        console.log(`PROBE   token grezzi sul resto: [${toks.join(" ")}] latex=«${rr0?.latex}» | recognizeInk: modello-resto «${full?.debugModelLatex}» finale «${full?.latex}»`);
      }
      const v0 = await read(rest);
      const v1 = await read(closeGaps(rest, 0.3));
      const v1b = await read(closeGaps(rest, 0.15));
      console.log(`PROBE «${expr}» ${style} ${seed}: resto ${rest.length}/${strokes.length} tratti | V0 «${v0}» | V1(gap≤0.3H) «${v1}» | V1b(gap≤0.15H) «${v1b}»`);
    }
  });
});

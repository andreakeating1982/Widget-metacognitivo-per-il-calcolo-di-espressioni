// Strumento di TRACCIA della geometria (senza modello): per un caso del banco
// disegna l'inchiostro originale e mostra cosa estrae ogni stadio.
//
//   TRACE=1 TRACE_EXPR="[3]" TRACE_STYLE=normal TRACE_SEED=1235 \
//   CANVAS_MODULE=/home/user/ocr-bench/node_modules/@napi-rs/canvas/index.js \
//   npx vitest run src/lib/bench/trace.test.ts
//
// (expr/style/seed di ogni lettura sono nel JSON del banco). Scrive
// /tmp/trace/<expr>_<style>_<seed>.png: grigio = inchiostro tolto dalla
// geometria, nero = inchiostro che vede il modello, rosso = tratti estratti
// come parentesi, blu = puntini, verde = meno/uguale/8/radice; sotto, il testo.
import fs from "node:fs";
import { describe, it } from "vitest";
import { synthDetailed, type SpacingStyle } from "./synthInk";
import { runGeometry } from "../recognizePipeline";

const ON = !!process.env.TRACE;

function key(s: { points: { x: number; y: number }[] }): string {
  const p = s.points;
  return `${p.length}:${p[0]!.x.toFixed(1)},${p[0]!.y.toFixed(1)}:${p[p.length - 1]!.x.toFixed(1)},${p[p.length - 1]!.y.toFixed(1)}`;
}

describe.skipIf(!ON)("traccia geometria", () => {
  it("disegna e descrive", { timeout: 120_000 }, async () => {
    const expr = process.env.TRACE_EXPR ?? "[3]";
    const style = (process.env.TRACE_STYLE ?? "normal") as SpacingStyle;
    const seed = Number(process.env.TRACE_SEED ?? 1235);
    const canvasMod = await import(/* @vite-ignore */ process.env.CANVAS_MODULE ?? "@napi-rs/canvas");
    const { strokes, owners } = synthDetailed(expr, { seed, style });
    const g = runGeometry(strokes as any);

    const stages: [string, any[]][] = [
      ["parentesi", g.brk.strokes],
      ["puntini", g.rewritten.strokes],
      ["frazioni", g.fr.strokes],
      ["radici", g.rad.strokes],
      ["8", g.eights.strokes],
      ["uguale", g.eq.strokes],
      ["meno", g.minus.strokes],
    ];
    const removedAt = new Map<string, string>();
    let prev = new Set(strokes.map(key));
    for (const [name, st] of stages) {
      const cur = new Set(st.map(key));
      for (const k of prev) if (!cur.has(k) && !removedAt.has(k)) removedAt.set(k, name);
      prev = cur;
    }
    const color: Record<string, string> = {
      parentesi: "#d62728", puntini: "#1f77b4", frazioni: "#9467bd", radici: "#8c564b", "8": "#2ca02c", uguale: "#2ca02c", meno: "#2ca02c",
    };
    const W = 620, H = 230;
    const c = canvasMod.createCanvas(W, H);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of strokes) for (const p of s.points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const sc = Math.min((W - 30) / (x1 - x0 + 1), 150 / (y1 - y0 + 1), 2.2);
    const ox = 15 - x0 * sc, oy = 12 - y0 * sc;
    strokes.forEach((s, i) => {
      const k = key(s as any);
      const by = removedAt.get(k);
      ctx.strokeStyle = by ? color[by] ?? "#999" : "#111";
      ctx.lineWidth = Math.max(1.5, (s.lineWidth ?? 3) * sc * 0.8);
      ctx.beginPath();
      s.points.forEach((p, j) => (j === 0 ? ctx.moveTo(p.x * sc + ox, p.y * sc + oy) : ctx.lineTo(p.x * sc + ox, p.y * sc + oy)));
      if (s.points.length === 1) ctx.lineTo(s.points[0]!.x * sc + ox + 0.1, s.points[0]!.y * sc + oy);
      ctx.stroke();
      // numero del tratto + glifo di appartenenza
      ctx.fillStyle = "#888"; ctx.font = "9px sans-serif";
      ctx.fillText(`${i}${owners[i]?.ch ?? ""}`, s.points[0]!.x * sc + ox + 2, y1 * sc + oy + 12);
    });
    ctx.fillStyle = "#000"; ctx.font = "13px sans-serif";
    const lines = [
      `${expr}  (${style}, seed ${seed})  ${strokes.length} tratti`,
      `parentesi: ${g.brk.brackets.map((b: any) => `${b.isOpen ? "(" : ")"}${b.kind}@${b.cx.toFixed(0)}`).join(" ") || "—"}`,
      `puntini: soli ${g.rewritten.loneDots} due-punti ${g.rewritten.colons} ÷ ${g.rewritten.divSigns}   meno: ${g.minus.minuses}  uguale: ${g.eq.equals}  8: ${g.eights.eights}  radici: ${g.rad.radicals}  frazioni: ${g.fr.fracs.length}`,
      `al modello restano ${g.minus.strokes.length} tratti su ${strokes.length}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, 10, 178 + i * 16));
    fs.mkdirSync("/tmp/trace", { recursive: true });
    const safe = expr.replace(/[^0-9a-zA-Z+\-]/g, (m) => "_" + m.charCodeAt(0).toString(16));
    const file = `/tmp/trace/${safe}_${style}_${seed}.png`;
    fs.writeFileSync(file, c.toBuffer("image/png"));
    console.log("TRACE-FILE " + file);
    console.log(lines.join("\n"));
  });
});

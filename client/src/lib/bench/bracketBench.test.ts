/**
 * Banco di taratura del classificatore di PARENTESI STAMPATE dai pixel (`printedBracket.ts`).
 *
 * Disegna «8 X 8» con X ∈ ( ) [ ] { } in più caratteri, altezze cifra e sfocature (anti-aliasing a 3×,
 * sfocatura gaussiana, rumore), estrae i glifi con la stessa pipeline dell'app (`extractGlyphs`) e
 * confronta il tipo letto con quello disegnato.
 *
 * Avvio:  BRACKET_BENCH=1 CANVAS_MODULE=/percorso/@napi-rs/canvas/index.js npx vitest run src/lib/bench/bracketBench.test.ts
 * Opzioni: BRACKET_VERBOSE=1 (elenca gli errori), BRACKET_FEATS=1 (intervalli delle misure per carattere).
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { classifyPrintedBracket, type BracketKind } from "../printedBracket";
import { extractGlyphs, inkFieldFromGray } from "../ocrReconcile";

const ENABLED = !!process.env.BRACKET_BENCH;

const FONTS: Record<string, string> = {
  "DejaVu Sans": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "DejaVu Serif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  "Liberation Sans": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "Liberation Serif": "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
  "Liberation Sans Bold": "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
  "Liberation Serif Bold": "/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf",
};

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0.05) return src;
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    sum += v;
  }
  const kk = k.map((v) => v / sum);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += src[y * w + Math.min(w - 1, Math.max(0, x + i))]! * kk[i + r]!;
      tmp[y * w + x] = a;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]! * kk[i + r]!;
      out[y * w + x] = a;
    }
  return out;
}

describe.skipIf(!ENABLED)("bracketBench — tipo di parentesi stampata dai pixel", () => {
  it("accuratezza su caratteri × altezze × sfocature", () => {
    const req = createRequire(import.meta.url);
    const nc = req(process.env.CANVAS_MODULE ?? "@napi-rs/canvas");
    for (const [fam, path] of Object.entries(FONTS)) nc.GlobalFonts.registerFromPath(path, fam);
    const R = rng(7);
    const canvases: Record<string, any> = {};
    const chars: BracketKind[] = ["(", ")", "[", "]", "{", "}"];
    const heights = process.env.BRACKET_HEIGHTS ? process.env.BRACKET_HEIGHTS.split(",").map(Number) : [16, 24, 36, 60, 90];
    // sfocatura RELATIVA all'altezza della cifra (foto piccola ingrandita ⇒ sigma ∝ altezza)
    const relBlurs = process.env.BRACKET_BLURS ? process.env.BRACKET_BLURS.split(",").map(Number) : [0, 0.015, 0.035, 0.06, 0.09];
    const tally: Record<string, [number, number, number]> = {}; // ok, ko, nullo
    const byFont: Record<string, [number, number]> = {};
    const byH: Record<string, [number, number]> = {};
    const feats: Record<string, { P: number[]; D: number[]; E: number[]; M: number[]; Em: number[]; m: number[] }> = {};
    const errs: string[] = [];
    for (const fam of Object.keys(FONTS)) {
      for (const dh of heights) {
        for (const rel of relBlurs) {
          const sigma = +(rel * dh).toFixed(2);
          for (const ch of chars) {
            const SS = 3;
            const px = Math.round((dh / 0.72) * SS);
            const W = Math.round(px * 2.6);
            const H = Math.round(px * 1.8);
            // un canvas per dimensione: la memoria nativa di napi-rs/canvas non la libera il GC di V8
            const ck = `${W}x${H}`;
            const cv = (canvases[ck] ??= nc.createCanvas(W, H));
            const ctx = cv.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#000";
            ctx.font = `${px}px "${fam}"`;
            ctx.textBaseline = "alphabetic";
            const base = Math.round(H * 0.72);
            let x = Math.round(px * 0.15);
            ctx.fillText("8", x, base);
            x += ctx.measureText("8").width + px * 0.28;
            ctx.fillText(ch, x, base);
            x += ctx.measureText(ch).width + px * 0.28;
            ctx.fillText("8", x, base);
            const data = ctx.getImageData(0, 0, W, H).data;
            // riduzione 3× (box) → grigio
            const w = Math.floor(W / SS);
            const h = Math.floor(H / SS);
            let gray = new Float32Array(w * h);
            for (let yy = 0; yy < h; yy++)
              for (let xx = 0; xx < w; xx++) {
                let a = 0;
                for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) a += data[((yy * SS + j) * W + (xx * SS + i)) * 4]!;
                gray[yy * w + xx] = a / (SS * SS);
              }
            gray = gaussianBlur(gray, w, h, sigma);
            const g8 = new Uint8Array(w * h);
            for (let i = 0; i < g8.length; i++) g8[i] = Math.max(0, Math.min(255, gray[i]! + (R() - 0.5) * 8));
            const field = inkFieldFromGray(g8, w, h);
            const { glyphs } = extractGlyphs(field);
            const key = `${ch}`;
            const t = (tally[key] ??= [0, 0, 0]);
            if (glyphs.length !== 3) {
              t[2]++;
              errs.push(`${fam} dh${dh} σ${sigma} ${ch}: ${glyphs.length} glifi`);
              continue;
            }
            const read = classifyPrintedBracket(field, glyphs[1]!);
            const f = (feats[key] ??= { P: [], D: [], E: [], M: [], Em: [], m: [] });
            if (read) {
              f.P.push(read.feat.P);
              f.D.push(read.feat.D);
              f.E.push(read.feat.E);
              f.M.push(read.feat.M);
              f.Em.push(read.feat.Em);
              f.m.push(read.margin);
            }
            const ok = read?.kind === ch;
            (byFont[fam] ??= [0, 0])[ok ? 0 : 1]++;
            (byH[String(dh)] ??= [0, 0])[ok ? 0 : 1]++;
            if (ok) t[0]++;
            else {
              t[read ? 1 : 2]++;
              errs.push(`${fam} dh${dh} σ${sigma} ${ch} → ${read?.kind ?? "∅"} (P=${read?.feat.P.toFixed(2)} D=${read?.feat.D.toFixed(2)} E=${read?.feat.E.toFixed(2)} m=${read?.margin.toFixed(2)})`);
            }
          }
        }
      }
    }
    const tot = Object.values(tally).reduce((a, b) => a + b[0] + b[1] + b[2], 0);
    const ok = Object.values(tally).reduce((a, b) => a + b[0], 0);
    const wrong = Object.values(tally).reduce((a, b) => a + b[1], 0);
    const lines = [
      `BRACKET TOT ${ok}/${tot} (${((100 * ok) / tot).toFixed(1)}%)  sbagliate ${wrong}  non classificate ${tot - ok - wrong}`,
      "BRACKET per carattere: " + Object.entries(tally).map(([k, v]) => `${k} ${v[0]}/${v[0] + v[1] + v[2]}`).join(" | "),
      "BRACKET per font: " + Object.entries(byFont).map(([k, v]) => `${k} ${v[0]}/${v[0] + v[1]}`).join(" | "),
      "BRACKET per altezza: " + Object.entries(byH).map(([k, v]) => `${k} ${v[0]}/${v[0] + v[1]}`).join(" | "),
    ];
    if (process.env.BRACKET_FEATS) {
      const q = (a: number[], p: number): number => {
        const s = [...a].sort((x, y) => x - y);
        return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]! : Number.NaN;
      };
      for (const [k, f] of Object.entries(feats))
        lines.push(
          `BRACKET feat ${k}: P[${q(f.P, 0).toFixed(2)}..${q(f.P, 1).toFixed(2)}] D[${q(f.D, 0).toFixed(2)} p10 ${q(f.D, 0.1).toFixed(2)} med ${q(f.D, 0.5).toFixed(2)} p90 ${q(f.D, 0.9).toFixed(2)} ..${q(f.D, 1).toFixed(2)}] E[${q(f.E, 0).toFixed(2)}..${q(f.E, 1).toFixed(2)}] M[${q(f.M, 0).toFixed(2)} p10 ${q(f.M, 0.1).toFixed(2)} med ${q(f.M, 0.5).toFixed(2)} p90 ${q(f.M, 0.9).toFixed(2)} ..${q(f.M, 1).toFixed(2)}] Em[${q(f.Em, 0).toFixed(2)}..${q(f.Em, 1).toFixed(2)}]`,
        );
    }
    if (process.env.BRACKET_VERBOSE) lines.push(...errs.slice(0, 80).map((e) => "BRACKET ERR " + e));
    console.log("\n" + lines.join("\n"));
    expect(tot).toBeGreaterThan(0);
  });
});

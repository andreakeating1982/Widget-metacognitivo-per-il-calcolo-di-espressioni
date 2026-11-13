/**
 * Banco di SICUREZZA della lettura a template (foto): quanto sono lontane le LETTERE dalle cifre?
 *
 * `ocrReconcile.refine` sostituisce un carattere letto da Tesseract con la cifra del template più
 * vicino se la distanza è ≤ TUNE.letterToDigit. Questa soglia non deve MAI trasformare una variabile
 * (x, a, b, y, …) in una cifra: il banco renderizza lettere e cifre in più font, altezze e sfocature,
 * le fa passare per lo stesso filtro di forma dell'app (altezza ≈ cifra, larghezza ≤ 1,2·altezza) e
 * stampa la distribuzione delle distanze:
 *   · CIFRE giuste: distanza dal template della cifra vera (devono stare SOTTO la soglia);
 *   · LETTERE: distanza minima da una qualunque cifra (devono stare SOPRA).
 *
 * Avvio: LETTER_BENCH=1 CANVAS_MODULE=/percorso/@napi-rs/canvas/index.js npx vitest run src/lib/bench/letterBench.test.ts
 */
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

vi.mock("tesseract.js", () => ({ createWorker: vi.fn(), PSM: { SINGLE_BLOCK: "6" } }));

const ENABLED = !!process.env.LETTER_BENCH;

const FONTS: Record<string, string> = {
  "DejaVu Sans": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "DejaVu Serif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  "Liberation Sans": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "Liberation Serif": "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
  "Liberation Sans Bold": "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
  "Liberation Serif Bold": "/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf",
};

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

const q = (a: number[], p: number): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]! : Number.NaN;
};

describe.skipIf(!ENABLED)("letterBench — distanza a template: cifre vs lettere", () => {
  it("distribuzioni", async () => {
    const req = createRequire(import.meta.url);
    const nc = req(process.env.CANVAS_MODULE ?? "@napi-rs/canvas");
    for (const [fam, path] of Object.entries(FONTS)) nc.GlobalFonts.registerFromPath(path, fam);
    (globalThis as any).document = {
      createElement: () => nc.createCanvas(1, 1),
    };
    const { getDigitTemplates } = await import("../ocr");
    const { normalizeGlyph, bestDigitMatch, digitDist } = await import("../ocrGeometry");
    const templates = getDigitTemplates();

    const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const DIGITS = "0123456789".split("");
    const heights = process.env.LETTER_HEIGHTS ? process.env.LETTER_HEIGHTS.split(",").map(Number) : [24, 36, 60];
    const relBlurs = process.env.LETTER_BLURS ? process.env.LETTER_BLURS.split(",").map(Number) : [0, 0.03, 0.06];
    const canvases: Record<string, any> = {};

    /** Renderizza `ch`, ritaglia l'inchiostro (±1 px) e restituisce grigio + ingombro. */
    const render = (ch: string, fam: string, dh: number, sigma: number) => {
      const SS = 3;
      const px = Math.round((dh / 0.72) * SS);
      const W = Math.round(px * 1.6);
      const H = Math.round(px * 1.8);
      const ck = `${W}x${H}`;
      const cv = (canvases[ck] ??= nc.createCanvas(W, H));
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#000";
      ctx.font = `${px}px "${fam}"`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(ch, Math.round(px * 0.3), Math.round(H * 0.7));
      const data = ctx.getImageData(0, 0, W, H).data;
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
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (gray[y * w + x]! < 128) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) return null;
      const cx0 = Math.max(0, x0 - 1), cy0 = Math.max(0, y0 - 1), cx1 = Math.min(w, x1 + 2), cy1 = Math.min(h, y1 + 2);
      const cw = cx1 - cx0, ch2 = cy1 - cy0;
      const g = new Float32Array(cw * ch2);
      for (let y = 0; y < ch2; y++) for (let x = 0; x < cw; x++) g[y * cw + x] = gray[(cy0 + y) * w + cx0 + x]!;
      return { g, cw, ch: ch2, inkW: x1 - x0 + 1, inkH: y1 - y0 + 1 };
    };

    const digOk: number[] = []; // distanza dal template della cifra VERA
    const digBestOther: number[] = []; // quanto un'ALTRA cifra batte la vera (se batte)
    const digWrongDist: number[] = []; // distanza quando il best match è un'altra cifra
    const letDist: Record<string, number[]> = {};
    const letDigit: Record<string, Record<string, number>> = {};
    let letPass = 0;
    let letTot = 0;

    for (const fam of Object.keys(FONTS)) {
      for (const dh of heights) {
        for (const rel of relBlurs) {
          const sigma = rel * dh;
          const ref = render("8", fam, dh, sigma);
          if (!ref) continue;
          const Hd = ref.inkH;
          for (const d of DIGITS) {
            const r = render(d, fam, dh, sigma);
            if (!r) continue;
            const ng = normalizeGlyph({ w: r.cw, h: r.ch, gray: r.g });
            const best = bestDigitMatch(ng, templates);
            const own = digitDist(ng, templates, d);
            digOk.push(own);
            if (best.digit !== d) {
              digWrongDist.push(best.dist);
              digBestOther.push(own - best.dist);
            }
          }
          for (const l of LETTERS) {
            letTot++;
            const r = render(l, fam, dh, sigma);
            if (!r) continue;
            // stesso filtro di `refine` in ocrReconcile: altezza ≈ cifra, larghezza ≤ 1,2·altezza
            if (r.inkH < 0.9 * Hd || r.inkH > 1.12 * Hd || r.inkW > 1.2 * r.inkH) continue;
            letPass++;
            const ng = normalizeGlyph({ w: r.cw, h: r.ch, gray: r.g });
            const best = bestDigitMatch(ng, templates);
            (letDist[l] ??= []).push(best.dist);
            const m = (letDigit[l] ??= {});
            m[best.digit] = (m[best.digit] ?? 0) + 1;
          }
        }
      }
    }

    const lines: string[] = [];
    lines.push(`LETTER cifre giuste: n=${digOk.length} dist min ${q(digOk, 0).toFixed(3)} p50 ${q(digOk, 0.5).toFixed(3)} p90 ${q(digOk, 0.9).toFixed(3)} p99 ${q(digOk, 0.99).toFixed(3)} max ${q(digOk, 1).toFixed(3)}`);
    lines.push(`LETTER cifre con best match ALTRA cifra: ${digWrongDist.length}/${digOk.length}; dist del best match errato: min ${q(digWrongDist, 0).toFixed(3)} p50 ${q(digWrongDist, 0.5).toFixed(3)}; (vera − errata) p50 ${q(digBestOther, 0.5).toFixed(3)}`);
    lines.push(`LETTER lettere che passano il filtro di forma: ${letPass}/${letTot}`);
    const all: number[] = [];
    for (const l of Object.keys(letDist).sort()) {
      all.push(...letDist[l]!);
      const top = Object.entries(letDigit[l]!).sort((a, b) => b[1] - a[1])[0]!;
      lines.push(`LETTER «${l}» n=${letDist[l]!.length} dist min ${q(letDist[l]!, 0).toFixed(3)} p10 ${q(letDist[l]!, 0.1).toFixed(3)} p50 ${q(letDist[l]!, 0.5).toFixed(3)} → cifra ${top[0]} (${top[1]})`);
    }
    lines.push(`LETTER TUTTE le lettere: min ${q(all, 0).toFixed(3)} p1 ${q(all, 0.01).toFixed(3)} p5 ${q(all, 0.05).toFixed(3)} p50 ${q(all, 0.5).toFixed(3)}`);
    for (const th of [0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2]) {
      const bad = all.filter((v) => v <= th).length;
      const good = digOk.filter((v) => v <= th).length;
      lines.push(`LETTER soglia ${th.toFixed(2)}: lettere convertite ${bad}/${all.length} (${((100 * bad) / all.length).toFixed(1)}%) — cifre giuste coperte ${good}/${digOk.length} (${((100 * good) / digOk.length).toFixed(1)}%)`);
    }
    console.log("\n" + lines.join("\n"));
    expect(digOk.length).toBeGreaterThan(0);
  }, 300_000);
});

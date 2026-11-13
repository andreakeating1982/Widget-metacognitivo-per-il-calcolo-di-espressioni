import { describe, expect, it } from "vitest";
import {
  connectedComponents,
  DIGIT_TARGET_PX,
  estimateDigitHeight,
  inkMask,
  otsuThreshold,
  scaleForDigits,
} from "./glyphScale";

/** immagine grigia w×h con rettangoli neri [x0,y0,x1,y1] (inclusivi) */
function page(w: number, h: number, rects: number[][], bg = 235, ink = 30): Uint8Array {
  const g = new Uint8Array(w * h).fill(bg);
  for (const [x0, y0, x1, y1] of rects as [number, number, number, number][])
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * w + x] = ink;
  return g;
}

/** riga di N «cifre» alte `dh` (larghe 0,55·dh), con apici (0,6·dh) e parentesi (1,3·dh) */
function expressionLine(dh: number): { gray: Uint8Array; w: number; h: number } {
  const w = Math.round(dh * 16);
  const h = Math.round(dh * 3);
  const base = Math.round(h * 0.7);
  const rects: number[][] = [];
  let x = Math.round(dh * 0.5);
  const dw = Math.max(2, Math.round(dh * 0.55));
  const gap = Math.max(2, Math.round(dh * 0.3));
  // ( 2 3 ) 4 5 6 + 7 , con un apice dopo il 3 e dopo il 6
  const glyph = (kind: string): void => {
    if (kind === "d") rects.push([x, base - dh, x + dw, base]);
    else if (kind === "p") rects.push([x, base - Math.round(dh * 1.15), x + Math.max(2, dw / 3), base + Math.round(dh * 0.15)]);
    else if (kind === "s") rects.push([x, base - dh, x + Math.round(dw * 0.7), base - dh + Math.round(dh * 0.6)]);
    else if (kind === "+") rects.push([x, base - Math.round(dh * 0.8), x + dw, base - Math.round(dh * 0.2)]);
    else if (kind === "m") rects.push([x, base - Math.round(dh * 0.5), x + dw, base - Math.round(dh * 0.5) + 2]);
    x += dw + gap;
  };
  for (const k of "pddsp+dddspmd d") glyph(k === " " ? "d" : k);
  return { gray: page(w, h, rects), w, h };
}

describe("otsuThreshold / inkMask", () => {
  it("separa nero e bianco", () => {
    const g = page(40, 40, [[5, 5, 20, 20]]);
    const t = otsuThreshold(g);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(235);
    const m = inkMask(g);
    expect(m.reduce((a, b) => a + b, 0)).toBe(16 * 16);
  });

  it("polarità invertita (testo chiaro su fondo scuro): l'inchiostro è comunque il lato minoritario", () => {
    const g = page(40, 40, [[5, 5, 20, 20]], 20, 230);
    expect(inkMask(g).reduce((a, b) => a + b, 0)).toBe(16 * 16);
  });
});

describe("connectedComponents", () => {
  it("conta due blob separati e unisce la diagonale (8-connessione)", () => {
    const w = 20;
    const h = 10;
    const mask = new Uint8Array(w * h);
    for (let x = 1; x <= 4; x++) mask[2 * w + x] = 1; // barra
    mask[3 * w + 5] = 1; // diagonale: stessa componente
    for (let y = 6; y <= 8; y++) mask[y * w + 15] = 1; // altro blob
    const ccs = connectedComponents(mask, w, h);
    expect(ccs.length).toBe(2);
    const big = ccs.find((c) => c.area === 5)!;
    expect(big.x0).toBe(1);
    expect(big.x1).toBe(5);
  });
});

describe("estimateDigitHeight", () => {
  it.each([12, 19, 38, 90])("cifre alte %i px → stima entro il 15%%", (dh) => {
    const { gray, w, h } = expressionLine(dh);
    const est = estimateDigitHeight(gray, w, h)!;
    expect(est).toBeGreaterThan(dh * 0.85);
    expect(est).toBeLessThan(dh * 1.2);
  });

  it("immagine bianca o con meno di 3 glifi → null", () => {
    expect(estimateDigitHeight(new Uint8Array(100 * 100).fill(240), 100, 100)).toBeNull();
    expect(estimateDigitHeight(page(100, 100, [[10, 10, 20, 40], [40, 10, 50, 40]]), 100, 100)).toBeNull();
  });

  it("il rumore (puntini 1–2 px) non abbassa la stima", () => {
    const { gray, w, h } = expressionLine(30);
    for (let i = 0; i < 60; i++) gray[((i * 37) % h) * w + ((i * 91) % w)] = 20;
    const est = estimateDigitHeight(gray, w, h)!;
    expect(est).toBeGreaterThan(25);
    expect(est).toBeLessThan(37);
  });
});

describe("scaleForDigits", () => {
  it("porta le cifre all'altezza obiettivo", () => {
    expect(scaleForDigits(20, 600, 60)).toBeCloseTo(DIGIT_TARGET_PX / 20, 5);
  });

  it("non ingrandisce oltre 10× né riduce sotto 0,4×", () => {
    expect(scaleForDigits(4, 300, 30)).toBe(10);
    expect(scaleForDigits(400, 3000, 3000)).toBeCloseTo(0.4 * Math.min(1, Math.sqrt(16e6 / 9e6) / 0.4), 5);
  });

  it("rispetta lato lungo e pixel totali", () => {
    const s = scaleForDigits(10, 4000, 500);
    expect(s * 4000).toBeLessThanOrEqual(6000 + 1e-6);
    expect(s * s * 4000 * 500).toBeLessThanOrEqual(16e6 + 1);
  });
});

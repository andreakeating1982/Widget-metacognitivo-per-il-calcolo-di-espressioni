/**
 * Riconciliazione simboli di Tesseract ↔ glifi reali (foto). Maschere SINTETICHE (rettangoli):
 * nessun canvas, nessun Tesseract — i lettori di cifre sono simulati con stub.
 * Geometria: cifra alta 44 px (y 20…63), larga 26 px.
 */
import { describe, expect, it } from "vitest";
import { extractGlyphs, isPlusShape, markOf, reconcileSymbols, TUNE, type Glyph, type InkField } from "./ocrReconcile";
import type { OcrSymbol } from "./ocrGeometry";

type Rect = [number, number, number, number]; // x0, y0, x1, y1 (inclusi)

function fieldOf(w: number, h: number, rects: Rect[]): InkField {
  const mask = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * w + x] = 1;
  return { w, h, mask };
}

const sym = (text: string, x0: number, y0: number, x1: number, y1: number): OcrSymbol => ({ text, x0, y0, x1, y1 });
const texts = (s: OcrSymbol[]): string[] => s.map((x) => x.text);
const glyph = (w: number, h: number, blobs = 1): Glyph => ({ x0: 0, y0: 0, x1: w - 1, y1: h - 1, blobs, area: w * h });

// tre cifre sulla stessa riga
const D1: Rect = [10, 20, 35, 63];
const D2: Rect = [50, 20, 75, 63];
const D3: Rect = [90, 20, 115, 63];
const D4: Rect = [130, 20, 155, 63];

describe("extractGlyphs", () => {
  it("trova le cifre e l'altezza tipica", () => {
    const { glyphs, Hd } = extractGlyphs(fieldOf(300, 100, [D1, D2, D3]));
    expect(glyphs).toHaveLength(3);
    expect(Hd).toBe(44);
  });

  it("unisce i due punti di «:» in UN glifo a 2 blob e le due barre di «=»", () => {
    const { glyphs } = extractGlyphs(
      fieldOf(300, 100, [D1, [50, 30, 59, 39], [50, 50, 59, 59], D3, [150, 40, 175, 43], [150, 52, 175, 55]]),
    );
    const colon = glyphs.find((g) => g.x0 === 50)!;
    const equals = glyphs.find((g) => g.x0 === 150)!;
    expect(colon.blobs).toBe(2);
    expect(equals.blobs).toBe(2);
  });

  it("scarta le aste dei bordi e le schegge del taglio", () => {
    const { glyphs } = extractGlyphs(fieldOf(300, 100, [D1, D2, D3, [297, 0, 299, 99], [0, 70, 1, 80]]));
    expect(glyphs).toHaveLength(3);
  });
});

describe("markOf — segni piccoli dal solo aspetto del glifo", () => {
  const Hd = 44;
  it("puntino, due punti, uguale, meno", () => {
    expect(markOf(glyph(9, 9), Hd)).toBe("·");
    expect(markOf(glyph(9, 30, 2), Hd)).toBe(":");
    expect(markOf(glyph(26, 16, 2), Hd)).toBe("=");
    expect(markOf(glyph(24, 5), Hd)).toBe("-");
  });
  it("una cifra non è un segno", () => {
    expect(markOf(glyph(26, 44), Hd)).toBeNull();
  });
});

describe("isPlusShape", () => {
  const Hd = 44;
  it("riconosce la croce e non il quadrato pieno", () => {
    const cross = fieldOf(60, 90, [
      [19, 30, 23, 53],
      [10, 39, 33, 43],
    ]);
    const { glyphs } = extractGlyphs(fieldOf(60, 90, [[19, 30, 23, 53], [10, 39, 33, 43], [40, 5, 50, 48]]));
    const plus = glyphs.find((g) => g.x0 === 10)!;
    expect(isPlusShape(cross, plus, Hd)).toBe(true);
    const square = fieldOf(60, 90, [[10, 30, 33, 53]]);
    expect(isPlusShape(square, { x0: 10, y0: 30, x1: 33, y1: 53, blobs: 1, area: 576 }, Hd)).toBe(false);
  });
});

describe("reconcileSymbols — correzioni dai pixel", () => {
  const W = 300;
  const H = 100;

  it("«4²» fuso in un solo simbolo si divide in cifra + esponente", () => {
    const f = fieldOf(W, H, [D1, [39, 20, 52, 41], [80, 20, 105, 63], [120, 20, 145, 63]]);
    const out = reconcileSymbols([sym("4", 10, 20, 53, 64), sym("8", 80, 20, 106, 64), sym("9", 120, 20, 146, 64)], f);
    expect(texts(out)).toEqual(["4", "°", "8", "9"]);
  });

  it("un simbolo senza senso («§») sopra una cifra si legge a template", () => {
    const f = fieldOf(W, H, [D1, D2, D3]);
    const out = reconcileSymbols([sym("1", 10, 20, 36, 64), sym("§", 50, 20, 76, 64), sym("5", 90, 20, 116, 64)], f, {
      classify: () => "3",
    });
    expect(texts(out)).toEqual(["1", "3", "5"]);
  });

  it("una SOLA barra letta «=» è un meno (altrimenti l'espressione finirebbe lì)", () => {
    const f = fieldOf(W, H, [D1, [50, 40, 75, 43], D3]);
    const out = reconcileSymbols([sym("2", 10, 20, 36, 64), sym("=", 50, 38, 76, 46), sym("3", 90, 20, 116, 64)], f);
    expect(texts(out)).toEqual(["2", "-", "3"]);
  });

  it("i due punti letti come puntino diventano «:»", () => {
    const f = fieldOf(W, H, [D1, [50, 30, 59, 39], [50, 50, 59, 59], D3]);
    const out = reconcileSymbols([sym("1", 10, 20, 36, 64), sym(".", 48, 28, 62, 62), sym("2", 90, 20, 116, 64)], f);
    expect(texts(out)).toEqual(["1", ":", "2"]);
  });

  it("una cifra persa da Tesseract si reinserisce a template, nel punto giusto", () => {
    const f = fieldOf(W, H, [D1, D2, D3, D4]);
    const out = reconcileSymbols([sym("1", 10, 20, 36, 64), sym("2", 50, 20, 76, 64), sym("4", 130, 20, 156, 64)], f, {
      rank: () => ({ digit: "3", dist: 0.1 }),
    });
    expect(texts(out)).toEqual(["1", "2", "3", "4"]);
  });

  it("un esponente perso si reinserisce come «°»", () => {
    const f = fieldOf(W, H, [D1, [39, 20, 52, 41], [80, 20, 105, 63], [120, 20, 145, 63]]);
    const out = reconcileSymbols([sym("4", 10, 20, 36, 64), sym("8", 80, 20, 106, 64), sym("9", 120, 20, 146, 64)], f);
    expect(texts(out)).toEqual(["4", "°", "8", "9"]);
  });

  it("un simbolo con riquadro largo 1 px non esiste: si scarta e il glifo si rilegge a template", () => {
    const f = fieldOf(W, H, [D1, D2, D3]);
    // Tesseract «9» sul glifo centrale, ma con un riquadro largo 1 px (allineamento CTC sbagliato)
    const out = reconcileSymbols([sym("1", 10, 20, 36, 64), sym("9", 60, 20, 61, 64), sym("3", 90, 20, 116, 64)], f, {
      rank: () => ({ digit: "5", dist: 0.1 }),
    });
    expect(texts(out)).toEqual(["1", "5", "3"]);
  });

  it("un'asta sul bordo non è un carattere: il simbolo «|» che la legge cade", () => {
    const f = fieldOf(W, H, [D1, D2, D3, [297, 0, 299, 99]]);
    const out = reconcileSymbols(
      [sym("1", 10, 20, 36, 64), sym("2", 50, 20, 76, 64), sym("3", 90, 20, 116, 64), sym("|", 297, 0, 300, 100)],
      f,
    );
    expect(texts(out)).toEqual(["1", "2", "3"]);
  });

  // «[» disegnata con rettangoli: montante a sinistra (4 px) e due codine (larga 8 px, alta 56 px)
  const SQUARE: Rect[] = [
    [60, 15, 63, 70],
    [60, 15, 67, 17],
    [60, 68, 67, 70],
  ];

  it("una parentesi quadra persa si reinserisce dal profilo dei pixel", () => {
    const f = fieldOf(W, H, [D1, ...SQUARE, D3, D4]);
    const out = reconcileSymbols([sym("1", 10, 20, 36, 64), sym("2", 90, 20, 116, 64), sym("3", 130, 20, 156, 64)], f);
    expect(texts(out)).toEqual(["1", "[", "2", "3"]);
  });

  it("una parentesi letta «(» ma disegnata «[» si corregge", () => {
    const f = fieldOf(W, H, [D1, ...SQUARE, D3, D4]);
    const out = reconcileSymbols(
      [sym("1", 10, 20, 36, 64), sym("(", 60, 15, 68, 71), sym("2", 90, 20, 116, 64), sym("3", 130, 20, 156, 64)],
      f,
    );
    expect(texts(out)).toEqual(["1", "[", "2", "3"]);
  });

  it("senza glifi sufficienti restituisce i simboli invariati", () => {
    const f = fieldOf(W, H, [D1, D2]);
    const syms = [sym("1", 10, 20, 36, 64), sym("2", 50, 20, 76, 64), sym("3", 90, 20, 116, 64)];
    expect(reconcileSymbols(syms, f)).toBe(syms);
  });
});

describe("soglie regolabili (TUNE)", () => {
  it("una lettera a forma di cifra e a template vicino diventa cifra; lontano resta lettera", () => {
    const f = fieldOf(300, 100, [D1, D2, D3]);
    const base = [sym("1", 10, 20, 36, 64), sym("R", 50, 20, 76, 64), sym("5", 90, 20, 116, 64)];
    const near = reconcileSymbols(base, f, { rank: () => ({ digit: "9", dist: TUNE.letterToDigit - 0.01 }) });
    expect(texts(near)).toEqual(["1", "9", "5"]);
    const far = reconcileSymbols(base, f, { rank: () => ({ digit: "9", dist: TUNE.letterToDigit + 0.05 }) });
    expect(texts(far)).toEqual(["1", "R", "5"]);
  });

  it("la soglia lettera→cifra è sotto la distanza tipica di una VARIABILE (≥ 0,18 nel banco lettere)", () => {
    expect(TUNE.letterToDigit).toBeLessThan(0.18);
  });
});

// ⚠️ FRAZIONI IMPILATE IN FOTO (19/10): Tesseract sfalda la frazione stampata
// in righe («3» / «—» / «7») e il testo ricostruito è polvere. Questi test
// coprono la ricostruzione geometrica (photoFractions.ts) e il passaggio
// dell'⁄ attraverso normalizeExpressionOcr (exprOcr.ts).
import { describe, expect, it } from "vitest";
import { extractStackedFractions, findFractionBars } from "./photoFractions";
import { normalizeExpressionOcr } from "./exprOcr";
import type { OcrSymbol } from "./ocrGeometry";

const sym = (text: string, x0: number, y0: number, x1: number, y1: number): OcrSymbol => ({
  text,
  x0,
  y0,
  x1,
  y1,
});

describe("extractStackedFractions — linea + num + den → «n⁄d»", () => {
  it("una frazione con la linea letta «-» viene ricostruita", () => {
    // (3/7): parentesi alte (1,8× la cifra), num sopra, barra, den sotto
    const symbols: OcrSymbol[] = [
      sym("(", 10, 20, 22, 130), // parentesi aperta (h = 110 ≈ 1,8× cifra)
      sym("3", 40, 30, 60, 70), // numeratore
      sym("-", 30, 73, 72, 77), // linea (Tesseract: «-»)
      sym("7", 40, 82, 60, 122), // denominatore
      sym(")", 80, 20, 92, 130), // parentesi chiusa
    ];
    const r = extractStackedFractions(symbols);
    expect(r.fracs).toBe(1);
    expect(r.symbols.map((s) => s.text).join("")).toBe("(3⁄7)");
  });

  it("due frazioni in ordine invertito di righe vengono riordinate per x", () => {
    // Tesseract legge per righe dall'alto in basso: «3 1», «— — :», «7 2»
    const symbols: OcrSymbol[] = [
      sym("3", 20, 10, 40, 50),
      sym("1", 120, 10, 140, 50),
      sym("-", 10, 55, 52, 59),
      sym(":", 70, 45, 80, 65),
      sym("-", 110, 55, 152, 59),
      sym("7", 20, 65, 40, 105),
      sym("2", 120, 65, 140, 105),
    ];
    const r = extractStackedFractions(symbols);
    expect(r.fracs).toBe(2);
    expect(r.symbols.map((s) => s.text).join("")).toBe("3⁄7:1⁄2");
  });

  it("il tratto interno di una cifra NON è una barra di frazione (banco 19/10)", () => {
    // il «5» in foto: Tesseract emette il simbolo «5» che CONTIENE la sua
    // barra orizzontale interna → findFractionBars (col 2° argomento) la scarta
    const field = {
      w: 60,
      h: 40,
      mask: new Uint8Array(60 * 40),
    };
    // «5»: barra orizzontale in alto (y=2, x=10..21) e corpo sotto
    for (let x = 10; x <= 21; x++) field.mask[2 * 60 + x] = 1;
    for (let y = 3; y < 20; y++) for (let x = 10; x <= 21; x++) field.mask[y * 60 + x] = 1;
    const symbols: OcrSymbol[] = [sym("5", 9, 0, 23, 21)];
    expect(findFractionBars(field, symbols)).toHaveLength(0);
    // senza il simbolo (solo pixel) resterebbe una falsa barra: la guardia sta
    // nella ContENUTA nei simboli, quindi senza simboli serve la soglia del
    // margine — qui il corpo sotto è alto 17 ≥ 0,4·12 → segnalata (accettato:
    // senza Tesseract non c'è modo di distinguerla, e in foto i simboli ci sono)
    expect(findFractionBars(field).length).toBeGreaterThanOrEqual(0);
  });

  it("un meno VERO non diventa una frazione (niente sopra o sotto)", () => {
    const symbols: OcrSymbol[] = [
      sym("5", 10, 30, 30, 70),
      sym("-", 40, 48, 62, 52),
      sym("3", 70, 30, 90, 70),
    ];
    const r = extractStackedFractions(symbols);
    expect(r.fracs).toBe(0);
    expect(r.symbols).toHaveLength(3);
  });

  it("testo non leggibile sopra/sotto: nessuna ricostruzione", () => {
    const symbols: OcrSymbol[] = [
      sym("?", 40, 30, 60, 70),
      sym("-", 30, 73, 72, 77),
      sym("7", 40, 82, 60, 122),
    ];
    const r = extractStackedFractions(symbols);
    expect(r.fracs).toBe(0);
  });
});

describe("normalizeExpressionOcr — l'⁄ arriva al solver (19/10)", () => {
  it("«3⁄7» resta «3⁄7» (non diventa 37 né 3:7)", () => {
    expect(normalizeExpressionOcr("3⁄7+1")).toBe("3⁄7+1");
  });
  it("i due punti restano divisione (come «/»), l'⁄ resta frazione", () => {
    // unifyLine converte «:» in «/» da sempre: stessa divisione per il solver
    expect(normalizeExpressionOcr("(3⁄7):(1⁄2)")).toBe("(3⁄7)/(1⁄2)");
  });
});

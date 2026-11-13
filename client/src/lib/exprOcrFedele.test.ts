import { describe, it, expect } from "vitest";
import { normalizeExpressionOcr, prettyExpression } from "./exprOcr";

describe("MAI OPERAZIONI INVENTATE (segnalazione utente 26/9)", () => {
  it("i segni raddoppiati dall'OCR vengono RIPULITI, mai amplificati", () => {
    // Testo che l'app mostrava nel campo (screenshot utente): l'espressione
    // non era valida. Ora i «*+», «*/», «*]» e i segni finali di troppo
    // vengono tolti (solo tolti: mai aggiunti) e il testo diventa valido.
    expect(normalizeExpressionOcr("-(-2)(-2)*+(-6)^2/(-3)*+[(+2)*/(-2)*]/2*-"))
      .toBe("-(-2)(-2)+(-6)^2/(-3)+[(+2)/(-2)]/2");
  });

  it("lettura reale Tesseract (Liberation Serif): «—(—2)+(—2)+(-6)2:(—3)+[(+2)-(-2)]:2»", () => {
    // il · del libro letto come «+» o «-» (colpa di Tesseract, l'app lo
    // riporta fedelmente), il ² letto come cifra attaccata → esponente
    expect(normalizeExpressionOcr("—(—2)+(—2)+(-6)2:(—3)+[(+2)-(-2)]:2"))
      .toBe("-(-2)+(-2)+(-6)^2/(-3)+[(+2)-(-2)]/2");
  });

  it("lettura reale Tesseract (grassetto): «—(—2)-(—2)+(—6)?:(-3) +14 2)-(-2)]:2» non contiene simboli inventati", () => {
    const out = normalizeExpressionOcr("—(—2)-(—2)+(—6)?:(-3) +14 2)-(-2)]:2");
    // il «?» prima di «:» è un apice (esponente recuperato); niente «*»
    // inseriti dall'app: solo i caratteri letti dall'OCR, ripuliti
    expect(out).not.toContain("*");
    expect(out).toContain("^2");
  });

  it("modalità light: solo pulizia, nessun recupero di esponenti", () => {
    expect(normalizeExpressionOcr("3x2-5x+2", true)).toBe("3x2-5x+2");
  });

  it("simbolo spurio prima di parentesi: scartato, NON diventato moltiplicazione", () => {
    expect(normalizeExpressionOcr("2°(3+(4-1)]:5")).toBe("2(3+(4-1))/5");
  });
});

describe("notazione del libro nel campo (prettyExpression)", () => {
  it("· al posto di *, : al posto di /, apici in alto", () => {
    expect(prettyExpression("3x^2*2:4")).toBe("3x²·2:4");
    expect(prettyExpression("-(-2)(-2)+(-6)^2/(-3)+[(+2)/(-2)]/2"))
      .toBe("-(-2)(-2)+(-6)²:(-3)+[(+2):(-2)]:2");
  });

  it("esponenti a più cifre", () => {
    expect(prettyExpression("x^10")).toBe("x¹⁰");
  });

  it("REGOLA 27/9-ter: simboli × Unicode → puntino (mai × nel display)", () => {
    expect(prettyExpression("2×3")).toBe("2·3");
    expect(prettyExpression("2⋅3")).toBe("2·3");
    expect(prettyExpression("2 \\times 3")).toBe("2 · 3");
  });

  it("GRAFFE LATEX (4/10): «\\{», «\\left\\{» e «\\lbrace» si mostrano SENZA backslash", () => {
    // segnalazione utente: «la graffa disegnata me la riconosce sempre con
    // una slash accanto» — era il backslash di \{ mostrato nel pezzo. Per un
    // pezzo con SOLO la graffa il modello legge «\{» (comando LaTeX): nel
    // display la graffa si mostra «{», mai «\{».
    expect(prettyExpression("\\{")).toBe("{");
    expect(prettyExpression("\\}2+3\\}")).toBe("}2+3}");
    expect(prettyExpression("\\{2+3\\}")).toBe("{2+3}");
    expect(prettyExpression("\\left\\{4\\right\\}")).toBe("{4}");
    expect(prettyExpression("\\lbrace 9 \\rbrace")).toBe("{ 9 }");
  });

  it("FOTO REALE dell'utente (26/9): dal motore geometrico al campo, identica al libro", () => {
    // (2 + 5²) : (4² - 2 · 5 - 3) + 48 : (6² - 2³) =
    // testo ricostruito da geometria+template sui simboli di tesseract.js
    const dalMotoreGeometrico = "(2+5^2):(4^2-2·5-3)+48:(6^2-2^3)=";
    const norm = normalizeExpressionOcr(dalMotoreGeometrico);
    expect(norm).toBe("(2+5^2)/(4^2-2*5-3)+48/(6^2-2^3)");
    expect(prettyExpression(norm)).toBe("(2+5²):(4²-2·5-3)+48:(6²-2³)");
  });
});

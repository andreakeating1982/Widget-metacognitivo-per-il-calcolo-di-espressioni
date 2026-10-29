import { describe, it, expect } from "vitest";
import {
  rebuildFromSymbols,
  normalizeGlyph,
  bestDigitMatch,
  digitDist,
  pickExponentRead,
  SUP_PLACEHOLDER,
  TEMPLATE_MAX_DIST,
  type OcrSymbol,
} from "./ocrGeometry";
import fixture from "./ocrGeometry.fixture.json";

/** I simboli della FOTO REALE allegata dall'utente (26/9): 
 *  (2 + 5²) : (4² - 2 · 5 - 3) + 48 : (6² - 2³) =
 *  estratti con tesseract.js 7 (la stessa libreria dell'app). */
const simboliFotoReale = fixture.symbols as OcrSymbol[];

describe("geometria OCR sulla foto reale dell'utente", () => {
  it("riconosce apici, «·» e «+» dai bounding box", () => {
    const geo = rebuildFromSymbols(simboliFotoReale);
    // il «+» della foto era letto «4» → recuperato; i tre ² e il ³ sono
    // placeholder da risolvere col template; il «·» (trattino di 55 px) → «·»
    expect(geo.text).toBe(
      `(2+5${"^"}${SUP_PLACEHOLDER}):(4${"^"}${SUP_PLACEHOLDER}-2·5-3)+48:(6${"^"}${SUP_PLACEHOLDER}-2${"^"}${SUP_PLACEHOLDER})=`
    );
    expect(geo.supBoxes).toHaveLength(4);
    expect(geo.supBoxes.map((b) => b.raw)).toEqual(["%", "4", "°", "3"]);
  });

  it("non tocca i simboli corretti (meno veri, «:», «48»)", () => {
    const geo = rebuildFromSymbols(simboliFotoReale);
    expect(geo.text).toContain("-2·5-3");
    expect(geo.text).toContain("+48:");
  });
});

describe("valore degli apici con i template (foto reale)", () => {
  const templates: Record<string, Float32Array> = {};
  for (const [d, arr] of Object.entries(fixture.templates as Record<string, number[]>)) {
    templates[d] = new Float32Array(arr);
  }

  it("² → 2 e ³ → 3 con margine netto", () => {
    const attesi = ["2", "2", "2", "3"];
    const raws = ["%", "4", "°", "3"];
    const sups = fixture.sups as Record<string, number[]>;
    let i = 0;
    for (const [, arr] of Object.entries(sups)) {
      const g = { w: 28, h: 36, v: new Float32Array(arr) };
      const { digit, dist } = bestDigitMatch(g, templates);
      expect(digit).toBe(attesi[i]);
      expect(dist).toBeLessThan(TEMPLATE_MAX_DIST);
      // margine: il secondo meglio è ben più lontano
      const others = Object.entries(templates)
        .filter(([d2]) => d2 !== digit)
        .map(([d2, t]) => bestDigitMatch(g, { [d2]: t }).dist);
      expect(Math.min(...others)).toBeGreaterThan(dist + 0.05);
      i++;
    }
  });

  it("digitDist: la forma dell'apice ² conferma SOLO il «2», non il «7» letto male da Tesseract (segnalazione 27/9: «6²» letto «6^7»)", () => {
    const sups = fixture.sups as Record<string, number[]>;
    const [, arr2] = Object.entries(sups)[0]!; // primo apice: un ²
    const g = { w: 28, h: 36, v: new Float32Array(arr2) };
    // la distanza dal 2 è nettamente inferiore a quella dal 7:
    // nel fallback il «7» letto da Tesseract NON deve essere corroborato
    const d2 = digitDist(g, templates, "2");
    const d7 = digitDist(g, templates, "7");
    expect(d2).toBeLessThan(TEMPLATE_MAX_DIST);
    expect(d7).toBeGreaterThan(d2 + 0.05);
  });

  it("formula di corroborazione del fallback (ocr.ts): il «7» spurio non passa, il «2» sì", () => {
    // stessa condizione implementata in resolveSuperscripts:
    //   corrobora(raw) = digitDist(raw) <= min(0,45, bestDist + 0,03)
    const sups = fixture.sups as Record<string, number[]>;
    const [, arr2] = Object.entries(sups)[0]!; // primo apice: un ²
    const g = { w: 28, h: 36, v: new Float32Array(arr2) };
    const bestDist = bestDigitMatch(g, templates).dist;
    const corrobora = (raw: string) =>
      digitDist(g, templates, raw) <= Math.min(0.45, bestDist + 0.03);
    expect(corrobora("2")).toBe(true); // la lettura giusta è confermata
    expect(corrobora("7")).toBe(false); // la lettura spuria NO
  });
});

describe("segnalazione 26/9: potenze basse e puntino nel percorso foto", () => {
  const H = 100;
  const W = 60;
  const digit = (text: string, x: number, h = H): OcrSymbol => ({
    text,
    x0: x,
    y0: 200 - h,
    x1: x + W,
    y1: 200,
  });

  it("apice piccolo poco sollevato (scrittura a mano) → comunque apice", () => {
    // h = 55 (0,55·H), sollevato di appena 15 px (0,15·H): con la vecchia
    // soglia (0,25·H) NON veniva preso e l'esponente finiva come cifra
    const sup: OcrSymbol = { text: "2", x0: 70, y0: 130, x1: 130, y1: 185 };
    const geo = rebuildFromSymbols([digit("x", 0), sup, digit("+", 140, 40), digit("1", 210)]);
    expect(geo.text).toContain("x^" + SUP_PLACEHOLDER);
    expect(geo.supBoxes).toHaveLength(1);
  });

  it("una cifra vera sulla base NON diventa apice", () => {
    const geo = rebuildFromSymbols([digit("3", 0), digit("4", 70)]);
    expect(geo.text).toBe("34");
    expect(geo.supBoxes).toHaveLength(0);
  });

  it("«3·3» letto «3.3»: il puntino minuscolo diventa «·»", () => {
    const dot: OcrSymbol = { text: ".", x0: 65, y0: 190, x1: 75, y1: 200 };
    const geo = rebuildFromSymbols([digit("3", 0), dot, digit("3", 90)]);
    expect(geo.text).toBe("3·3");
  });

  it("una virgola (scende sotto la base) resta virgola: decimale", () => {
    const comma: OcrSymbol = { text: ",", x0: 65, y0: 195, x1: 75, y1: 215 };
    const geo = rebuildFromSymbols([digit("2", 0), comma, digit("5", 90)]);
    expect(geo.text).toBe("2,5");
  });
});

describe("segnalazione 27/9-bis: «4²» letto «+» o «4^22»", () => {
  const P = SUP_PLACEHOLDER;
  const digit = (text: string, x0: number, x1: number, y0 = 100, y1 = 200): OcrSymbol => ({
    text,
    x0,
    y0,
    x1,
    y1,
  });

  it("apice SPEZZATO in due simboli sovrapposti → UN solo segnaposto (non «4^22»)", () => {
    // Tesseract a volte sdoppia il piccolo ²: due simboli «2» con bbox
    // che si sovrappongono. Devono fondersi in UN apice.
    const base = digit("4", 0, 60);
    const s1 = { text: "2", x0: 64, y0: 110, x1: 98, y1: 155 };
    const s2 = { text: "2", x0: 80, y0: 108, x1: 118, y1: 152 };
    const dash = { text: "-", x0: 130, y0: 185, x1: 210, y1: 200 }; // vero meno (largo)
    const five = digit("5", 220, 280);
    const geo = rebuildFromSymbols([base, s1, s2, dash, five]);
    expect(geo.text).toBe(`4^${P}-5`);
    expect(geo.supBoxes).toHaveLength(1);
    // la bbox fusa copre ENTRAMBI i frammenti (crop completo per il template)
    expect(geo.supBoxes[0]).toMatchObject({ x0: 64, y0: 108, x1: 118, y1: 155 });
  });

  it("esponente vero a due cifre (2^10): glifi affiancati → DUE segnaposto", () => {
    const base = digit("2", 0, 60);
    const d1 = { text: "1", x0: 64, y0: 110, x1: 92, y1: 155 }; // affiancato…
    const d2 = { text: "0", x0: 96, y0: 108, x1: 124, y1: 152 }; // …NON sovrapposto
    const five = digit("5", 140, 200);
    const geo = rebuildFromSymbols([base, d1, d2, five]);
    expect(geo.text).toBe(`2^${P}${P}5`);
    expect(geo.supBoxes).toHaveLength(2);
  });

  it("il ² letto «+» (piccolo e sollevato) diventa un apice, non un più", () => {
    const base = digit("4", 0, 60);
    const plus = { text: "+", x0: 64, y0: 110, x1: 102, y1: 155 }; // h 45, raised 45
    const five = digit("5", 140, 200);
    const geo = rebuildFromSymbols([base, plus, five]);
    expect(geo.text).toBe(`4^${P}5`);
    expect(geo.supBoxes).toHaveLength(1);
    expect(geo.supBoxes[0].raw).toBe("+");
  });

  it("un «+» vero (sulla linea di base) resta «+»", () => {
    const geo = rebuildFromSymbols([
      digit("2", 0, 60),
      { text: "+", x0: 70, y0: 110, x1: 130, y1: 200 },
      digit("3", 140, 200),
    ]);
    expect(geo.text).toBe("2+3");
    expect(geo.supBoxes).toHaveLength(0);
  });

  it("un «·» vero (minuscolo, sulla base) resta «·», non apice", () => {
    const geo = rebuildFromSymbols([
      digit("2", 0, 60),
      { text: ".", x0: 65, y0: 190, x1: 75, y1: 200 },
      digit("3", 90, 150),
    ]);
    expect(geo.text).toBe("2·3");
    expect(geo.supBoxes).toHaveLength(0);
  });
});

describe("normalizeGlyph", () => {
  it("ritaglia l'inchiostro e normalizza un quadrato", () => {
    const w = 20;
    const h = 20;
    const gray = new Float32Array(w * h).fill(255);
    for (let y = 5; y < 12; y++) for (let x = 4; x < 11; x++) gray[y * w + x] = 0;
    const n = normalizeGlyph({ w, h, gray });
    expect(n.w).toBe(28);
    expect(n.h).toBe(36);
    const ink = n.v.reduce((s, x) => s + (x > 0.5 ? 1 : 0), 0);
    expect(ink).toBeGreaterThan(50);
  });

  it("immagine bianca → glifo vuoto", () => {
    const gray = new Float32Array(100).fill(255);
    const n = normalizeGlyph({ w: 10, h: 10, gray });
    expect(n.v.every((x) => x === 0)).toBe(true);
  });
});

describe("pickExponentRead — il ritaglio esatto non si lascia battere da un vicino che entra nel padding", () => {
  const t = (digit: string, dist: number) => ({ digit, dist });

  it("«3» esatto a 0,194 contro «1» a 0,192 del ritaglio col padding → «3» (era «2^1» a scala 0,8)", () => {
    expect(pickExponentRead([t("3", 0.194), t("1", 0.2), t("1", 0.192)], 0.05, 0.3)?.digit).toBe("3");
  });

  it("un vero guadagno del padding (glifo tagliato dal riquadro) vince ancora", () => {
    expect(pickExponentRead([t("7", 0.5), t("2", 0.3), t("2", 0.15)], 0.05, 0.3)?.digit).toBe("2");
  });

  it("un ritaglio esatto oltre la distanza massima non prevale mai", () => {
    expect(pickExponentRead([t("3", 0.34), t("1", 0.32)], 0.05, 0.3)?.digit).toBe("1");
  });

  it("senza letture → null", () => {
    expect(pickExponentRead([], 0.05, 0.3)).toBeNull();
  });
});

describe("regola «cifra larga e bassa = +»: mai su un glifo alto quanto una cifra", () => {
  const sy = (text: string, x0: number, x1: number, y0: number, y1: number): OcrSymbol => ({ text, x0, y0, x1, y1 });
  const row = (mid: OcrSymbol): OcrSymbol[] => [
    sy("2", 0, 60, 100, 200),
    mid,
    sy("3", 300, 360, 100, 200),
    sy("5", 380, 440, 100, 200),
  ];

  it("«4²» fuso (riquadro largo ma alto come una cifra) resta «4»", () => {
    const geo = rebuildFromSymbols(row(sy("4", 70, 190, 100, 200)));
    expect(geo.text).not.toContain("+");
    expect(geo.text).toContain("4");
  });

  it("un «4» largo, centrato sulla riga e alto 78% di una cifra è il «+» letto male (foto reale)", () => {
    const geo = rebuildFromSymbols(row(sy("4", 100, 178, 111, 189)));
    expect(geo.text).toBe("2+35");
  });
});

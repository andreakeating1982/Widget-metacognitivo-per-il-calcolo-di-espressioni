import { describe, expect, it } from "vitest";
import { alignAtoms, composeLatex, inkColumns, timesToLetterX, tokenizeLatex } from "./composeLatex";
import type { SimpleStroke } from "./inkSigns";

/** glifo: contorno rettangolare largo w, alto 60, centrato in cx */
const glyph = (cx: number, w = 20): SimpleStroke => ({
  points: [
    { x: cx - w / 2, y: 50 },
    { x: cx + w / 2, y: 50 },
    { x: cx + w / 2, y: 110 },
    { x: cx - w / 2, y: 110 },
  ],
});

describe("tokenizeLatex: atomi di primo livello", () => {
  it("cifre, lettere, operatori, \\left … \\right con esponente attaccato", () => {
    const a = tokenizeLatex("3+\\left(2x\\right)^{2}");
    expect(a.map((t) => t.tex)).toEqual(["3", "+", "\\left(", "2", "x", "\\right)^{2}"]);
    expect(a.map((t) => t.kind)).toEqual(["digit", "op", "open", "digit", "letter", "close"]);
  });

  it("\\frac e \\sqrt sono UN atomo; le graffe del modello sono parentesi", () => {
    const a = tokenizeLatex("\\frac{1}{2}+\\sqrt{9}{3}");
    expect(a.map((t) => t.tex)).toEqual(["\\frac{1}{2}", "+", "\\sqrt{9}", "{", "3", "}"]);
    expect(a.map((t) => t.kind)).toEqual(["frac", "op", "sqrt", "open", "digit", "close"]);
  });

  it("\\cdot è un comando; \\{ e \\} sono graffe; gli spazi non contano", () => {
    const a = tokenizeLatex("2 \\cdot \\{ 3 \\}");
    expect(a.map((t) => t.tex)).toEqual(["2", "\\cdot", "\\{", "3", "\\}"]);
  });

  it("l'esponente a più cifre resta dentro l'atomo, mai un punto d'inserimento", () => {
    const a = tokenizeLatex("x^{12}+1");
    expect(a.map((t) => t.tex)).toEqual(["x^{12}", "+", "1"]);
  });
});

describe("inkColumns / alignAtoms", () => {
  it("un glifo a due tratti sovrapposti è UNA colonna", () => {
    const cross: SimpleStroke[] = [
      { points: [{ x: 90, y: 90 }, { x: 110, y: 110 }] },
      { points: [{ x: 110, y: 90 }, { x: 90, y: 110 }] },
      glyph(160),
    ];
    const cols = inkColumns(cross);
    expect(cols).toHaveLength(2);
    expect(cols[0]!.cx).toBeCloseTo(100, 5);
  });

  it("colonne == atomi → x della colonna; colonne ≠ atomi → quantili crescenti", () => {
    const atoms3 = tokenizeLatex("123");
    const ok = alignAtoms(atoms3, [glyph(100), glyph(150), glyph(200)]);
    expect(ok).toEqual([100, 150, 200]);
    const fb = alignAtoms(atoms3, [glyph(100), glyph(150, 40)]); // due colonne, tre atomi
    expect(fb[0]!).toBeLessThan(fb[1]!);
    expect(fb[1]!).toBeLessThan(fb[2]!);
  });
});

describe("composeLatex: elementi estratti ed esponenti per POSIZIONE", () => {
  it("senza elementi né esponenti il LaTeX non viene toccato", () => {
    expect(composeLatex({ latex: "2 +  3", ink: [], items: [], exps: [] })).toBe("2 +  3");
  });

  it("parentesi estratte agli estremi: «[234]»", () => {
    const out = composeLatex({
      latex: "234",
      ink: [glyph(100), glyph(150), glyph(200)],
      items: [
        { x: 240, tex: "]", kind: "close" },
        { x: 60, tex: "[", kind: "open" },
      ],
      exps: [],
    });
    expect(out).toBe("[234]");
  });

  it("segno nel mezzo: «2−3»", () => {
    const out = composeLatex({
      latex: "23",
      ink: [glyph(100), glyph(200)],
      items: [{ x: 150, tex: "-", kind: "op" }],
      exps: [],
    });
    expect(out).toBe("2-3");
  });

  it("«14−8»: meno e 8 entrambi a destra di tutto l'inchiostro → ordine di PAGINA, non dei moduli", () => {
    const out = composeLatex({
      latex: "14",
      ink: [glyph(100), glyph(140)],
      items: [
        { x: 240, tex: "8", kind: "digit", key: "e0" },
        { x: 190, tex: "-", kind: "op" },
      ],
      exps: [],
    });
    expect(out).toBe("14-8");
  });

  it("«6·8»: puntino e 8 a destra: «6\\cdot 8», non «68\\cdot»", () => {
    const out = composeLatex({
      latex: "6",
      ink: [glyph(100)],
      items: [
        { x: 200, tex: "8", kind: "digit", key: "e0" },
        { x: 150, tex: "\\cdot", kind: "op" },
      ],
      exps: [],
    });
    expect(out).toBe("6\\cdot 8");
  });

  it("un segno NON cade mai dentro un esponente già presente nel LaTeX", () => {
    const out = composeLatex({
      latex: "3^{2}+1",
      ink: [glyph(100), glyph(150), glyph(200)],
      items: [{ x: 125, tex: ")", kind: "close" }],
      exps: [],
    });
    expect(out).toBe("3^{2})+1");
  });

  it("l'esponente di una QUADRA estratta si attacca alla quadra: «[3]^{2}»", () => {
    const out = composeLatex({
      latex: "3",
      ink: [glyph(100)],
      items: [
        { x: 50, tex: "[", kind: "open", key: "b0" },
        { x: 150, tex: "]", kind: "close", key: "b1" },
      ],
      exps: [{ digits: "2", baseX: 150, baseKey: "b1" }],
    });
    expect(out).toBe("[3]^{2}");
  });

  it("l'esponente di una parentesi estratta senza chiave sceglie il nodo base più vicino", () => {
    const out = composeLatex({
      latex: "3",
      ink: [glyph(100)],
      items: [
        { x: 50, tex: "{", kind: "open" },
        { x: 150, tex: "}", kind: "close" },
      ],
      exps: [{ digits: "3", baseX: 152 }],
    });
    expect(out).toBe("{3}^{3}");
  });

  it("l'esponente di una lettera: «x^{2}+1»", () => {
    const out = composeLatex({
      latex: "x+1",
      ink: [glyph(100), glyph(150), glyph(200)],
      items: [],
      exps: [{ digits: "2", baseX: 100 }],
    });
    expect(out).toBe("x^{2}+1");
  });

  it("l'esponente sceglie la base per x: «x+y^{2}»", () => {
    const out = composeLatex({
      latex: "x+y",
      ink: [glyph(100), glyph(150), glyph(200)],
      items: [],
      exps: [{ digits: "2", baseX: 198 }],
    });
    expect(out).toBe("x+y^{2}");
  });

  it("l'esponente non si attacca a un operatore né a una parentesi aperta", () => {
    const out = composeLatex({
      latex: "(2+3)",
      ink: [glyph(80), glyph(120), glyph(160), glyph(200), glyph(240)],
      items: [],
      exps: [{ digits: "2", baseX: 168 }], // il più vicino è «+», ma non è una base valida
    });
    expect(out).toBe("(2+3^{2})");
  });

  it("inchiostro che non combacia con gli atomi (quantili): l'ordine resta giusto", () => {
    const out = composeLatex({
      latex: "123",
      ink: [glyph(100), glyph(160, 40)], // glifi stretti fusi in una colonna
      items: [
        { x: 40, tex: "[", kind: "open" },
        { x: 260, tex: "]", kind: "close" },
      ],
      exps: [],
    });
    expect(out).toBe("[123]");
  });

  it("solo elementi estratti (nessun inchiostro): ordinati per x", () => {
    const out = composeLatex({
      latex: "",
      ink: [],
      items: [
        { x: 300, tex: "}", kind: "close" },
        { x: 100, tex: "{", kind: "open" },
        { x: 250, tex: "]", kind: "close" },
        { x: 150, tex: "[", kind: "open" },
      ],
      exps: [],
    });
    expect(out).toBe("{[]}");
  });

  it("\\left( … \\right) restano atomi interi: l'elemento va FUORI dal delimitatore", () => {
    const out = composeLatex({
      latex: "\\left(2\\right)",
      ink: [glyph(100), glyph(150), glyph(200)],
      items: [{ x: 250, tex: "]", kind: "close" }],
      exps: [],
    });
    expect(out).toBe("\\left(2\\right)]");
  });
});


describe("timesToLetterX: «×» del modello = lettera x o puntino (6/10)", () => {
  /** rettangolo pieno (un tratto) x0..x1 × y0..y1 */
  const rect = (x0: number, x1: number, y0: number, y1: number): SimpleStroke => ({
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  });
  /** croce a due diagonali (glifo x o +) */
  const cross = (x0: number, x1: number, y0: number, y1: number): SimpleStroke[] => [
    { points: [{ x: x0, y: y0 }, { x: x1, y: y1 }] },
    { points: [{ x: x1, y: y0 }, { x: x0, y: y1 }] },
  ];
  // «3 × ( 2 x + 1 )»: cifre alte ~55, parentesi ~65–73, x alta 35, + alta 29
  const ink = (timesH: number): SimpleStroke[] => [
    rect(30, 56, 43, 97), // 3
    ...cross(80, 100, 98 - timesH, 98), // il glifo del × (x se alto, croce piccola se basso)
    rect(122, 141, 40, 101), // (
    rect(156, 181, 44, 100), // 2
    ...cross(211, 229, 64, 100), // x
    { points: [{ x: 248, y: 72 }, { x: 278, y: 72 }] }, // + orizzontale
    { points: [{ x: 263, y: 58 }, { x: 263, y: 87 }] }, // + verticale
    rect(296, 310, 42, 97), // 1
    rect(319, 335, 35, 108), // )
  ];

  it("glifo alto come una lettera → la variabile x (3x(2x+1) non perde la x)", () => {
    expect(timesToLetterX("3\\times(2x+1)", ink(34))).toBe("3x(2x+1)");
  });

  it("croce PICCOLA (puntino sintetico) → resta \\times (il chiamante la fa \\cdot)", () => {
    expect(timesToLetterX("3\\times(2x+1)", ink(12))).toBe("3\\times(2x+1)");
  });

  it("senza \\times, senza inchiostro o con un solo glifo: nessuna modifica", () => {
    expect(timesToLetterX("3(2x+1)", ink(34))).toBe("3(2x+1)");
    expect(timesToLetterX("3\\times(2x+1)", [])).toBe("3\\times(2x+1)");
    expect(timesToLetterX("\\times", cross(10, 30, 10, 50))).toBe("\\times");
  });
});


describe("composeLatex: parentesi allucinate dal modello (6/10)", () => {
  // inchiostro: `[`(cx 40) `3`(cx 80); la `]` estratta sta a x=130
  const ink2 = [glyph(40), glyph(80)];

  it("`[ 3 ]` del modello + `]` estratta → UNA sola `]` (e l'esponente va alla `]` estratta)", () => {
    const out = composeLatex({
      latex: "[3]",
      ink: ink2,
      items: [{ x: 130, tex: "]", kind: "close", key: "b0" }],
      exps: [{ digits: "2", baseX: 130, baseKey: "b0" }],
    });
    expect(out).toBe("[3]^{2}");
  });

  it("parentesi BILANCIATE `[[2]]` non si toccano", () => {
    const ink3 = [glyph(40), glyph(80), glyph(120)];
    const out = composeLatex({
      latex: "[[2]",
      ink: ink3,
      items: [{ x: 160, tex: "]", kind: "close" }],
      exps: [],
    });
    expect(out).toBe("[[2]]");
  });
});

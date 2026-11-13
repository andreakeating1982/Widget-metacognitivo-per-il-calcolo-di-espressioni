import { describe, expect, it } from "vitest";
import { detectBracketShapes, restoreSquareBrackets } from "./squareBrackets";
import type { SimpleStroke } from "./dotSigns";

/** Quadra [ disegnata in un solo tratto: tick sup → aste → tick inf */
const openSquare = (x: number): SimpleStroke => ({
  points: [
    { x: x + 12, y: 20 },
    { x, y: 20 },
    { x, y: 130 },
    { x: x + 12, y: 130 },
  ],
  lineWidth: 3,
});

/** Quadra ] specchiata */
const closeSquare = (x: number): SimpleStroke => ({
  points: [
    { x: x - 12, y: 20 },
    { x, y: 20 },
    { x, y: 130 },
    { x: x - 12, y: 130 },
  ],
  lineWidth: 3,
});

/** Tonda ( curva, alta ~78 px (più di una cifra, meno di una quadra) */
const openRound = (x: number): SimpleStroke => {
  const pts: { x: number; y: number }[] = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    pts.push({ x: x + 14 - 14 * Math.sin(Math.PI * t), y: 36 + 78 * t });
  }
  return { points: pts, lineWidth: 3 };
};

/** Tonda ) */
const closeRound = (x: number): SimpleStroke => {
  const pts: { x: number; y: number }[] = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    pts.push({ x: x + 14 * Math.sin(Math.PI * t), y: 36 + 78 * t });
  }
  return { points: pts, lineWidth: 3 };
};

/** Cifra sintetica (uno «0» boxy): h ~60 px → NON è una shape alta.
 *  Il loop si RICHIUDE (come uno 0 vero): la guardia anti-ciclo-chiuso
 *  della quadra a un tratto la respinge. */
const digit = (x0: number, y0 = 45, y1 = 105): SimpleStroke => ({
  points: [
    { x: x0, y: y0 },
    { x: x0 + 25, y: y0 },
    { x: x0 + 25, y: y1 },
    { x: x0, y: y1 },
    { x: x0, y: y0 },
  ],
  lineWidth: 3,
});

describe("detectBracketShapes", () => {
  it("quadra aperta e chiusa disegnate come un solo tratto", () => {
    const s = detectBracketShapes([openSquare(50), digit(90), digit(180), closeSquare(140)]);
    expect(s.opens).toEqual([true]);
    expect(s.closes).toEqual([true]);
  });

  it("tonda disegnata come arco → non quadra", () => {
    const s = detectBracketShapes([openRound(50), closeRound(140), digit(200), digit(240)]);
    expect(s.opens).toEqual([false]);
    expect(s.closes).toEqual([false]);
  });

  it("una cifra (bassa) non è una shape alta: nessuna shape", () => {
    // la cifra sintetica è uno «0» boxy a loop CHIUSO: né la firma della
    // quadra (guardia anti-ciclo-chiuso) né quella della graffa la accettano
    const s = detectBracketShapes([digit(50)]);
    expect(s.opens).toEqual([]);
    expect(s.closes).toEqual([]);
  });

  it("ordine di x rispettato: quadra, tonda, tonda, quadra", () => {
    const s = detectBracketShapes([
      openSquare(30),
      openRound(70),
      closeRound(120),
      closeSquare(160),
      digit(200),
    ]);
    expect(s.opens).toEqual([true, false]);
    expect(s.closes).toEqual([false, true]);
  });
});

describe("restoreSquareBrackets", () => {
  it("caso della segnalazione: la coppia di quadre letta tonda torna quadra", () => {
    // inchiostro: quadra aperta, tonda aperta, tonda chiusa, quadra chiusa
    const strokes = [
      openSquare(30),
      openRound(70),
      digit(110),
      digit(170),
      closeRound(120),
      closeSquare(160),
    ];
    // testo riconosciuto: la quadra disegnata è diventata tonda nel testo
    const latex = "( ( 2 + 3 ) + 1 ) : 5";
    const out = restoreSquareBrackets(latex, strokes);
    expect(out).toBe("[ ( 2 + 3 ) + 1 ] : 5"); // quadre tornate, tonda interna intatta
  });

  it("tonde disegnate restano tonde (nessuna trasformazione inversa sbagliata)", () => {
    const strokes = [openRound(50), closeRound(140), digit(200), digit(240)];
    const latex = "( 2 + 3 ) : 5";
    expect(restoreSquareBrackets(latex, strokes)).toBe(latex);
  });

  it("annidamento: ( [ ] ) — la quadra interna torna quadra, la tonda esterna no", () => {
    const strokes = [
      openRound(30),
      openSquare(70),
      closeSquare(110),
      closeRound(150),
      digit(210),
      digit(250),
    ];
    const latex = "( ( 2 + 3 ) \\cdot 2 ) + 1"; // modello: quadre → tonde
    const out = restoreSquareBrackets(latex, strokes);
    expect(out).toBe("( [ 2 + 3 ] \\cdot 2 ) + 1");
  });

  it("conteggi diversi → nessuna modifica (mai trasformazioni a caso)", () => {
    const strokes = [openSquare(50), digit(100), digit(150)]; // una sola quadra disegnata
    const latex = "( 2 + 3 ) : ( 4 + 5 )"; // due coppie nel testo
    expect(restoreSquareBrackets(latex, strokes)).toBe(latex);
  });

  it("testo malformato → nessuna modifica", () => {
    const strokes = [openSquare(50), closeSquare(140)];
    const latex = "( 2 + 3 : 5";
    expect(restoreSquareBrackets(latex, strokes)).toBe(latex);
  });

  it("senza shape quadre disegnate → nessuna modifica", () => {
    const strokes = [digit(50), digit(90)];
    const latex = "( 2 + 3 ) : 5";
    expect(restoreSquareBrackets(latex, strokes)).toBe(latex);
  });
});

// ─── GRAFFE { } RICONOSCIUTE GEOMETRICAMENTE (27/9, segnalazione utente) ───
// Il modello legge una graffa disegnata come «3»/«\sum» («{3}» → «33\sum2»).
// Tre novità: classificazione a TRE tipi (round/square/curly), estrazione
// dall'inchiostro delle graffe e quadre (rewriteBrackets, stessa tecnica di
// √, 8, = e −) e mappatura delle graffe anche nel percorso restoreSquare-
// Brackets (le graffe di \frac{..}{..}/\sqrt{..}/^{..} NON contano).

import { detectBracketKinds, rewriteBrackets } from "./squareBrackets";

/** Polilinea densa (punti ogni ~4 px) da una lista di vertici */
const interp = (ctrl: [number, number][]): { x: number; y: number }[] => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i < ctrl.length; i++) {
    const [x0, y0] = ctrl[i - 1]!;
    const [x1, y1] = ctrl[i]!;
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      pts.push({ x: x0 + ((x1 - x0) * k) / n, y: y0 + ((y1 - y0) * k) / n });
    }
  }
  return pts;
};

/** Graffa { in un solo tratto: estremità che tornano a destra,
 *  rigonfiamenti OLTRE le estremità, punta centrale a sinistra */
const openCurly = (x: number): SimpleStroke => ({
  points: interp([
    [x + 16, 20],
    [x + 34, 32],
    [x + 40, 46],
    [x + 18, 60],
    [x, 75],
    [x + 18, 90],
    [x + 40, 104],
    [x + 34, 118],
    [x + 16, 130],
  ]),
  lineWidth: 3,
});

/** Graffa } specchiata */
const closeCurly = (x: number): SimpleStroke => ({
  points: interp([
    [x - 16, 20],
    [x - 34, 32],
    [x - 40, 46],
    [x - 18, 60],
    [x, 75],
    [x - 18, 90],
    [x - 40, 104],
    [x - 34, 118],
    [x - 16, 130],
  ]),
  lineWidth: 3,
});

/** «3» alto: estremità e incavo centrale dal STESSO lato (sinistro) e
 *  incavo molto più timido degli archi — NON è una graffa */
const threeLike = (x: number): SimpleStroke => ({
  points: interp([
    [x, 20],
    [x + 30, 38],
    [x + 32, 52],
    [x - 6, 75],
    [x + 32, 98],
    [x + 30, 112],
    [x, 130],
  ]),
  lineWidth: 3,
});

/** «E» alta: aste + tre barre (quella centrale a metà altezza) */
const eShape = (x: number): SimpleStroke[] => [
  { points: [{ x, y: 20 }, { x, y: 130 }], lineWidth: 3 },
  { points: [{ x, y: 20 }, { x: x + 30, y: 20 }], lineWidth: 3 },
  { points: [{ x, y: 75 }, { x: x + 26, y: 75 }], lineWidth: 3 },
  { points: [{ x, y: 130 }, { x: x + 30, y: 130 }], lineWidth: 3 },
];

describe("detectBracketKinds — graffe e guardie anti-falsi-positivi", () => {
  it("graffa aperta e chiusa disegnate a mano → «curly»", () => {
    const s = detectBracketKinds([openCurly(40), digit(90), closeCurly(140)]);
    expect(s.opens).toEqual(["curly"]);
    expect(s.closes).toEqual(["curly"]);
  });

  it("una «3» alta NON è una graffa (incavo centrale timido, estremità dal lato della punta)", () => {
    const s = detectBracketKinds([threeLike(40), digit(100)]);
    expect(s.opens).not.toContain("curly");
    expect(s.closes).not.toContain("curly");
  });

  it("una «E» alta (barra centrale) non è una quadra", () => {
    const s = detectBracketKinds([...eShape(40), digit(100)]);
    expect(s.opens).toEqual([]);
    expect(s.closes).toEqual([]);
  });

  it("tipi in ordine di x: quadra, tonda, tonda, graffa", () => {
    const s = detectBracketKinds([
      openSquare(20),
      openRound(60),
      closeRound(110),
      openCurly(150),
      digit(210),
    ]);
    expect(s.opens).toEqual(["square", "round", "curly"]);
    expect(s.closes).toEqual(["round"]);
  });
});

describe("rewriteBrackets — estrazione di graffe e quadre dall'inchiostro", () => {
  it("«{3}»: le graffe vengono TOLTE dall'inchiostro, il 3 resta", () => {
    const r = rewriteBrackets([openCurly(40), digit(90), closeCurly(140)]);
    expect(r.strokes).toHaveLength(1);
    expect(r.brackets).toEqual([
      { kind: "curly", isOpen: true, cx: expect.any(Number) },
      { kind: "curly", isOpen: false, cx: expect.any(Number) },
    ]);
    expect(r.brackets[0]!.cx).toBeLessThan(r.brackets[1]!.cx);
  });

  it("«[3]»: le quadre vengono tolte, il 3 resta", () => {
    const r = rewriteBrackets([openSquare(30), digit(80), closeSquare(140)]);
    expect(r.strokes).toHaveLength(1);
    expect(r.brackets).toEqual([
      { kind: "square", isOpen: true, cx: expect.any(Number) },
      { kind: "square", isOpen: false, cx: expect.any(Number) },
    ]);
  });

  it("le TONDE restano nell'inchiostro (il modello le legge bene)", () => {
    const strokes = [openRound(50), closeRound(140), digit(200), digit(240)];
    const r = rewriteBrackets(strokes);
    expect(r.brackets).toEqual([]);
    expect(r.strokes).toHaveLength(strokes.length);
  });

  it("una «3» alta accanto a una cifra non viene mai estratta come parentesi", () => {
    const r = rewriteBrackets([threeLike(40), digit(110)]);
    expect(r.brackets).toEqual([]);
    expect(r.strokes).toHaveLength(2);
  });

  it("una «E» alta non viene estratta come quadra", () => {
    const r = rewriteBrackets([...eShape(40), digit(110)]);
    expect(r.brackets).toEqual([]);
    expect(r.strokes).toHaveLength(5);
  });

  it("firma FORTE alla stessa altezza del contenuto: la graffa VERA si estrae, la «3» resta (4/10)", () => {
    // con la soglia per-firma l'altezza non è più l'unica guardia: una
    // graffa con firma inequivocabile si estrae anche se una «3» disegnata
    // grande le sta accanto alla stessa altezza (la «3» non passa la firma
    // e resta nell'inchiostro per il modello)
    const r = rewriteBrackets([openCurly(40), threeLike(140)]);
    expect(r.brackets).toEqual([
      { kind: "curly", isOpen: true, cx: expect.any(Number) },
    ]);
    expect(r.strokes).toHaveLength(1); // la «3»
  });

  it("GUARDIA: forma ambigua (aste nuda, firma nulla) alla stessa altezza → nessuna estrazione", () => {
    // un tratto verticale nudo (come una «1» o una «l») non passa NESSUNA
    // firma: non è nemmeno una candidata
    const bareShaft: SimpleStroke = {
      points: [{ x: 40, y: 20 }, { x: 40, y: 130 }],
      lineWidth: 3,
    };
    const r = rewriteBrackets([bareShaft, threeLike(140)]);
    expect(r.brackets).toEqual([]);
    expect(r.strokes).toHaveLength(2);
  });

  it("pezzo con SOLO graffe (5/10): si estrae TUTTO, niente ancora al modello", () => {
    // 5/10 (verifica browser): il modello sbaglia ANCHE l'ancora (una
    // graffa sola diventa «r»/«\sum») e la pipeline ha il percorso «pezzo
    // con SOLO segni sintetizzati» (LaTeX diretto senza modello): tutte
    // le candidate forti si estraggono, anche quando l'inchiostro resta
    // vuoto.
    const r = rewriteBrackets([openCurly(40), closeCurly(140)]);
    expect(r.brackets).toEqual([
      { kind: "curly", isOpen: true, cx: expect.any(Number) },
      { kind: "curly", isOpen: false, cx: expect.any(Number) },
    ]);
    expect(r.strokes).toHaveLength(0);
  });

  it("graffa SINGOLA disegnata da sola (5/10): estratta, il modello non la legge più «r»/«\\sum»", () => {
    // verifica browser 5/10: pezzo con una sola graffa chiusa → il modello
    // la leggeva «r» perché l'estrazione richiedeva ≥ 2 candidate
    const r = rewriteBrackets([closeCurly(140)]);
    expect(r.brackets).toEqual([
      { kind: "curly", isOpen: false, cx: expect.any(Number) },
    ]);
    expect(r.strokes).toHaveLength(0);
  });

  // ⚠️ 4/10: «quando scrivo insieme di seguito graffa, quadra e tonda, o
  // una parentesi più qualche numero accanto, difficilmente le riconosce».
  // Con la vecchia soglia unica 1,3× bastavano una tonda o una cifra quasi
  // alte quanto le parentesi per bloccare TUTTA l'estrazione.
  describe("parentesi in sequenza e con numeri alti accanto (4/10)", () => {
    // cifra ALTA e REALISTICA (una «3»): un rettangolo ⊃-like sarebbe
    // topologicamente una quadra a un tratto e verrebbe estratto — una
    // cifra vera no (firma anti-«3»)
    const tallDigit = (x: number): SimpleStroke => threeLike(x); // h=110

    it("{[() + cifre ALTE (h=100 su parentesi 110): graffa e quadra estratte", () => {
      const strokes = [
        openCurly(30),
        openSquare(100),
        openRound(170),
        tallDigit(230),
        tallDigit(280),
      ];
      const r = rewriteBrackets(strokes);
      expect(r.brackets).toEqual([
        { kind: "curly", isOpen: true, cx: expect.any(Number) },
        { kind: "square", isOpen: true, cx: expect.any(Number) },
      ]);
      // restano la tonda (per il modello) e le due cifre
      expect(r.strokes).toHaveLength(3);
    });

    it("{[()} di sole parentesi (5/10 notte): TUTTE estratte, nessun tratto al modello", () => {
      const strokes = [
        openCurly(30),
        openSquare(100),
        openRound(170),
        closeRound(240),
        closeSquare(300),
        closeCurly(370),
      ];
      const r = rewriteBrackets(strokes);
      expect(r.brackets).toEqual([
        { kind: "curly", isOpen: true, cx: expect.any(Number) },
        { kind: "square", isOpen: true, cx: expect.any(Number) },
        { kind: "round", isOpen: true, cx: expect.any(Number) },
        { kind: "round", isOpen: false, cx: expect.any(Number) },
        { kind: "square", isOpen: false, cx: expect.any(Number) },
        { kind: "curly", isOpen: false, cx: expect.any(Number) },
      ]);
      expect(r.strokes).toHaveLength(0);
    });

    it("sole parentesi di ALTEZZE DIVERSE `}}` (59 e 76 px): la più bassa non si auto-esclude", () => {
      const scale = (st: SimpleStroke, k: number, ox: number): SimpleStroke => {
        const ys = st.points.map((p) => p.y);
        const y0 = Math.min(...ys);
        return { ...st, points: st.points.map((p) => ({ ...p, x: ox + (p.x - st.points[0]!.x) * k, y: y0 + (p.y - y0) * k })) };
      };
      const small = scale(closeCurly(30), 0.78, 30);
      const big = closeCurly(110);
      const r = rewriteBrackets([small, big]);
      expect(r.brackets.map((b) => `${b.kind}${b.isOpen ? "(" : ")"}`)).toEqual(["curly)", "curly)"]);
      expect(r.strokes).toHaveLength(0);
    });

    it("{[]} senza tonde né contenuto (5/10): si estrae TUTTO, niente ancora", () => {
      const strokes = [openCurly(30), openSquare(100), closeSquare(170), closeCurly(240)];
      const r = rewriteBrackets(strokes);
      expect(r.brackets).toEqual([
        { kind: "curly", isOpen: true, cx: expect.any(Number) },
        { kind: "square", isOpen: true, cx: expect.any(Number) },
        { kind: "square", isOpen: false, cx: expect.any(Number) },
        { kind: "curly", isOpen: false, cx: expect.any(Number) },
      ]);
      expect(r.strokes).toHaveLength(0);
    });

    it("GUARDIA: quadra multi-tratto con UN tick solo (firma debole) + cifre alte → 1,3×, non si tocca", () => {
      const shaft: SimpleStroke = {
        points: [{ x: 30, y: 20 }, { x: 30, y: 130 }],
        lineWidth: 3,
      };
      const topTick: SimpleStroke = {
        points: [{ x: 30, y: 20 }, { x: 42, y: 20 }],
        lineWidth: 3,
      };
      const strokes = [shaft, topTick, tallDigit(90)];
      const r = rewriteBrackets(strokes);
      expect(r.brackets).toEqual([]);
      expect(r.strokes).toHaveLength(3);
    });
  });

  // ⚠️ QUADRA MULTI-TRATTO (4/10: «la quadra quasi sempre aggiunge un meno
  // (-) a destra [-»): quadra disegnata in TRATTI SEPARATI (aste + tick in
  // alto/in basso). Prima del fix l'unità classificata conteneva solo
  // l'asta nuda (senza firma) → NESSUNA estrazione → i trattini restavano
  // nell'inchiostro e il modello li leggeva come un MENO spurio.
  describe("quadre multi-tratto (aste + tick separati)", () => {
    const shaft = (x: number): SimpleStroke => ({
      points: [{ x, y: 20 }, { x, y: 130 }],
      lineWidth: 3,
    });
    const tickR = (x: number, y: number): SimpleStroke => ({
      points: [{ x, y }, { x: x + 12, y }],
      lineWidth: 3,
    });
    const tickL = (x: number, y: number): SimpleStroke => ({
      points: [{ x, y }, { x: x - 12, y }],
      lineWidth: 3,
    });

    it("«[3]» con quadre in 3 tratti: aste E tick vengono tolte, il 3 resta", () => {
      const r = rewriteBrackets([
        shaft(30),
        tickR(30, 20),
        tickR(30, 130),
        digit(80),
        shaft(140),
        tickL(140, 20),
        tickL(140, 130),
      ]);
      expect(r.strokes).toHaveLength(1); // solo la cifra: NESSUN meno residuo
      expect(r.brackets).toEqual([
        { kind: "square", isOpen: true, cx: expect.any(Number) },
        { kind: "square", isOpen: false, cx: expect.any(Number) },
      ]);
    });

    it("quadra multi-tratto riconosciuta anche nella mappatura dei tipi", () => {
      const s = detectBracketShapes([
        shaft(30),
        tickR(30, 20),
        tickR(30, 130),
        digit(80),
        shaft(140),
        tickL(140, 20),
        tickL(140, 130),
      ]);
      expect(s.opens).toEqual([true]);
      expect(s.closes).toEqual([true]);
    });

    it("GUARDIA anti-«+»: un segno più vicino all'estremità non è un tick", () => {
      // «+» = due trattini con centri quasi coincidenti: nessuno dei due si
      // assorbe → niente estrazione, il contenuto resta intero
      const plusH: SimpleStroke = {
        points: [{ x: 28, y: 108 }, { x: 44, y: 108 }],
        lineWidth: 3,
      };
      const plusV: SimpleStroke = {
        points: [{ x: 36, y: 100 }, { x: 36, y: 116 }],
        lineWidth: 3,
      };
      const strokes = [shaft(30), plusH, plusV, digit(80)];
      const r = rewriteBrackets(strokes);
      expect(r.brackets).toEqual([]);
      expect(r.strokes).toHaveLength(strokes.length);
    });

    it("GUARDIA anti-punto: i puntini di «:» vicino all'asta non sono tick", () => {
      // i puntini sono TROPPO stretti per essere tick: la quadra nuda non
      // viene estratta e i due punti restano nell'inchiostro
      const dot1: SimpleStroke = {
        points: [{ x: 44, y: 34 }, { x: 46, y: 36 }],
        lineWidth: 3,
      };
      const dot2: SimpleStroke = {
        points: [{ x: 44, y: 74 }, { x: 46, y: 76 }],
        lineWidth: 3,
      };
      const strokes = [shaft(30), dot1, dot2, digit(80)];
      const r = rewriteBrackets(strokes);
      expect(r.brackets).toEqual([]);
      expect(r.strokes).toHaveLength(strokes.length);
    });
  });

  describe("TONDE STRETTE disegnate a mano NON sono quadre (5/10)", () => {
    // Una tonda scritta STRETTA (per far posto al contenuto) ha
    // verticalFraction alta e finisce nel percorso «aste» della quadra: con
    // le estremità deviate dallo stesso lato passava la firma della quadra
    // a un tratto → veniva estratta e reinserita come «[»/«]». La guardia
    // anti-ARCO (curvatura graduale del fianco) la classifica TONDA e la
    // lascia nell'inchiostro (il modello legge bene «(»/«)»).
    const arcOpen = (w: number, h: number, skew = 0): SimpleStroke => {
      const pts: { x: number; y: number }[] = [];
      for (let t = 0; t <= 1.0001; t += 0.03) {
        pts.push({ x: 100 + w - w * Math.sin(Math.PI * t) + skew * t, y: 20 + h * t });
      }
      return { points: pts, lineWidth: 3 };
    };
    const arcClose = (w: number, h: number, skew = 0): SimpleStroke => {
      const pts: { x: number; y: number }[] = [];
      for (let t = 0; t <= 1.0001; t += 0.03) {
        pts.push({ x: 100 + w * Math.sin(Math.PI * t) + skew * t, y: 20 + h * t });
      }
      return { points: pts, lineWidth: 3 };
    };

    it("sweep: nessuna variante stretta (w 8–14, h 85–130, anche storta) viene estratta", () => {
      const failures: string[] = [];
      for (const w of [8, 10, 12, 14]) {
        for (const h of [85, 110, 130]) {
          for (const skew of [0, 6]) {
            for (const [name, arc] of [
              ["aperta", arcOpen(w, h, skew)],
              ["chiusa", arcClose(w, h, skew)],
            ] as const) {
              const r = rewriteBrackets([arc, digit(200), digit(240)]);
              if (r.brackets.length > 0) {
                failures.push(`${name} w${w} h${h} skew${skew} → ${JSON.stringify(r.brackets)}`);
              }
              // l'arco resta nell'inchiostro (3 tratti: arco + 2 cifre)
              expect(r.strokes).toHaveLength(3);
            }
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it("positiva: la quadra a un tratto con fianco RETTO resta una quadra", () => {
      const r = rewriteBrackets([openSquare(100), digit(200), digit(240)]);
      expect(r.brackets).toEqual([
        { kind: "square", isOpen: true, cx: expect.any(Number) },
      ]);
      expect(r.strokes).toHaveLength(2);
    });
  });
});

describe("restoreSquareBrackets — graffe nel testo", () => {
  it("la coppia disegnata graffa con testo tondo torna graffa", () => {
    const strokes = [openCurly(40), digit(90), closeCurly(140)];
    expect(restoreSquareBrackets("( 3 )", strokes)).toBe("{ 3 }");
  });

  it("le graffe dei comandi (\\frac, \\sqrt) NON contano come parentesi utente", () => {
    const strokes = [openCurly(40), closeCurly(140)];
    // due graffe disegnate ma nel testo solo quelle dei comandi → conteggi
    // diversi → nessuna modifica (mai trasformazioni a caso)
    expect(restoreSquareBrackets("\\frac{2}{3}", strokes)).toBe("\\frac{2}{3}");
    expect(restoreSquareBrackets("\\sqrt{9}", strokes)).toBe("\\sqrt{9}");
  });

  it("esponenti ^{..}: le graffe non sono parentesi dell'utente", () => {
    const strokes = [openCurly(40), closeCurly(140)];
    expect(restoreSquareBrackets("2^{10}", strokes)).toBe("2^{10}");
  });

  it("testo \\left\\{ \\right\\} con quadre disegnate → \\left[ \\right]", () => {
    const strokes = [openSquare(30), digit(70), closeSquare(140)];
    expect(restoreSquareBrackets("\\left\\{4\\right\\}", strokes)).toBe(
      "\\left[4\\right]",
    );
  });

  it("testo già graffa con graffe disegnate → invariato", () => {
    const strokes = [openCurly(40), digit(90), closeCurly(140)];
    expect(restoreSquareBrackets("{ 3 }", strokes)).toBe("{ 3 }");
  });
});

describe("PARENTESI + NUMERI MESSI INSIEME (5/10, parte 2)", () => {
  // «difficoltà con il riconoscimento della trascrizione a mano delle
  // parentesi e numeri messi insieme». DUE difetti a scrittura fitta:
  // (a) una CIFRA ALTA (≥ 85% del gruppo) finiva nell'UNITÀ della parentesi:
  //     veniva estratta INSIEME ad essa (spariva!) o bloccava la
  //     classificazione (la prima verticale era la cifra, non la quadra);
  // (b) la barra del «+»/«=» incollata al gruppo scartava la quadra vera via
  //     guardia anti-«E» (che ora esige adiacenza orizzontale E assenza di
  //     compagno incrociato «+» o parallelo «=»). Rip. unit: «3[2+1]» con
  //     cifre ~100 px e gap 0 → ZERO quadre estratte.
  const interpT = (pts: [number, number][]): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      for (let t = 0; t < 8; t++) {
        out.push({ x: x0 + ((x1 - x0) * t) / 8, y: y0 + ((y1 - y0) * t) / 8 });
      }
    }
    out.push({ x: pts[pts.length - 1]![0], y: pts[pts.length - 1]![1] });
    return out;
  };
  const stT = (points: { x: number; y: number }[], lineWidth = 3): SimpleStroke => ({ points, lineWidth });
  // cifre ALTE (~100 px, y 20..120) quanto le parentesi (110)
  const d3T = (x: number) => stT(interpT([[x + 10, 22], [x + 38, 28], [x + 42, 42], [x + 20, 58], [x + 44, 82], [x + 40, 112], [x + 12, 118]]));
  const d2T = (x: number) => stT(interpT([[x + 12, 20], [x + 38, 24], [x + 44, 40], [x + 22, 58], [x + 46, 90], [x + 14, 120]]));
  const d1T = (x: number) => stT(interpT([[x + 16, 26], [x + 12, 120]]));
  const openQT = (x: number) => stT([{ x: x + 12, y: 20 }, { x, y: 20 }, { x, y: 130 }, { x: x + 12, y: 130 }]);
  const closeQT = (x: number) => stT([{ x: x - 12, y: 20 }, { x, y: 20 }, { x, y: 130 }, { x: x - 12, y: 130 }]);

  it("«3[2+1]» con cifre ALTE e scrittura fitta: quadre estratte, cifre intatte", () => {
    for (const gap of [25, 12, 4, 0]) {
      let x = 30;
      const ink: SimpleStroke[] = [];
      const put = (s: SimpleStroke, w: number) => {
        ink.push(s);
        x += w + gap;
      };
      put(d3T(x), 46);
      put(openQT(x), 12);
      put(d2T(x), 46);
      put(stT(interpT([[x, 62], [x + 34, 64]])), 0); // barra orizzontale «+»
      put(stT(interpT([[x + 17, 46], [x + 18, 80]])), 34); // barra verticale «+»
      put(d1T(x), 20);
      put(closeQT(x), 12);
      const r = rewriteBrackets(ink);
      expect(r.brackets, `gap=${gap}`).toEqual([
        { kind: "square", isOpen: true, cx: expect.any(Number) },
        { kind: "square", isOpen: false, cx: expect.any(Number) },
      ]);
      // le DUE quadre vengono tolte dall'inchiostro, TUTTE le cifre restano
      expect(r.strokes, `gap=${gap}`).toHaveLength(ink.length - 2);
    }
  });

  it("«[1]» con l'uno verticale incollato alle quadre: quadre estratte, «1» resta", () => {
    for (const gap of [8, 0]) {
      let x = 30;
      const ink: SimpleStroke[] = [];
      const put = (s: SimpleStroke, w: number) => {
        ink.push(s);
        x += w + gap;
      };
      put(openQT(x), 12);
      put(d1T(x), 20);
      put(closeQT(x), 12);
      const r = rewriteBrackets(ink);
      expect(r.brackets, `gap=${gap}`).toEqual([
        { kind: "square", isOpen: true, cx: expect.any(Number) },
        { kind: "square", isOpen: false, cx: expect.any(Number) },
      ]);
      expect(r.strokes, `gap=${gap}`).toHaveLength(1); // solo l'«1»
    }
  });
});

describe("PARENTESI + NUMERI MESSI INSIEME (5/10, parte 3)", () => {
  // La GRAFFA non ha asta: il percorso profilo usa l'unità intera, ma con
  // una «1» alta incollata il profilo unito si corrompe e la graffa non
  // viene estratta (rip. browser: «3{2+1}» cifre alte gap 4 → solo la
  // graffa aperta estratta, il modello leggeva «y» per «1}»). FIX: quando
  // l'unità contiene un tratto verticale, si riprova con i singoli tratti
  // non verticali (la graffa da sola passa, la cifra resta all'inchiostro).
  const interpC = (pts: [number, number][]): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      for (let t = 0; t < 8; t++) {
        out.push({ x: x0 + ((x1 - x0) * t) / 8, y: y0 + ((y1 - y0) * t) / 8 });
      }
    }
    out.push({ x: pts[pts.length - 1]![0], y: pts[pts.length - 1]![1] });
    return out;
  };
  const stC = (points: { x: number; y: number }[], lineWidth = 3): SimpleStroke => ({ points, lineWidth });
  const d1C = (x: number) => stC(interpC([[x + 16, 26], [x + 12, 120]]));
  const openGC = (x: number) =>
    stC(interpC([[x + 16, 20], [x + 34, 32], [x + 40, 46], [x + 18, 60], [x, 75], [x + 18, 90], [x + 40, 104], [x + 34, 118], [x + 16, 130]]));
  const closeGC = (x: number) =>
    stC(interpC([[x - 16, 20], [x - 34, 32], [x - 40, 46], [x - 18, 60], [x, 75], [x - 18, 90], [x - 40, 104], [x - 34, 118], [x - 16, 130]]));

  it("«{1}» con l'uno alto incollato alle graffe: graffe estratte, «1» resta", () => {
    for (const gap of [25, 12, 4, 0]) {
      let x = 30;
      const ink: SimpleStroke[] = [];
      const put = (s: SimpleStroke, w: number) => {
        ink.push(s);
        x += w + gap;
      };
      put(openGC(x), 40);
      put(d1C(x), 20);
      put(closeGC(x), 40);
      const r = rewriteBrackets(ink);
      expect(r.brackets, `gap=${gap}`).toEqual([
        { kind: "curly", isOpen: true, cx: expect.any(Number) },
        { kind: "curly", isOpen: false, cx: expect.any(Number) },
      ]);
      expect(r.strokes, `gap=${gap}`).toHaveLength(1); // solo l'«1»
    }
  });
});

describe("PARENTESI + NUMERI MESSI INSIEME (5/10, parte 4)", () => {
  // Unità fusa graffa + CIFRA ALTA (entrambe non verticali, quasi alte
  // quanto il gruppo): il profilo unito «riusciva» ma INGHITTISCE la cifra
  // (rip. browser: «3{2+1}» cifre alte gap 4 → candidato [3+graffa], la
  // cifra spariva dall'inchiostro). Con ≥2 tratti full-height non
  // verticali si classifica ogni tratto da solo: la graffa passa, la
  // cifra (profilo da «3», incavo centrale timido) resta all'inchiostro.
  const interpD = (pts: [number, number][]): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      for (let t = 0; t < 8; t++) {
        out.push({ x: x0 + ((x1 - x0) * t) / 8, y: y0 + ((y1 - y0) * t) / 8 });
      }
    }
    out.push({ x: pts[pts.length - 1]![0], y: pts[pts.length - 1]![1] });
    return out;
  };
  const stD = (points: { x: number; y: number }[], lineWidth = 3): SimpleStroke => ({ points, lineWidth });
  const d3D = (x: number) => stD(interpD([[x + 10, 22], [x + 38, 28], [x + 42, 42], [x + 20, 58], [x + 44, 82], [x + 40, 112], [x + 12, 118]]));
  const d2D = (x: number) => stD(interpD([[x + 12, 20], [x + 38, 24], [x + 44, 40], [x + 22, 58], [x + 46, 90], [x + 14, 120]]));
  const openGD = (x: number) =>
    stD(interpD([[x + 16, 20], [x + 34, 32], [x + 40, 46], [x + 18, 60], [x, 75], [x + 18, 90], [x + 40, 104], [x + 34, 118], [x + 16, 130]]));
  const closeGD = (x: number) =>
    stD(interpD([[x - 16, 20], [x - 34, 32], [x - 40, 46], [x - 18, 60], [x, 75], [x - 18, 90], [x - 40, 104], [x - 34, 118], [x - 16, 130]]));

  it("«3{2}» con la 3 e la 2 ALTE incollate alle graffe: graffe estratte, cifre intatte", () => {
    for (const gap of [12, 6, 0]) {
      let x = 30;
      const ink: SimpleStroke[] = [];
      const put = (s: SimpleStroke, w: number) => {
        ink.push(s);
        x += w + gap;
      };
      put(d3D(x), 46);
      put(openGD(x), 40);
      put(d2D(x), 46);
      put(closeGD(x), 40);
      const r = rewriteBrackets(ink);
      expect(r.brackets, `gap=${gap}`).toEqual([
        { kind: "curly", isOpen: true, cx: expect.any(Number) },
        { kind: "curly", isOpen: false, cx: expect.any(Number) },
      ]);
      // le DUE graffe tolte dall'inchiostro, ENTRAMBE le cifre restano
      expect(r.strokes, `gap=${gap}`).toHaveLength(2);
    }
  });
});

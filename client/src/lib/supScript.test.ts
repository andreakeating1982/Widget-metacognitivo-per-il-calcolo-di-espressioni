import { describe, it, expect } from "vitest";
import {
  dedupeIdenticalStrokes,
  extractSuperscripts,
  spliceExponents,
  stripModelExponents,
  type SimpleStroke,
} from "./supScript";

/** Tratto di linea (per lettere e cifre sintetiche) */
function line(x0: number, y0: number, x1: number, y1: number): SimpleStroke {
  return { points: [{ x: x0, y: y0 }, { x: x1, y: y1 }], lineWidth: 2 };
}

/** «x» alta ~80 px centrata su (cx, cy): due tratti incrociati */
function xLetter(cx: number, cy: number): SimpleStroke[] {
  return [
    line(cx - 20, cy - 40, cx + 20, cy + 40),
    line(cx + 20, cy - 40, cx - 20, cy + 40),
  ];
}

/** «2» piccolo in alto (~28 px) alla destra della base, centrato su (cx, cy) */
function smallTwo(cx: number, cy: number): SimpleStroke[] {
  return [
    line(cx - 8, cy - 14, cx + 8, cy - 14),
    line(cx + 8, cy - 14, cx - 8, cy + 14),
    line(cx - 8, cy + 14, cx + 8, cy + 14),
  ];
}

describe("extractSuperscripts (geometria degli apici)", () => {
  it("x²: isola l'apice piccolo e in alto, la base resta nell'inchiostro principale", () => {
    const strokes = [...xLetter(60, 100), ...smallTwo(105, 55)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.sups[0]!.baseIndex).toBe(0);
    expect(r.sups[0]!.baseCount).toBe(1);
    // l'inchiostro principale contiene SOLO la x (2 tratti)
    expect(r.strokes).toHaveLength(2);
    // gli apici hanno i tratti ingranditi per il riconoscimento isolato
    const supBox = bbox(r.sups[0]!.scaled);
    expect(supBox.y1 - supBox.y0).toBeGreaterThan(40);
  });

  it("3xy²: l'apice si aggancia alla y (ultima base), non alla x", () => {
    // base 3 (cifra), base x, base y, apice
    const bar = line(10, 70, 20, 130); // il «3» semplificato come tratto verticale
    const strokes = [bar, ...xLetter(60, 100), ...xLetter(120, 100), ...smallTwo(165, 55)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.sups[0]!.baseIndex).toBe(2); // la y è la terza base (0,1,2)
    expect(r.sups[0]!.baseCount).toBe(3);
    expect(r.strokes).toHaveLength(5); // 3 (1 tratto) + x + x (2 tratti cadauna)
  });

  it("x²y³: due apici, ordinati da sinistra a destra", () => {
    const strokes = [
      ...xLetter(60, 100),
      ...smallTwo(105, 55),
      ...xLetter(160, 100),
      ...smallTwo(205, 55),
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(2);
    expect(r.sups[0]!.baseIndex).toBe(0);
    expect(r.sups[1]!.baseIndex).toBe(1);
    expect(r.strokes).toHaveLength(4);
  });

  it("apice GRANDE (65% della base, ex limite 62%) e VICINO alla base è comunque un apice (segnalazione 27/9)", () => {
    // «2» medio-alto (h ≈ 52 = 65% di 80), attaccato alla x (gap ~13 px)
    const mediumTwo = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 9, cy - 26, cx + 9, cy - 26),
      line(cx + 9, cy - 26, cx - 9, cy + 26),
      line(cx - 9, cy + 26, cx + 9, cy + 26),
    ];
    const strokes = [...xLetter(60, 100), ...mediumTwo(102, 62)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.strokes).toHaveLength(2);
  });

  it("apice FUSO con la base (2 che tocca la x, stesso cluster): recuperato (27/9-septies)", () => {
    // il «2» parte a x=80 = bordo destro della x (40-80) → dx = 0 ≤ GAP_X:
    // cluster UNICO. La geometria interna deve separare base e apice.
    const strokes = [...xLetter(60, 100), ...smallTwo(88, 55)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.sups[0]!.baseIndex).toBe(0);
    expect(r.sups[0]!.baseCount).toBe(1);
    // l'inchiostro principale contiene SOLO la x (2 tratti)
    expect(r.strokes).toHaveLength(2);
  });

  it("la barra del «t» NON è un apice (parte a sinistra del centro della base)", () => {
    const t = [line(50, 60, 50, 140), line(46, 75, 64, 75)];
    const r = extractSuperscripts(t);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(2);
  });

  it("il puntino dell'«i» NON è un apice (troppo piccolo)", () => {
    const i = [line(50, 70, 50, 140), line(53, 55, 57, 59)];
    const r = extractSuperscripts(i);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(2);
  });

  it("la coda della «y» impedisce il recupero (terzo gruppo in basso)", () => {
    // y = tratto alto + coda bassa; apice FUSO col cluster (dx = 9 ≤ 12,
    // dy = 0): il gruppo basso della coda blocca il recupero
    const strokes = [
      line(40, 60, 78, 140),
      line(78, 140, 90, 108), // coda (in basso)
      ...smallTwo(95, 55),
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(5);
  });

  it("apice al 71% della base (sopra il vecchio 68%): comunque un apice", () => {
    const mediumTwo = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 9, cy - 28, cx + 9, cy - 28),
      line(cx + 9, cy - 28, cx - 9, cy + 28),
      line(cx - 9, cy + 28, cx + 9, cy + 28),
    ];
    // h = 56 = 70% di 80: con il vecchio 68% era «normale», ora è apice
    const strokes = [...xLetter(60, 100), ...mediumTwo(102, 64)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.strokes).toHaveLength(2);
  });

  it("(2²)²: l'apice interno si aggancia alla CIFRA, non alla parentesi (27/9-novies)", () => {
    const digitTwo = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 12, cy - 40, cx + 12, cy - 40),
      line(cx + 12, cy - 40, cx - 12, cy + 40),
      line(cx - 12, cy + 40, cx + 12, cy + 40),
    ];
    // parentesi alte (h=120), cifra più bassa (h=80), apici piccoli (h=28)
    const strokes = [
      line(40, 40, 52, 160), // "("
      ...digitTwo(90, 100), // 2 interno (h=80 < 75% di 120 → NON «normale»)
      ...smallTwo(125, 62), // apice del 2 interno
      line(150, 40, 162, 160), // ")"
      ...smallTwo(185, 62), // apice della parentesi
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(2);
    expect(r.strokes).toHaveLength(5); // parentesi + cifra, senza apici
    // apice interno → base = cifra (indice 1); apice esterno → base = ")" (2)
    expect(r.sups[0]!.baseIndex).toBe(1);
    expect(r.sups[1]!.baseIndex).toBe(2);
    expect(r.sups[0]!.baseCount).toBe(3);
  });

  it("una cifra più bassa delle parentesi NON è un apice della parentesi", () => {
    const digitTwo = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 12, cy - 40, cx + 12, cy - 40),
      line(cx + 12, cy - 40, cx - 12, cy + 40),
      line(cx - 12, cy + 40, cx + 12, cy + 40),
    ];
    const r = extractSuperscripts([line(40, 40, 52, 160), ...digitTwo(90, 100)]);
    // il 2 interno (h=80, cy=100) è allo stesso livello della parentesi
    // (cy=100): la guardia di sollevamento blocca l'aggancio
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(4);
  });

  it("(2²)² con il ² interno FUSO con la «)»: base = cifra precedente (27/9-decies)", () => {
    const digitTwo = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 12, cy - 40, cx + 12, cy - 40),
      line(cx + 12, cy - 40, cx - 12, cy + 40),
      line(cx - 12, cy + 40, cx + 12, cy + 40),
    ];
    // il ² interno (x 132-148) TOCCA la «)» (x 150-162): dx = 2 ≤ 12 →
    // cluster unico. Il recupero laterale sinistro lo aggancia al 2.
    const strokes = [
      line(40, 40, 52, 160),
      ...digitTwo(90, 100),
      ...smallTwo(140, 62),
      line(150, 40, 162, 160),
      ...smallTwo(185, 62),
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(2);
    expect(r.strokes).toHaveLength(5);
    expect(r.sups[0]!.baseIndex).toBe(1); // apice interno → cifra 2
    expect(r.sups[1]!.baseIndex).toBe(2); // apice esterno → «)»
    expect(r.sups[0]!.baseCount).toBe(3);
  });

  it("MEGA-CLUSTER (27/9-terzies): tratti REALI dell'utente — (2²)² tutto fuso", () => {
    // bbox ESATTI del file diagnostico pezzo-1-tratti.json: la «(» tocca la
    // cifra (dx 3), il ² interno tocca cifra e «)» (dx -4 e 2), la «)»
    // tocca il ² esterno (dx 10) → UN solo cluster di 5 tratti. Prima la
    // trascrizione era (2²): il ² esterno finiva saldato all'interno.
    const strokes = [
      line(127, 41, 171, 96), // cifra 2 (bbox reale)
      line(167, 29, 181, 52), // ² interno
      line(97, 15, 124, 121), // «(»
      line(183, 12, 208, 126), // «)»
      line(218, 12, 233, 36), // ² esterno
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(2);
    expect(r.strokes).toHaveLength(3); // «(», cifra, «)»
    expect(r.sups[0]!.baseIndex).toBe(0); // ² interno → sotto-cluster («(»+cifra)
    expect(r.sups[1]!.baseIndex).toBe(1); // ² esterno → «)»
    expect(r.sups[0]!.baseCount).toBe(2);
    expect(r.sups[1]!.baseCount).toBe(2);
  });

  it("MEGA-CLUSTER (27/9-quater): ² interno PROFONDAMENTE sovrapposto alla cifra → base = cifra, NON la «)» (niente esponente «22»)", () => {
    // il ² interno parte 16 px DENTRO la cifra (gap −16 < −GAP_X): con la
    // vecchia regola di adiacenza la cifra veniva scartata e il ² cavalcava
    // la «)» insieme al ² esterno → due apici sullo stesso punto → «22»
    const strokes = [
      line(97, 15, 124, 121), // «(»
      line(127, 41, 171, 96), // cifra 2
      line(155, 29, 169, 52), // ² interno sovrapposto in profondità
      line(183, 12, 208, 126), // «)»
      line(218, 12, 233, 36), // ² esterno
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(2);
    expect(r.sups[0]!.baseIndex).toBe(0); // ² interno → cifra
    expect(r.sups[1]!.baseIndex).toBe(1); // ² esterno → «)»
  });

  it("dedupeIdenticalStrokes (27/9-septies): il ² interno duplicato (stesso bbox) viene rimosso → niente esponente «22» (pezzo 2 reale)", () => {
    // bbox REALI dell'input del riconoscimento nel browser: il ² interno
    // compariva DUE volte con lo stesso bbox → le copie fondevano in un
    // unico gruppo apice e il modello leggeva «22».
    const strokes = [
      line(156, 43, 210, 91), // cifra 2
      line(133, 15, 157, 115), // «(»
      line(230, 9, 254, 112), // «)»
      line(267, 11, 288, 37), // ² esterno
      line(211, 22, 233, 44), // ² interno
      line(211, 22, 233, 44), // ² interno DUPLICATO (stesso bbox)
    ];
    const dedup = dedupeIdenticalStrokes(strokes);
    expect(dedup).toHaveLength(5); // la copia identica è rimossa
    const r = extractSuperscripts(dedup);
    expect(r.sups).toHaveLength(2);
    expect(r.sups[0]!.baseIndex).toBe(0); // ² interno → cifra
    expect(r.sups[1]!.baseIndex).toBe(1); // ² esterno → «)»
    expect(r.sups.every((s) => s.strokes.length === 1)).toBe(true);
  });

  it("MEGA-CLUSTER (27/9-quinquies): ² esterno in cluster separato con base = mega spezzato → baseIndex della «)», NON −1 (pezzo 2 reale)", () => {
    // bbox REALI del file diagnostico pezzo-2-tratti.json: il ² esterno è
    // in cluster SEPARATO (dx 13 dalla «)») con base = il mega-cluster
    // originale; dopo lo split quel cluster non è più tra i normali e la
    // trascrizione era (2²²)². La base orfa deve risalire al sotto-cluster
    // che l'apice segue (la «)»), non dare −1.
    const strokes = [
      line(157, 43.2, 211, 91.3), // cifra 2
      line(134, 15.6, 158, 114.8), // «(»
      line(211, 25.8, 234, 42.2), // ² interno
      line(231, 9.4, 254, 111.8), // «)»
      line(267, 11.5, 288, 37.1), // ² esterno (cluster separato)
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(2);
    expect(r.strokes).toHaveLength(3); // «(», cifra, «)»
    expect(r.sups[0]!.baseIndex).toBe(0); // ² interno → cifra
    expect(r.sups[1]!.baseIndex).toBe(1); // ² esterno → «)»
    expect(r.sups[0]!.baseCount).toBe(2);
    expect(r.sups[1]!.baseCount).toBe(2);
  });

  it("(2²)²: ² esterno POCO SOLLEVATO ora è apice (27/9-duodecies)", () => {
    // contro la «)» alta (cy=100) la vecchia soglia 0.08 richiedeva cy ≤ 90,4:
    // un esponente scritto poco sollevato (cy 92) passava col 2 interno
    // (soglia 93,6) ma veniva scartato con quello esterno → (2²)
    const digitTwo = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 12, cy - 40, cx + 12, cy - 40),
      line(cx + 12, cy - 40, cx - 12, cy + 40),
      line(cx - 12, cy + 40, cx + 12, cy + 40),
    ];
    const strokes = [
      line(40, 40, 52, 160),
      ...digitTwo(90, 100),
      line(150, 40, 162, 160),
      ...smallTwo(185, 92), // cy = 92: sopra la riga di base ma pochissimo
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.sups[0]!.baseIndex).toBe(2); // base = «)»
    expect(r.sups[0]!.baseCount).toBe(3);
  });

  it("(2²)² SERRATO: ² interno ed esterno FUSI entrambi con la «)» (27/9-undecies)", () => {
    // ² scritto a due tratti (due barre orizzontali), come spesso a mano
    const apexBars = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 8, cy - 14, cx + 8, cy - 14),
      line(cx - 8, cy + 14, cx + 8, cy + 14),
    ];
    const digitTwo = (cx: number, cy: number): SimpleStroke[] => [
      line(cx - 12, cy - 40, cx + 12, cy - 40),
      line(cx + 12, cy - 40, cx - 12, cy + 40),
      line(cx - 12, cy + 40, cx + 12, cy + 40),
    ];
    // il ² interno (x 128-144) e quello esterno (x 168-184) toccano entrambi
    // la «)» (x 150-162): dx = 6 ≤ 12 → UN cluster con parentesi + 2 apici
    const strokes = [
      line(40, 40, 52, 160),
      ...digitTwo(90, 100),
      ...apexBars(136, 62),
      line(150, 40, 162, 160),
      ...apexBars(176, 62),
    ];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(2);
    expect(r.strokes).toHaveLength(5); // parentesi + cifra, senza i 4 tratti d'apice
    expect(r.sups[0]!.baseIndex).toBe(1); // ² interno → cifra 2
    expect(r.sups[1]!.baseIndex).toBe(2); // ² esterno → «)»
    expect(r.sups[0]!.baseCount).toBe(3);
  });

  it("spliceExponents: (2²)² — apice interno dopo il 2, esterno dopo la parentesi", () => {
    const out = spliceExponents("(2)", [
      { digits: "2", baseIndex: 1, baseCount: 3 },
      { digits: "2", baseIndex: 2, baseCount: 3 },
    ]);
    expect(out).toBe("(2^{2})^{2}");
  });

  it("una cifra alla stessa altezza NON è un apice (lettura 2x invariata)", () => {
    // «2» grande alla stessa altezza della x
    const bigTwo = [
      line(100, 60, 130, 60),
      line(130, 60, 105, 140),
      line(105, 140, 135, 140),
    ];
    const strokes = [...xLetter(60, 100), ...bigTwo];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(5);
  });

  it("un tratto solo: nessun apice", () => {
    const r = extractSuperscripts([line(10, 10, 50, 90)]);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(1);
  });

  // ⚠️ AUDIT 4/10 («Ricontrolla gli esponenti»): POTENZA A DUE CIFRE
  // scritta con le cifre DISTACCIATE (5¹⁰ con l'1 e lo 0 a più di 12 px):
  // due cluster apice distinti che devono BOTH agganciarsi alla STESSA
  // base — altrimenti il riattacco perde una cifra o la mette sul glifo
  // sbagliato.
  it("5¹⁰ con le cifre dell'apice in DUE cluster separati: entrambi sulla STESSA base", () => {
    const five: SimpleStroke = {
      points: [{ x: 20, y: 20 }, { x: 45, y: 20 }, { x: 45, y: 100 }, { x: 20, y: 100 }],
      lineWidth: 3,
    };
    const one: SimpleStroke = { points: [{ x: 56, y: 25 }, { x: 56, y: 50 }], lineWidth: 3 };
    const zero: SimpleStroke = {
      points: [
        { x: 76, y: 25 }, { x: 92, y: 25 }, { x: 92, y: 50 }, { x: 76, y: 50 }, { x: 76, y: 25 },
      ],
      lineWidth: 3,
    };
    const r = extractSuperscripts([five, one, zero]);
    expect(r.sups).toHaveLength(2);
    expect(r.sups[0]!.baseIndex).toBe(0);
    expect(r.sups[1]!.baseIndex).toBe(0);
    expect(r.sups[0]!.baseCount).toBe(1);
    expect(r.sups[1]!.baseCount).toBe(1);
    expect(r.strokes).toHaveLength(1); // resta solo la base
  });
});

describe("spliceExponents (riattacco al LaTeX)", () => {
  it("x² con base unica", () => {
    expect(spliceExponents("x", [{ digits: "2", baseIndex: 0, baseCount: 1 }])).toBe("x^{2}");
  });

  // ⚠️ AUDIT 4/10: potenza a DUE cifre con cifre in cluster separati →
  // DUE apici con la STESSA base. Prima del fix la seconda cifra non
  // trovava punti liberi (si PERDEVA) o cadeva sul glifo successivo.
  it("5¹⁰ in due cluster (stessa base): le cifre si FONDONO in un solo apice", () => {
    expect(
      spliceExponents("5", [
        { digits: "1", baseIndex: 0, baseCount: 1 },
        { digits: "0", baseIndex: 0, baseCount: 1 },
      ]),
    ).toBe("5^{10}");
  });

  it("x¹⁰y⁵: apice a due cifre separate sulla x, apice singolo sulla y", () => {
    expect(
      spliceExponents("xy", [
        { digits: "1", baseIndex: 0, baseCount: 2 },
        { digits: "0", baseIndex: 0, baseCount: 2 },
        { digits: "5", baseIndex: 1, baseCount: 2 },
      ]),
    ).toBe("x^{10}y^{5}");
  });

  it("tre cifre separate (5¹⁰⁰): tutte sulla stessa base", () => {
    expect(
      spliceExponents("5", [
        { digits: "1", baseIndex: 0, baseCount: 1 },
        { digits: "0", baseIndex: 0, baseCount: 1 },
        { digits: "0", baseIndex: 0, baseCount: 1 },
      ]),
    ).toBe("5^{100}");
  });

  it("3x² aggancia dopo la x, non dopo il coefficiente", () => {
    expect(
      spliceExponents("3x", [{ digits: "2", baseIndex: 1, baseCount: 2 }])
    ).toBe("3x^{2}");
  });

  it("(2x)³ aggancia dopo la parentesi chiusa (i comandi \\left/\\right non contano)", () => {
    expect(
      spliceExponents("\\left(2x\\right)", [{ digits: "3", baseIndex: 3, baseCount: 4 }])
    ).toBe("\\left(2x\\right)^{3}");
  });

  it("x²y³: due apici sui due punti giusti", () => {
    expect(
      spliceExponents("xy", [
        { digits: "2", baseIndex: 0, baseCount: 2 },
        { digits: "3", baseIndex: 1, baseCount: 2 },
      ])
    ).toBe("x^{2}y^{3}");
  });

  it("xy²: l'apice va solo sulla y", () => {
    expect(
      spliceExponents("3xy", [{ digits: "2", baseIndex: 2, baseCount: 3 }])
    ).toBe("3xy^{2}");
  });

  it("5² numeric: aggancia dopo la cifra", () => {
    expect(spliceExponents("5", [{ digits: "2", baseIndex: 0, baseCount: 1 }])).toBe("5^{2}");
  });

  it("2x²+3 con parentesi e operatori nel LaTeX", () => {
    expect(
      spliceExponents("2x+3", [{ digits: "2", baseIndex: 1, baseCount: 3 }])
    ).toBe("2x^{2}+3");
  });

  it("se il modello aveva già scritto un ^, il punto resta occupato", () => {
    // il modello ha scritto «x^2»: il nuovo apice va sul punto libero più vicino
    expect(
      spliceExponents("x^{2}y", [{ digits: "3", baseIndex: 0, baseCount: 1 }])
    ).toBe("x^{2}y^{3}");
  });
});

describe("stripModelExponents", () => {
  it("rimuove gli esponenti impostori del modello", () => {
    expect(stripModelExponents("x^{2}+x^3+2")).toBe("x+x+2");
    expect(stripModelExponents("x^{2}")).toBe("x");
  });
});

function bbox(strokes: SimpleStroke[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes)
    for (const p of s.points) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
  return { x0, y0, x1, y1 };
}

// ── 5/10 sera: «+» e «−» NON sono apici ─────────────────────────────────────
// Il segno sta sull'asse della riga, PIÙ IN ALTO del centro di una lettera
// minuscola, ed è più piccolo di una cifra: soddisfaceva tutte le soglie di un
// apice («x+1» → x^{+}1, «2x−1» → 2x^{−}1) e il modello non vedeva più il segno.
describe("extractSuperscripts: «+» e «−» non sono esponenti", () => {
  /** cifra alta (un tratto verticale di 100 px) */
  const tall = (x: number): SimpleStroke => line(x, 50, x, 150);
  /** «x» minuscola: 56 px, appoggiata alla riga di base (y=150) */
  const smallX = (cx: number): SimpleStroke[] => [
    line(cx - 14, 94, cx + 14, 150),
    line(cx + 14, 94, cx - 14, 150),
  ];
  /** «+» di 44 px sull'asse (centro y=100) */
  const plus = (cx: number, cy = 100, size = 44): SimpleStroke[] => [
    line(cx - size / 2, cy, cx + size / 2, cy),
    line(cx, cy - size / 2, cx, cy + size / 2),
  ];
  /** «−» di 32 px sull'asse */
  const minus = (cx: number, cy = 100): SimpleStroke => line(cx - 16, cy, cx + 16, cy);

  it("x+1: il «+» dopo una x minuscola resta nell'inchiostro", () => {
    const strokes = [...smallX(40), ...plus(100), tall(160)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(strokes.length);
  });

  it("2x−1: il «−» dopo una x minuscola resta nell'inchiostro", () => {
    const strokes = [tall(20), ...smallX(70), minus(120), tall(170)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(strokes.length);
  });

  it("x+x: il «+» non è né apice né base", () => {
    const strokes = [...smallX(40), ...plus(100), ...smallX(160)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(0);
    expect(r.strokes).toHaveLength(strokes.length);
  });

  it("un VERO apice dopo la x resta un apice anche con un «+» accanto: x²+1", () => {
    const strokes = [...xLetter(60, 100), ...smallTwo(105, 55), ...plus(150, 100, 44), tall(200)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.sups[0]!.baseIndex).toBe(0);
    // x (2 tratti) + «+» (2) + «1» (1) restano all'inchiostro principale
    expect(r.strokes).toHaveLength(5);
  });

  it("la «t» (sbarra al 30% dell'asta) NON è un «+»: t² mantiene il suo apice", () => {
    const t: SimpleStroke[] = [line(60, 60, 60, 140), line(44, 84, 76, 84)];
    const strokes = [...t, ...smallTwo(105, 55)];
    const r = extractSuperscripts(strokes);
    expect(r.sups).toHaveLength(1);
    expect(r.sups[0]!.baseIndex).toBe(0);
  });
});

// ── 5/10 sera: la «x» NON è un tratto duplicato ─────────────────────────────
// Le due diagonali di una «x» hanno lo STESSO bbox (angolo con angolo, speculari):
// il solo criterio del bbox cancellava la seconda come «duplicato» e il modello
// riceveva un tratto solo («x[x+1]» → «1[+1]»; banco P5: 23 letture su 28
// rovinate dalla pipeline mentre il modello da solo le leggeva giuste).
describe("dedupeIdenticalStrokes: la «x» resta intera", () => {
  it("le due diagonali di una x (stesso bbox, speculari) sono ENTRAMBE mantenute", () => {
    const x = [line(100, 94, 128, 150), line(128, 94, 100, 150)];
    expect(dedupeIdenticalStrokes(x)).toHaveLength(2);
  });

  it("anche una x piccolissima (14×16 px) resta intera", () => {
    const x = [line(60, 80, 74, 96), line(74, 80, 60, 96)];
    expect(dedupeIdenticalStrokes(x)).toHaveLength(2);
  });

  it("un ripasso con jitter di ±1 px e verso opposto è ancora un duplicato", () => {
    const a = line(100, 94, 128, 150);
    const b = line(128.8, 150.9, 100.7, 94.6); // stesso tratto, ripassato al contrario
    expect(dedupeIdenticalStrokes([a, b])).toHaveLength(1);
  });

  it("due tratti diversi con lo stesso bbox (diagonale e curva a «S») restano due", () => {
    const diag = line(100, 94, 128, 150);
    const sCurve: SimpleStroke = {
      points: [
        { x: 100, y: 94 },
        { x: 128, y: 100 },
        { x: 100, y: 122 },
        { x: 128, y: 150 },
      ],
    };
    expect(dedupeIdenticalStrokes([diag, sCurve])).toHaveLength(2);
  });
});

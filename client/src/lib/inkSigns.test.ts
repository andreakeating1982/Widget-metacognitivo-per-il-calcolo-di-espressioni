import { describe, expect, it } from "vitest";
import {
  eightOrNineFromInk,
  repairModelNine,
  repairModelSqrt,
  rewriteEqualSigns,
  rewriteEights,
  digitsFromNumberLatex,
  rewriteMinusSigns,
  rewriteRadicalSigns,
  rewriteStackedFractions,
  stripSpuriousFractionMinus,
} from "./inkSigns";
import type { SimpleStroke } from "./inkSigns";

const bar = (x0: number, x1: number, y: number): SimpleStroke => ({
  points: [{ x: x0, y }, { x: x1, y }],
  lineWidth: 3,
});

const digit = (x0: number, x1: number, y0: number, y1: number): SimpleStroke => ({
  points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
  lineWidth: 3,
});

/** Segno di radice disegnato: V (discesa + risalita) + barra in alto + cifra */
const radical = (x0: number): SimpleStroke[] => [
  // V: discesa poi risalita ripida che finisce in alto
  {
    points: [
      { x: x0, y: 60 },
      { x: x0 + 14, y: 100 },
      { x: x0 + 44, y: 40 },
    ],
    lineWidth: 3,
  },
  // vinculum: barra orizzontale che parte dall'apice della V
  bar(x0 + 44, x0 + 120, 40),
  // radicando (cifra sotto la barra)
  digit(x0 + 60, x0 + 90, 45, 105),
];

describe("rewriteMinusSigns — segno meno disegnato a mano (27/9 «-8»)", () => {
  it("un meno solo (pezzo isolato) viene tolto dall'inchiostro con ancora 0", () => {
    const r = rewriteMinusSigns([bar(40, 110, 80)]);
    expect(r.minuses).toBe(1);
    expect(r.strokes).toHaveLength(0);
    expect(r.anchors).toEqual([0]);
  });

  it("«-8» (barra + otto) perde la barra: il modello vede solo l'otto", () => {
    // otto = due anelli impilati (quadrato chiuso ×2, come nei test esistenti)
    const otto: SimpleStroke = {
      points: [
        { x: 60, y: 40 },
        { x: 100, y: 40 },
        { x: 100, y: 80 },
        { x: 60, y: 80 },
        { x: 60, y: 40 },
        { x: 60, y: 120 },
        { x: 100, y: 120 },
        { x: 100, y: 80 },
      ],
      lineWidth: 3,
    };
    const strokes = [bar(10, 45, 78), otto];
    const r = rewriteMinusSigns(strokes);
    expect(r.minuses).toBe(1);
    expect(r.strokes).toHaveLength(1); // resta solo l'otto (che rewriteEights toglie)
    // il meno è a SINISTRA dell'otto: ancora vicina a 0
    expect(r.anchors[0]).toBeLessThan(0.3);
  });

  it("la traversa di un «+» (barra + verticale che la attraversa) NON è un meno", () => {
    const verticale: SimpleStroke = {
      points: [
        { x: 75, y: 30 },
        { x: 75, y: 130 },
      ],
      lineWidth: 3,
    };
    const r = rewriteMinusSigns([verticale, bar(40, 110, 80)]);
    expect(r.minuses).toBe(0);
    expect(r.strokes).toHaveLength(2); // niente è stato tolto
  });

  it("un meno RIPASSATO (due tratti sovrapposti) è UN solo meno, non «--»", () => {
    const r = rewriteMinusSigns([bar(40, 110, 80), bar(42, 108, 82)]);
    expect(r.minuses).toBe(1);
    expect(r.anchors).toHaveLength(1);
  });

  it("due meno in un pezzo («3 - 8 - 2») vengono tutti rilevati", () => {
    const strokes = [
      digit(10, 40, 40, 120),
      bar(60, 105, 80),
      digit(125, 165, 40, 120),
      bar(185, 230, 80),
      digit(250, 290, 40, 120),
    ];
    const r = rewriteMinusSigns(strokes);
    expect(r.minuses).toBe(2);
    expect(r.strokes).toHaveLength(3);
    expect(r.anchors).toHaveLength(2);
  });
});

describe("rewriteEqualSigns — uguale disegnato a mano", () => {
  it("due barre impilate tra due cifre diventano un uguale sintetico", () => {
    const strokes = [
      digit(40, 80, 40, 120),
      bar(120, 190, 62),
      bar(122, 188, 78),
      digit(210, 250, 40, 120),
    ];
    const r = rewriteEqualSigns(strokes);
    expect(r.equals).toBe(1);
    // le barre vengono TOLTE dall'inchiostro: restano solo le 2 cifre
    expect(r.strokes).toHaveLength(2);
    // ancORA per il reinserimento di «=» nel LaTeX (tra le cifre)
    expect(r.anchors).toHaveLength(1);
    expect(r.anchors[0]).toBeGreaterThan(0.2);
    expect(r.anchors[0]).toBeLessThan(0.8);
  });

  it("una sola barra (meno) NON viene toccata", () => {
    const strokes = [digit(40, 80, 40, 120), bar(120, 180, 80), digit(210, 250, 40, 120)];
    const r = rewriteEqualSigns(strokes);
    expect(r.equals).toBe(0);
    expect(r.strokes).toHaveLength(3);
  });

  it("due barre TROPPO DISTANTI (due meno su righe diverse) non formano un uguale", () => {
    const strokes = [digit(40, 80, 20, 90), bar(120, 180, 55), bar(120, 180, 110), digit(210, 250, 40, 120)];
    const r = rewriteEqualSigns(strokes);
    expect(r.equals).toBe(0);
  });

  it("una barra con del contenuto SOTTO (vinculum di radice) non è un uguale", () => {
    const strokes = [...radical(40), digit(180, 220, 40, 120)];
    const r = rewriteEqualSigns(strokes);
    expect(r.equals).toBe(0);
  });
});

describe("rewriteRadicalSigns — il pancino di una lettera NON è una radice (5/10 notte)", () => {
  it("il pancino della «b» (arco che risale e rientra) resta nell'inchiostro", () => {
    // punti reali del banco: `(a+b)(a-b)`, seed 1795 (stile normale), tratti 12 (asta) e 13 (pancino)
    const P = (arr: [number, number][]) => ({ points: arr.map(([x, y]) => ({ x, y })), lineWidth: 3 });
    const stem = P([[420, 32], [419, 41], [419, 49], [417, 57], [416, 66], [416, 75], [415, 84], [413, 92], [412, 100]]);
    const bowl = P([
      [414, 89], [418, 92], [420, 97], [423, 99], [426, 98], [429, 94], [430, 90], [432, 85],
      [434, 80], [436, 77], [438, 73], [436, 69], [434, 66], [431, 62], [426, 61], [422, 62],
      [419, 65], [416, 67], [416, 68],
    ]);
    const r = rewriteRadicalSigns([stem, bowl]);
    expect(r.radicals).toBe(0);
    expect(r.strokes).toHaveLength(2);
  });
});

describe("rewriteRadicalSigns — radice disegnata a mano", () => {
  it("V + barra + radicando: segno TOLTO, resta il radicando con l'ancora", () => {
    const strokes = radical(40);
    const r = rewriteRadicalSigns(strokes);
    expect(r.radicals).toBe(1);
    // V e barra rimossi: resta solo il radicando (che il modello sa leggere)
    expect(r.strokes).toHaveLength(1);
    // la radice era a SINISTRA del radicando → ancora a frazione 0
    expect(r.anchors).toEqual([0]);
  });

  it("il vinculum NELLO STESSO tratto (V con coda orizzontale) è una radice", () => {
    const strokes: SimpleStroke[] = [
      {
        // discesa, risalita, poi lunga coda orizzontale in alto
        points: [
          { x: 40, y: 60 },
          { x: 54, y: 100 },
          { x: 84, y: 40 },
          { x: 160, y: 38 },
        ],
        lineWidth: 3,
      },
      digit(100, 130, 45, 105),
    ];
    const r = rewriteRadicalSigns(strokes);
    expect(r.radicals).toBe(1);
    // tutto il tratto (V + coda) è stato rimosso: resta il radicando
    expect(r.strokes).toHaveLength(1);
  });

  it("una «v» SENZA barra non è una radice: resta nell'inchiostro", () => {
    const strokes: SimpleStroke[] = [
      {
        // lettera v: discesa + risalita, senza barra né coda
        points: [
          { x: 40, y: 50 },
          { x: 55, y: 100 },
          { x: 70, y: 50 },
        ],
        lineWidth: 3,
      },
      digit(90, 130, 40, 120),
    ];
    const r = rewriteRadicalSigns(strokes);
    expect(r.radicals).toBe(0);
    expect(r.anchors).toEqual([]);
    expect(r.strokes).toHaveLength(2);
  });

  it("una cifra da sola non è una radice", () => {
    const strokes = [digit(40, 80, 40, 120)];
    const r = rewriteRadicalSigns(strokes);
    expect(r.radicals).toBe(0);
    expect(r.strokes).toHaveLength(1);
  });
});

/** 8 in un solo tratto «a due anelli»: si parte dal PUNTO DI VITA (in
 *  mezzo), si gira attorno all'anello superiore, si torna al punto di vita
 *  e si gira attorno all'anello inferiore, chiudendo sul punto di partenza.
 *  Gli anelli sono TANGENTI al punto di vita: nessuna autointersezione,
 *  ma forte STROZZURA al centro (firma a). */
const eight1 = (x0: number, y0 = 30): SimpleStroke => {
  const cx = x0 + 30;
  const cyT = y0 + 30; // centro anello superiore
  const cyB = y0 + 84; // centro anello inferiore
  const waist = { x: cx, y: cyT + 26 }; // = (cx, cyB - 28): punto di vita
  const pts: { x: number; y: number }[] = [];
  // anello superiore: angolo 90° (il punto di vita) per un giro completo
  for (let a = 90; a <= 90 + 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    pts.push({ x: cx + 26 * Math.cos(rad), y: cyT + 26 * Math.sin(rad) });
  }
  // anello inferiore: dall'angolo -90° (di nuovo il punto di vita),
  // senso opposto, un giro completo
  for (let a = -90; a >= -90 - 360; a -= 30) {
    const rad = (a * Math.PI) / 180;
    pts.push({ x: cx + 28 * Math.cos(rad), y: cyB + 28 * Math.sin(rad) });
  }
  pts.push({ ...waist }); // chiusura esatta sul punto di partenza
  return { points: pts, lineWidth: 3 };
};

/** 8 «a croce» in un solo tratto: due anelli SOVRAPPOSTI che si
 *  attraversano vicino al centro (autointersezioni, firma b). */
const eightCross = (x0: number, y0 = 30): SimpleStroke => {
  const cx = x0 + 30;
  const cyT = y0 + 32; // centro anello superiore
  const cyB = y0 + 78; // centro anello inferiore (SOVRAPPOSTO: 32+26 > 78-28)
  const waist = { x: cx, y: cyT + 26 };
  const pts: { x: number; y: number }[] = [];
  for (let a = 90; a <= 90 + 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    pts.push({ x: cx + 26 * Math.cos(rad), y: cyT + 26 * Math.sin(rad) });
  }
  for (let a = -90; a >= -90 - 360; a -= 30) {
    const rad = (a * Math.PI) / 180;
    pts.push({ x: cx + 28 * Math.cos(rad), y: cyB + 28 * Math.sin(rad) });
  }
  pts.push({ ...waist });
  return { points: pts, lineWidth: 3 };
};

describe("rewriteEights — numero 8 disegnato a mano", () => {
  it("8 a due anelli tangenti (un tratto): tolto dall'inchiostro con ancora", () => {
    const strokes = [eight1(40), digit(110, 150, 40, 120)];
    const r = rewriteEights(strokes);
    expect(r.eights).toBe(1);
    // resta solo la cifra accanto: l'8 era a SINISTRA → ancora a frazione 0
    expect(r.anchors).toEqual([0]);
    expect(r.strokes).toHaveLength(1);
  });

  it("8 a croce (con autointersezione al centro): tolto con ancora", () => {
    const r = rewriteEights([eightCross(40), digit(110, 150, 40, 120)]);
    expect(r.eights).toBe(1);
    expect(r.strokes).toHaveLength(1);
    expect(r.anchors).toEqual([0]);
  });

  it("8 da solo nel pezzo: inchiostro vuoto, ancora a 0", () => {
    const r = rewriteEights([eight1(60)]);
    expect(r.eights).toBe(1);
    expect(r.strokes).toHaveLength(0);
    expect(r.anchors).toEqual([0]);
  });

  it("una cifra APERTA (3, 5, s) non è un 8: resta nell'inchiostro", () => {
    // «3»: due archi aperti a sinistra, inizio e fine DISTANTI
    const three: SimpleStroke = {
      points: [
        { x: 50, y: 40 },
        { x: 74, y: 36 },
        { x: 78, y: 58 },
        { x: 56, y: 70 },
        { x: 78, y: 84 },
        { x: 72, y: 106 },
        { x: 46, y: 112 },
      ],
      lineWidth: 3,
    };
    const r = rewriteEights([three]);
    expect(r.eights).toBe(0);
    expect(r.strokes).toHaveLength(1);
  });

  it("uno zero (anello chiuso SENZA incroci) non è un 8", () => {
    const zero: SimpleStroke = {
      points: [
        { x: 60, y: 30 },
        { x: 86, y: 40 },
        { x: 90, y: 75 },
        { x: 76, y: 105 },
        { x: 52, y: 100 },
        { x: 44, y: 66 },
        { x: 54, y: 36 },
        { x: 60, y: 30 },
      ],
      lineWidth: 3,
    };
    const r = rewriteEights([zero]);
    expect(r.eights).toBe(0);
    expect(r.strokes).toHaveLength(1);
  });

  it("una «B» con stelo a sinistra NON è un 8 (guardia anti-stelo)", () => {
    const bee: SimpleStroke = {
      // gambo verticale sinistro + due bump: chiuso in alto a sinistra
      points: [
        { x: 40, y: 30 },
        { x: 40, y: 110 },
        { x: 74, y: 96 },
        { x: 76, y: 72 },
        { x: 52, y: 62 },
        { x: 78, y: 50 },
        { x: 74, y: 34 },
        { x: 40, y: 30 },
      ],
      lineWidth: 3,
    };
    const r = rewriteEights([bee]);
    expect(r.eights).toBe(0);
    expect(r.strokes).toHaveLength(1);
  });

  it("8 APERTO (traccia che non si richiude ma incrocia al centro): tolto (27/9-bis)", () => {
    // come eightCross ma SENZA chiusura finale: la traccia finisce a
    // metà dell'anello inferiore (gap piccolo, non a braccia divaricate)
    const open8 = (x0: number, y0 = 30): SimpleStroke => {
      const cx = x0 + 30;
      const cyT = y0 + 32;
      const cyB = y0 + 78;
      const pts: { x: number; y: number }[] = [];
      for (let a = 90; a <= 90 + 360; a += 30) {
        const rad = (a * Math.PI) / 180;
        pts.push({ x: cx + 26 * Math.cos(rad), y: cyT + 26 * Math.sin(rad) });
      }
      // anello inferiore FERMATO a -210° (in basso a sinistra, vicino
      // al punto di vita ma senza richiudere)
      for (let a = -90; a >= -90 - 120; a -= 30) {
        const rad = (a * Math.PI) / 180;
        pts.push({ x: cx + 28 * Math.cos(rad), y: cyB + 28 * Math.sin(rad) });
      }
      return { points: pts, lineWidth: 3 };
    };
    const r = rewriteEights([open8(40), digit(110, 150, 40, 120)]);
    expect(r.eights).toBe(1);
    expect(r.strokes).toHaveLength(1);
  });

  it("una «x» in un solo tratto NON è un 8 (estremità divaricate in diagonale)", () => {
    const ex: SimpleStroke = {
      points: [
        { x: 40, y: 30 },
        { x: 80, y: 110 },
        { x: 40, y: 110 },
        { x: 80, y: 30 },
      ],
      lineWidth: 3,
    };
    const r = rewriteEights([ex]);
    expect(r.eights).toBe(0);
    expect(r.strokes).toHaveLength(1);
  });

  it("8 in DUE tratti con anelli SOVRAPPOSTI (27/9-bis): tolto con ancora unica", () => {
    const loop = (cy: number): SimpleStroke => ({
      points: [
        { x: 60, y: cy - 22 },
        { x: 84, y: cy - 12 },
        { x: 86, y: cy + 10 },
        { x: 64, y: cy + 20 },
        { x: 44, y: cy + 10 },
        { x: 42, y: cy - 12 },
        { x: 60, y: cy - 22 },
      ],
      lineWidth: 3,
    });
    // distanza dei centri 21 px con anelli alti 42: SOVRAPPOSTI
    // (prima soglia 60% = 25,2 px → sfuggiva)
    const r = rewriteEights([loop(55), loop(76), digit(140, 180, 40, 120)]);
    expect(r.eights).toBe(1);
    expect(r.strokes).toHaveLength(1);
  });

  it("8 in DUE tratti (due anelli chiusi impilati): tolto con ancora unica", () => {
    const loop = (cy: number): SimpleStroke => ({
      points: [
        { x: 60, y: cy - 22 },
        { x: 84, y: cy - 12 },
        { x: 86, y: cy + 10 },
        { x: 64, y: cy + 20 },
        { x: 44, y: cy + 10 },
        { x: 42, y: cy - 12 },
        { x: 60, y: cy - 22 },
      ],
      lineWidth: 3,
    });
    const r = rewriteEights([loop(55), loop(105), digit(140, 180, 40, 120)]);
    expect(r.eights).toBe(1);
    expect(r.strokes).toHaveLength(1);
    expect(r.anchors).toEqual([0]);
  });
});

describe("repairModelSqrt — 8 letto come radice dal modello (27/9-bis)", () => {
  const loop: SimpleStroke = {
    points: [
      { x: 60, y: 33 },
      { x: 84, y: 43 },
      { x: 86, y: 65 },
      { x: 64, y: 75 },
      { x: 44, y: 65 },
      { x: 42, y: 43 },
      { x: 60, y: 33 },
    ],
    lineWidth: 3,
  };
  const dig = (x0: number): SimpleStroke => ({
    points: [{ x: x0, y: 40 }, { x: x0 + 30, y: 40 }, { x: x0 + 30, y: 120 }, { x: x0, y: 120 }],
    lineWidth: 3,
  });

  it("\\sqrt spurio + glifo ad anello → 8 (con radicando in giustapposizione)", () => {
    expect(repairModelSqrt("\\sqrt{9}", 0, [loop])).toBe("89");
  });

  it("\\sqrt nudo + glifo ad anello → 8", () => {
    expect(repairModelSqrt("\\sqrt", 0, [loop])).toBe("8");
  });

  it("con radici GEOMETRICHE non si tocca (la radice vera arriva dalle ancore)", () => {
    expect(repairModelSqrt("\\sqrt{9}", 1, [loop])).toBe("\\sqrt{9}");
  });

  it("senza glifo ad anello non si tocca (radice sfuggita alla geometria)", () => {
    expect(repairModelSqrt("\\sqrt{9}", 0, [dig(40)])).toBe("\\sqrt{9}");
  });

  it("più \sqrt nello stesso latex (es. 88 letto \\sqrt\\sqrt)", () => {
    expect(repairModelSqrt("\\sqrt\\sqrt{3}", 0, [loop, dig(120)])).toBe("883");
  });

  it("senza \\sqrt il latex è invariato", () => {
    expect(repairModelSqrt("3x+2", 0, [loop])).toBe("3x+2");
  });
});

describe("guardia anti-8 nel radicale (27/9-quater: 8 → √)", () => {
  // 8 a un tratto: due anelli sovrapposti (stesso disegno del test eights)
  const eight1 = (x0: number): SimpleStroke => {
    const cx = x0 + 30;
    const cyT = 50, ryT = 36, rT = 22;
    const cyB = 105, ryB = 40, rB = 26;
    const pts: { x: number; y: number }[] = [];
    for (let a = 90; a <= 450; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rT * Math.cos(rad), y: cyT + ryT * Math.sin(rad) });
    }
    for (let a = -90; a >= -450; a -= 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rB * Math.cos(rad), y: cyB + ryB * Math.sin(rad) });
    }
    return { points: pts, lineWidth: 3 };
  };

  it("un 8 NON viene rivendicato come radicale (radicals = 0)", () => {
    const r = rewriteRadicalSigns([eight1(40), digit(110, 150, 40, 120)]);
    expect(r.radicals).toBe(0);
  });

  it("una radice VERA (V aperta + barra) resta un radicale", () => {
    const vee: SimpleStroke = {
      points: [
        { x: 40, y: 70 },
        { x: 60, y: 110 },
        { x: 100, y: 30 },
      ],
      lineWidth: 3,
    };
    const vbar: SimpleStroke = {
      points: [
        { x: 100, y: 30 },
        { x: 180, y: 30 },
      ],
      lineWidth: 3,
    };
    const r = rewriteRadicalSigns([vee, vbar, digit(120, 160, 40, 120)]);
    expect(r.radicals).toBe(1);
  });
});

describe("eightOrNineFromInk — firma 8/9/0 sull'inchiostro (27/9-quater)", () => {
  // 8 a un tratto: due anelli sovrapposti
  const eight1 = (): SimpleStroke => {
    const cx = 60, cyT = 50, ryT = 36, rT = 22, cyB = 105, ryB = 40, rB = 26;
    const pts: { x: number; y: number }[] = [];
    for (let a = 90; a <= 450; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rT * Math.cos(rad), y: cyT + ryT * Math.sin(rad) });
    }
    for (let a = -90; a >= -450; a -= 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rB * Math.cos(rad), y: cyB + ryB * Math.sin(rad) });
    }
    return { points: pts, lineWidth: 3 };
  };
  // 9: anello largo in alto + gambo stretto in basso
  const nine1 = (): SimpleStroke => {
    const cx = 60, cyT = 55, ryT = 38, rT = 24;
    const pts: { x: number; y: number }[] = [];
    for (let a = 90; a <= 450; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rT * Math.cos(rad), y: cyT + ryT * Math.sin(rad) });
    }
    pts.push({ x: cx + 20, y: 100 });
    pts.push({ x: cx + 18, y: 135 });
    return { points: pts, lineWidth: 3 };
  };
  // 0: un solo anello largo ovunque
  const zero1 = (): SimpleStroke => {
    const cx = 60, cy = 80, ry = 45, r = 26;
    const pts: { x: number; y: number }[] = [];
    for (let a = 90; a <= 450; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + r * Math.cos(rad), y: cy + ry * Math.sin(rad) });
    }
    return { points: pts, lineWidth: 3 };
  };

  it("8 a un tratto → «8»", () => {
    expect(eightOrNineFromInk([eight1()])).toBe("8");
  });

  it("9 (anello + gambo) → «9»", () => {
    expect(eightOrNineFromInk([nine1()])).toBe("9");
  });

  it("0 (anello unico largo) → «0», NON un falso 8", () => {
    expect(eightOrNineFromInk([zero1()])).toBe("0");
  });

  it("tratti non glifo (barra, V) → null", () => {
    expect(eightOrNineFromInk([bar(20, 100, 80)])).toBeNull();
    expect(
      eightOrNineFromInk([
        { points: [{ x: 40, y: 40 }, { x: 60, y: 90 }, { x: 80, y: 40 }], lineWidth: 3 },
      ]),
    ).toBeNull();
  });

  it("inchiostro vuoto → null", () => {
    expect(eightOrNineFromInk([])).toBeNull();
  });
});

describe("repairModelNine — 9 letto g/q dal modello (27/9-quater)", () => {
  it("g e q isolati → 9", () => {
    expect(repairModelNine("g")).toBe("9");
    expect(repairModelNine("q")).toBe("9");
    expect(repairModelNine("G")).toBe("9");
  });

  it("g/q accanto a cifre e operatori → 9", () => {
    expect(repairModelNine("3g")).toBe("39");
    expect(repairModelNine("q+2")).toBe("9+2");
    expect(repairModelNine("2(g+3)")).toBe("2(9+3)");
    expect(repairModelNine("5:q")).toBe("5:9");
  });

  it("comandi LaTeX con la g restano INTATTI", () => {
    expect(repairModelNine("\\sigma")).toBe("\\sigma");
    expect(repairModelNine("\\log_{2}8")).toBe("\\log_{2}8");
  });

  it("lettere attaccate a g restano variabili (sequenze di lettere)", () => {
    expect(repairModelNine("ag")).toBe("ag");
    expect(repairModelNine("gx")).toBe("gx");
  });

  it("più g nello stesso pezzo", () => {
    expect(repairModelNine("g:g")).toBe("9:9");
  });

  it("firma d'inchiostro «8»: g/q e \\theta diventano 8", () => {
    expect(repairModelNine("g", "8")).toBe("8");
    expect(repairModelNine("\\theta", "8")).toBe("8");
    expect(repairModelNine("3\\theta", "8")).toBe("38");
  });

  it("\\theta con firma «0» o «9» segue la firma", () => {
    expect(repairModelNine("\\theta", "0")).toBe("0");
    expect(repairModelNine("\\theta", "9")).toBe("9");
  });

  it("\\theta con firma nulla resta com'è (l'utente corregge)", () => {
    expect(repairModelNine("\\theta")).toBe("\\theta");
    expect(repairModelNine("\\theta", null)).toBe("\\theta");
  });

  it("\\sigma resta intatto anche con firma «8»", () => {
    expect(repairModelNine("\\sigma", "8")).toBe("\\sigma");
  });
});

describe("rewriteEqualSigns — casi difficili (segnalazione 26/9)", () => {
  it("barre INCLINATE (fino a ~30°) formano comunque un uguale", () => {
    const tilt = (x0: number, y0: number): SimpleStroke => ({
      points: [
        { x: x0, y: y0 },
        { x: x0 + 30, y: y0 - 14 },
        { x: x0 + 60, y: y0 - 28 },
      ],
      lineWidth: 3,
    });
    const strokes = [digit(30, 70, 40, 120), tilt(110, 80), tilt(112, 112), digit(220, 260, 40, 120)];
    const r = rewriteEqualSigns(strokes);
    expect(r.equals).toBe(1);
    expect(r.strokes).toHaveLength(2); // solo le cifre, barre rimosse
  });

  it("uguale IN UN SOLO TRATTO (vai-e-torna) diventa uguale sintetico", () => {
    const oneStroke: SimpleStroke = {
      // barra destra, ritorno a sinistra, barra destra: 3 corse orizzontali
      points: [
        { x: 120, y: 60 },
        { x: 150, y: 59 },
        { x: 180, y: 61 },
        { x: 178, y: 72 },
        { x: 148, y: 73 },
        { x: 122, y: 72 },
        { x: 120, y: 84 },
        { x: 152, y: 85 },
        { x: 180, y: 84 },
      ],
      lineWidth: 3,
    };
    const strokes = [digit(40, 80, 40, 120), oneStroke, digit(220, 260, 40, 120)];
    const r = rewriteEqualSigns(strokes);
    expect(r.equals).toBe(1);
    // il tratto unico è stato rimosso: restano solo le 2 cifre
    expect(r.strokes).toHaveLength(2);
  });

  it("una «z» (corsa diagonale) NON è un uguale in un tratto", () => {
    const zed: SimpleStroke = {
      points: [
        { x: 120, y: 50 },
        { x: 180, y: 50 },
        { x: 126, y: 108 },
        { x: 184, y: 108 },
      ],
      lineWidth: 3,
    };
    const r = rewriteEqualSigns([zed]);
    expect(r.equals).toBe(0);
    expect(r.strokes).toHaveLength(1);
  });

  it("barre con distanza verticale grande (~40 px) formano comunque un uguale (segnalazione 27/9)", () => {
    const r = rewriteEqualSigns([
      digit(40, 80, 30, 110),
      bar(120, 190, 55),
      bar(120, 190, 95),
      digit(210, 250, 40, 120),
    ]);
    expect(r.equals).toBe(1);
  });

  it("barre con centri disallineati di ~20 px formano comunque un uguale (segnalazione 27/9)", () => {
    const r = rewriteEqualSigns([
      digit(40, 80, 40, 120),
      bar(120, 190, 62),
      bar(126, 196, 84),
      digit(210, 250, 40, 120),
    ]);
    expect(r.equals).toBe(1);
  });
});

describe("rewriteEights — 8 piccolo (segnalazione 27/9)", () => {
  it("un 8 piccolo (altezza ~28 px) viene comunque tolto dall'inchiostro", () => {
    // 8 piccolo: due anelli di raggio 6/7, altezza totale ~28 px
    const pts: { x: number; y: number }[] = [];
    const cx = 60, cyT = 43, cyB = 57;
    for (let a = 90; a <= 450; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + 6 * Math.cos(rad), y: cyT + 7 * Math.sin(rad) });
    }
    for (let a = -90; a >= -450; a -= 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + 7 * Math.cos(rad), y: cyB + 7 * Math.sin(rad) });
    }
    const r = rewriteEights([{ points: pts, lineWidth: 3 }, digit(110, 150, 40, 120)]);
    expect(r.eights).toBe(1);
  });
});

// ─── FRAZIONE IMPILATA: il «−» spurio (segnalazione 27/9-bis) ────────
// Lo studente scrive 75 sopra, la linea, 7 sotto: l'app leggeva «−75/7»
// (e decimale «−10,71») perché la linea della frazione veniva classificata
// come segno «−».

/** Frazione impilata: numeratore (cifre in alto), linea, denominatore */
const frazioneImpilata = (numeri: SimpleStroke[], den: SimpleStroke[]): SimpleStroke[] => [
  ...numeri,
  bar(50, 150, 120), // linea di frazione
  ...den,
];

describe("frazione impilata: niente «−» spurio (segnalazione 27/9-bis)", () => {
  it("la LINEA della frazione non viene più estratta come meno", () => {
    // numeratore: due cifre in alto; linea; denominatore: una cifra in basso
    const tratti = frazioneImpilata(
      [digit(60, 90, 40, 100), digit(95, 130, 40, 100)],
      [digit(60, 130, 140, 200)],
    );
    const r = rewriteMinusSigns(tratti);
    expect(r.minuses).toBe(0);
    expect(r.strokes).toHaveLength(4); // niente è stato tolto dall'inchiostro
  });

  it("frazione scritta bene + LaTeX con «−» spurio → il «−» viene scartato", () => {
    const tratti = frazioneImpilata(
      [digit(60, 90, 40, 100), digit(95, 130, 40, 100)],
      [digit(60, 130, 140, 200)],
    );
    // il modello (o un pezzo di curva) ha prodotto «−\frac{75}{7}»
    expect(stripSpuriousFractionMinus("-\\frac{75}{7}", tratti)).toBe("\\frac{75}{7}");
    // anche in notazione «-75/7»
    expect(stripSpuriousFractionMinus("-75/7", tratti)).toBe("75/7");
  });

  it("un «−» disegnato DAVVERO a sinistra, fuori dalla banda della linea, resta", () => {
    // meno a sinistra (x 0–30), poi la frazione (x 50–150)
    const tratti = [
      bar(0, 30, 120),
      ...frazioneImpilata(
        [digit(60, 90, 40, 100)],
        [digit(60, 130, 140, 200)],
      ),
    ];
    const r = rewriteMinusSigns(tratti);
    expect(r.minuses).toBe(1); // il meno vero è estratto e reinserito
    expect(stripSpuriousFractionMinus("-\\frac{3}{4}", tratti)).toBe("-\\frac{3}{4}");
  });

  it("un «−» sulla BANDA della linea (in mezzo ai numeri) non è mai un meno", () => {
    // barra piatta in mezzo alla frazione, sovrapposta ai numeri
    const tratti = frazioneImpilata(
      [digit(60, 90, 40, 100)],
      [digit(60, 130, 140, 200)],
    );
    expect(stripSpuriousFractionMinus("-\\frac{7}{5}", tratti)).toBe("\\frac{7}{5}");
  });

  it("senza meno nel LaTeX non cambia niente", () => {
    const tratti = frazioneImpilata(
      [digit(60, 90, 40, 100)],
      [digit(60, 130, 140, 200)],
    );
    expect(stripSpuriousFractionMinus("\\frac{75}{7}", tratti)).toBe("\\frac{75}{7}");
  });

  it("un «−» davanti a NON-frazione (es. «-8») resta anche con linee di frazione nell'inchiostro", () => {
    const tratti = frazioneImpilata(
      [digit(60, 90, 40, 100)],
      [digit(60, 130, 140, 200)],
    );
    expect(stripSpuriousFractionMinus("-8", tratti)).toBe("-8");
  });
});

// ─── FRAZIONE IMPILATA: ESTRAZIONE GEOMETRICA (27/9, riconoscimento) ────
// Il modello non sa leggere la struttura impilata: numeratore e denominatore
// vengono estratti e riconosciuti A PARTE in modalità «numero».

describe("rewriteStackedFractions: estrazione della frazione impilata", () => {
  it("estrae numeratore, linea e denominatore da una frazione pura", () => {
    const tratti = frazioneImpilata(
      [digit(60, 90, 40, 100), digit(95, 130, 40, 100)],
      [digit(60, 130, 140, 200)],
    );
    const r = rewriteStackedFractions(tratti);
    expect(r.fracs).toHaveLength(1);
    expect(r.fracs[0]!.numStrokes).toHaveLength(2);
    expect(r.fracs[0]!.denStrokes).toHaveLength(1);
    expect(r.strokes).toHaveLength(0); // tutto l'inchiostro è la frazione
    // le copie INGRANDITE esistono e sono più grandi (modalità «numero»)
    const g0 = r.fracs[0]!.numStrokes[0]!.points;
    const gs0 = r.fracs[0]!.numScaled[0]!.points;
    const h = (pts: { x: number; y: number }[]) =>
      Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    expect(h(gs0)).toBeGreaterThan(h(g0));
  });

  it("lascia nell'inchiostro i tratti che NON fanno parte della frazione", () => {
    const altro = digit(200, 240, 120, 190); // cifra a destra, allineata alla linea
    const tratti = [altro, ...frazioneImpilata([digit(60, 90, 40, 100)], [digit(60, 130, 140, 200)])];
    const r = rewriteStackedFractions(tratti);
    expect(r.fracs).toHaveLength(1);
    expect(r.strokes).toEqual([altro]);
  });

  it("un meno con cifre ACCANTO non è una frazione (niente falsi positivi)", () => {
    // barra orizzontale al centro, cifra a sinistra e cifra a destra
    const tratti = [digit(0, 30, 90, 150), bar(60, 140, 120), digit(170, 200, 90, 150)];
    const r = rewriteStackedFractions(tratti);
    expect(r.fracs).toHaveLength(0);
    expect(r.strokes).toHaveLength(3);
  });

  it("un segno «÷» già sintetizzato (barra diagonale) non è una frazione", () => {
    // barra diagonale come quella sintetizzata da rewriteDotSigns + due glifi ai lati
    const slash: SimpleStroke = {
      points: [
        { x: 90, y: 90 },
        { x: 96, y: 110 },
        { x: 102, y: 130 },
        { x: 108, y: 150 },
      ],
      lineWidth: 12,
    };
    const tratti = [digit(0, 40, 90, 160), slash, digit(150, 190, 90, 160)];
    const r = rewriteStackedFractions(tratti);
    expect(r.fracs).toHaveLength(0);
  });

  it("una barra piatta SENZA cifre sopra e sotto non è una linea di frazione", () => {
    const tratti = [bar(50, 150, 120), digit(200, 240, 90, 160)];
    const r = rewriteStackedFractions(tratti);
    expect(r.fracs).toHaveLength(0);
  });

  it("l'inchiostro resta invariato se non c'è nessuna frazione", () => {
    const tratti = [digit(0, 40, 90, 160), digit(70, 110, 90, 160)];
    const r = rewriteStackedFractions(tratti);
    expect(r.fracs).toHaveLength(0);
    expect(r.strokes).toEqual(tratti);
  });
});

describe("digitsFromNumberLatex: omonimi delle cifre in modalità «numero»", () => {
  it("mappa le lettere omonime sulle cifre", () => {
    expect(digitsFromNumberLatex("g")).toBe("9");
    expect(digitsFromNumberLatex("q")).toBe("9");
    expect(digitsFromNumberLatex("\\operatorname{g}")).toBe("9");
    expect(digitsFromNumberLatex("o")).toBe("0");
    expect(digitsFromNumberLatex("O")).toBe("0");
    expect(digitsFromNumberLatex("\\theta")).toBe("0");
    expect(digitsFromNumberLatex("l")).toBe("1");
    expect(digitsFromNumberLatex("I")).toBe("1");
    expect(digitsFromNumberLatex("\\ell")).toBe("1");
    expect(digitsFromNumberLatex("s")).toBe("5");
    expect(digitsFromNumberLatex("S")).toBe("5");
    expect(digitsFromNumberLatex("z")).toBe("2");
    expect(digitsFromNumberLatex("Z")).toBe("2");
    expect(digitsFromNumberLatex("b")).toBe("6");
    expect(digitsFromNumberLatex("B")).toBe("8");
    expect(digitsFromNumberLatex("\\infty")).toBe("8");
  });

  it("le cifre vere restano invariate e i non-omonimi si scartano", () => {
    expect(digitsFromNumberLatex("75")).toBe("75");
    expect(digitsFromNumberLatex("12")).toBe("12");
    expect(digitsFromNumberLatex("gz")).toBe("92");
    expect(digitsFromNumberLatex("\\alpha x")).toBe(""); // lettere non omonime: niente cifre
  });
});

// ─── «27» LETTO «8» (27/9, finestra dei risultati) ─────────────────────────
// La firma 8/9/0 vale per UN SINGOLO glifo: due cifre compatte affiancate
// («27») potevano soddisfare la firma dell'8 e la scorciatoia «8 isolato»
// dell'hook SOVRASCRIVEVA il modello. Guardie: colonna verticale vuota
// interna (≥ 2 glifi affiancati) e rapporto larghezza/altezza ≤ 1,2.

describe("eightOrNineFromInk: guardia multi-grafo («27» non è un 8)", () => {
  // «2» a un tratto: arco alto, diagonale, base
  const two = (dx = 0): SimpleStroke => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI - (Math.PI * i) / 12;
      pts.push({ x: 40 + dx + 22 * Math.cos(a), y: 55 - 30 * Math.sin(a) });
    }
    for (let i = 1; i <= 8; i++) {
      pts.push({ x: 62 + dx - 22 * (i / 8), y: 55 + 65 * (i / 8) });
    }
    for (let i = 1; i <= 6; i++) {
      pts.push({ x: 40 + dx + 25 * (i / 6), y: 120 });
    }
    return { points: pts, lineWidth: 3 };
  };
  // «7» a un tratto: barra + diagonale
  const seven = (dx = 0): SimpleStroke => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i++) pts.push({ x: 95 + dx + 45 * (i / 8), y: 40 });
    for (let i = 1; i <= 8; i++) pts.push({ x: 140 + dx - 30 * (i / 8), y: 40 + 85 * (i / 8) });
    return { points: pts, lineWidth: 3 };
  };

  it("«27» con le cifre SEPARATE (colonna vuota interna) → null, non «8»", () => {
    const v = eightOrNineFromInk([two(0), seven(0)]);
    expect(v).toBeNull();
  });

  it("«27» compatto (wh ~1,15) resta sotto il limite glifo singolo ma la colonna vuota lo esclude", () => {
    // cifre ravvicinate: il «7» parte dove finisce il «2»
    const v = eightOrNineFromInk([two(0), seven(-12)]);
    expect(v).toBeNull();
  });

  it("«88» (due anelli affiancati) → null, non «8» unico", () => {
    const ring = (cx: number): SimpleStroke => {
      const pts: { x: number; y: number }[] = [];
      for (let a = 90; a <= 450; a += 30) {
        const rad = (a * Math.PI) / 180;
        pts.push({ x: cx + 20 * Math.cos(rad), y: 80 + 40 * Math.sin(rad) });
      }
      return { points: pts, lineWidth: 3 };
    };
    expect(eightOrNineFromInk([ring(45), ring(105)])).toBeNull();
  });

  it("un 8 VERO a un tratto resta «8» (nessuna colonna vuota interna)", () => {
    const cx = 60, cyT = 50, ryT = 36, rT = 22, cyB = 105, ryB = 40, rB = 26;
    const pts: { x: number; y: number }[] = [];
    for (let a = 90; a <= 450; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rT * Math.cos(rad), y: cyT + ryT * Math.sin(rad) });
    }
    for (let a = -90; a >= -450; a -= 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rB * Math.cos(rad), y: cyB + ryB * Math.sin(rad) });
    }
    expect(eightOrNineFromInk([{ points: pts, lineWidth: 3 }])).toBe("8");
  });

  it("un 9 VERO (anello + gambo) resta «9»", () => {
    const cx = 60, cyT = 55, ryT = 38, rT = 24;
    const pts: { x: number; y: number }[] = [];
    for (let a = 90; a <= 450; a += 30) {
      const rad = (a * Math.PI) / 180;
      pts.push({ x: cx + rT * Math.cos(rad), y: cyT + ryT * Math.sin(rad) });
    }
    pts.push({ x: cx + 20, y: 100 });
    pts.push({ x: cx + 18, y: 135 });
    expect(eightOrNineFromInk([{ points: pts, lineWidth: 3 }])).toBe("9");
  });
});

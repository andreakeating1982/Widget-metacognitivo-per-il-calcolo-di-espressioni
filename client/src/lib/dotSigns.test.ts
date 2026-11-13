import { describe, expect, it } from "vitest";
import { rewriteDotSigns, rescueLoneDotSign } from "./dotSigns";
import type { SimpleStroke } from "./dotSigns";

const dot = (x: number, y: number): SimpleStroke => ({
  points: [{ x: x - 2, y: y - 2 }, { x: x + 2, y: y + 2 }],
  lineWidth: 2,
});

/** Cifra sintetica: un "quadrato" alto ~60 px (tratto alto, non puntino) */
const digit = (x0: number, x1: number, y0: number, y1: number): SimpleStroke => ({
  points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
  lineWidth: 3,
});

describe("rewriteDotSigns — guardianie anti-coppie-false", () => {
  it("« : » con puntini MARCATI (h≈28) e gap largo (dy≈70): riconosciuto (27/9-octies)", () => {
    const bigDot = (x: number, y: number): SimpleStroke => ({
      points: [{ x: x - 14, y: y - 14 }, { x: x + 14, y: y + 14 }],
      lineWidth: 3,
    });
    const r = rewriteDotSigns([
      digit(100, 140, 40, 120),
      bigDot(150, 70),
      bigDot(150, 140),
      digit(160, 200, 40, 120),
    ]);
    expect(r.colons).toBe(1);
    expect(r.loneDots).toBe(0);
  });

  it("« : » scritto GRANDE (gap 80, quasi tutta l'altezza delle cifre): riconosciuto (27/9-octies)", () => {
    const r = rewriteDotSigns([
      digit(100, 140, 40, 140),
      dot(150, 72),
      dot(150, 152),
      digit(160, 200, 40, 140),
    ]);
    expect(r.colons).toBe(1);
    expect(r.loneDots).toBe(0);
  });

  it("« : » scritto storto (dx≈22 tra i centri): riconosciuto (27/9-octies)", () => {
    const r = rewriteDotSigns([
      digit(100, 140, 40, 120),
      dot(148, 85),
      dot(170, 105),
      digit(190, 230, 40, 120),
    ]);
    expect(r.colons).toBe(1);
    expect(r.loneDots).toBe(0);
  });

  it("due puntini MARCATI con una cifra in mezzo NON formano un « : » (guardia resta)", () => {
    const bigDot = (x: number, y: number): SimpleStroke => ({
      points: [{ x: x - 14, y: y - 14 }, { x: x + 14, y: y + 14 }],
      lineWidth: 3,
    });
    const r = rewriteDotSigns([
      digit(100, 140, 40, 120),
      bigDot(150, 70),
      bigDot(150, 140),
      digit(145, 155, 40, 120), // tratto alto che copre l'intervallo x dei puntini
      digit(160, 200, 40, 120),
    ]);
    expect(r.colons).toBe(0);
    // 5/10 notte: un tratto che passa NEL MEZZO del riquadro di un «puntino» (qui quello ALTO,
    // y 56–84, attraversato dall'asta 40–120) fa parte di un glifo: resta nell'inchiostro. Il
    // puntino BASSO (y 126–154, sotto l'asta) non è toccato e resta un puntino.
    expect(r.loneDots).toBe(1);
    expect(r.strokes.length).toBe(4);
  });

  it("la «L» del 4 (diagonale + base) attraversata dall'asta all'85% NON è un puntino (5/10 notte)", () => {
    // «4» in due tratti: L = diagonale giù-sinistra poi base verso destra; asta verticale che
    // attraversa la base vicino alla sua fine (né giunzione, né incrocio «interno a entrambi»)
    const ell: SimpleStroke = {
      points: [
        { x: 47, y: 56 }, { x: 40, y: 68 }, { x: 31, y: 82 },
        { x: 40, y: 84 }, { x: 50, y: 85 }, { x: 56, y: 86 },
      ],
      lineWidth: 3,
    };
    const stem: SimpleStroke = {
      points: [{ x: 48, y: 50 }, { x: 48, y: 70 }, { x: 48, y: 98 }],
      lineWidth: 3,
    };
    const r = rewriteDotSigns([digit(10, 30, 50, 98), ell, stem, digit(70, 95, 50, 98)]);
    expect(r.loneDots).toBe(0);
    expect(r.strokes.length).toBe(4);
  });

  it("due-punti come item di POSIZIONE: niente barra sintetica per il modello (5/10 notte)", () => {
    const r = rewriteDotSigns([
      digit(100, 140, 40, 120),
      dot(150, 85),
      dot(150, 105),
      digit(160, 200, 40, 120),
    ]);
    expect(r.colons).toBe(1);
    expect(r.divCenters).toHaveLength(1);
    expect(r.divCenters[0]).toBeCloseTo(150, 0);
    // restano SOLO le due cifre: i puntini sono tolti e non c'è nessuna barra «/»
    expect(r.strokes).toHaveLength(2);
  });

  it("un « : » vero tra due cifre viene riconosciuto", () => {
    // cifre 40..120, puntini a 85 e 105 (zona bassa, dentro l'altezza)
    const r = rewriteDotSigns([
      digit(100, 140, 40, 120),
      dot(150, 85),
      dot(150, 105),
      digit(160, 200, 40, 120),
    ]);
    expect(r.colons).toBe(1);
    expect(r.loneDots).toBe(0);
  });

  it("puntino + apice piccolo in alto NON formano un due punti (guardia altezza)", () => {
    // il puntino di «2·2³» e un tratto piccolo alto vicino (zona apice)
    const r = rewriteDotSigns([
      digit(200, 240, 60, 120),
      dot(250, 100), // · al centro
      dot(262, 55), // tratto piccolo di un apice, ben sopra
      digit(255, 290, 60, 120),
    ]);
    expect(r.colons).toBe(0);
  });

  it("due puntini con una cifra IN MEZZO non formano un due punti (guardia ingombro)", () => {
    const r = rewriteDotSigns([
      digit(100, 140, 40, 120),
      dot(150, 85),
      dot(152, 105), // sotto, ma tra i due c'è la cifra 160..200? no: qui il blocco è dato dal tratto sotto
      digit(145, 155, 40, 120), // tratto alto che copre l'intervallo x dei puntini
    ]);
    expect(r.colons).toBe(0);
    expect(r.loneDots).toBe(2);
  });

  // ⚠️ 5/10: «la moltiplicazione a puntino viene trascritta come una
  // piccola X». Prima il puntino veniva SOSTITUITO nell'inchiostro da una
  // croce «×» sintetica (che il modello leggeva come la LETTERA x); ora il
  // puntino viene TOLTO e «\cdot» reinserito via ancora nel hook.
  describe("puntino di moltiplicazione tolto dall'inchiostro (5/10)", () => {
    it("un puntino isolato (·) viene TOLTO: loneDots = 1, anchor al centro del puntino", () => {
      const r = rewriteDotSigns([
        digit(200, 240, 40, 120),
        dot(255, 85),
        digit(270, 310, 40, 120),
      ]);
      expect(r.colons).toBe(0);
      expect(r.loneDots).toBe(1);
      expect(r.dots).toEqual([{ cx: 255 }]);
      // nell'inchiostro restano SOLE le due cifre: nessuna croce
      expect(r.strokes).toHaveLength(2);
    });

    it("due puntini isolati (2·3·4): due ancore, nessuna croce", () => {
      const r = rewriteDotSigns([
        digit(100, 140, 40, 120),
        dot(155, 85),
        digit(170, 210, 40, 120),
        dot(225, 85),
        digit(240, 280, 40, 120),
      ]);
      expect(r.loneDots).toBe(2);
      expect(r.dots.map((d) => d.cx)).toEqual([155, 225]);
      expect(r.strokes).toHaveLength(3);
    });

    it("il puntino tra i due di un « : » NON è isolato: nessuna ancora", () => {
      const r = rewriteDotSigns([
        digit(100, 140, 40, 120),
        dot(158, 85),
        dot(158, 105),
        digit(172, 212, 40, 120),
      ]);
      expect(r.colons).toBe(1);
      expect(r.loneDots).toBe(0);
      expect(r.dots).toEqual([]);
    });
  });
});

describe("due punti tra parentesi quadre (segnalazione 26/9)", () => {
  /** Quadra: tratto verticale alto (y 20–130) */
  const bracket = (x: number): SimpleStroke => ({
    points: [{ x, y: 20 }, { x, y: 130 }],
    lineWidth: 3,
  });
  /** Punto «marcato»: più grande di un puntino normale (h≈20 px) */
  const bigDot = (x: number, y: number): SimpleStroke => ({
    points: [{ x: x - 4, y: y - 10 }, { x: x + 4, y: y + 10 }],
    lineWidth: 4,
  });

  it("«] : [» con punti marcati (h≈20) viene riconosciuto", () => {
    // quadra | punti grandi | quadra: le quadre ai FIANCHI non devono
    // bloccare l'accoppio (non attraversano l'intervallo dei centri) e i
    // punti grandi devono qualificare come piccoli segni
    const r = rewriteDotSigns([
      bracket(100),
      bigDot(115, 82),
      bigDot(115, 104),
      bracket(132),
    ]);
    expect(r.colons).toBe(1);
    expect(r.loneDots).toBe(0);
  });

  it("«] : [» tra cifre complete viene riconosciuto", () => {
    const r = rewriteDotSigns([
      bracket(100),
      digit(105, 145, 40, 120),
      dot(158, 85),
      dot(158, 105),
      digit(172, 212, 40, 120),
      bracket(220),
    ]);
    expect(r.colons).toBe(1);
  });

  it("GUARDIA 3: apice sospeso sopra il suo numero + puntino non formano «:»", () => {
    // quadra alta alza tallTop: l'apice (cy 50) passa la guardia 1, ma
    // sta SOPRA la x della sua cifra → non è un due punti
    const r = rewriteDotSigns([
      bracket(100),
      digit(200, 240, 60, 120),
      dot(237, 50), // apice (piccolo, sopra la cifra)
      dot(250, 95), // · di moltiplicazione
    ]);
    expect(r.colons).toBe(0);
  });

  it("GUARDIA 3 con tolleranza: « : » stretto fra le quadre resta valido anche se gli ingombri si toccano", () => {
    // quadra larga (100..110) e punto alto con centro FUORI ma ingombro
    // che tocca la quadra: il centro è ciò che conta (segnalazione 26/9:
    // «] : [» scartato e letto «V» dal modello)
    const nearBracket: SimpleStroke = {
      points: [{ x: 106, y: 80 }, { x: 114, y: 86 }], // bbox tocca x=110 della quadra, centro x=110? no: 110 è il bordo… centro 110
      lineWidth: 3,
    };
    const r = rewriteDotSigns([
      { points: [{ x: 100, y: 20 }, { x: 110, y: 130 }], lineWidth: 3 }, // quadra larga
      nearBracket,
      dot(112, 105),
    ]);
    expect(r.colons).toBe(1);
  });

  it("il puntino isolato viene TOLTO dall'inchiostro con anchor a (255, 85) — 5/10, niente più croce «×» letta come lettera x", () => {
    const r = rewriteDotSigns([
      digit(200, 240, 40, 120),
      dot(255, 85),
      digit(270, 310, 40, 120),
    ]);
    expect(r.loneDots).toBe(1);
    // il puntino originale NON è più nell'inchiostro e NON viene sostituito
    // da nulla: «\cdot» viene reinserito nel LaTeX via ancora (hook)
    expect(r.dots).toEqual([{ cx: 255 }]);
    expect(r.strokes).toHaveLength(2); // solo le due cifre
  });

  it("un trattino piatto (meno) NON viene sostituito da croce", () => {
    // segnalazione 26/9 «terrificante»: i trattini meno corti diventavano
    // palloni letti come lettere («o», «cos»)
    const dash: SimpleStroke = {
      points: [{ x: 250, y: 85 }, { x: 270, y: 85 }], // w 20, h 0 → rapporto ∞
      lineWidth: 3,
    };
    const r = rewriteDotSigns([
      digit(200, 240, 40, 120),
      dash,
      digit(280, 320, 40, 120),
    ]);
    expect(r.loneDots).toBe(0);
    expect(r.strokes).toContain(dash); // il trattino resta com'è
  });

  it("loneDots ignora i segni in zona apice (non fanno scattare il soccorso)", () => {
    // solo un tratto piccolo in ALTO (apice) e una barra «/» disegnata:
    // nessun puntino in zona riga → il soccorso non deve partire
    const r = rewriteDotSigns([
      digit(100, 140, 40, 120),
      dot(150, 55), // apice piccolo in alto
      digit(160, 200, 40, 120),
    ]);
    expect(r.colons).toBe(0);
    expect(r.loneDots).toBe(0);
  });
});

describe("rescueLoneDotSign — il puntino letto come barra/div diventa moltiplicazione", () => {
  it("un solo / nel testo + un solo puntino disegnato → \\cdot", () => {
    const out = rescueLoneDotSign("2 / 2^{3}", { colons: 0, divSigns: 0, loneDots: 1 });
    expect(out).toContain("\\cdot");
    expect(out).not.toContain("/");
  });

  it("un solo : (modello senza barra) + un solo puntino → \\cdot", () => {
    const out = rescueLoneDotSign("2 : 2^{3}", { colons: 0, divSigns: 0, loneDots: 1 });
    expect(out).toContain("\\cdot");
    expect(out).not.toContain(":");
  });

  it("\\div letto dal modello viene prima normalizzato e poi soccorso", () => {
    const out = rescueLoneDotSign("2 \\div 2^{3}", { colons: 0, divSigns: 0, loneDots: 1 });
    expect(out).toContain("\\cdot");
  });

  it("con un : vero disegnato (colons=1) NON tocca nulla", () => {
    const out = rescueLoneDotSign("3 : 4", { colons: 1, divSigns: 0, loneDots: 0 });
    expect(out).toBe("3 : 4");
  });

  it("con più segni di divisione NON tocca nulla (ambiguo)", () => {
    const out = rescueLoneDotSign("48 : 6 + 8 / 2", { colons: 0, divSigns: 0, loneDots: 1 });
    expect(out).toBe("48 : 6 + 8 / 2");
  });

  it("senza puntini disegnati NON tocca nulla (barra vera tracciata)", () => {
    const out = rescueLoneDotSign("48 / 6", { colons: 0, divSigns: 0, loneDots: 0 });
    expect(out).toBe("48 / 6");
  });
});

describe("uguale piccolo NON è un due punti (segnalazione 27/9)", () => {
  /** Barretta piatta: larghezza ~20 px, spessore ~0 (uguale piccolo) */
  const flatBar = (x0: number, x1: number, y: number, y1 = y): SimpleStroke => ({
    points: [{ x: x0, y }, { x: x1, y: y1 }],
    lineWidth: 3,
  });

  it("due barrette piatte impilate (uguale piccolo) NON formano un « : »: restano per rewriteEqualSigns", () => {
    const r = rewriteDotSigns([
      digit(40, 80, 40, 120),
      flatBar(120, 140, 62),
      flatBar(120, 140, 78),
      digit(210, 250, 40, 120),
    ]);
    expect(r.colons).toBe(0);
    expect(r.divSigns).toBe(0);
  });

  it("un trattino meno piatto e corto non diventa un puntino · (nessuna croce)", () => {
    const r = rewriteDotSigns([
      digit(40, 80, 40, 120),
      flatBar(120, 142, 80, 87),
      digit(210, 250, 40, 120),
    ]);
    expect(r.loneDots).toBe(0);
  });

  it("un « : » vero con puntini tondi marcati funziona ancora", () => {
    const roundDot = (x: number, y: number): SimpleStroke => ({
      points: [
        { x: x - 8, y: y - 8 }, { x: x + 8, y: y - 8 },
        { x: x + 8, y: y + 8 }, { x: x - 8, y: y + 8 },
      ],
      lineWidth: 3,
    });
    const r = rewriteDotSigns([
      digit(40, 80, 40, 120),
      roundDot(150, 70),
      roundDot(150, 100),
      digit(210, 250, 40, 120),
    ]);
    expect(r.colons).toBe(1);
  });
});

describe("l'apice ² NON è un puntino isolato (segnalazione 27/9-decies, pezzo 2 reale)", () => {
  // Geometria REALE del pezzo 2 ((2²)² scritto a mano): il ² interno è un
  // glifo tondo 22×22 px in alto; con le parentesi alte ~100 px la vecchia
  // guardia 0.32×medH lo sfaldava per meno di 1 px e veniva SOSTITUITO
  // dalla croce × sintetica (DUE tratti stesso bbox) → modello leggeva
  // «22» → (2²²)².
  const supGlyph = (x0: number, y0: number): SimpleStroke => ({
    points: [
      { x: x0, y: y0 }, { x: x0 + 22, y: y0 },
      { x: x0 + 22, y: y0 + 22 }, { x: x0, y: y0 + 22 },
    ],
    lineWidth: 3,
  });

  it("(2²)²: il ² interno resta nell'inchiostro, nessuna croce sintetica", () => {
    const r = rewriteDotSigns([
      digit(156, 210, 43, 91), // cifra 2
      digit(133, 157, 15, 115), // «(»
      supGlyph(211, 22), // ² interno
      digit(230, 254, 9, 112), // «)»
      supGlyph(267, 11), // ² esterno
    ]);
    expect(r.loneDots).toBe(0);
    expect(r.strokes).toHaveLength(5); // NESSUNA sostituzione con ×
    // i bbox degli apici sono INVARIATI (non croci sintetiche)
    expect(r.strokes.some((s) => s.lineWidth === 4)).toBe(false);
  });

  it("il puntino di moltiplicazione a metà riga resta un puntino isolato", () => {
    const r = rewriteDotSigns([
      digit(40, 80, 40, 120),
      dot(150, 82), // centro riga: y1 = 84 > medCy ≈ 80
      digit(210, 250, 40, 120),
    ]);
    expect(r.loneDots).toBe(1);
  });
});

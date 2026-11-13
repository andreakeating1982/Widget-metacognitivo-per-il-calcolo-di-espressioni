import { describe, it, expect } from "vitest";
import {
  analyzeExpression,
  normalizeInput,
  polyToLatex,
  ExprError,
  termToLatex,
  isUserSumCorrect,
  buildVerificationValues,
  substituteAndEvaluate,
  fr,
  repairDivisionSigns,
  parsePolyLoose,
  polyEquals,
  auditProgressivita,
  fractionStepLatex,
  latexValue,
} from "./espressioni";

function final(raw: string): string {
  const a = analyzeExpression(raw);
  return a.finalLatex;
}

describe("normalizeInput", () => {
  it("taglia la parte dopo l'uguale", () => {
    const a = analyzeExpression("3x + 2x = ?");
    expect(a.finalLatex).toBe("5x");
  });

  it("GRAFFE LATEX (4/10): \\{ \\} e \\lbrace \\rbrace diventano parentesi dell'utente", () => {
    // il modello legge la graffa disegnata come comando LaTeX: al momento
    // del calcolo deve diventare { } (tokenizer: parentesi col tipo)
    expect(normalizeInput("\\{2+3\\}")).toBe("{2+3}");
    expect(normalizeInput("\\lbrace9\\rbrace")).toBe("{9}");
    expect(normalizeInput("\\left\\{x\\right\\}")).toBe("{x}");
  });
});

describe("espressioni numeriche (mappa PDF)", () => {
  it("esempio della mappa: 3+4−(100:10)−5+(4−2) = −6", () => {
    const a = analyzeExpression("3 + 4 - (100 : 10) - 5 + (4 - 2)");
    expect(a.hasVars).toBe(false);
    expect(a.finalLatex).toBe("-6");
    // PASSO 1: due parentesi risolte col loro valore (la divisione 100:10
    // dentro le parentesi è un passo «paren-div» dal 19/10)
    const valueSteps = a.steps.filter((s) => s.kind === "paren-value" || s.kind === "div-num" || s.kind === "paren-div");
    expect(valueSteps).toHaveLength(2);
    expect(valueSteps[0].detail).toContain("100");
    // poi il calcolo in ordine da sinistra a destra
    expect(a.steps.some((s) => s.kind === "fold-add-num")).toBe(true);
  });

  it("divisione e prodotto fuori parentesi", () => {
    // i valori non interi GIÀ CALCOLATI si mostrano come frazione impilata
    // (come scritta dall'utente nel verde); i due punti solo per le divisioni
    // NON ancora risolte
    expect(final("2 * 3 : 4")).toBe("\\dfrac{3}{2}");
  });

  it("numeri negativi intermedi", () => {
    expect(final("5 - 8")).toBe("-3");
  });
});

describe("monomi", () => {
  it("prodotto di monomi: 2x·3x = 6x²", () => {
    expect(final("2x * 3x")).toBe("6x^{2}");
  });

  it("potenza di monomio: (2x)^2 = 4x²", () => {
    expect(final("(2x)^{2}")).toBe("4x^{2}");
  });

  it("potenza di variabile: x^3 · x^2 = x⁵", () => {
    expect(final("x^{3} \\cdot x^{2}")).toBe("x^{5}");
  });

  it("coefficiente frazionario: x/2 · x = x²/2", () => {
    expect(final("x/2 * x")).toBe("\\dfrac{x^{2}}{2}");
  });

  it("divisione per numero distribuita: (4x+6):2", () => {
    expect(final("(4x + 6) : 2")).toBe("2x + 3");
  });
});

describe("espressioni letterali con parentesi", () => {
  it("2x + 3y − (x − y) = x + 4y", () => {
    const a = analyzeExpression("2x + 3y - (x - y)");
    expect(a.finalLatex).toBe("x + 4y");
    expect(a.groups.map((g) => g.key)).toEqual(["x^1", "y^1"]);
    expect(a.groups[0].termLatexes).toEqual(["2x", "-x"]);
    expect(a.groups[1].termLatexes).toEqual(["3y", "y"]);
  });

  it("segno meno davanti alla parentesi: −(a+b)+(a−b) = −2b", () => {
    expect(final("-(a + b) + (a - b)")).toBe("-2b");
  });

  it("prodotto monomio × polinomio: 3x(2x − 5) = 6x² − 15x", () => {
    const a = analyzeExpression("3x(2x - 5)");
    expect(a.finalLatex).toBe("6x^{2} - 15x");
    expect(a.steps.some((s) => s.kind === "paren-mul")).toBe(true);
  });

  it("quadrato di binomio: (x+1)^2 = x²+2x+1", () => {
    const a = analyzeExpression("(x + 1)^{2}");
    expect(a.finalLatex).toBe("x^{2} + 2x + 1");
  });

  it("parentesi annidate", () => {
    expect(final("2(x + (3x - x))")).toBe("6x");
  });

  it("termini simili che si annullano", () => {
    expect(final("2x + 3x - 5x")).toBe("0");
  });

  it("somma di polinomi con due lettere", () => {
    expect(final("(2a + 3b) + (a - b)")).toBe("3a + 2b");
  });

  it("monomio già singolo senza parentesi", () => {
    const a = analyzeExpression("4x");
    expect(a.finalLatex).toBe("4x");
    expect(a.groups).toHaveLength(1);
    expect(a.groups[0].needsInput).toBe(false);
  });

  it("espressione già senza simili", () => {
    const a = analyzeExpression("2x + 3y");
    expect(a.finalLatex).toBe("2x + 3y");
    expect(a.groups.every((g) => !g.needsInput)).toBe(true);
  });
});

describe("verifica per sostituzione", () => {
  it("originale e risultato coincidono sostituendo i valori", () => {
    const a = analyzeExpression("2x + 3y - (x - y)");
    const { values } = buildVerificationValues(a.ast);
    expect(substituteAndEvaluate(a.ast, values)).toBe(
      substituteAndEvaluate(
        { k: "add", a: a.ast, b: { k: "num", v: fr(0) } } as any,
        values
      )
    );
  });
});

describe("errori chiari", () => {
  it("divisione polinomio : monomio → 2 + 1/x (punto 1, 25/10: era errore)", () => {
    const a = analyzeExpression("(2x + 1) : x");
    expect(a.finalLatex).toBe("2 + \\dfrac{1}{x}");
  });

  it("parentesi non bilanciate", () => {
    expect(() => analyzeExpression("(2x + 3")).toThrow(ExprError);
    expect(() => analyzeExpression("2x + 3)")).toThrow(ExprError);
  });

  it("stringa vuota", () => {
    expect(() => analyzeExpression("   ")).toThrow(ExprError);
  });

  it("caratteri non ammessi", () => {
    expect(() => analyzeExpression("2x + #")).toThrow(ExprError);
  });
});

describe("confronto input studente", () => {
  it("accetta decimali entro 2 decimali", () => {
    expect(isUserSumCorrect(-6, fr(-6))).toBe(true);
    expect(isUserSumCorrect(5, fr(5))).toBe(true);
    expect(isUserSumCorrect(4, fr(5))).toBe(false);
    expect(isUserSumCorrect(0.83, fr(5, 6))).toBe(true);
  });
});

describe("repairDivisionSigns (segno di divisione scritto a mano)", () => {
  it("converte ÷, =, .., \\cdot\\cdot e \\cdots in :", () => {
    expect(repairDivisionSigns("3 \\cdot (21 \\div 2)")).toBe("3 \\cdot (21 : 2)");
    expect(repairDivisionSigns("3 \\cdot (21 = 2)")).toBe("3 \\cdot (21 : 2)");
    expect(repairDivisionSigns("3 \\cdot (21..2)")).toBe("3 \\cdot (21:2)");
    expect(repairDivisionSigns("3 \\cdot (21\\cdot\\cdot2)")).toBe("3 \\cdot (21:2)");
    expect(repairDivisionSigns("21 \\cdots 2")).toBe("21 : 2");
  });

  it("l'espressione riparata si analizza come divisione", () => {
    const a = analyzeExpression(repairDivisionSigns("3 \\cdot (21 = 2) + 3 - 7 \\cdot (2 \\cdot 3)"));
    expect(a.originalLatex).toContain("21 : 2");
  });

  it("l'uguale FINALE resta uguale (l'utente chiude l'espressione con =)", () => {
    // segnalazione 26/9: «…]=» diventava «…]:» e l'espressione si rompeva
    expect(repairDivisionSigns("[-2(2^2:2)]:[-3(3\\cdot3^3)]=")).toBe(
      "[-2(2^2:2)]:[-3(3\\cdot3^3)]=",
    );
    expect(repairDivisionSigns("21=2")).toBe("21 : 2"); // = interno → divisione
    expect(repairDivisionSigns("3\\times3")).toBe("3\\cdot3"); // croce sintetica → ·
    expect(repairDivisionSigns("(3+4)="))
      .toContain("="); // = finale anche dopo parentesi
  });

  it("REGOLA 27/9-ter: moltiplicazione SEMPRE puntino, mai x/×", () => {
    // «x» fra due cifre = moltiplicazione disegnata letta come lettera
    expect(repairDivisionSigns("2x3")).toBe("2 \\cdot 3");
    expect(repairDivisionSigns("12x34")).toBe("12 \\cdot 34");
    expect(repairDivisionSigns("2 x 3")).toBe("2 \\cdot 3");
    expect(repairDivisionSigns("2x3x4")).toBe("2 \\cdot 3 \\cdot 4");
    expect(repairDivisionSigns("2 \\times 3")).toBe("2 \\cdot 3");
    expect(repairDivisionSigns("2 \\bullet 3")).toBe("2 \\cdot 3");
    // le x laterali restano VARIABILI legittime (monomi)
    expect(repairDivisionSigns("3x+2")).toBe("3x+2");
    expect(repairDivisionSigns("2x(3+1)")).toBe("2x(3+1)");
    expect(repairDivisionSigns("x3")).toBe("x3");
    expect(repairDivisionSigns("2xy3")).toBe("2xy3");
  });
});

describe("stampa LaTeX", () => {
  it("monomio con coefficiente frazionario e parte letterale", () => {
    expect(termToLatex({ c: fr(3, 2), vars: [{ v: "x", e: 2 }] })).toBe("\\dfrac{3x^{2}}{2}");
    expect(termToLatex({ c: fr(-1), vars: [{ v: "y", e: 1 }] })).toBe("-y");
  });

  it("polinomio ordinato", () => {
    expect(polyToLatex([
      { c: fr(6), vars: [{ v: "x", e: 2 }] },
      { c: fr(-15), vars: [{ v: "x", e: 1 }] },
    ])).toBe("6x^{2} - 15x");
  });
});

describe("parentesi quadre e graffe", () => {
  it("la quadra scritta dall'utente NON si trasforma in tonda", () => {
    const a = analyzeExpression("2·[3+1]");
    expect(a.originalLatex).toContain("\\left[");
    expect(a.originalLatex).toContain("\\right]");
    expect(a.originalLatex).not.toContain("\\left(");
    expect(a.finalLatex).toBe("8");
  });

  it("la graffa scritta dall'utente NON si trasforma in tonda", () => {
    const a = analyzeExpression("2·{3+1}");
    expect(a.originalLatex).toContain("\\left\\{");
    expect(a.originalLatex).toContain("\\right\\}");
    expect(a.finalLatex).toBe("8");
  });

  it("le graffe LaTeX \{ \} si comportano come graffe", () => {
    const a = analyzeExpression("2·\\left\\{3+1\\right\\}");
    expect(a.originalLatex).toContain("\\left\\{");
    expect(a.finalLatex).toBe("8");
  });

  it("le tonde restano tonde e i tipi misti si rispettano", () => {
    const a = analyzeExpression("2·(3+1)");
    expect(a.originalLatex).toContain("\\left(");
    const b = analyzeExpression("([5−2])·3");
    expect(b.originalLatex).toContain("\\left[5 - 2\\right]");
    expect(b.finalLatex).toBe("9");
  });

  it("i passi mostrano la quadra dell'utente anche nei dettagli", () => {
    const a = analyzeExpression("2·[3+1]");
    const pv = a.steps.find((s) => s.kind === "paren-value");
    expect(pv?.opLatex).toContain("\\left[");
    expect(pv?.opLatex).not.toContain("\\left(");
  });
});

describe("valori risolti in frazione impilata nei passi successivi", () => {
  it("dopo 2 : 4 = 1/2 i passi successivi mostrano \\dfrac{1}{2}, non 1 : 2", () => {
    const a = analyzeExpression("9:[-(2:4)]");
    // la divisione NON ancora risolta resta con i due punti
    expect(a.originalLatex).toContain("2 : 4");
    // le Divisioni con valori già sostituiti usano la frazione impilata
    const afterDiv = a.steps.filter((s) => s.kind !== "div-num");
    for (const s of afterDiv) {
      if (s.latex) expect(s.latex).not.toContain("1 : 2");
      if (s.detail) expect(s.detail).not.toContain("1 : 2");
    }
    expect(a.finalLatex).toBe("-18");
  });

  it("la catena numerica mostra frazioni impilate", () => {
    const a = analyzeExpression("1:2+1:3");
    const sub = a.steps.find((s) => s.kind === "fold-add-num");
    expect(sub?.opLatex).toContain("\\dfrac{1}{2}");
    expect(sub?.opLatex).toContain("\\dfrac{1}{3}");
    expect(sub?.opLatex).not.toContain("1 : 2");
  });
});

describe("risultato di divisioni non esatte (frazione impilata)", () => {
  it("frazione impilata SEMPRE, mai decimale con la virgola (richiesta 27/9)", () => {
    expect(fractionStepLatex(fr(1, 6), false)).toBe("\\dfrac{1}{6}");
    expect(fractionStepLatex(fr(1, 6), true)).toBe("\\dfrac{1}{6}");
    expect(fractionStepLatex(fr(-1, 6), true)).toBe("-\\dfrac{1}{6}");
    expect(fractionStepLatex(fr(9, 5), true)).toBe("\\dfrac{9}{5}");
  });
});

describe("prodotto dentro le parentesi: MAI calcolato da solo (19/10)", () => {
  /** Replica la selezione del punto 2 in EspressioniExercises.tsx */
  function punto2(steps: ReturnType<typeof analyzeExpression>["steps"]) {
    const parenKinds = ["paren-value", "paren-sign", "paren-mul", "paren-prod", "paren-unwrap"];
    let lastParenIdx = 0;
    for (let i = steps.length - 1; i > 0; i--) {
      if (parenKinds.includes(steps[i]!.kind)) {
        lastParenIdx = i;
        break;
      }
    }
    return steps.slice(1, lastParenIdx + 1);
  }
  it("(1/2·[1/5]) : 1/3: il prodotto 1/2·1/5 è un passo del punto 2 (da svolgere), non calcolato da solo", () => {
    const a = analyzeExpression("(\\frac{1}{2}\\cdot[\\frac{1}{5}]) : \\frac{1}{3}");
    const p2 = punto2(a.steps);
    const mul = p2.find((s) => s.kind === "paren-prod");
    expect(mul).toBeDefined();
    expect(mul!.opLatex).toBe("\\dfrac{1}{2} \\cdot \\dfrac{1}{5}");
    expect(mul!.answer).toEqual({ n: 1, d: 10 });
    // l'operazione proposta allo studente è il PRODOTTO, non il valore già svolto
    expect(mul!.opLatex).not.toContain("\\dfrac{1}{10}");
  });
  it("(1/2·1/5) : 1/3 (senza quadre): stessa protezione", () => {
    const a = analyzeExpression("(\\frac{1}{2}\\cdot\\frac{1}{5}) : \\frac{1}{3}");
    const p2 = punto2(a.steps);
    expect(p2.some((s) => s.kind === "paren-prod" && s.answer && s.answer.n === 1 && s.answer.d === 10)).toBe(true);
  });
  it("2x·3x (letterale, dentro le parentesi): resta un passo mostrato, non saltato", () => {
    const a = analyzeExpression("(2x \\cdot 3x) : x");
    expect(a.steps.some((s) => s.kind === "paren-prod")).toBe(true);
    expect(a.finalLatex).toBe("6x");
  });
  it("9 : 5 (risultato diretto senza prodotti): comportamento invariato", () => {
    const a = analyzeExpression("9 : 5");
    expect(a.steps.every((s) => s.kind !== "paren-prod")).toBe(true);
    expect(a.finalLatex).toBe("\\dfrac{9}{5}");
  });
});

describe("divisione dentro le parentesi: MAI calcolata da solo (19/10)", () => {
  /** Replica la selezione del punto 2 in EspressioniExercises.tsx */
  function punto2(steps: ReturnType<typeof analyzeExpression>["steps"]) {
    const parenKinds = ["paren-value", "paren-sign", "paren-mul", "paren-prod", "paren-div", "paren-unwrap"];
    let lastParenIdx = 0;
    for (let i = steps.length - 1; i > 0; i--) {
      if (parenKinds.includes(steps[i]!.kind)) {
        lastParenIdx = i;
        break;
      }
    }
    return steps.slice(1, lastParenIdx + 1);
  }
  it("(3/7 : 9/14)² − 7/12·2: la divisione dentro la parentesi è un passo del punto 2", () => {
    const a = analyzeExpression("(\\frac{3}{7} : \\frac{9}{14})^2 - \\frac{7}{12} \\cdot 2");
    const p2 = punto2(a.steps);
    const div = p2.find((s) => s.kind === "paren-div");
    expect(div).toBeDefined();
    expect(div!.opLatex).toBe("\\dfrac{3}{7} : \\dfrac{9}{14}");
    expect(div!.answer).toEqual({ n: 2, d: 3 });
  });
  it("(3/7 : 9/14) : 1/3: divisione interna nel punto 2, esterna nel risultato finale", () => {
    const a = analyzeExpression("(\\frac{3}{7} : \\frac{9}{14}) : \\frac{1}{3}");
    const p2 = punto2(a.steps);
    expect(p2.some((s) => s.kind === "paren-div" && s.answer && s.answer.n === 2 && s.answer.d === 3)).toBe(true);
    expect(a.finalLatex).toBe("2");
  });
  it("9 : (3/7 : 9/14): divisione dentro le parentesi proposta nel punto 2", () => {
    const a = analyzeExpression("9 : (\\frac{3}{7} : \\frac{9}{14})");
    const p2 = punto2(a.steps);
    expect(p2.some((s) => s.kind === "paren-div")).toBe(true);
    expect(a.finalLatex).toBe("\\dfrac{27}{2}");
  });
  it("divisione ESTERNA per un numero: resta «div-num», comportamento invariato", () => {
    const a = analyzeExpression("9 : 5");
    expect(a.steps.some((s) => s.kind === "div-num")).toBe(true);
    expect(a.steps.every((s) => s.kind !== "paren-div")).toBe(true);
  });
});

describe("frazioni impilate riconosciute (7/10, richiesta esplicita)", () => {
  it("la frazione scritta a mano resta \\dfrac in OGNI passo, mai «a : b»", () => {
    const a = analyzeExpression("\\frac{1}{2}+2");
    expect(a.originalLatex).toBe("\\dfrac{1}{2} + 2");
    for (const s of a.steps) expect(s.latex).not.toContain(" : ");
    expect(a.finalLatex).toBe("\\dfrac{5}{2}");
  });
  it("segno meno: -\\frac{2}{5}+1 → -\\dfrac{2}{5} + 1 (mai \\dfrac{-2}{5})", () => {
    const a = analyzeExpression("-\\frac{2}{5}+1");
    expect(a.originalLatex).toBe("-\\dfrac{2}{5} + 1");
    expect(a.finalLatex).toBe("\\dfrac{3}{5}");
  });
  it("prodotto di frazioni: \\dfrac{2}{3}·\\dfrac{3}{4} con il puntino, mai giustapposte", () => {
    const a = analyzeExpression("\\frac{2}{3}\\cdot\\frac{3}{4}");
    expect(a.originalLatex).toBe("\\dfrac{2}{3} \\cdot \\dfrac{3}{4}");
    expect(a.finalLatex).toBe("\\dfrac{1}{2}");
  });
  it("frazioni con lettera: \\frac{x}{2}+\\frac{x}{3} impilate e risultato \\dfrac{5x}{6}", () => {
    const a = analyzeExpression("\\frac{x}{2}+\\frac{x}{3}");
    expect(a.originalLatex).toBe("\\dfrac{x}{2} + \\dfrac{x}{3}");
    expect(a.finalLatex).toBe("\\dfrac{5x}{6}");
    for (const s of a.steps) expect(s.latex).not.toContain(" : ");
  });
  it("le divisioni scritte con i DUE PUNTI restano «a : b» (invariate)", () => {
    const a = analyzeExpression("6 : 2");
    expect(a.originalLatex).toBe("6 : 2");
    expect(a.finalLatex).toBe("3");
  });
  it("\\dfrac e \\tfrac del modello si comportano come \\frac", () => {
    expect(analyzeExpression("\\dfrac{21}{2}").originalLatex).toBe("\\dfrac{21}{2}");
    expect(analyzeExpression("\\tfrac{1}{4}+\\frac{1}{4}").finalLatex).toBe("\\dfrac{1}{2}");
  });
});

describe("giro 29 — niente risultati pre-scritti nei passi non interattivi", () => {
  it("l'espressione della foto: i conti con lettere mostrano SOLO l'operazione", () => {
    const a = analyzeExpression("(3·x\u20444):(5x·1)");
    const nonInterattivi = a.steps.filter((s) => !(s.opLatex && s.answer) && s.detail.trim());
    for (const s of nonInterattivi) {
      expect(s.detail).not.toContain("=");
    }
    // le operazioni da svolgere restano (senza risultato)
    expect(a.steps.some((s) => s.detail === "5x \\cdot 1")).toBe(true);
    expect(a.steps.some((s) => s.detail === "3 \\cdot \\dfrac{x}{4}")).toBe(true);
    // la notazione della frazione impilata non è un conto: niente «x = x⁄4»
    expect(a.steps.some((s) => s.detail.includes("x} = \\dfrac{x}{4}"))).toBe(false);
  });

  it("(24/10, filosofia scaffolding) NESSUN passo contiene il risultato nel detail: «operazione = risultato» si ricostruisce solo dopo la risposta corretta", () => {
    const a = analyzeExpression("2·3+8:4");
    const interattivi = a.steps.filter((s) => s.opLatex && s.answer);
    expect(interattivi.length).toBeGreaterThan(0);
    for (const s of interattivi) expect(s.detail).not.toContain("=");
    const b = analyzeExpression("(3+51+3)");
    for (const s of b.steps) expect(s.detail).not.toContain("=");
  });

  it("divisione con lettere nel risultato: solo l'operazione", () => {
    const a = analyzeExpression("6x:2");
    const div = a.steps.find((s) => s.kind === "div-num" || s.kind === "div-mono");
    expect(div).toBeTruthy();
    expect(div!.detail).not.toContain("=");
    expect(div!.detail).toContain(":");
  });

  it("potenza con lettere: solo l'operazione (punto 3: pow-prod al posto dello sviluppo)", () => {
    const a = analyzeExpression("(2x)^2");
    const pow = a.steps.find((s) => s.kind === "pow-prod" || s.kind === "pow-term" || s.kind === "paren-prod" || s.kind === "paren-mul");
    expect(pow).toBeTruthy();
    expect(pow!.detail).not.toContain("=");
  });
});

describe("giro 30 — answerPoly: il risultato con lettere lo scrive lo studente", () => {
  it("parsePolyLoose accetta la notazione tastiera (regole giro 26)", () => {
    expect(parsePolyLoose("5x")).toEqual([{ c: fr(5), vars: [{ v: "x", e: 1 }] }]);
    expect(parsePolyLoose("3x/4")![0].c).toEqual(fr(3, 4));
    expect(parsePolyLoose("3x\u20444")!.length).toBe(1);
    expect(parsePolyLoose("a^2+2ab+b^2")!.length).toBe(3);
    expect(parsePolyLoose("-x+2")!.length).toBe(2);
    expect(parsePolyLoose("ciao!!!")).toBeNull();
    expect(parsePolyLoose("")).toBeNull();
  });

  it("polyEquals ignora l'ordine dei termini", () => {
    expect(polyEquals(parsePolyLoose("b^2+a^2+2ab")!, parsePolyLoose("a^2+2ab+b^2")!)).toBe(true);
    expect(polyEquals(parsePolyLoose("x+1")!, parsePolyLoose("x+2")!)).toBe(false);
  });

  it("i conti con lettere portano answerPoly (niente opLatex/answer)", () => {
    const a = analyzeExpression("(3·x\u20444):(5x·1)");
    const prod5x = a.steps.find((s) => s.detail === "5x \\cdot 1");
    expect(prod5x?.answerPoly).toBeTruthy();
    expect(polyEquals(prod5x!.answerPoly!, parsePolyLoose("5x")!)).toBe(true);
    expect(prod5x?.opLatex).toBeUndefined();
    const prod3x4 = a.steps.find((s) => s.detail === "3 \\cdot \\dfrac{x}{4}");
    expect(polyEquals(prod3x4!.answerPoly!, parsePolyLoose("3x/4")!)).toBe(true);
    // la divisione finale tra monomi (3x⁄4 : 5x = 3/20) resta numerica-interattiva
    const divFinale = a.steps.find((s) => s.kind === "div-mono");
    expect(divFinale?.answer).toBeTruthy();
  });

  it("divisione con lettere: answerPoly, dettaglio solo operazione", () => {
    const a = analyzeExpression("6x:2");
    const div = a.steps.find((s) => s.kind === "div-num");
    expect(polyEquals(div!.answerPoly!, parsePolyLoose("3x")!)).toBe(true);
    expect(div!.detail).not.toContain("=");
  });

  it("i passi numerici restano interattivi con opLatex+answer (nessuna regressione)", () => {
    const a = analyzeExpression("2·3+8:4");
    const interattivi = a.steps.filter((s) => s.opLatex && s.answer);
    expect(interattivi.length).toBeGreaterThan(0);
    for (const s of interattivi) expect(s.answerPoly).toBeUndefined();
  });
});

describe("giro 31 — sentinella: mai il passo dopo prima del risultato corretto", () => {
  it("auditProgressivita: zero violazioni su TUTTI i tipi di espressione", () => {
    const casi = [
      // numeriche con parentesi e catene
      "2·3+8:4", "(2+1)·3+8:4", "3 + 4 - (100 : 10) - 5 + (4 - 2)",
      "27 : 3 + 48 : 28", "3+2-5:2", "9 : 5", "1:2+1:3",
      // letterali: prodotti, divisioni, potenze, radici, distributiva
      "(3·x\u20444):(5x·1)", "2x·3x+x:2", "6x:2", "(2x + 1) : x",
      "(2x · 3x) : x", "(2x)^2", "(x + 1)^{2}", "3x(2x - 5)",
      "2x + 3y - (x - y)", "x^2+2x+1", "4x^2:2x",
      // radici e potenze letterali
      "√(4x^2)", "(3x)^2", "2·√(9)+x",
      // regola dei segni con lettere
      "3x-(2x-5)", "-(x-2)+4x",
      // fratte scritte dall'utente (non sono conti)
      "\\frac{x}{2}+\\frac{x}{3}", "\\dfrac{21}{2}",
      // quadre e graffe
      "([5−2])·3", "2·[3+1]", "2·{3+1}",
    ];
    const violazioni: string[] = [];
    for (const c of casi) {
      try {
        const a = analyzeExpression(c);
        for (const v of auditProgressivita(a.steps)) {
          violazioni.push(`${c} [passo ${v.indice} ${v.kind} «${v.detail}»]: ${v.motivo}`);
        }
      } catch {
        /* espressioni non valide: la sentinella non si applica */
      }
    }
    expect(violazioni).toEqual([]);
  });

  it("il distributivo paren×flat chiede il risultato allo studente (answerPoly)", () => {
    const a = analyzeExpression("3x(2x - 5)");
    const dist = a.steps.find((s) => s.kind === "paren-mul");
    expect(dist).toBeTruthy();
    expect(dist!.detail).not.toContain("=");
    expect(dist!.answerPoly).toBeTruthy();
  });
});

/* 26/10 — foto «3 radice di 15 data per sbagliata»: coefficiente davanti
   alla radice (moltiplicazione implicita). Il box rifiutava la risposta
   corretta perché latexValue("3\\sqrt{15}") era null. */
describe("latexValue: coefficiente davanti alla radice", () => {
  it("3√15 = 3·√15 (foto utente)", () => {
    const v = latexValue("3\\sqrt{15}");
    expect(v).not.toBeNull();
    expect(Math.abs(v! - 3 * Math.sqrt(15))).toBeLessThan(1e-9);
  });
  it("√15·3√15 = 45", () => {
    const v = latexValue("\\sqrt{15}\\cdot 3\\sqrt{15}");
    expect(v).not.toBeNull();
    expect(Math.abs(v! - 45)).toBeLessThan(1e-6);
  });
});

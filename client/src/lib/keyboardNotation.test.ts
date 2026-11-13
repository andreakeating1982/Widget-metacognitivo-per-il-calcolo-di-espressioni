import { describe, it, expect } from "vitest";
import {
  normalizeKeyboardNotation,
  normalizeKeyboardLive,
  normalizeKeyboardDisplayLive,
  normalizeKeyboardDisplayNotation,
  sanitizeLatexNotation,
  toDisplayNotation,
  keyboardNotationHint,
  keyboardDisplayHint,
} from "./keyboardNotation";
import { analyzeExpression } from "./espressioni";

describe("normalizeKeyboardNotation (giro 26, regole tastiera dell'app audio)", () => {
  it("conversioni complete", () => {
    expect(normalizeKeyboardNotation("[2+1 (4 : 2)]")).toBe("[2+1(4:2)]");
    expect(normalizeKeyboardNotation("3*4")).toBe("3·4");
    expect(normalizeKeyboardNotation("3/4")).toBe("3\u20444");
    expect(normalizeKeyboardNotation("(3/4)^2")).toBe("(3\u20444)^2");
    expect(normalizeKeyboardNotation("rad2 9")).toBe("√9");
    expect(normalizeKeyboardNotation("sqrt(16)")).toBe("√(16)");
    expect(normalizeKeyboardNotation("rad3 8")).toBe("∛8");
    expect(normalizeKeyboardNotation("rad4 16")).toBe("∜16");
    expect(normalizeKeyboardNotation("radq(x+1)")).toBe("√(x+1)");
  });

  it("asterisco → puntino, mai la lettera x; ÷ → due punti; meno unicode", () => {
    expect(normalizeKeyboardNotation("2*x")).toBe("2·x");
    expect(normalizeKeyboardNotation("6 ÷ 2")).toBe("6:2");
    expect(normalizeKeyboardNotation("1 − 2")).toBe("1-2");
  });

  it("i rapporti complessi restano con la barra (divisione)", () => {
    expect(normalizeKeyboardNotation("(x+1)/(2x-3)")).toBe("(x+1)/(2x-3)");
    expect(normalizeKeyboardNotation("x/2")).toBe("x\u20442");
  });

  it("(09/11) numeri periodici da tastiera: cifre + «per» → \overline{}", () => {
    expect(normalizeKeyboardNotation("0,3per")).toBe("0,\\overline{3}");
    expect(normalizeKeyboardNotation("1,3per")).toBe("1,\\overline{3}");
    expect(normalizeKeyboardNotation("0,1_6per")).toBe("0,1\\overline{6}");
    expect(normalizeKeyboardNotation("2,23per")).toBe("2,\\overline{23}");
    // il comando non sminchia parole: «per» seguito da lettere resta com'è
    expect(normalizeKeyboardNotation("0,3periodico")).toBe("0,3periodico");
  });

  it("(11/11) STANDARD CALCOLATRICE: radici da esponente frazionario", () => {
    expect(normalizeKeyboardNotation("(12)^(1/2)")).toBe("√(12)");
    // la barra nella base diventa frazione impilata (notazione dell'app)
    expect(normalizeKeyboardNotation("(8/27)^(1/3)")).toBe("∛(8\u204427)");
    expect(normalizeKeyboardNotation("(16)^(1/4)")).toBe("∜(16)");
    expect(normalizeKeyboardNotation("(5)^(1/7)")).toBe("\u2077√(5)");
    expect(normalizeKeyboardNotation("(a)^(-1/3)")).toBe("\u207b\u00b3√(a)");
    expect(normalizeKeyboardNotation("(25)^(0.5)")).toBe("√(25)");
    // l'esponente intero NEGATIVO non è una radice: resta potenza
    expect(normalizeKeyboardNotation("x^(-1)")).toBe("x^(-1)");
    // radice di radice: la base col livello annidato è presa per intero
    expect(normalizeKeyboardNotation("((4)^(1/2))^(1/3)")).toBe("∛(√(4))");
    // end-to-end col parser dell'app (radici ESATTE, regola didattica dell'app)
    expect(analyzeExpression(normalizeKeyboardNotation("(16)^(1/2)")).originalLatex).toContain("\\sqrt");
    expect(analyzeExpression(normalizeKeyboardNotation("(27)^(1/3)")).finalLatex).toBe("3");
  });

  it("(11/11) STANDARD CALCOLATRICE: decimali col punto e periodici coi puntini", () => {
    expect(normalizeKeyboardNotation("0.75")).toBe("0,75");
    expect(normalizeKeyboardNotation("1.25x")).toBe("1,25x");
    expect(normalizeKeyboardNotation("0,3333...")).toBe("0,\\overline{3}");
    expect(normalizeKeyboardNotation("0.1666...")).toBe("0,1\\overline{6}");
  });

  it("casi vuoti ed esponenti negativi", () => {
    expect(normalizeKeyboardNotation("")).toBe("");
    expect(normalizeKeyboardNotation("   ")).toBe("");
    expect(normalizeKeyboardNotation("x^-2")).toBe("x^-2");
    expect(normalizeKeyboardNotation("RAD2 9")).toBe("√9");
  });
});

describe("normalizeKeyboardLive (conversione mentre si digita)", () => {
  it("non cambia nulla se non serve", () => {
    expect(normalizeKeyboardLive("[2+1]", 5)).toEqual({ value: "[2+1]", caret: 5 });
  });

  it("accorcia rad2 e riposiziona il cursore", () => {
    expect(normalizeKeyboardLive("rad2", 4)).toEqual({ value: "√", caret: 1 });
    expect(normalizeKeyboardLive("rad2 9", 6)).toEqual({ value: "√9", caret: 2 });
  });

  it("cursore al centro (dentro un token convertito)", () => {
    const r = normalizeKeyboardLive("3*4", 2);
    expect(r.value).toBe("3·4");
    expect(r.caret).toBe(2);
  });

  it("token spezzato dal cursore: cursore in fondo", () => {
    const r = normalizeKeyboardLive("rad2", 2);
    expect(r.value).toBe("√");
    expect(r.caret).toBe(1);
  });
});

describe("sanitizeLatexNotation (giro 33-fix: l'IA restituisce \\frac, il campo vuole /)", () => {
  it("\\frac{a}{b} → a⁄b (frazione impilata con la barra)", () => {
    expect(sanitizeLatexNotation("\\frac{3}{4}")).toBe("3\u20444");
    expect(sanitizeLatexNotation("\\frac{1}{4}")).toBe("1\u20444");
    expect(sanitizeLatexNotation("\\frac{3}{c}")).toBe("3\u2044c");
    expect(sanitizeLatexNotation("\\dfrac{3}{4}")).toBe("3\u20444");
  });
  it("il caso della foto: ·\\frac{3}{c}(\\frac{1}{4} → notazione lineare", () => {
    expect(normalizeKeyboardNotation("·\\frac{3}{c}(\\frac{1}{4}")).toBe("·3\u2044c(1\u20444");
    expect(toDisplayNotation("·\\frac{3}{c}(\\frac{1}{4}")).toBe("·3\u2044c(1\u20444");
  });
  it("radici, per, diviso e parentesi LaTeX", () => {
    expect(normalizeKeyboardNotation("\\sqrt{9}")).toBe("√9");
    expect(normalizeKeyboardNotation("\\sqrt[3]{8}")).toBe("∛8");
    expect(normalizeKeyboardNotation("2\\cdot3")).toBe("2·3");
    expect(normalizeKeyboardNotation("2×3")).toBe("2·3");
    expect(normalizeKeyboardNotation("\\left(3\\right)")).toBe("(3)");
    expect(normalizeKeyboardNotation("x^{2}")).toBe("x^2");
  });
  it("graffe residue mai nel risultato (la notazione non le usa)", () => {
    expect(sanitizeLatexNotation("\\frac{3}{4}")).not.toContain("{");
    expect(sanitizeLatexNotation("\\frac{3}{4}")).not.toContain("\\");
  });
  it("testo senza backslash invariato", () => {
    expect(sanitizeLatexNotation("3⁄4·(1⁄4)")).toBe("3⁄4·(1⁄4)");
    expect(sanitizeLatexNotation("2x+3=7")).toBe("2x+3=7");
  });
  it("il caso della foto (giro 35, campo ✎): \\frac{3}{4}^2) → (3⁄4)^2)", () => {
    // notazione interna del widget: MAI il comando \frac, solo la barra;
    // l'esponente vale per TUTTA la frazione → parentesi ((3⁄4)^2)
    expect(normalizeKeyboardNotation("\\frac{3}{4}^2)")).toBe("(3\u20444)^2)");
    expect(sanitizeLatexNotation("\\frac{3}{4}^2)")).not.toContain("frac");
    expect(sanitizeLatexNotation("\\frac{3}{4}^2)")).not.toContain("\\");
  });
  it("\\frac senza esponente resta senza parentesi", () => {
    expect(normalizeKeyboardNotation("\\frac{3}{4}")).toBe("3\u20444");
  });
});

describe("keyboardNotationHint", () => {
  // (11/11) STANDARD CALCOLATRICE: gli aiuti elencano le regole della guida
  it("menziona le regole della calcolatrice", () => {
    expect(keyboardNotationHint).toContain("* moltiplicazione");
    expect(keyboardNotationHint).toContain("/ divisione");
    expect(keyboardNotationHint).toContain("(A)/(B) frazione impilata");
    expect(keyboardNotationHint).toContain("^(-1) potenze");
    expect(keyboardNotationHint).toContain("(A)^(1/2) radice quadrata");
    expect(keyboardNotationHint).toContain("(A)^(-1/3) indice −3");
    expect(keyboardNotationHint).toContain("0.75 decimale");
    expect(keyboardNotationHint).toContain("frazione generatrice 1/3");
  });
  it("l'aiuto del pannello copre le stesse regole e l'uguale", () => {
    expect(keyboardDisplayHint).toContain("(A)^(1/2) radice quadrata");
    expect(keyboardDisplayHint).toContain("frazione impilata");
    expect(keyboardDisplayHint).toContain("= si ignora");
  });
});

describe("normalizeKeyboardDisplayNotation (giro 28, regole pannello come app audio)", () => {
  it("la barra è SEMPRE frazione impilata, anche nelle fratte", () => {
    expect(normalizeKeyboardDisplayNotation("(x+1)/(2x-3)")).toBe("(x+1)\u2044(2x-3)");
    expect(normalizeKeyboardDisplayNotation("(3x+1)/2")).toBe("(3x+1)\u20442");
    expect(normalizeKeyboardDisplayNotation("3/4*4/6")).toBe("3\u20444·4\u20446");
  });

  it("i due punti scritti si mostrano come ÷", () => {
    expect(normalizeKeyboardDisplayNotation("6:2")).toBe("6\u00f72");
    expect(normalizeKeyboardDisplayNotation("6 ÷ 2")).toBe("6\u00f72");
    expect(normalizeKeyboardDisplayNotation("(3/4*4/6)^2-2:5")).toBe("(3\u20444·4\u20446)^2-2\u00f75");
  });

  it("radici e spazi come nell'editor", () => {
    expect(normalizeKeyboardDisplayNotation("rad2 9 + rad3 8")).toBe("√9+∛8");
  });

  it("toDisplayNotation: notazione IA (:) → schermo (÷)", () => {
    expect(toDisplayNotation("(3⁄4)^2:5")).toBe("(3⁄4)^2\u00f75");
  });

  it("normalizeKeyboardDisplayLive accorcia rad2 e riposiziona il cursore", () => {
    expect(normalizeKeyboardDisplayLive("6:2", 4)).toEqual({ value: "6\u00f72", caret: 3 });
    expect(normalizeKeyboardDisplayLive("rad2", 4)).toEqual({ value: "√", caret: 1 });
  });

  it("dal pannello al pezzo: normalizeKeyboardNotation riconverte ÷ in :", () => {
    expect(normalizeKeyboardNotation("(3\u20444·4\u20446)^2-2\u00f75")).toBe("(3\u20444·4\u20446)^2-2:5");
  });
});

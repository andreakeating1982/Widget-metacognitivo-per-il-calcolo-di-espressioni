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
  it("menziona le regole richieste dall'utente", () => {
    expect(keyboardNotationHint).toContain(": diviso");
    expect(keyboardNotationHint).toContain("* per");
    expect(keyboardNotationHint).toContain("3/4 frazione impilata");
    expect(keyboardNotationHint).toContain("^2 potenza");
    expect(keyboardNotationHint).toContain("rad2");
    expect(keyboardNotationHint).toContain("rad3");
  });
  it("l'aiuto del pannello dice che i due punti si mostrano come ÷", () => {
    expect(keyboardDisplayHint).toContain("si mostra ÷");
    expect(keyboardDisplayHint).toContain("frazione impilata");
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

import { describe, expect, it } from "vitest";
import { appNotationToLatex, stackedFractionsToLatex } from "../client/src/lib/appNotationLatex";
import { groupRadicalNumerators, normalizeExpressionOcr } from "../client/src/lib/exprOcr";

/* Foto allegata (prova.png), osservata ingrandita: ⟨√(ab+1)⟩² sopra
 * √(ab+1), più ⟨2 sopra 6⟩^(-1). Entrambe le barre coprono anche +1.
 * La resa deve funzionare anche se l'IA omette le parentesi esterne al
 * denominatore; altre forme restano test indipendenti, non letture della foto. */
describe("foto prova.png — frazione con radici resa impilata", () => {
  it("operandi racchiusi: (√(ab)+1)^2⁄(√(ab)+1)", () => {
    expect(appNotationToLatex("(√(ab)+1)^2⁄(√(ab)+1)")).toBe(
      "\\frac{(\\sqrt{ab}+1)^{2}}{\\sqrt{ab}+1}",
    );
  });

  it("denominatore radice SENZA parentesi esterne: (…)^2⁄√(ab+1)", () => {
    expect(appNotationToLatex("(√(ab+1))^2⁄√(ab+1)")).toBe(
      "\\frac{(\\sqrt{ab+1})^{2}}{\\sqrt{ab+1}}",
    );
  });

  it("radice semplice a sinistra: √(ab+1)⁄2", () => {
    expect(appNotationToLatex("√(ab+1)⁄2")).toBe("\\frac{\\sqrt{ab+1}}{2}");
  });

  it("radice con potenza a sinistra: √(ab)^2⁄x", () => {
    expect(appNotationToLatex("√(ab)^2⁄x")).toBe("\\frac{\\sqrt{ab}^{2}}{x}");
  });

  it("radice atomica senza parentesi: √2⁄3 e √ab⁄3", () => {
    expect(appNotationToLatex("√2⁄3")).toBe("\\frac{\\sqrt{2}}{3}");
    // Il parser lega il monomio alla radice: anche la resa deve rispettarlo.
    expect(appNotationToLatex("√ab⁄3")).toBe("\\frac{\\sqrt{ab}}{3}");
    expect(appNotationToLatex("1⁄√16")).toBe("\\frac{1}{\\sqrt{16}}");
  });

  it("radice a destra: x⁄√(ab+1)", () => {
    expect(appNotationToLatex("x⁄√(ab+1)")).toBe("\\frac{x}{\\sqrt{ab+1}}");
  });

  it("frazioni con somme fuori dal radicale: forma diversa, da preservare", () => {
    expect(appNotationToLatex("(√(ab)+1)^2⁄(√(ab)+1) + (2⁄6)^-1")).toBe(
      "\\frac{(\\sqrt{ab}+1)^{2}}{\\sqrt{ab}+1} + (\\frac{2}{6})^{-1}",
    );
  });

  it("l'espressione completa della foto, senza parentesi esterne al denominatore", () => {
    expect(appNotationToLatex("(√(ab+1))^2⁄√(ab+1) + (2⁄6)^-1")).toBe(
      "\\frac{(\\sqrt{ab+1})^{2}}{\\sqrt{ab+1}} + (\\frac{2}{6})^{-1}",
    );
  });

  it("mantiene la struttura nel percorso reale di normalizzazione della foto IA", () => {
    const letto = "(√(ab+1))^2⁄√(ab+1)+(2⁄6)^-1";
    const pulito = groupRadicalNumerators(normalizeExpressionOcr(letto, true, { keepDivision: true }));
    const latex = appNotationToLatex(pulito);
    expect(latex).toContain("\\frac{(\\sqrt{ab+1})^{2}}{\\sqrt{ab+1}}");
    expect(latex).toContain("\\frac{2}{6}");
    expect(latex).not.toContain("⁄");
  });

  it("preserva l'indice della radice, anche negativo, in numeratore e denominatore", () => {
    expect(appNotationToLatex("⁻³√(ab+1)⁄2")).toBe("\\frac{\\sqrt[-3]{ab+1}}{2}");
    expect(appNotationToLatex("2⁄⁻³√(ab+1)")).toBe("\\frac{2}{\\sqrt[-3]{ab+1}}");
    expect(appNotationToLatex("⁷√(x)⁄∛(y)")).toBe("\\frac{\\sqrt[7]{x}}{\\sqrt[3]{y}}");
  });

  it("non rompe i casi già coperti (√(3⁄7), (1⁄2)⁄(3⁄4), \\sqrt{3}⁄2)", () => {
    expect(appNotationToLatex("√(3⁄7)")).toBe("\\sqrt{\\frac{3}{7}}");
    expect(stackedFractionsToLatex("(1⁄2)⁄(3⁄4)")).toBe("\\frac{\\frac{1}{2}}{\\frac{3}{4}}");
    expect(stackedFractionsToLatex("\\sqrt{3}⁄2")).toBe("\\frac{\\sqrt{3}}{2}");
  });
});

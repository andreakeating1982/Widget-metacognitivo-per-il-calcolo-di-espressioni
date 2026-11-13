import { describe, expect, it } from "vitest";
import { appNotationToLatex, stackedFractionsToLatex, tidyFractionParens } from "./appNotationLatex";

/**
 * Frazioni impilate nella lista dei pezzi (foto, mano, tastiera).
 * Segnalazione 7/11: l'espressione algebrica a²/(ab−b²) − … letta dalla foto
 * compariva come «a^{2/(ab−b²)} …»: l'esponente veniva scambiato per il
 * numeratore. Qui si verifica che numeratore e denominatore comprendano
 * SEMPRE le potenze, esattamente come le legge il parser dell'app.
 */
describe("stackedFractionsToLatex — operandi con potenze", () => {
  const casi: Array<[string, string]> = [
    ["a^2⁄(ab-b^2)", "\\frac{a^2}{ab-b^2}"],
    [
      "a^2⁄(ab-b^2)-(a^2+b^2)⁄(a^2-b^2)-b^2⁄(ab+b^2)",
      "\\frac{a^2}{ab-b^2}-\\frac{a^2+b^2}{a^2-b^2}-\\frac{b^2}{ab+b^2}",
    ],
    ["1⁄b^2", "\\frac{1}{b^2}"],
    ["1⁄(x+1)^2", "\\frac{1}{(x+1)^2}"],
    ["x^2⁄y^3", "\\frac{x^2}{y^3}"],
    ["(a+b)^2⁄c", "\\frac{(a+b)^2}{c}"],
    ["2^3⁄5", "\\frac{2^3}{5}"],
    ["x^-2⁄3", "\\frac{x^-2}{3}"],
    ["x^(-2)⁄3", "\\frac{x^(-2)}{3}"],
    ["1⁄x^n", "\\frac{1}{x^n}"],
  ];
  for (const [input, atteso] of casi) {
    it(`${input}`, () => expect(stackedFractionsToLatex(input)).toBe(atteso));
  }

  it("il termine FUORI dalla linea resta fuori (½x²)", () => {
    expect(stackedFractionsToLatex("1⁄2x^2")).toBe("\\frac{1}{2}x^2");
    expect(stackedFractionsToLatex("3⁄4x-5⁄6")).toBe("\\frac{3}{4}x-\\frac{5}{6}");
  });

  it("coefficiente davanti a una frazione con potenza: 2x²⁄3 = 2·(x²⁄3), come il parser", () => {
    expect(stackedFractionsToLatex("2x^2⁄3")).toBe("2\\frac{x^2}{3}");
  });
});

describe("stackedFractionsToLatex — parentesi di raggruppamento", () => {
  it("le parentesi che racchiudono TUTTO il numeratore/denominatore non si vedono", () => {
    expect(stackedFractionsToLatex("(a+b)⁄(a-b)")).toBe("\\frac{a+b}{a-b}");
    expect(stackedFractionsToLatex("(2x)⁄(3y)")).toBe("\\frac{2x}{3y}");
    expect(stackedFractionsToLatex("1⁄(x+2)")).toBe("\\frac{1}{x+2}");
  });
  it("le frazioni annidate restano annidate e senza parentesi inutili", () => {
    expect(stackedFractionsToLatex("(1⁄2)⁄(3⁄4)")).toBe("\\frac{\\frac{1}{2}}{\\frac{3}{4}}");
    expect(stackedFractionsToLatex("(1⁄x+1)⁄(1-1⁄x)")).toBe("\\frac{\\frac{1}{x}+1}{1-\\frac{1}{x}}");
  });
  it("una parentesi con esponente o con altro attaccato NON viene tolta", () => {
    expect(stackedFractionsToLatex("(a+b)^2⁄(a-b)^2")).toBe("\\frac{(a+b)^2}{(a-b)^2}");
    expect(stackedFractionsToLatex("(a+b)(a-b)⁄c")).toBe("(a+b)\\frac{a-b}{c}");
  });
  it("la frazione dentro parentesi, con esponente sulla parentesi, resta com'era", () => {
    expect(stackedFractionsToLatex("(3⁄4)^2")).toBe("(\\frac{3}{4})^2");
    expect(stackedFractionsToLatex("(2⁄3)^2·3⁄4")).toBe("(\\frac{2}{3})^2·\\frac{3}{4}");
  });
});

describe("stackedFractionsToLatex — casi che già funzionavano", () => {
  it("frazioni semplici e somme", () => {
    expect(stackedFractionsToLatex("3⁄4")).toBe("\\frac{3}{4}");
    expect(stackedFractionsToLatex("12⁄34")).toBe("\\frac{12}{34}");
    expect(stackedFractionsToLatex("x⁄2+1⁄x")).toBe("\\frac{x}{2}+\\frac{1}{x}");
    expect(stackedFractionsToLatex("az⁄4")).toBe("\\frac{az}{4}");
    expect(stackedFractionsToLatex("2⁄3az")).toBe("\\frac{2}{3}az");
    expect(stackedFractionsToLatex("a^2b⁄c")).toBe("a^2\\frac{b}{c}");
  });
  it("niente ⁄ → testo invariato", () => {
    expect(stackedFractionsToLatex("3x^2-5x+2")).toBe("3x^2-5x+2");
    expect(stackedFractionsToLatex("")).toBe("");
  });
  it("un ⁄ senza operandi non manda in ciclo e non perde il testo", () => {
    expect(stackedFractionsToLatex("⁄")).toBe("⁄");
    expect(stackedFractionsToLatex("3⁄")).toBe("3⁄");
    expect(stackedFractionsToLatex("⁄4")).toBe("⁄4");
  });
});

describe("appNotationToLatex — radici attorno alle frazioni", () => {
  it("la barra della radice avvolge la frazione già impilata", () => {
    expect(appNotationToLatex("√(3⁄7)")).toBe("\\sqrt{\\frac{3}{7}}");
    expect(appNotationToLatex("√((3⁄7)·(1−4⁄7))+√(1⁄64)")).toBe(
      "\\sqrt{(\\frac{3}{7})\\cdot (1−\\frac{4}{7})}+\\sqrt{\\frac{1}{64}}",
    );
  });
  it("la foto di algebra: tre frazioni di fila", () => {
    expect(appNotationToLatex("a^2⁄(ab-b^2)-(a^2+b^2)⁄(a^2-b^2)-b^2⁄(ab+b^2)")).toBe(
      "\\frac{a^{2}}{ab-b^{2}}-\\frac{a^{2}+b^{2}}{a^{2}-b^{2}}-\\frac{b^{2}}{ab+b^{2}}",
    );
  });
});

describe("tidyFractionParens — LaTeX stampato dal motore", () => {
  it("toglie le parentesi \\left( \\right) che racchiudono tutto un operando", () => {
    expect(tidyFractionParens("\\dfrac{a^{2}}{\\left(ab - b^{2}\\right)}")).toBe("\\dfrac{a^{2}}{ab - b^{2}}");
    expect(
      tidyFractionParens(
        "\\dfrac{a^{2}}{\\left(ab - b^{2}\\right)} - \\dfrac{\\left(a^{2} + b^{2}\\right)}{\\left(a^{2} - b^{2}\\right)} - \\dfrac{\\left(b^{2}\\right)}{\\left(ab + b^{2}\\right)}",
      ),
    ).toBe("\\dfrac{a^{2}}{ab - b^{2}} - \\dfrac{a^{2} + b^{2}}{a^{2} - b^{2}} - \\dfrac{b^{2}}{ab + b^{2}}");
  });
  it("lascia le parentesi con esponente o con più gruppi", () => {
    expect(tidyFractionParens("\\dfrac{\\left(a+b\\right)^{2}}{c}")).toBe("\\dfrac{\\left(a+b\\right)^{2}}{c}");
    expect(tidyFractionParens("\\dfrac{\\left(a+b\\right)\\left(a-b\\right)}{c}")).toBe(
      "\\dfrac{\\left(a+b\\right)\\left(a-b\\right)}{c}",
    );
    expect(tidyFractionParens("\\dfrac{x}{\\left(a+b\\right) c}")).toBe("\\dfrac{x}{\\left(a+b\\right) c}");
  });
  it("lascia quadre e graffe disegnate dallo studente", () => {
    expect(tidyFractionParens("\\dfrac{\\left[a+b\\right]}{c}")).toBe("\\dfrac{\\left[a+b\\right]}{c}");
    expect(tidyFractionParens("\\dfrac{\\left\\{a+b\\right\\}}{c}")).toBe("\\dfrac{\\left\\{a+b\\right\\}}{c}");
  });
  it("frazioni annidate e parentesi fuori dalla frazione", () => {
    expect(tidyFractionParens("\\dfrac{\\dfrac{\\left(1+x\\right)}{x}}{\\left(1-x\\right)}")).toBe(
      "\\dfrac{\\dfrac{1+x}{x}}{1-x}",
    );
    expect(tidyFractionParens("\\left(\\dfrac{1}{2}\\right)^{2}")).toBe("\\left(\\dfrac{1}{2}\\right)^{2}");
  });
  it("testo senza frazioni o con LaTeX incompleto non cambia e non va in ciclo", () => {
    expect(tidyFractionParens("3x^{2} - 5")).toBe("3x^{2} - 5");
    expect(tidyFractionParens("\\dfrac{a}{")).toBe("\\dfrac{a}{");
    expect(tidyFractionParens("\\dfrac{a}")).toBe("\\dfrac{a}");
    expect(tidyFractionParens("")).toBe("");
  });
  it("parentesi tonde letterali (non \\left) non si toccano", () => {
    expect(tidyFractionParens("\\dfrac{(a+b)}{c}")).toBe("\\dfrac{(a+b)}{c}");
  });
});



describe("rappresentazione del prodotto nella trascrizione della foto", () => {
  it("mostra il puntino e non l'asterisco tra le radici", () => {
    const latex = appNotationToLatex("√(9x^3)*√(x)-2x√(4x^2)+(√(25x^4))⁄x");
    expect(latex).toContain(String.raw`\sqrt{9x^{3}}\cdot \sqrt{x}`);
    expect(latex).not.toContain("*");
    expect(latex).toContain(String.raw`\frac{\sqrt{25x^{4}}}{x}`);
  });
  it("mostra il puntino anche con i simboli moltiplicativi Unicode e LaTeX", () => {
    for (const symbol of ["*", "·", "⋅", "×", "∗", String.raw`\times`]) {
      expect(appNotationToLatex(`2${symbol}3`)).toBe(String.raw`2\cdot 3`);
    }
  });
});


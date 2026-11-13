import { describe, expect, it } from "vitest";
import { formaDidatticaValida } from "./criteriDidattici";

const criterio = "radicale_trasformato" as const;
describe("criterio didattico per il radicale al denominatore", () => {
  const op = "\\dfrac{ab+1}{\\sqrt{ab+1}}+3";
  it("non accetta una semplice ripetizione dell'operazione", () => {
    expect(formaDidatticaValida(criterio, op, op)).toBe(false);
    expect(formaDidatticaValida(criterio, "(ab+1)/rad2(ab+1)+3", op)).toBe(false);
  });
  it("accetta le grafie del risultato senza imporre una sola notazione", () => {
    expect(formaDidatticaValida(criterio, "\\sqrt{ab+1}+3", op)).toBe(true);
    expect(formaDidatticaValida(criterio, "rad2(ab+1)+3", op)).toBe(true);
    expect(formaDidatticaValida(criterio, "3+√(ab+1)", op)).toBe(true);
    expect(formaDidatticaValida(criterio, "(ab+1)^(1/2)+3", op)).toBe(true);
  });
  it("consente un radicale alla volta quando ci sono più frazioni", () => {
    const due = "\\dfrac{a}{\\sqrt{a}}+\\dfrac{b}{\\sqrt{b}}";
    expect(formaDidatticaValida(criterio, "√(a) + (b)/(√(b))", due)).toBe(true);
    expect(formaDidatticaValida(criterio, due, due)).toBe(false);
  });
  it("non conferma se il denominatore è ancora irrazionale", () => {
    const frazione = "\\dfrac{1}{\\sqrt{3}}+2";
    expect(formaDidatticaValida(criterio, "1/√3+2", frazione)).toBe(false);
    expect(formaDidatticaValida(criterio, "√3/3+2", frazione)).toBe(true);
  });
});


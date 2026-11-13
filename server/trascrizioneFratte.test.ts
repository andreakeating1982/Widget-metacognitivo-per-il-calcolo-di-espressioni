import { describe, expect, it } from "vitest";
import { trascrizioneFedele } from "./costruisci";

// La disposizione è quella visibile nella foto: il fattore 2 è ESTERNO
// alla seconda frazione. I test non scrivono su database e non invocano IA.
const formulaFuori = String.raw`\dfrac{x}{x+1}+2\cdot\dfrac{x}{4-x}`;
const formulaDentro = String.raw`\dfrac{x}{x+1}+\dfrac{2x}{4-x}`;

describe("fedeltà tra editor e formula visualizzata nelle frazioni letterali", () => {
  it.each([
    "x/(x+1)+2*x/(4-x)",
    "x/(x+1)+2·x/(4-x)",
    "x⁄(x+1)+2·x⁄(4-x)",
  ])("mantiene la frazione visibile e il fattore esterno in %s", (sorgente) => {
    expect(trascrizioneFedele(sorgente, formulaFuori)).toBe(true);
    expect(trascrizioneFedele(sorgente, formulaDentro)).toBe(false);
  });
  it("accetta un fattore dentro solo se lo studente lo ha scritto dentro", () => {
    expect(trascrizioneFedele("x/(x+1)+(2x)/(4-x)", formulaDentro)).toBe(true);
    expect(trascrizioneFedele("x/(x+1)+(2x)/(4-x)", formulaFuori)).toBe(false);
  });
  it("rispetta le parentesi quadre e graffe dell'utente", () => {
    expect(trascrizioneFedele("{[x/(x+1)+2*x/(4-x)]}", String.raw`\left\{\left[\dfrac{x}{x+1}+2\cdot\dfrac{x}{4-x}\right]\right\}`)).toBe(true);
    expect(trascrizioneFedele("{[x/(x+1)+2*x/(4-x)]}", formulaFuori)).toBe(false);
  });
});


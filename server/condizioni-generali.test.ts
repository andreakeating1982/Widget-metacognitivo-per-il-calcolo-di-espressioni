import { describe, expect, it } from "vitest";
import { condizioniGeneraliNonRisolte, sezioneCondizioniEsistenza } from "./costruisci";

const foto = String.raw`\dfrac{\sqrt[3]{x^3+3x^2+3x+1}\cdot0,5+(\sqrt{x^2-4x+4})^{-1}\cdot1,\overline{3}}{\sqrt[-2]{0,0\overline{5}}\cdot x+\sqrt[4]{x^4-8x^3+24x^2-32x+16}}`;

describe("condizioni generali quando i valori vietati non sono tutti risolubili", () => {
  it("non omette il denominatore con radicale e valore assoluto della foto", () => {
    const c = condizioniGeneraliNonRisolte(foto);
    expect(c.some(s => s.includes(String.raw`\sqrt[-2]`) && s.includes(String.raw`\ne 0`))).toBe(true);
    expect(c.some(s => s.includes(String.raw`\sqrt[4]`) && s.includes(String.raw`\ne 0`))).toBe(true);
    expect(c.some(s => s.includes(String.raw`\ge 0`))).toBe(true);
    expect(sezioneCondizioniEsistenza(foto)?.boxes.some(b => b.condizioniEsistenza)).toBe(true);
  });

  it("mostra la condizione irrazionale senza fingere di averne calcolato gli zeri", () => {
    const c = condizioniGeneraliNonRisolte(String.raw`\dfrac{1}{x^{2}-2}`);
    expect(c).toHaveLength(1);
    expect(c[0]).toContain(String.raw`\ne 0`);
  });

  it("non ripete una condizione lineare già affidata al box dedicato", () => {
    expect(condizioniGeneraliNonRisolte(String.raw`\dfrac{1}{x-3}`)).toEqual([]);
  });

  it("per una radice pari con indice negativo chiede positività, non soltanto diversità da zero", () => {
    const c = condizioniGeneraliNonRisolte(String.raw`\sqrt[-4]{x-3}`);
    expect(c.some(s => s.includes(String.raw`\gt 0`))).toBe(true);
  });

  it("per una radice dispari con indice negativo chiede solo radicando diverso da zero", () => {
    const c = condizioniGeneraliNonRisolte(String.raw`\sqrt[-5]{x^{2}-2}`);
    expect(c.some(s => s.includes(String.raw`\ne 0`))).toBe(true);
    expect(c.some(s => s.includes(String.raw`\gt 0`))).toBe(false);
  });

  it("aggiunge non-negatività alla radice pari con lettera", () => {
    const c = condizioniGeneraliNonRisolte(String.raw`\sqrt{x-3}`);
    expect(c.some(s => s.includes(String.raw`\ge 0`))).toBe(true);
  });

  it("non aggiunge vincoli alle espressioni puramente numeriche valide", () => {
    expect(condizioniGeneraliNonRisolte(String.raw`\dfrac{2}{3}+\sqrt{5}`)).toEqual([]);
  });
});


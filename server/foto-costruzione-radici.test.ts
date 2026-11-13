import { describe, expect, it } from "vitest";
import { appNotationToLatex } from "../client/src/lib/appNotationLatex";
import { trascrizioneFedele } from "./costruisci";

const foto = "(√(ab+1))^2⁄√(ab+1)+(2⁄6)^-1";
const latexLetto = String.raw`\dfrac{\left(\sqrt{ab+1}\right)^2}{\sqrt{ab+1}}+\left(\dfrac{2}{6}\right)^{-1}`;

describe("fedeltà dell'espressione fotografata durante la costruzione", () => {
  it("confronta la trascrizione con la frazione impilata senza modificare la traccia", () => {
    expect(trascrizioneFedele(foto, latexLetto)).toBe(true);
    expect(trascrizioneFedele(foto, appNotationToLatex(foto))).toBe(true);
  });
  it.each([
    ["x⁄√(a+1)", String.raw`\frac{x}{\sqrt{a+1}}`],
    ["x⁄⁻³√(a+1)", String.raw`\frac{x}{\sqrt[-3]{a+1}}`],
    ["x⁄∛(a+1)", String.raw`\frac{x}{\sqrt[3]{a+1}}`],
    ["x⁄∜(a+1)", String.raw`\frac{x}{\sqrt[4]{a+1}}`],
    ["√(a)⁄√(b)", String.raw`\frac{\sqrt{a}}{\sqrt{b}}`],
    ["(2⁄3)⁄√(b)", String.raw`\frac{\frac{2}{3}}{\sqrt{b}}`],
    ["2·x⁄√(a+1)", String.raw`2\cdot\frac{x}{\sqrt{a+1}}`],
  ])("riconosce il radicale al denominatore senza eliminarne l'indice: %s", (src, latex) => {
    expect(trascrizioneFedele(src, latex)).toBe(true);
  });
  it("non confonde indici di radice diversi e conserva i delimitatori", () => {
    expect(trascrizioneFedele("[x⁄⁻³√(a+1)]", String.raw`\left[\frac{x}{\sqrt[3]{a+1}}\right]`)).toBe(false);
    expect(trascrizioneFedele("[x⁄√(a+1)]", String.raw`\frac{x}{\sqrt{a+1}}`)).toBe(false);
    expect(trascrizioneFedele("√(a)⁄√(b)", String.raw`\sqrt{\frac{a}{b}}`)).toBe(false);
  });
  it("rifiuta alterazioni del radicando o della frazione", () => {
    expect(trascrizioneFedele(foto, String.raw`\dfrac{\left(\sqrt{ab}+1\right)^2}{\sqrt{ab}+1}+\left(\dfrac{2}{6}\right)^{-1}`)).toBe(false);
    expect(trascrizioneFedele(foto, String.raw`\dfrac{\left(\sqrt{ab+1}\right)^2}{\sqrt{ab+1}}+\left(\dfrac{2}{3}\right)^{-1}`)).toBe(false);
  });
});


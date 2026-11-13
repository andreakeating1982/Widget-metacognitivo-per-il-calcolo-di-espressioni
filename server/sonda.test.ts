/** Sonda 2: primitive periodici + radici n-esime. Viene rimossa dopo. */
import { describe, it, expect } from "vitest";
import { normalizeInput, parseExpression, printLatex, latexValue, fr } from "../client/src/lib/espressioni";
import { replaceExpressionStep } from "../client/src/lib/progressiveExpression";
import { risultatoRadicaleLatex, exactNumericEquality, risultatoNesimoLatex } from "../client/src/lib/numericRadicalEquality";
import { verificaPerSostituzione } from "./costruisci";

describe("sonda 2", () => {
  it("periodici: parse esatto", () => {
    for (const s of ["1,\\overline{3}", "1,\\bar{3}", "1{,}\\overline{3}", "1,3̄", "0,\\overline{3}", "0,1\\overline{3}", "1,23̄"]) {
      const n = parseExpression(normalizeInput(s));
      console.log(s, "→", printLatex(n));
    }
    console.log("latexValue 1,\\overline{3} =", latexValue("1,\\overline{3}"));
    console.log("latexValue 1,3̄ =", latexValue("1,3̄"));
  });
  it("periodico nell'espressione della foto", () => {
    const esp = "\\left[\\left(\\dfrac{3}{2}-0,5\\right)^{2}\\cdot\\sqrt{\\dfrac{9}{4}}+1,\\overline{3}\\right]:\\left(2-\\dfrac{1}{3}\\right)";
    expect(() => parseExpression(normalizeInput(esp))).not.toThrow();
    console.log("valore:", latexValue(esp));
    console.log("esatto vs 17/10:", exactNumericEquality(esp, "\\dfrac{17}{10}"));
  });
  it("radici cubiche esatte", () => {
    console.log("∛81 →", risultatoRadicaleLatex("\\sqrt[3]{81}"));
    console.log("2·3∛3 →", risultatoRadicaleLatex("2\\cdot 3\\sqrt[3]{3}"));
    console.log("raccolta →", risultatoRadicaleLatex("6\\sqrt[3]{3}-10\\sqrt[3]{4}-6\\sqrt[3]{3}+12\\sqrt[3]{4}"));
    console.log("esatta uguale:", exactNumericEquality("6\\sqrt[3]{3}-10\\sqrt[3]{4}-6\\sqrt[3]{3}+12\\sqrt[3]{4}", "2\\sqrt[3]{4}"));
    console.log("esercizio intero → 2∛4:", exactNumericEquality("2\\sqrt[3]{81}-5\\sqrt[3]{32}-3\\sqrt[3]{24}+4\\sqrt[3]{108}", "2\\sqrt[3]{4}"));
    console.log("risultatoNesimoLatex:", risultatoNesimoLatex("2\\sqrt[3]{81}-5\\sqrt[3]{32}-3\\sqrt[3]{24}+4\\sqrt[3]{108}"));
    console.log("quarta radice:", risultatoRadicaleLatex("2\\sqrt[4]{16}\\cdot 3"));
  });
  it("catena periodica step", () => {
    const riga = "\\left[\\left(\\dfrac{3}{2}-0,5\\right)^{2}\\cdot\\sqrt{\\dfrac{9}{4}}+1,\\overline{3}\\right]:\\left(2-\\dfrac{1}{3}\\right)";
    let r: string | null = riga;
    r = replaceExpressionStep(r, "\\left(\\dfrac{3}{2}-0,5\\right)^{2}", "1");
    console.log("r1:", r);
    r = r && replaceExpressionStep(r, "\\sqrt{\\dfrac{9}{4}}", "\\dfrac{3}{2}");
    console.log("r2:", r);
    r = r && replaceExpressionStep(r, "1\\cdot\\dfrac{3}{2}", "\\dfrac{3}{2}");
    console.log("r3:", r);
    r = r && replaceExpressionStep(r, "\\dfrac{3}{2}+1,\\overline{3}", "\\dfrac{17}{6}");
    console.log("r4:", r);
    r = r && replaceExpressionStep(r, "2-\\dfrac{1}{3}", "\\dfrac{5}{3}");
    console.log("r5:", r);
    r = r && replaceExpressionStep(r, "\\dfrac{17}{6}:\\dfrac{5}{3}", "\\dfrac{17}{10}");
    console.log("r6:", r);
  });
  it("sostituzione con periodico", () => {
    console.log(verificaPerSostituzione("\\left[\\left(\\dfrac{3}{2}-0,5\\right)^{2}\\cdot\\sqrt{\\dfrac{9}{4}}+1,\\overline{3}\\right]:\\left(2-\\dfrac{1}{3}\\right)", "\\dfrac{17}{10}"));
  });
});

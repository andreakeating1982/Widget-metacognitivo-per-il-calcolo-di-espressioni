import { describe, expect, it } from "vitest";
import { countElements, MAX_PEZZO, pieceFitsLimit } from "./pieceCount";

/**
 * Limite «MAX 10 ELEMENTI ALLA VOLTA» (dal 21/10/2026, giro 19: prima 5, e prima ancora 8).
 * Decisione dell'utente: le parentesi GRAFFE { } NON contano. Questi test FISSANO la
 * regola: se qualcuno la cambia, falliscono.
 */
describe("countElements: le graffe { } NON contano", () => {
  it("{[(2)]} vale 5, non 7", () => {
    expect(countElements("{[(2)]}")).toBe(5);
  });

  it("la graffa non conta in nessuna delle sue forme", () => {
    expect(countElements("\\{[(2)]\\}")).toBe(5); // \{ \}
    expect(countElements("\\lbrace[(2)]\\rbrace")).toBe(5); // \lbrace \rbrace
    expect(countElements("\\left\\{[(2)]\\right\\}")).toBe(5); // \left\{ \right\}
    expect(countElements("{")).toBe(0);
    expect(countElements("}")).toBe(0);
    expect(countElements("{}")).toBe(0);
    expect(countElements("{{{}}}")).toBe(0);
  });

  it("le graffe non spostano il limite di 10 elementi", () => {
    // dal giro 19 (21/10) il limite è 10: (2x+1) = 6 elementi è AMMESSO, anche fra graffe
    expect(countElements("(2x+1)")).toBe(6);
    expect(pieceFitsLimit("(2x+1)")).toBe(true);
    expect(pieceFitsLimit("{(2x+1)}")).toBe(true);
    expect(countElements("{[(2)]\\cdot4}")).toBe(7);
    expect(pieceFitsLimit("{[(2)]\\cdot4}")).toBe(true); // 7 elementi: ora entra
    // 11 elementi: rifiutato anche se racchiuso fra graffe ([ ( 2 x + 1 ) ] · 4 5)
    expect(countElements("{[(2x+1)]\\cdot45}")).toBe(11);
    expect(pieceFitsLimit("{[(2x+1)]\\cdot45}")).toBe(false);
  });

  it("MAX_PEZZO è 10", () => {
    expect(MAX_PEZZO).toBe(10);
  });
});

describe("countElements: tutto il resto conta come prima", () => {
  it("le parentesi tonde e quadre contano", () => {
    expect(countElements("[(2)]")).toBe(5);
    expect(countElements("(2+3)")).toBe(5);
    expect(countElements("[2x+1]")).toBe(6);
  });

  it("numeri, lettere e segni: un carattere = un elemento; gli spazi non contano", () => {
    expect(countElements("3+2")).toBe(3);
    expect(countElements("3 + 2")).toBe(3);
    expect(countElements("18:3")).toBe(4);
    expect(countElements("12x-5")).toBe(5);
  });

  it("i segni LaTeX (\\cdot \\times \\bullet \\div) contano 1", () => {
    expect(countElements("3\\cdot2")).toBe(3);
    expect(countElements("3\\times2")).toBe(3);
    expect(countElements("3\\bullet2")).toBe(3);
    expect(countElements("6\\div3")).toBe(3);
  });

  it("gli apici: il segno ^ e le graffe del gruppo non contano, la cifra sì", () => {
    expect(countElements("2^{3}")).toBe(2);
    expect(countElements("2^3")).toBe(2);
    expect(countElements("x^{2}+3")).toBe(4);
    expect(countElements("(2^{2})^{3}")).toBe(5);
  });

  it("radici e frazioni: il comando conta 1, più il contenuto", () => {
    expect(countElements("\\sqrt{9}")).toBe(2);
    expect(countElements("\\frac{1}{2}")).toBe(3);
  });

  it("\\left e \\right (dimensione) non sono elementi: una parentesi = 1", () => {
    expect(countElements("\\left(3+2\\right)")).toBe(5);
    expect(countElements("\\left[3\\right]")).toBe(3);
    expect(countElements("\\bigl(3\\bigr)")).toBe(3);
  });

  it("un comando che INIZIA come \\left o \\right è un comando vero (conta 1)", () => {
    expect(countElements("a\\leftarrow b")).toBe(3);
    expect(countElements("a\\rightarrow b")).toBe(3);
  });

  it("stringa vuota", () => {
    expect(countElements("")).toBe(0);
    expect(countElements("   ")).toBe(0);
  });
});

/**
 * Parentesi in scrittura PICCOLA con coordinate a pixel INTERI (6/10).
 *
 * Il canvas dell'app è ~476×136 px: le cifre sono alte ~38 px e un mouse dà pixel interi. A quella
 * scala il banco (catalogo intero, modello reale) cadeva dall'88% al 70%. Due cause corrette qui:
 *   1. una TONDA «a punta» (poco profonda, tremolante, senza uncini) veniva classificata GRAFFA
 *      FORTE, tolta dall'inchiostro e reinserita come «}» (`)` di `12(3)` → «}»): `hooklessRound`;
 *   2. in un pezzo di SOLE parentesi bastava UNA tonda (o quadra morbida) con pochi punti non
 *      classificata perché tutto passasse al modello, che legge «CV», «1(», «\pi»: `completeBracketOnly`.
 * I tratti sono sintetici e DETERMINISTICI (`bench/synthInk.ts`, seme fisso): il test è ripetibile.
 */
import { describe, expect, it } from "vitest";
import { synthDetailed, type SpacingStyle } from "./bench/synthInk";
import { rewriteBrackets } from "./squareBrackets";

const H = 38;

/** tratti sintetici a cifre piccole e punti INTERI (come gli eventi del mouse) */
function ink(expr: string, seed: number, style: SpacingStyle = "normal") {
  const { strokes } = synthDetailed(expr, { seed, style, H });
  for (const st of strokes) for (const p of st.points) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
  return strokes as never;
}

const kinds = (expr: string, seed: number, style: SpacingStyle = "normal") =>
  rewriteBrackets(ink(expr, seed, style)).brackets.map((b) => `${b.kind[0]}${b.isOpen ? "(" : ")"}`).join(" ");

describe("tonda «a punta» NON è una graffa (hooklessRound)", () => {
  it("la «)» di 12(3) e 4(5)6 resta nell'inchiostro: nessuna graffa estratta", () => {
    // semi per cui, prima della correzione, la «)» veniva estratta come graffa chiusa «}»
    expect(kinds("12(3)", 6722)).toBe("");
    expect(kinds("4(5)6", 2814)).toBe("");
  });

  it("su 40 semi, una tonda in contesto non diventa quasi mai graffa", () => {
    let falseCurly = 0;
    let n = 0;
    for (const expr of ["12(3)", "8(6)", "4(5)6", "(2+3)", "3(x+1)"]) {
      for (let s = 1; s <= 8; s++) {
        n++;
        if (rewriteBrackets(ink(expr, 4000 + s * 131 + expr.length)).brackets.some((b) => b.kind === "curly")) falseCurly++;
      }
    }
    expect(n).toBe(40);
    expect(falseCurly).toBeLessThanOrEqual(2);
  });

  it("le graffe VERE in contesto restano graffe (nessuna perdita)", () => {
    let seen = 0;
    let n = 0;
    for (const expr of ["{3}", "{2+1}", "5{x}", "{4-2}3"]) {
      for (let s = 1; s <= 8; s++) {
        n++;
        const curly = rewriteBrackets(ink(expr, 4100 + s * 137 + expr.length)).brackets.filter((b) => b.kind === "curly").length;
        if (curly === 2) seen++;
      }
    }
    expect(n).toBe(32);
    // a H=38 con pixel interi la graffa è la forma più fragile (cuspide di pochi pixel): misurate 24/32
    // coppie estratte, IDENTICO a prima della regola (curlyStats: 0 graffe vere perse su 728).
    // Tutti i semi sono fissi: se scende, qualcuno ha reso più severa la classificazione delle graffe.
    expect(seen).toBeGreaterThanOrEqual(24);
  });
});

describe("pezzo di SOLE parentesi piccole: completeBracketOnly", () => {
  it("«[(» «)(» «{[(»: tutte le parentesi estratte, nessun tratto al modello", () => {
    const a = rewriteBrackets(ink("[(", 9205));
    expect(a.strokes).toHaveLength(0);
    expect(a.brackets.map((b) => b.kind)).toEqual(["square", "round"]);
    const b = rewriteBrackets(ink(")(", 1236));
    expect(b.strokes).toHaveLength(0);
    expect(b.brackets.map((x) => x.kind)).toEqual(["round", "round"]);
    expect(b.brackets.map((x) => x.isOpen)).toEqual([false, true]);
    const c = rewriteBrackets(ink("{[(", 1409));
    expect(c.strokes).toHaveLength(0);
    expect(c.brackets.map((x) => x.kind)).toEqual(["curly", "square", "round"]);
  });

  it("con una CIFRA nel pezzo non si estrae tutto: la cifra resta all'inchiostro", () => {
    // «(3»: una tonda + una cifra → il pezzo NON è di sole parentesi
    for (const seed of [9205, 1236, 1409, 77, 78, 79]) {
      const r = rewriteBrackets(ink("(3", seed));
      expect(r.strokes.length).toBeGreaterThan(0);
    }
    for (const seed of [9205, 1236, 1409, 77, 78, 79]) {
      const r = rewriteBrackets(ink("2(", seed));
      expect(r.strokes.length).toBeGreaterThan(0);
    }
  });
});

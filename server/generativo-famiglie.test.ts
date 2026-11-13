/** TEST GENERATIVO (12/11, richiesta dell'utente: «le migliorie devono essere
 *  generalizzabili a espressioni simili ma con valori diversi»).
 *
 *  Non collauda espressioni singole: GENERA famiglie con parametri casuali
 *  (PRNG con seme fisso → riproducibile) e verifica le PROPRIETÀ del motore:
 *   1. l'esercizio si costruisce (riparaEsercizio accetta strutture IA plausibili);
 *   2. la sezione C.E. contiene ESATTAMENTE i valori vietati veri (mai falsi
 *      vietati come il vecchio «1/2» della deflazione invertita);
 *   3. il risultato finale è verificato dal motore contro la traccia;
 *   4. la deflazione di Ruffini trova ESATTAMENTE le radici razionali dei
 *      polinomi generati, a qualunque grado con radici razionali.
 */
import { describe, it, expect } from "vitest";
import { riparaEsercizio, valoriVietatiPolinomio, contoGiusto } from "./costruisci";
import { parsePolyLoose } from "../client/src/lib/espressioni";

/* PRNG deterministico (mulberry32): la suite è sempre la stessa. */
function prng(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const scelto = <T,>(r: () => number, v: readonly T[]): T => v[Math.floor(r() * v.length)]!;

/** (x+b)² SVILUPPATO: x^{2}+2bx+b^{2} */
function quadratoSviluppato(b: number): string {
  return `x^{2}+${2 * b}x+${b * b}`;
}
/** (x−a)³ (segno 1) o (x+a)³ (segno −1) SVILUPPATI:
 *  x³ ∓ 3a·x² + 3a²·x ∓ a³. */
function cuboSviluppato(a: number, segno: 1 | -1): string {
  const c2 = -segno * 3 * a, c1 = 3 * a * a, c0 = -segno * a * a * a;
  const seg = (v: number) => (v < 0 ? "-" : "+");
  const coe = (v: number) => (Math.abs(v) === 1 ? "" : Math.abs(v));
  return `x^{3}${seg(c2)}${coe(c2)}x^{2}${seg(c1)}${coe(c1)}x${seg(c0)}${Math.abs(c0)}`;
}
/** x−a (segno 1) o x+a (segno −1). */
function binomio(a: number, segno: 1 | -1): string {
  return segno === 1 ? `x-${a}` : `x+${a}`;
}

interface Candidato {
  espressioneLatex: string;
  sezioni: Array<{ title: string; boxes: Array<{ op: string; answerLatex: string; prompt: string }> }>;
  risultatoFinaleLatex: string;
}

/** Famiglia della FOTO: (√((x+b)²) + (∛((x∓a)³))⁻¹) / ((x+c)/d)⁻¹.
 *  Tre varianti di scrittura dei box (0 pulita, 1 radicando originale nei
 *  box radicali, 2 ultimo passaggio distributivo equivalente): esercitano i
 *  fallback di collegamento introdotti il 12/11. */
function candidatoFamiglia(
  variante: number,
  b: number, a: number, segno: 1 | -1, c: number, d: number,
): Candidato {
  const bin = binomio(a, segno); // x−a oppure x+a
  const sq = quadratoSviluppato(b);
  const cb = cuboSviluppato(a, segno);
  const radq = `\\sqrt{${sq}}`;
  const radc = `\\sqrt[3]{${cb}}`;
  const esp = `\\dfrac{${radq}+\\left(${radc}\\right)^{-1}}{\\left(\\dfrac{x+${c}}{${d}}\\right)^{-1}}`;
  // Dopo la radice pari rimane il valore assoluto, senza ipotesi sul segno.
  const base = `\\left|x+${b}\\right|`;
  const reciproco = `\\dfrac{1}{\\left(${bin}\\right)}`;
  const fattore = `\\dfrac{x+${c}}{${d}}`;
  const somma = `\\left(${base}+${reciproco}\\right)\\cdot${fattore}`;
  const distributiva = `\\left(${base}\\cdot${fattore}\\right)+\\left(${reciproco}\\cdot${fattore}\\right)`;
  const finale = variante === 2 ? distributiva : somma;
  return {
    espressioneLatex: esp,
    sezioni: [
      {
        title: "SCOMPOSIZIONE",
        boxes: [
          { op: sq, answerLatex: `\\left(x+${b}\\right)^{2}`, prompt: "Riconosco il quadrato perfetto di un binomio." },
          { op: cb, answerLatex: `\\left(${bin}\\right)^{3}`, prompt: "Riconosco il cubo perfetto di un binomio." },
        ],
      },
      {
        title: "CALCOLI",
        boxes: [
          { op: variante === 1 ? radq : `\\sqrt{${sq}}`, answerLatex: base, prompt: "Svolgo la radice quadrata." },
          { op: variante === 1 ? radc : `\\sqrt[3]{${cb}}`, answerLatex: bin, prompt: "Svolgo la radice cubica." },
          { op: `\\left(${bin}\\right)^{-1}`, answerLatex: reciproco, prompt: "Inverto la potenza con esponente negativo." },
          { op: `\\left(\\dfrac{x+${c}}{${d}}\\right)^{-1}`, answerLatex: `\\dfrac{${d}}{x+${c}}`, prompt: "Inverto la frazione." },
          { op: somma, answerLatex: finale, prompt: "Sommo i termini omogenei." },
        ],
      },
    ],
    risultatoFinaleLatex: finale,
  };
}

describe("TEST GENERATIVO — famiglie con valori diversi", () => {
  it("famiglia della foto: 30 espressioni con parametri diversi si costruiscono con C.E. esatta", () => {
    const r = prng(20261112);
    const bs = [1, 2, 3, 4, 5, 6] as const;
    const as = [1, 2, 3] as const;
    const cs = [1, 2, 4] as const;
    const ds = [2, 3, 5] as const;
    let costruiti = 0;
    for (let k = 0; k < 30; k++) {
      const b = scelto(r, bs), a = scelto(r, as), c = scelto(r, cs), d = scelto(r, ds);
      const segno: 1 | -1 = r() < 0.5 ? 1 : -1;
      const variante = k % 3;
      const candidato = candidatoFamiglia(variante, b, a, segno, c, d);
      const esito = riparaEsercizio(candidato as never);
      const p = `variante=${variante} b=${b} a=${a} segno=${segno} c=${c} d=${d}: ${JSON.stringify(esito.problemi)}`;
      expect(esito.esercizio, p).not.toBeNull();
      costruiti++;
      const e = esito.esercizio!;
      // C.E.: ESATTAMENTE i vietati veri — a o −a (dal cubo sotto esponente −1)
      // e −c (dalla frazione invertita); DEDUPLICATI per valore.
      const valori = new Set<string>();
      for (const s of e.sezioni) {
        for (const bx of s.boxes as Array<{ condizioniEsistenza?: boolean; answerLatex: string }>) {
          if (bx.condizioniEsistenza) valori.add(bx.answerLatex);
        }
      }
      const attesi = new Set([String(segno === 1 ? a : -a), String(-c)]);
      expect([...valori].sort(), `C.E. errata con ${p}: trovati ${[...valori].join(", ")}`)
        .toEqual([...attesi].sort());
      // il finale è verificato dal motore contro la TRACCIA (mai risultato sbagliato)
      expect(contoGiusto(candidato.espressioneLatex, e.risultatoFinaleLatex).ok,
        `finale non verificato con ${p}`).toBe(true);
    }
    expect(costruiti).toBe(30);
  });

  it("deflazione di Ruffini: radici ESATTE su 40 polinomi generati (grado 2–4)", () => {
    const r = prng(9097);
    const gcd = (p: number, q: number): number => (q ? gcd(q, p % q) : Math.abs(p));
    for (let k = 0; k < 40; k++) {
      const grado = scelto(r, [2, 3, 4] as const);
      const radici: number[] = [];
      for (let g = 0; g < grado; g++) radici.push(scelto(r, [-3, -2, -1, 1, 2, 3, 4, 5] as const));
      // polinomio MONICO con le radici date: moltiplicazione simbolica di (x − ri)
      let gradi = new Map<number, { n: number; d: number }>([[0, { n: 1, d: 1 }]]);
      for (const ri of radici) {
        const out = new Map<number, { n: number; d: number }>();
        const agg = (gg: number, num: number, den: number) => {
          const vec = out.get(gg) ?? { n: 0, d: 1 };
          const nu = vec.n * den + num * vec.d;
          const de = vec.d * den;
          const m = gcd(nu, de) || 1;
          out.set(gg, { n: nu / m, d: de / m });
        };
        for (const [g, co] of gradi) { agg(g + 1, co.n, co.d); agg(g, -ri * co.n, co.d); }
        gradi = out;
      }
      const termini: string[] = [];
      for (let g = radici.length; g >= 0; g--) {
        const co = gradi.get(g);
        if (!co || co.n === 0) continue;
        const espo = g === 0 ? "" : g === 1 ? "x" : `x^{${g}}`;
        const coef = Math.abs(co.n) === 1 && g > 0 ? "" : Math.abs(co.n);
        termini.push(`${termini.length === 0 ? (co.n < 0 ? "-" : "") : co.n < 0 ? "-" : "+"}${coef}${espo}`);
      }
      const latex = termini.join("");
      const p = parsePolyLoose(latex);
      expect(p, `parse di ${latex}`).not.toBeNull();
      const v = valoriVietatiPolinomio(p!);
      expect(v, `vietati di ${latex}`).not.toBeNull();
      const trovati = new Set(v!.map((x) => x.valore));
      const attesi = new Set(radici.map((ri) => String(ri)));
      expect([...trovati].sort(), `radici di ${latex} (attese ${radici.join(", ")})`)
        .toEqual([...attesi].sort());
    }
  });

  it("polinomio senza radici razionali: NESSUN falso vietato (x²+2, x³−2, x²−2x+2)", () => {
    expect(valoriVietatiPolinomio(parsePolyLoose("x^{2}+2")!)).toBeNull();
    expect(valoriVietatiPolinomio(parsePolyLoose("x^{3}-2")!)).toBeNull();
    expect(valoriVietatiPolinomio(parsePolyLoose("x^{2}-2x+2")!)).toBeNull();
  });
});

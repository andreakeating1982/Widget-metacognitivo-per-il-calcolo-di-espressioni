/** Rende la risposta già verificata dal motore come testo da digitare.
 * Non calcola, non inserisce e non modifica la risposta dello studente.
 * Le parentesi intorno a frazioni, radicandi ed esponenti conservano la
 * struttura anche per formule annidate. */
import { normalizeInput, parseExpression, type Node, type Term } from "./espressioni";

function frazione(n: number, d: number): string {
  return d === 1 ? String(n) : `(${n})/(${d})`;
}

function termine(t: Term): string {
  const lettere = t.vars.map(v => v.e === 1 ? v.v : `${v.v}^(${v.e})`).join("*");
  if (!lettere) return frazione(t.c.n, t.c.d);
  if (t.c.n === t.c.d) return lettere;
  if (t.c.n === -t.c.d) return `-${lettere}`;
  return `${frazione(t.c.n, t.c.d)}*${lettere}`;
}

function senzaParentesi(n: Node): Node {
  return n.k === "paren" ? senzaParentesi(n.a) : n;
}

function fattore(n: Node): string {
  const s = stampa(n);
  return n.k === "add" || n.k === "sub" || n.k === "neg" ? `(${s})` : s;
}

function stampa(n: Node): string {
  switch (n.k) {
    case "num":
      // I periodici diventano la frazione esatta, accettata dal campo.
      return n.dec && !/\\(?:overline|bar)/.test(n.dec)
        ? n.dec.replace(",", ".") : frazione(n.v.n, n.v.d);
    case "var": return n.name;
    case "term": return termine(n.t);
    case "paren": return `(${stampa(n.a)})`;
    case "neg": return `-${fattore(n.a)}`;
    case "add": return `${stampa(n.a)}+${stampa(n.b)}`;
    case "sub": return `${stampa(n.a)}-${n.b.k === "add" || n.b.k === "sub" || n.b.k === "neg" ? `(${stampa(n.b)})` : stampa(n.b)}`;
    case "mul": return `${fattore(n.a)}*${fattore(n.b)}`;
    case "div": return `(${stampa(senzaParentesi(n.a))})/(${stampa(senzaParentesi(n.b))})`;
    case "pow": return `(${stampa(senzaParentesi(n.a))})^(${n.e})`;
    case "powfrac": return `(${stampa(senzaParentesi(n.a))})^(${n.m}/${n.n})`;
    case "sqrt": return `(${stampa(senzaParentesi(n.a))})^(1/2)`;
    case "root": return `(${stampa(senzaParentesi(n.a))})^(${n.n < 0 ? "-" : ""}1/${Math.abs(n.n)})`;
    // (12/11) VALORE ASSOLUTO: formato calcolatrice con le barre |…|.
    case "abs": return `|${stampa(n.a)}|`;
    case "rat": {
      const polinomio = (p: Term[]) => p.length ? p.map(termine).join("+").replace(/\+-/g, "-") : "0";
      return `(${polinomio(n.num)})/(${polinomio(n.den)})`;
    }
  }
}

/** null = il formato non è convertibile senza rischiare una risposta errata. */
export function soluzioneInFormatoCalcolatrice(latex: string): string | null {
  try {
    const sorgente = (latex ?? "").trim();
    if (!sorgente) return null;
    const ast = parseExpression(normalizeInput(sorgente, true));
    return stampa(ast);
  } catch {
    return null;
  }
}


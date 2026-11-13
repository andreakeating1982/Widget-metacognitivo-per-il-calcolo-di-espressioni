/** Somme di frazioni che contengono valori assoluti o radicali.
 *
 * Le parti non razionali sono trattate come ATOMI FORMALI distinti. Una
 * identità provata per atomi indipendenti vale anche quando sono radicali
 * o moduli (sul dominio originale). Non si deduce mai la disuguaglianza
 * dal fallimento della prova: due atomi diversi potrebbero essere legati
 * da altre identità matematiche. Nessuna valutazione a campione è una prova.
 */
import { normalizeInput, parseExpression, printLatex, rationalPolyEquals, type Node } from "./espressioni";

function leggi(s: string): Node {
  if (!s.trim() || s.length > 1800 || s.includes("=")) throw new Error("Espressione non supportata");
  return parseExpression(normalizeInput(s, true));
}

function senzaParentesi(n: Node): Node {
  while (n.k === "paren") n = n.a;
  return n;
}

/** true soltanto se l'identità razionale è dimostrata ESATTAMENTE; null
 * significa «non deciso», non «diverso». */
export function uguaglianzaRazionaleConAtomi(a: string, b: string): true | null {
  try {
    const first = leggi(a), second = leggi(b);
    const lettere = new Set<string>();
    let nodi = 0;
    const raccogli = (n: Node, depth: number): void => {
      if (++nodi > 1200 || depth > 80) throw new Error("Espressione troppo complessa");
      switch (n.k) {
        case "var": lettere.add(n.name); return;
        case "term": n.t.vars.forEach(v => lettere.add(v.v)); return;
        case "add": case "sub": case "mul": case "div": raccogli(n.a, depth + 1); raccogli(n.b, depth + 1); return;
        case "paren": case "neg": case "pow": case "powfrac": case "sqrt": case "root": case "abs": raccogli(n.a, depth + 1); return;
        case "rat": throw new Error("Nodo razionale interno non supportato");
        case "num": return;
      }
    };
    raccogli(first, 0); raccogli(second, 0);
    const libere = [..."qwrtuvpmnoijklhgfedsabcxyz"].filter(l => !lettere.has(l));
    const atomi = new Map<string, string>();
    const trasforma = (n: Node): Node => {
      switch (n.k) {
        case "abs": case "sqrt": case "root": case "powfrac": {
          // printLatex nasce dal medesimo parser per entrambi i membri: un
          // atomo viene riutilizzato SOLO se il suo contenuto è identico.
          const key = `${n.k}:${printLatex(n)}`;
          let lettera = atomi.get(key);
          if (!lettera) {
            lettera = libere[atomi.size];
            if (!lettera) throw new Error("Troppi atomi distinti");
            atomi.set(key, lettera);
          }
          return { k: "var", name: lettera };
        }
        case "paren": case "neg": case "pow": return { ...n, a: trasforma(n.a) };
        case "add": case "sub": case "mul": case "div": return { ...n, a: trasforma(n.a), b: trasforma(n.b) };
        case "rat": throw new Error("Nodo razionale interno non supportato");
        default: return n;
      }
    };
    const prova = rationalPolyEquals(printLatex(trasforma(first)), printLatex(trasforma(second)));
    return prova === true ? true : null;
  } catch {
    return null;
  }
}

/** Formula generale A/B ± C/D → (A·D ± C·B)/(B·D). Ritorna una scrittura
 * solo quando la sua identità è dimostrata esattamente; resta invariato il
 * dominio originario e i fattori non razionali non vengono mai eliminati. */
export function sommaFrazioniConAtomi(s: string): string | null {
  try {
    const n = senzaParentesi(leggi(s));
    if (n.k !== "add" && n.k !== "sub") return null;
    const uno: Node = { k: "num", v: { n: 1, d: 1 } };
    const isOne = (v: Node) => {
      const x = senzaParentesi(v);
      return x.k === "num" && x.v.n === x.v.d;
    };
    const mul = (x: Node, y: Node): Node => isOne(x) ? y : isOne(y) ? x : { k: "mul", a: x, b: y };
    // Un addendo può essere un prodotto come (3/4)·(x−2): il suo
    // denominatore è 4, non 1. Esploriamo solo prodotti e quozienti;
    // somme, radicali e moduli rimangono fattori intatti e distinti.
    const parti = (v: Node, depth = 0): { num: Node; den: Node; frazione: boolean } => {
      if (depth > 40) throw new Error("Espressione troppo complessa");
      const x = senzaParentesi(v);
      if (x.k === "mul" || x.k === "div") {
        const a = parti(x.a, depth + 1), b = parti(x.b, depth + 1);
        return x.k === "mul"
          ? { num: mul(a.num, b.num), den: mul(a.den, b.den), frazione: a.frazione || b.frazione }
          : { num: mul(a.num, b.den), den: mul(a.den, b.num), frazione: true };
      }
      if (x.k === "neg") {
        const a = parti(x.a, depth + 1);
        return { ...a, num: { k: "neg", a: a.num } };
      }
      return { num: v, den: uno, frazione: false };
    };
    const a = parti(n.a), b = parti(n.b);
    if (!a.frazione && !b.frazione) return null;
    const sinistra = mul(a.num, b.den), destra = mul(b.num, a.den);
    const num: Node = n.k === "add"
      ? { k: "add", a: sinistra, b: destra }
      : { k: "sub", a: sinistra, b: destra };
    const den = mul(a.den, b.den);
    const risultato = printLatex({ k: "div", a: num, b: den, fr: true });
    return uguaglianzaRazionaleConAtomi(s, risultato) === true ? risultato : null;
  } catch {
    return null;
  }
}


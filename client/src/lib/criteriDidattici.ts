/** Forma richiesta da specifici passaggi guidati. L'uguaglianza matematica
 * viene sempre verificata separatamente con il motore esatto: questi criteri
 * distinguono soltanto un calcolo realmente svolto dall'operazione ripetuta. */
import { normalizeInput, parseExpression, parsePolyLoose, printLatex, termKey, type Node } from "./espressioni";
import { normalizeKeyboardNotation } from "./keyboardNotation";

export type CriterioDidattico = "frazione_unica" | "prodotto_svolto" | "somma_ridotta" | "radicale_trasformato";

function srotola(nodo: Node): Node {
  let n = nodo;
  while (n.k === "paren") n = n.a;
  return n;
}

function haProdottoDaDistribuire(nodo: Node): boolean {
  const n = srotola(nodo);
  if (n.k === "mul") {
    const a = srotola(n.a), b = srotola(n.b);
    if (a.k === "add" || a.k === "sub" || b.k === "add" || b.k === "sub") return true;
    return haProdottoDaDistribuire(a) || haProdottoDaDistribuire(b);
  }
  if (n.k === "add" || n.k === "sub" || n.k === "div") return haProdottoDaDistribuire(n.a) || haProdottoDaDistribuire(n.b);
  if (n.k === "neg" || n.k === "pow" || n.k === "powfrac" || n.k === "sqrt" || n.k === "root") return haProdottoDaDistribuire(n.a);
  return false;
}

function termini(nodo: Node): Node[] {
  const n = srotola(nodo);
  if (n.k === "add" || n.k === "sub") return [...termini(n.a), ...termini(n.b)];
  if (n.k === "neg") return termini(n.a);
  return [n];
}

/** Conta i denominatori che contengono radicali, senza calcolare nulla. */
function contieneRadice(n: Node): boolean {
  if (n.k === "sqrt" || n.k === "root") return true;
  if (n.k === "add" || n.k === "sub" || n.k === "mul" || n.k === "div") return contieneRadice(n.a) || contieneRadice(n.b);
  if (n.k === "paren" || n.k === "neg" || n.k === "pow" || n.k === "powfrac") return contieneRadice(n.a);
  return false;
}

function denominatoriConRadice(n: Node): number {
  if (n.k === "div") return Number(contieneRadice(n.b)) + denominatoriConRadice(n.a) + denominatoriConRadice(n.b);
  if (n.k === "add" || n.k === "sub" || n.k === "mul") return denominatoriConRadice(n.a) + denominatoriConRadice(n.b);
  if (n.k === "paren" || n.k === "neg" || n.k === "pow" || n.k === "powfrac" || n.k === "sqrt" || n.k === "root") return denominatoriConRadice(n.a);
  return 0;
}

/** true se la forma può rappresentare il passo richiesto. Non richiede una
 * grafia identica alla risposta attesa: ordine, segni e forme equivalenti
 * restano liberi, purché il singolo calcolo chiesto sia stato svolto. */
export function formaDidatticaValida(criterio: CriterioDidattico | undefined, risposta: string, operazione?: string): boolean {
  if (!criterio) return true;
  try {
    // In questo campo '/' indica frazione; i ':' restano divisioni.
    const rispostaNormalizzata = criterio === "radicale_trasformato" && !risposta.includes("\\")
      ? normalizeKeyboardNotation(risposta) : risposta;
    let n = srotola(parseExpression(normalizeInput(rispostaNormalizzata.replace(/\//g, "⁄"), true)));
    if (criterio === "radicale_trasformato") {
      if (!operazione) return false;
      const originale = parseExpression(normalizeInput(operazione.replace(/\//g, "⁄"), true));
      const prima = denominatoriConRadice(originale);
      return prima > 0 && denominatoriConRadice(n) < prima;
    }
    if (criterio === "frazione_unica") {
      if (n.k === "neg") n = srotola(n.a);
      return n.k === "div";
    }
    if (haProdottoDaDistribuire(n)) return false;
    if (criterio === "prodotto_svolto") return true;
    const visti = new Set<string>();
    for (const pezzo of termini(n)) {
      const p = parsePolyLoose(printLatex(pezzo));
      if (!p || p.length !== 1) continue;
      const chiave = termKey(p[0]);
      if (visti.has(chiave)) return false;
      visti.add(chiave);
    }
    return true;
  } catch {
    return false;
  }
}


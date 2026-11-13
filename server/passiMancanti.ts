/** Recupero conservativo di un passaggio che l'IA ha saltato.
 *
 * Si aggiungono al massimo tre operazioni tra numeri INTERI o radici
 * perfette di interi già visibili (o rese visibili da un passo precedente)
 * e, se necessario, l'unione di frazioni con lo STESSO denominatore.
 * I risultati sono risposte NASCOSTE di nuovi box: non vengono inseriti per
 * lo studente. Se i passaggi non collegano ESATTAMENTE il box successivo,
 * non si interviene e il consueto rifiuto della costruzione rimane attivo.
 */
import { evalPoly, normalizeInput, parseExpression, polyToLatex, printLatex, type Node } from "../client/src/lib/espressioni";
import { replaceExpressionStep, sameExpressionStructure } from "../client/src/lib/progressiveExpression";
import type { BoxAI } from "./costruisci";

type Passo = Pick<BoxAI, "op" | "answerLatex" | "prompt" | "simbolico">;

function sparenta(n: Node): Node {
  while (n.k === "paren") n = n.a;
  return n;
}
function interoScritto(n: Node): boolean {
  const t = sparenta(n);
  if (t.k === "neg") return interoScritto(t.a);
  return t.k === "num" && !t.dec && t.v.d === 1 && Number.isSafeInteger(t.v.n);
}
function figli(n: Node): Node[] {
  switch (n.k) {
    case "add": case "sub": case "mul": case "div": return [n.a, n.b];
    case "paren": case "neg": case "pow": case "powfrac": case "sqrt": case "root": case "abs": return [n.a];
    default: return [];
  }
}
function nodi(raw: string): Node[] {
  const root = parseExpression(normalizeInput(raw, true));
  const found: Node[] = [];
  function visit(n: Node, depth: number): void {
    if (depth > 50 || found.length >= 400) throw new Error("Espressione troppo complessa");
    for (const f of figli(n)) visit(f, depth + 1);
    found.push(n);
  }
  visit(root, 0);
  return found;
}
function collegabile(riga: string, op: string, risposta: string): boolean {
  return replaceExpressionStep(riga, op, risposta) !== null;
}
function promptNumerico(n: Node): string {
  switch (n.k) {
    case "mul": return "Moltiplico i numeri tra loro.";
    case "add": return "Sommo i numeri tra loro.";
    case "sub": return "Sottraggo i numeri tra loro.";
    case "div": return "Semplifico la frazione dividendo per lo stesso numero.";
    case "pow": return "Moltiplico la base per sé stessa tante volte quanto indica l'esponente.";
    case "sqrt": case "root": return "Svolgo la radice indicata.";
    default: return "Calcolo il valore dell'operazione.";
  }
}
function candidatiNumerici(riga: string): Passo[] {
  const out: Passo[] = [];
  const seen = new Set<string>();
  for (const n of nodi(riga)) {
    const binario = n.k === "mul" || n.k === "add" || n.k === "sub" || n.k === "div";
    if (binario) {
      if (!interoScritto(n.a) || !interoScritto(n.b)) continue;
      if (n.k === "div" && sparenta(n.b).k === "num" && (sparenta(n.b) as {v:{n:number}}).v.n === 0) continue;
    } else if (n.k === "pow") {
      if (!interoScritto(n.a) || !Number.isInteger(n.e) || Math.abs(n.e) > 12) continue;
    } else if (n.k === "sqrt" || n.k === "root") {
      // Solo radici esatte di interi: evalPoly sotto rifiuta quelle non
      // perfette e fuori dal dominio reale. Non tocchiamo radici letterali
      // o con indice negativo e non sopprimiamo mai i valori assoluti.
      if (!interoScritto(n.a) || (n.k === "root" && n.n < 0)) continue;
    } else continue;
    try {
      const p = evalPoly(n);
      if (p.some(t => t.vars.length) || p.length > 1) continue;
      const op = printLatex(n), answerLatex = polyToLatex(p);
      if (!answerLatex || sameExpressionStructure(op, answerLatex) || seen.has(op)) continue;
      seen.add(op);
      out.push({ op, answerLatex, prompt: promptNumerico(n) });
      if (out.length >= 25) break;
    } catch { /* caso non esatto: non si propone */ }
  }
  return out;
}
function frazioneComune(riga: string, target: string, risposta: string): Passo | null {
  // Se il box successivo è già presente non aggiungere un raggruppamento
  // estraneo. Il ponte serve solo se crea davvero il bersaglio mancante.
  if (collegabile(riga, target, risposta)) return null;
  for (const n of nodi(riga)) {
    if (n.k !== "add" && n.k !== "sub") continue;
    const a = sparenta(n.a), b = sparenta(n.b);
    if (a.k !== "div" || b.k !== "div" || !a.fr || !b.fr) continue;
    if (!sameExpressionStructure(printLatex(a.b), printLatex(b.b))) continue;
    const numerator: Node = n.k === "add"
      ? { k: "add", a: a.a, b: b.a }
      : { k: "sub", a: a.a, b: b.a };
    const grouped = printLatex({ k: "div", a: numerator, b: a.b, fr: true });
    // Il box successivo può riguardare l'intera frazione O soltanto un
    // sottotermine appena creato (ad esempio il suo numeratore). In entrambi
    // i casi la sostituzione strutturale qui sotto deve riuscire davvero.
    const op = printLatex(n);
    const r = replaceExpressionStep(riga, op, grouped);
    if (!r || !collegabile(r, target, risposta)) continue;
    return { op, answerLatex: grouped, prompt: "Scrivo le frazioni con lo stesso denominatore in un'unica frazione.", simbolico: true };
  }
  return null;
}

/** Il confronto dell'intera riga per equivalenza non deve trasformare
 * implicitamente i conti numerici ancora visibili: ognuno deve comparire
 * anche nell'operazione proposta, altrimenti lo studente non lo vede. */
export function contiNumericiSaltati(riga: string, op: string): boolean {
  try {
    const presenti = nodi(op).map((n) => printLatex(n));
    return candidatiNumerici(riga).some((c) =>
      !presenti.some((p) => sameExpressionStructure(c.op, p)),
    );
  } catch {
    return true; // non verificabile: non permettere un salto
  }
}

/** Restituisce box intermedi solo quando si riesce poi a collegare il box
 * originale; null non modifica la catena. Ogni box va riverificato dal chiamante. */
export function individuaPassiMancanti(riga: string, op: string, risposta: string): Passo[] | null {
  if (!riga || !op || !risposta || riga.length > 6000 || op.length > 4000) return null;
  try {
    const gruppo = frazioneComune(riga, op, risposta);
    if (gruppo) return [gruppo];
    // Ricerca limitata di una breve catena: ad esempio, se manca sia la
    // sottrazione tra parentesi sia il prodotto successivo, lo studente
    // riceve DUE box distinti, mai il risultato già calcolato.
    const coda: { riga: string; passi: Passo[] }[] = [{ riga, passi: [] }];
    const visti = new Set([riga]);
    let esaminati = 0;
    while (coda.length && esaminati++ < 80) {
      const stato = coda.shift()!;
      if (stato.passi.length >= 3) continue;
      for (const numerico of candidatiNumerici(stato.riga)) {
        const dopo = replaceExpressionStep(stato.riga, numerico.op, numerico.answerLatex);
        if (!dopo || visti.has(dopo)) continue;
        visti.add(dopo);
        const passi = [...stato.passi, numerico];
        if (collegabile(dopo, op, risposta)) return passi;
        const raccolta = frazioneComune(dopo, op, risposta);
        if (raccolta) return [...passi, raccolta];
        if (passi.length < 3 && visti.size < 80) coda.push({ riga: dopo, passi });
      }
    }
    return null;
  } catch { return null; }
}


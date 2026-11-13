/** Percorso deterministico per due frazioni con denominatori coniugati.
 *
 * È intenzionalmente circoscritto: due frazioni letterali sommate/sottratte,
 * numeratori monomiali e denominatori strutturalmente A-B e A+B. In tutti
 * gli altri casi si lascia operare il normale costruttore IA. I risultati
 * sono soltanto le risposte attese, mai visibili prima dell'inserimento
 * dello studente. Ogni sostituzione viene ricontrollata dal motore esatto.
 */
import {
  normalizeInput, parseExpression, parsePolyLoose, polyEquals, polyToLatex,
  printLatex, termKey, type Node,
} from "../client/src/lib/espressioni";
import { evalRat } from "../client/src/lib/fratte";
import { replaceExpressionStep, sameExpressionStructure } from "../client/src/lib/progressiveExpression";
import type { BoxAI, EsercizioAI } from "./costruisci";

function senzaParentesi(node: Node): Node {
  let n = node;
  while (n.k === "paren") n = n.a;
  return n;
}

function testoNodo(node: Node): string {
  return printLatex(senzaParentesi(node));
}

function stessiNodi(a: Node, b: Node): boolean {
  return sameExpressionStructure(testoNodo(a), testoNodo(b));
}

function polinomioRisultato(espressione: string): string | null {
  const p = parsePolyLoose(espressione);
  return p === null ? null : polyToLatex(p);
}

type Addendo = { segno: 1 | -1; nodo: Node };

/* Qui si esplorano solo le parentesi introdotte dal percorso stesso nel
 * numeratore, non si cambiano le parentesi originali dell'espressione. */
function addendi(nodo: Node, segno: 1 | -1 = 1): Addendo[] {
  const n = senzaParentesi(nodo);
  if (n.k === "add") return [...addendi(n.a, segno), ...addendi(n.b, segno)];
  if (n.k === "sub") return [...addendi(n.a, segno), ...addendi(n.b, segno === 1 ? -1 : 1)];
  if (n.k === "neg") return addendi(n.a, segno === 1 ? -1 : 1);
  if (n.k === "num" && n.v.n < 0) {
    return [{ segno: segno === 1 ? -1 : 1, nodo: { ...n, v: { ...n.v, n: -n.v.n } } }];
  }
  return [{ segno, nodo: n }];
}

function primaCoppiaSimile(numeratore: Node): [Addendo, Addendo] | null {
  const gruppi = new Map<string, Addendo[]>();
  for (const a of addendi(numeratore)) {
    const p = parsePolyLoose(printLatex(a.nodo));
    if (!p || p.length !== 1) continue;
    const chiave = termKey(p[0]);
    const gruppo = gruppi.get(chiave) ?? [];
    gruppo.push(a);
    if (gruppo.length === 2) return [gruppo[0], gruppo[1]];
    gruppi.set(chiave, gruppo);
  }
  return null;
}

function operazioneCoppia([a, b]: [Addendo, Addendo]): string {
  return `${a.segno < 0 ? "-" : ""}${printLatex(a.nodo)}${b.segno < 0 ? "-" : "+"}${printLatex(b.nodo)}`;
}

/** Crea un candidato, o null se la forma non è riconosciuta con sicurezza.
 * Il chiamante deve ancora passarlo a riparaEsercizio e trascrizioneFedele. */
export function costruisciFrazioniConiugate(input: string): EsercizioAI | null {
  try {
    // La barra dell'editor è una frazione; ':' continua a indicare divisione.
    const sorgente = parseExpression(normalizeInput(input.replace(/\//g, "⁄"), true));
    const espressioneLatex = printLatex(sorgente);
    const radice = senzaParentesi(sorgente);
    if (radice.k !== "add" && radice.k !== "sub") return null;
    const sx = senzaParentesi(radice.a), dx = senzaParentesi(radice.b);
    if (sx.k !== "div" || dx.k !== "div" || !sx.fr || !dx.fr) return null;
    const d1 = senzaParentesi(sx.b), d2 = senzaParentesi(dx.b);
    if (!((d1.k === "add" && d2.k === "sub") || (d1.k === "sub" && d2.k === "add"))) return null;
    if (!stessiNodi(d1.a, d2.a) || !stessiNodi(d1.b, d2.b)) return null;
    // Il percorso riguarda frazioni letterali con numeratori monomiali.
    if (!/[a-z]/i.test(`${testoNodo(d1)}${testoNodo(d2)}`.replace(/\\[a-zA-Z]+/g, ""))) return null;
    const p1 = parsePolyLoose(testoNodo(sx.a)), p2 = parsePolyLoose(testoNodo(dx.a));
    if (!p1 || !p2 || p1.length !== 1 || p2.length !== 1) return null;
    if ([...p1, ...p2].some(t => t.vars.some(v => v.e < 0))) return null;

    const n1 = testoNodo(sx.a), n2 = testoNodo(dx.a);
    const den1 = testoNodo(sx.b), den2 = testoNodo(dx.b);
    const op1 = `\\left(${n1}\\right)\\cdot\\left(${den2}\\right)`;
    // Nella sottrazione il segno meno accompagna il secondo numeratore:
    // l'operazione resta da fare, ma i successivi termini sono raggruppabili.
    const secondoNumeratore = radice.k === "sub" ? `-\\left(${n2}\\right)` : n2;
    const op2 = `\\left(${secondoNumeratore}\\right)\\cdot\\left(${den1}\\right)`;
    const opDen = `\\left(${den1}\\right)\\cdot\\left(${den2}\\right)`;
    const unicaFrazione = `\\dfrac{${op1}+${op2}}{${opDen}}`;
    const risposta1 = polinomioRisultato(op1), risposta2 = polinomioRisultato(op2);
    const rispostaDen = polinomioRisultato(opDen);
    if (!risposta1 || !risposta2 || !rispostaDen) return null;

    // Non promettere un finale ridotto se è necessaria una cancellazione
    // tra numeratore e denominatore: quel caso rimane al percorso generale.
    const denEspanso = parsePolyLoose(rispostaDen);
    const ridotta = evalRat(sorgente);
    if (!denEspanso?.length || !ridotta.den.length || !polyEquals(denEspanso, ridotta.den)) return null;

    const sezioni: EsercizioAI["sezioni"] = [
      { title: "DENOMINATORE COMUNE", boxes: [
        { op: espressioneLatex, answerLatex: unicaFrazione, simbolico: true,
          criterioDidattico: "frazione_unica", prompt: "Porto le frazioni allo stesso denominatore." },
      ] },
      { title: "SVOLGO IL NUMERATORE", boxes: [
        { op: op1, answerLatex: risposta1, simbolico: true, criterioDidattico: "prodotto_svolto",
          prompt: "Moltiplico ogni termine tra parentesi." },
        { op: op2, answerLatex: risposta2, simbolico: true, criterioDidattico: "prodotto_svolto",
          prompt: "Moltiplico ogni termine tra parentesi." },
      ] },
    ];
    let riga = espressioneLatex;
    const applica = (box: BoxAI): boolean => {
      const successiva = replaceExpressionStep(riga, box.op, box.answerLatex);
      if (!successiva) return false;
      riga = successiva;
      return true;
    };
    for (const box of sezioni.flatMap(s => s.boxes)) if (!applica(box)) return null;

    // Raggruppare DUE termini simili per box: nessuna somma viene svolta
    // automaticamente. Al massimo dodici passaggi; altrimenti fallback IA.
    for (let i = 0; i < 12; i++) {
      const frazione = senzaParentesi(parseExpression(normalizeInput(riga, true)));
      if (frazione.k !== "div") return null;
      const coppia = primaCoppiaSimile(frazione.a);
      if (!coppia) break;
      const op = operazioneCoppia(coppia);
      const risposta = polinomioRisultato(op);
      if (risposta === null) return null;
      const box: BoxAI = { op, answerLatex: risposta, simbolico: true, criterioDidattico: "somma_ridotta",
        prompt: "Raggruppo e sommo i termini simili." };
      if (!applica(box)) return null;
      sezioni[1].boxes.push(box);
      if (i === 11) return null;
    }

    const frazione = senzaParentesi(parseExpression(normalizeInput(riga, true)));
    if (frazione.k !== "div") return null;
    const ultimo: BoxAI = {
      op: testoNodo(frazione.b), answerLatex: rispostaDen, simbolico: true,
      criterioDidattico: "prodotto_svolto",
      prompt: "Riconosco una somma per differenza e calcolo la differenza dei quadrati.",
    };
    if (!applica(ultimo)) return null;
    sezioni.push({ title: "PRODOTTO NOTEVOLE AL DENOMINATORE", boxes: [ultimo] });

    return { espressioneLatex, sezioni, righeProgressive: [espressioneLatex], risultatoFinaleLatex: riga };
  } catch {
    // Nessuna supposizione su strutture o dominio non supportati.
    return null;
  }
}


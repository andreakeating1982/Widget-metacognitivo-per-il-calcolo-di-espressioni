import { evaluateNumericExpression, normalizeInput, parseExpression, parsePolyLoose, polyToLatex, rationalPolyEquals, printLatex, type Node } from "./espressioni";
import { replaceExpressionStep, sameExpressionStructure } from "./progressiveExpression";
import { uguaglianzaRazionaleConAtomi } from "./frazioniConAtomi";
import { contenutiPerCondizioniDiSegno, scritturaConModuliSottintesi } from "./moduliSottintesi";

/** Il server ha già verificato la catena originale. Questo ramo non cambia
 * mai l'archivio: sostituisce ogni |A| con A solo nell'intersezione fra le
 * C.E. originali e TUTTE le ipotesi A>=0, mostrate esplicitamente a studente
 * e nel PDF. Fuori da tale intersezione non viene dichiarato alcun risultato. */
export interface BoxPerRamo {
  id: string; op: string; answer: number; answerLatex: string;
  prompt?: string; extraLatex?: string; rispostaAttesa?: string;
  simbolico?: boolean; criterioDidattico?: "frazione_unica" | "prodotto_svolto" | "somma_ridotta" | "radicale_trasformato";
  condizioniEsistenza?: true; soluzioneCe?: string;
}
export interface EsercizioPerRamo {
  espressioneLatex: string;
  sezioni: { title: string; boxes: BoxPerRamo[] }[];
  righeProgressive: string[];
  risultatoFinaleLatex: string;
  condizioniGenerali?: string[];
  ipotesiDiSegno?: string[];
}
export type EsitoRamo = { ok: true; esercizio: EsercizioPerRamo; applicato: boolean }
  | { ok: false; motivo: string };

const senzaParen = (n: Node): Node => n.k === "paren" ? senzaParen(n.a) : n;
function fattori(n: Node): Node[] {
  const unwrapped = senzaParen(n);
  return unwrapped.k === "mul" ? [...fattori(unwrapped.a), ...fattori(unwrapped.b)] : [n];
}
function prodotto(nodi: Node[]): Node {
  if (!nodi.length) return { k: "num", v: { n: 1, d: 1 } };
  return nodi.slice(1).reduce<Node>((a,b)=>({k:"mul",a,b}),nodi[0]);
}
/** Rimuove un solo fattore comune già presente al numeratore e denominatore.
 * La divisione originaria richiede denominatore diverso da zero; l'uguaglianza
 * è verificata esattamente con gli atomi simbolici. Nessun fattore inventato. */
function cancellaUnFattore(latex: string): string | null {
  try {
    const root = senzaParen(parseExpression(normalizeInput(latex,true)));
    if (root.k !== "div" || !root.fr) return null;
    const sopra = fattori(root.a), sotto = fattori(root.b);
    if (sopra.length < 2 || sotto.length < 2) return null;
    for (let i=0;i<sopra.length;i++) for(let j=0;j<sotto.length;j++) {
      const a = senzaParen(sopra[i]), b = senzaParen(sotto[j]);
      // Non cancellare costanti (compreso zero) o espressioni problematiche.
      if (a.k === "num" || b.k === "num") continue;
      if (!sameExpressionStructure(printLatex(a),printLatex(b))) continue;
      const n=sopra.filter((_,k)=>k!==i), d=sotto.filter((_,k)=>k!==j);
      const nuovo=printLatex({k:"div",a:prodotto(n),b:prodotto(d),fr:true});
      if (uguaglianzaRazionaleConAtomi(latex,nuovo) === true) return nuovo;
    }
  } catch { /* se non verificabile non si aggiunge alcun passaggio */ }
  return null;
}

/** Evita espansioni potenzialmente esplosive in formule caricate dall'utente.
 * La continuazione automatica è facoltativa: se il caso eccede i limiti,
 * si mantiene la frazione verificata senza inventare altre trasformazioni. */
function polinomioLimitato(nodo:Node, profondita=0): number {
  if (profondita>20) return 100;
  const n=senzaParen(nodo);
  switch(n.k) {
    case "num": return Math.abs(n.v.n)<=1000000 && n.v.d<=1000000 ? 1 : 100;
    case "var": return 1;
    case "term": return n.t.vars.every(v=>Number.isInteger(v.e)&&v.e>=0&&v.e<=6) ? 1 : 100;
    case "neg": return polinomioLimitato(n.a,profondita+1);
    case "add": case "sub": return Math.min(100,polinomioLimitato(n.a,profondita+1)+polinomioLimitato(n.b,profondita+1));
    case "mul": return Math.min(100,polinomioLimitato(n.a,profondita+1)*polinomioLimitato(n.b,profondita+1));
    case "pow": return Number.isInteger(n.e)&&n.e>=0&&n.e<=6 ? Math.min(100,Math.pow(polinomioLimitato(n.a,profondita+1),n.e)) : 100;
    default:return 100;
  }
}

/** Ulteriori piccoli calcoli polinomiali resi possibili dalla riscrittura:
 * prima distribuisco un monomio su una parentesi, poi raccolgo termini simili.
 * Aggiungo un box solo se la trasformazione locale e l'intera riga sono
 * verificate esattamente e il collegamento strutturale è riuscito. */
function prossimoCalcoloPolinomiale(riga: string): {op:string; risposta:string; riga:string; prompt:string} | null {
  try {
    const radice=parseExpression(normalizeInput(riga,true));
    const nodi: {nodo:Node; dentroSomma:boolean}[]=[];
    const visita=(n:Node, dentroSomma=false) => {
      const discendeSomma=dentroSomma || n.k==="add" || n.k==="sub";
      if ("a" in n && n.a && typeof n.a === "object") visita(n.a as Node,discendeSomma);
      if ("b" in n && n.b && typeof n.b === "object") visita(n.b as Node,discendeSomma);
      nodi.push({nodo:n,dentroSomma});
    };
    const principale=senzaParen(radice);
    // Conservare il denominatore fattorizzato: permette di leggere le C.E.
    visita(principale.k==="div" ? principale.a : principale);
    const eSomma=(n:Node)=>{const x=senzaParen(n);return x.k==="add" || x.k==="sub";};
    const monomio=(n:Node)=>{if(polinomioLimitato(n)>32)return false;const p=parsePolyLoose(printLatex(n));return !!p && p.length===1;};
    for (const modo of ["distribuzione", "termini"] as const) for (const {nodo,dentroSomma} of nodi) {
      if (modo==="distribuzione" && !(dentroSomma && nodo.k==="mul" && ((monomio(nodo.a)&&eSomma(nodo.b))||(monomio(nodo.b)&&eSomma(nodo.a))))) continue;
      if (modo==="termini" && !(nodo.k==="add" || nodo.k==="sub")) continue;
      if (polinomioLimitato(nodo)>32) continue;
      const op=printLatex(nodo), p=parsePolyLoose(op);
      if (!p || p.length>8) continue;
      const risposta=polyToLatex(p);
      if (!risposta || sameExpressionStructure(op,risposta) || rationalPolyEquals(op,risposta)!==true) continue;
      const successiva=replaceExpressionStep(riga,op,risposta);
      if (!successiva || sameExpressionStructure(riga,successiva) || uguaglianzaRazionaleConAtomi(riga,successiva)!==true) continue;
      return {op,risposta,riga:successiva,prompt:modo==="distribuzione"?"Applico la proprietà distributiva.":"Riduco i termini simili."};
    }
  } catch { /* nessuna trasformazione non verificata */ }
  return null;
}

export function creaRamoConCondizioni(ex: EsercizioPerRamo): EsitoRamo {
  const sorgenti: string[] = [ex.espressioneLatex, ex.risultatoFinaleLatex,
    ...ex.righeProgressive, ...(ex.condizioniGenerali ?? [])];
  for (const section of ex.sezioni) for (const box of section.boxes) {
    sorgenti.push(box.op, box.answerLatex);
    if (box.extraLatex) sorgenti.push(box.extraLatex);
    if (box.soluzioneCe) sorgenti.push(box.soluzioneCe);
  }
  const contenuti: string[]=[];
  let applicato=false;
  for (const s of sorgenti) {
    const trovati=contenutiPerCondizioniDiSegno(s);
    if (trovati === null) return {ok:false,motivo:"Non riesco a leggere con sicurezza un valore assoluto. Il percorso non viene modificato."};
    if (trovati.length) applicato=true;
    for (const c of trovati) {
      // Una condizione numerica falsa definirebbe un ramo vuoto: mai fingere
      // che la trasformazione sia valida (per esempio |-8| -> -8).
      const valore=evaluateNumericExpression(c);
      if (valore !== null) {
        if (valore < 0) return {ok:false,motivo:"Una condizione di segno necessaria è impossibile: questo percorso senza valore assoluto non è applicabile."};
        continue;
      }
      if (!contenuti.some(t=>sameExpressionStructure(t,c) || t.replace(/\s+/g,"")===c.replace(/\s+/g,""))) contenuti.push(c);
    }
  }
  if (!applicato) return {ok:true,esercizio:ex,applicato:false};
  const converti=(s:string)=>scritturaConModuliSottintesi(s).latex;
  const sezioni=ex.sezioni.map(s=>({...s,boxes:s.boxes.map(b=>{
    const answerLatex=converti(b.answerLatex);
    return {...b,op:converti(b.op),answerLatex,
      extraLatex:b.extraLatex ? converti(b.extraLatex):undefined,
      soluzioneCe:b.soluzioneCe ? converti(b.soluzioneCe):undefined,
      rispostaAttesa:b.rispostaAttesa ? converti(b.rispostaAttesa):undefined};
  })}));
  const nuovo:EsercizioPerRamo={...ex,sezioni,
    righeProgressive:ex.righeProgressive.map((r,i)=>i===0 ? r : converti(r)),
    risultatoFinaleLatex:converti(ex.risultatoFinaleLatex),
    condizioniGenerali:ex.condizioniGenerali?.map(converti),
    ipotesiDiSegno:contenuti.map(c=>`${c} \\ge 0`)};
  // La riscrittura può rendere possibile una semplificazione che in generale
  // non lo era. Aggiungiamo box separati, non soluzioni già scritte.
  for (let i=0;i<12;i++) {
    const prima=nuovo.risultatoFinaleLatex;
    const dopo=cancellaUnFattore(prima);
    if (!dopo || sameExpressionStructure(prima,dopo)) break;
    const id=`b${nuovo.sezioni.reduce((n,s)=>n+s.boxes.length,0)+1}`;
    nuovo.sezioni[nuovo.sezioni.length-1].boxes.push({id,op:prima,answer:NaN,answerLatex:dopo,
      rispostaAttesa:dopo,simbolico:true,criterioDidattico:"frazione_unica",
      prompt:"Semplifico il fattore comune al numeratore e al denominatore."});
    nuovo.righeProgressive.push(dopo);
    nuovo.risultatoFinaleLatex=dopo;
  }
  for (let i=0;i<12;i++) {
    const passo=prossimoCalcoloPolinomiale(nuovo.risultatoFinaleLatex);
    if (!passo) break;
    const id=`b${nuovo.sezioni.reduce((n,s)=>n+s.boxes.length,0)+1}`;
    nuovo.sezioni[nuovo.sezioni.length-1].boxes.push({id,op:passo.op,answer:NaN,answerLatex:passo.risposta,
      rispostaAttesa:passo.risposta,simbolico:true,prompt:passo.prompt});
    nuovo.righeProgressive.push(passo.riga);
    nuovo.risultatoFinaleLatex=passo.riga;
  }
  return {ok:true,esercizio:nuovo,applicato:true};
}


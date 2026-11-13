import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, PartyPopper, Star } from "lucide-react";
import katex from "katex";
import {
  parsePolyLoose,
  polyEquals,
  rationalPolyEquals,
  evaluateNumericExpression,
  normalizeInput,
  parseExpression,
  type Node,
} from "@/lib/espressioni";
import { NumberInputCanvas, normalizeTypedValueNotation } from "@/components/NumberInputCanvas";
import { exactNumericEquality, hasRadical } from "@/lib/numericRadicalEquality";
import { verificaPerSostituzione } from "@/lib/verificaSostituzione";
import { uguaglianzaRazionaleConAtomi } from "@/lib/frazioniConAtomi";
import { uniformaVirgoleDecimaliLatex } from "@/lib/appNotationLatex";
import { formaDidatticaValida, type CriterioDidattico } from "@/lib/criteriDidattici";
import { sameExpressionStructure } from "@/lib/progressiveExpression";
import { scritturaConModuliSottintesi } from "@/lib/moduliSottintesi";
import { creaRamoConCondizioni } from "@/lib/ramoCondizionato";

/* ═══════════════════════════════════════════════════════════════════
   WIDGET METACOGNITIVO PER IL CALCOLO DI ESPRESSIONI — pagina di svolgimento
   Un'unica espressione fissa, risolta con i passaggi minimi decisi
   con l'utente (11 box). Filosofia dell'app, pedissequamente:
   - UN solo risultato semplice per box, MAI compilato dall'app:
     ogni «=» è vuoto e attende la mano (o la tastiera) dello studente;
   - rivelazione progressiva: il box successivo appare solo dopo la
     convalida del precedente;
   - frazioni SEMPRE impilate (\dfrac), MAI decimali con la virgola;
   - moltiplicazione con il puntino (·), mai la x;
   - feedback per tipo di sbaglio, MAI il risultato;
   - RISULTATO FINALE in marrone nell'ultimo passaggio.
   ═══════════════════════════════════════════════════════════════════ */

function katexHtml(latex: string, displayMode: boolean = true): string {
  try {
    return katex.renderToString(uniformaVirgoleDecimaliLatex(latex), { displayMode, throwOnError: false, strict: false });
  } catch {
    return latex;
  }
}

/* ─── Dati dell'esercizio ────────────────────────────────────────── */

interface Box {
  id: string;
  op: string;            // LaTeX dell'operazione (frazione impilata)
  prompt?: string;       // frase didattica sotto (metodo, non risultato)
  extraLatex?: string;   // LaTeX aggiuntivo (es. forma capovolta della divisione)
  answer: number;        // valore atteso (si accettano forme equivalenti)
  answerLatex: string;   // mostrato dopo la risposta esatta o su esplicita richiesta
  /* (26/10, app UNIVERSALE) box con LETTERE: la risposta si verifica per
     FORMA (polinomi identici) o per sostituzione, non come numero */
  simbolico?: boolean;
  rispostaAttesa?: string;
  criterioDidattico?: CriterioDidattico;
  /* (12/11) box CONDIZIONI DI ESISTENZA: non ha una riga progressiva (non
     cambia l'espressione) e la risposta risolta è una implicazione. */
  condizioniEsistenza?: true;
  soluzioneCe?: string;
}

/* Confronto delle risposte: verifica razionale esatta oppure, per radicali
   numerici, valutazione dell'intera scrittura. Nessuna uguaglianza basata
   unicamente sulla sostituzione delle lettere in un punto. */
export function stessaForma(op: string, attesa: string, scritta: string): boolean {
  void op;
  const testo = normalizeTypedValueNotation(scritta);
  // Una risposta con lo stesso albero è esattamente la stessa espressione,
  // anche con più di tre lettere (limite della sostituzione numerica).
  // Il criterio didattico viene comunque verificato separatamente dal box.
  if (sameExpressionStructure(attesa, testo)) return true;
  // Le forme razionali si confrontano ESATTAMENTE, compresi i denominatori:
  // una sola sostituzione non è una prova di equivalenza.
  const razionale = rationalPolyEquals(attesa, testo);
  if (razionale !== null) return razionale;
  const numericoEsatto = exactNumericEquality(attesa, testo);
  if (numericoEsatto !== null) return numericoEsatto;
  /* (08/11, radicali con lettere) √((a²−1)/3):(3a+3): le risposte dei box
     con radici E lettere (quoziente dei radicali, razionalizzazione…) non
     hanno né forma razionale né valore numerico diretto. Stessa strada già
     collaudata sul server: sostituzione numerica multipla (tornate con
     negativi incluse), false al primo campione che differisce, null se i
     campioni validi sono troppo pochi. Prima del fallback polinomiale,
     come nel motore di costruzione. */
  const sostituzione = verificaPerSostituzione(attesa, testo);
  // La prova con atomi è algebrica, ma prima accertiamo che esistano
  // campioni reali e che la risposta non restringa il dominio.
  if (sostituzione === true && uguaglianzaRazionaleConAtomi(attesa, testo) === true) return true;
  if (sostituzione !== null) return sostituzione;
  // Le radici letterali sono valutabili solo quando la trasformazione è
  // valida sui reali; il motore rifiuta i casi che richiedono il modulo.
  const pA = parsePolyLoose(attesa), pS = parsePolyLoose(testo);
  return pA !== null && pS !== null && polyEquals(pA, pS);
}

/** Accetta la scrittura convenzionale richiesta nel solo campo del box.
 * Il confronto matematico generale e la risposta originale restano invariati:
 * |A| NON viene mai dichiarato uguale ad A sul dominio reale.
 * Se l'intera risposta è un unico modulo, accettiamo forme equivalenti del
 * suo contenuto; per moduli inseriti in formule composte confrontiamo invece
 * la struttura, evitando cancellazioni ingiustificate tra moduli sottintesi. */
export function rispostaCompatibileConModuliSottintesi(op: string, attesa: string, scritta: string): boolean {
  if (stessaForma(op, attesa, scritta)) return true;
  const convenzionale = scritturaConModuliSottintesi(attesa);
  if (!convenzionale.moduliOmissi) return false;
  if (sameExpressionStructure(convenzionale.latex, normalizeTypedValueNotation(scritta))) return true;
  return convenzionale.unSoloModuloIntero && stessaForma(op, convenzionale.latex, scritta);
}

/* (26/10-fix4, foto utente «2 dato per sbagliato»): in un box SIMBOLICO la
   risposta può arrivare anche dal percorso NUMERICO (canvas o tastiera):
   una cifra scritta a mano riconosciuta come cifra non ha lettere, e il
   campo DIGITA con «2» valuta 2 senza pubblicare testo simbolico. Il box
   con lettere accetta ENTRAMBE le vie: forma (stessaForma) oppure valore
   numerico identico alla risposta attesa (quando è un numero puro). */
function boxRisposto(
  b: Box,
  valore: number | null | undefined,
  testo: string | null | undefined,
): boolean {
  if (b.simbolico) {
    if (testo != null && !!b.rispostaAttesa && rispostaCompatibileConModuliSottintesi(b.op, b.rispostaAttesa, testo) && formaDidatticaValida(b.criterioDidattico, testo, b.op)) return true;
    // I passi con una forma richiesta conservano il testo originale: non
    // accettare il valore già calcolato dal parser al posto della scrittura.
    if (b.criterioDidattico && (b.criterioDidattico !== "radicale_trasformato" || !!testo?.trim())) return false;
    const convenzionale = b.rispostaAttesa != null ? scritturaConModuliSottintesi(b.rispostaAttesa) : null;
    // Un valore numerico non basta a verificare la struttura di più moduli:
    // potrebbe nascondere una cancellazione non valida.
    if (convenzionale?.moduliOmissi && !convenzionale.unSoloModuloIntero) return false;
    const attesaNum = convenzionale ? evaluateNumericExpression(convenzionale.latex) : null;
    if (valore == null || attesaNum == null || !b.rispostaAttesa) return false;
    // Una radice irrazionale non diventa corretta per arrotondamento.
    if (hasRadical(b.rispostaAttesa)) return exactNumericEquality(b.rispostaAttesa, String(valore)) === true;
    return Math.abs(valore - attesaNum) < 1e-9;
  }
  return valore != null && Math.abs(valore - b.answer) < 1e-9;
}

/* ─── (7/11, richiesta utente) PAGINA FINALE DI FEEDBACK ──────────
   Come nella foto del modello: stelline e numero di risposte giuste
   AL PRIMO COLPO, sul totale delle risposte che lo studente doveva
   dare per risolvere tutta l'espressione (un box = una risposta).
   Definizione senza falsi errori: è «al primo colpo» il box la cui
   PRIMA risposta pubblicata (canvas RICONOSCI o tastiera ✎, che
   pubblicano UN valore per invio) era già quella giusta. */

/* Prima risposta pubblicata per un box: valore numerico oppure testo
   simbolico. Null/"" non conta come tentativo (cancellare non è rispondere). */
export interface PrimoValore {
  valore: number | null;
  testo: string | null;
}

export function registraPrimoValore(
  precedenti: Record<string, PrimoValore>,
  id: string,
  valore: number | null,
  testo: string | null,
): Record<string, PrimoValore> {
  if (valore == null && (testo == null || testo.trim() === "")) return precedenti;
  if (precedenti[id]) return precedenti; // la prima risposta resta quella
  return { ...precedenti, [id]: { valore, testo } };
}

export function conteggioPrimoColpo(
  boxes: Box[],
  primi: Record<string, PrimoValore>,
): { primoColpo: number; totale: number } {
  let primoColpo = 0;
  for (const b of boxes) {
    const p = primi[b.id];
    if (p && boxRisposto(b, p.valore, p.testo)) primoColpo += 1;
  }
  return { primoColpo, totale: boxes.length };
}

/* Cinque stelle solo quando tutte le risposte sono giuste al primo colpo.
   Negli altri casi la proporzione dà da una a quattro stelle; zero resta zero. */
export function stellePerPrimoColpo(primoColpo: number, totale: number): number {
  if (!Number.isFinite(primoColpo) || !Number.isFinite(totale) || totale <= 0 || primoColpo <= 0) return 0;
  if (primoColpo >= totale) return 5;
  return Math.max(1, Math.min(4, Math.floor((primoColpo / totale) * 5)));
}

/* Messaggio breve e incoraggiante: «ottimo» è riservato a chi ha dato
   tutte le risposte giuste al primo colpo. Nessuna valutazione negativa. */
export function messaggioPerStelle(stelle: number): string {
  if (stelle >= 5) return "OTTIMO LAVORO!";
  if (stelle >= 3) return "HAI FATTO UN BUON LAVORO!";
  return "CONTINUA A ESERCITARTI!";
}

/* ─── (7/11, richiesta utente) REGOLA DI TRASCRIZIONE DEI RISULTATI
   FRAZIONARI — quando la risposta attesa è una frazione con numeratore o
   denominatore composti, lo schema generico si aggiunge al testo normale
   del metodo: niente riquadri e mai la soluzione. Le parentesi tonde dello
   schema sono un esempio: il controllo accetta anche quadre e graffe
   bilanciate, pure se annidate, preservando la forma scritta dallo studente. */

/* Riconoscimento strutturale: non confondere una frazione unica con una
   somma che ne contiene una. Per esempio, x + 1/(x+2) NON deve ricevere
   l'indicazione di racchiudere l'intera somma come numeratore. */
function senzaSegnoOParentesi(nodo: Node): Node {
  let n = nodo;
  while (n.k === "paren" || n.k === "neg") n = n.a;
  return n;
}

function parteSemplice(nodo: Node): boolean {
  const n = senzaSegnoOParentesi(nodo);
  if (n.k === "num" || n.k === "var") return true;
  if (n.k === "term") return n.t.vars.length <= 1;
  if (n.k === "pow") {
    const base = senzaSegnoOParentesi(n.a);
    return base.k === "num" || base.k === "var";
  }
  // Un solo coefficiente e una lettera, anche con esponente: 3x, 2x².
  if (n.k === "mul") {
    const a = senzaSegnoOParentesi(n.a), b = senzaSegnoOParentesi(n.b);
    const variabile = (x: Node) => x.k === "var" ||
      (x.k === "pow" && senzaSegnoOParentesi(x.a).k === "var");
    return (a.k === "num" && variabile(b)) || (b.k === "num" && variabile(a));
  }
  return false;
}

/** Istruzioni solo per una frazione composta, con o senza parentesi esterne.
 * Il parser gestisce LaTeX e barra di frazione, senza eseguire alcun conto. */
export function rispostaFrazionariaComposta(rispostaAttesa?: string | null): boolean {
  if (!rispostaAttesa?.trim()) return false;
  try {
    const n = senzaSegnoOParentesi(parseExpression(normalizeInput(rispostaAttesa.replace(/\//g, "⁄"), true)));
    if (n.k === "div" && n.fr) return !parteSemplice(n.a) || !parteSemplice(n.b);
    // Il parser può rappresentare 3x/(x+1) come 3 · (x/(x+1)).
    if (n.k === "mul") {
      const a = senzaSegnoOParentesi(n.a), b = senzaSegnoOParentesi(n.b);
      const frac = a.k === "div" && a.fr && b.k !== "div" ? a :
        b.k === "div" && b.fr && a.k !== "div" ? b : null;
      if (frac) {
        const altro = frac === a ? b : a;
        return !parteSemplice({ k: "mul", a: altro, b: frac.a }) || !parteSemplice(frac.b);
      }
    }
    return false;
  } catch {
    return false;
  }
}

interface Section {
  title: string;
  boxes: Box[];
}

const ESERCIZIO: Section[] = [
  {
    title: "1. RISOLVO LE PARENTESI TONDE (PRIMO BLOCCO)",
    boxes: [
      {
        id: "b1",
        op: "\\dfrac{1}{4}+\\dfrac{7}{8}",
        prompt: "Porto allo stesso denominatore: mcm(4, 8) = 8.",
        answer: 9 / 8,
        answerLatex: "\\dfrac{9}{8}",
      },
      {
        id: "b2",
        op: "\\dfrac{9}{8}-\\dfrac{3}{4}",
        prompt: "Porto allo stesso denominatore: 8.",
        answer: 3 / 8,
        answerLatex: "\\dfrac{3}{8}",
      },
      {
        id: "b3",
        op: "\\left(\\dfrac{3}{2}\\right)^{2}",
        prompt: "Applico la proprietà della potenza: eleva sia il numeratore che il denominatore alla seconda.",
        answer: 9 / 4,
        answerLatex: "\\dfrac{9}{4}",
      },
      {
        id: "b4",
        op: "\\dfrac{3}{8}:\\dfrac{9}{4}",
        prompt: "Per dividere, giro la seconda frazione e moltiplico:",
        extraLatex: "\\dfrac{3}{8}\\cdot\\dfrac{4}{9}",
        answer: 1 / 6,
        answerLatex: "\\dfrac{1}{6}",
      },
    ],
  },
  {
    title: "2. RISOLVO LE PARENTESI QUADRE (PRIMO BLOCCO)",
    boxes: [
      {
        id: "b5",
        op: "2+\\dfrac{1}{5}+\\dfrac{1}{3}-\\dfrac{1}{6}",
        prompt: "Porto tutto al denominatore comune: mcm(5, 3, 6) = 30.",
        answer: 71 / 30,
        answerLatex: "\\dfrac{71}{30}",
      },
    ],
  },
  {
    title: "3. RISOLVO LE PARENTESI TONDE (SECONDO BLOCCO)",
    boxes: [
      {
        id: "b6",
        op: "1-\\dfrac{3}{5}",
        answer: 2 / 5,
        answerLatex: "\\dfrac{2}{5}",
      },
      {
        id: "b7",
        op: "\\left(\\dfrac{2}{5}\\right)^{2}",
        prompt: "Applico la proprietà della potenza: eleva sia il numeratore che il denominatore alla seconda.",
        answer: 4 / 25,
        answerLatex: "\\dfrac{4}{25}",
      },
      {
        id: "b8",
        op: "\\dfrac{4}{25}\\cdot\\dfrac{15}{4}",
        prompt: "Semplifico: 4 con 4 e 15 con 25.",
        answer: 3 / 5,
        answerLatex: "\\dfrac{3}{5}",
      },
      {
        id: "b9",
        op: "\\dfrac{1}{2}+\\dfrac{2}{5}-\\dfrac{3}{5}",
        prompt: "Porto tutto al denominatore comune: mcm(2, 5, 5) = 10.",
        answer: 3 / 10,
        answerLatex: "\\dfrac{3}{10}",
      },
    ],
  },
  {
    title: "4. RISOLVO LE PARENTESI QUADRE (SECONDO BLOCCO)",
    boxes: [
      {
        id: "b10",
        op: "\\dfrac{3}{5}+\\dfrac{3}{10}",
        prompt: "Porto allo stesso denominatore: 10.",
        answer: 9 / 10,
        answerLatex: "\\dfrac{9}{10}",
      },
    ],
  },
  {
    title: "5. ESEGUO L'ULTIMA DIVISIONE",
    boxes: [
      {
        id: "b11",
        op: "\\dfrac{71}{30}:\\dfrac{9}{10}",
        prompt: "Per dividere, giro la seconda frazione e moltiplico:",
        extraLatex: "\\dfrac{71}{30}\\cdot\\dfrac{10}{9}",
        answer: 71 / 27,
        answerLatex: "\\dfrac{71}{27}",
      },
    ],
  },
];

const TUTTI_I_BOX: Box[] = ESERCIZIO.flatMap((s) => s.boxes);

const ESPRESSIONE_COMPLETA =
  "\\left[2+\\dfrac{1}{5}+\\dfrac{1}{3}-\\left(\\dfrac{1}{4}+\\dfrac{7}{8}-\\dfrac{3}{4}\\right):\\left(\\dfrac{3}{2}\\right)^{2}\\right]:\\left[\\left(1-\\dfrac{3}{5}\\right)^{2}\\cdot\\dfrac{15}{4}+\\left(\\dfrac{1}{2}+\\dfrac{2}{5}-\\dfrac{3}{5}\\right)\\right]";

/* ─── Informazioni dello studente (dalla prima pagina) ───────────── */

function useStudentInfo(): { cognome: string; nome: string; data: string; classe: string } {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      cognome: params.get("cognome")?.trim() || "",
      nome: params.get("nome")?.trim() || "",
      data: params.get("data")?.trim() || "",
      classe: params.get("classe")?.trim() || "",
    };
  }, []);
}

/* ─── Card di un box ─────────────────────────────────────────────── */

function BoxCard({
  box,
  index,
  value,
  onChange,
  testoLibero,
  onTestoLibero,
  rigaProgressiva,
}: {
  box: Box;
  index: number;
  /* (27/10, correzione utente) la riga del PDF che corrisponde a questo box:
     l'INTERA espressione accorciata con il risultato appena calcolato */
  rigaProgressiva?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /* (26/10) box con LETTERE: lo studente scrive la forma da tastiera (✎)
     e il confronto è simbolico, non numerico */
  testoLibero?: string | null;
  onTestoLibero?: (t: string | null) => void;
}) {
  /* (26/10-fix4) confronto unificato: forma simbolica O valore numerico */
  const corretto = boxRisposto(box, value, testoLibero);
  // Tutti i dati di questo box provengono dal ramo condizionato preparato
  // all'apertura: risposte, calcoli e righe successive usano le stesse ipotesi.
  const operazioneConvenzionale = scritturaConModuliSottintesi(box.op);
  const rispostaConvenzionale = scritturaConModuliSottintesi(box.answerLatex);
  const soluzioneCeConvenzionale = box.soluzioneCe ? scritturaConModuliSottintesi(box.soluzioneCe) : null;
  const rigaConvenzionale = rigaProgressiva ? scritturaConModuliSottintesi(rigaProgressiva) : null;
  const risolta = box.condizioniEsistenza && soluzioneCeConvenzionale
    ? `${operazioneConvenzionale.latex} \\Rightarrow ${soluzioneCeConvenzionale.latex}`
    : `${operazioneConvenzionale.latex} = ${rispostaConvenzionale.latex}`;
  const formaDaCompletare = !!box.criterioDidattico && !!testoLibero?.trim() && !!box.rispostaAttesa &&
    rispostaCompatibileConModuliSottintesi(box.op, box.rispostaAttesa, testoLibero) && !formaDidatticaValida(box.criterioDidattico, testoLibero, box.op);
  const istruzioneFrazione = !!box.simbolico && rispostaFrazionariaComposta(box.rispostaAttesa);
  // Adegua anche le sessioni precedenti, senza riscrivere l'esercizio salvato.
  const testoMetodo = istruzioneFrazione && /^porto le frazioni allo stesso denominatore\.?$/i.test(box.prompt?.trim() ?? "")
    ? "Porto la frazione allo stesso denominatore."
    : box.prompt;

  return (
    <div
      className="rounded-[14px] border border-[#E5E0D8] bg-[#FDFBF8] p-3.5 md:p-4"
      data-box={box.id}
    >
      <p className="mb-2 text-center text-sm font-bold tracking-wide text-[#8B3A1A]">
        BOX {index}
      </p>
      <div
        className="max-w-full overflow-x-auto text-center text-lg leading-loose text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        role="region"
        aria-label={`Operazione del box ${index}: scorri orizzontalmente se necessario`}
        tabIndex={0}
      >
        <div className="w-max min-w-full" dangerouslySetInnerHTML={{ __html: katexHtml(box.op) }} />
      </div>
      {(testoMetodo || istruzioneFrazione) && (
        <p lang="it" className={`mt-2 break-words hyphens-auto text-center ${istruzioneFrazione ? "text-[1.167rem]" : "text-base"} text-foreground`}>
          {testoMetodo}
          {istruzioneFrazione && (
            <span data-testid="istruzione-trascrizione-frazione">
              {testoMetodo ? " " : ""}Scrivo così il risultato: (numeratore)/<wbr />(denominatore)
            </span>
          )}
        </p>
      )}
      {box.extraLatex && (
        <div
          className="mt-1 max-w-full overflow-x-auto text-center text-lg leading-loose text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          role="region"
          aria-label={`Passaggio del box ${index}: scorri orizzontalmente se necessario`}
          tabIndex={0}
        >
          <div className="w-max min-w-full" dangerouslySetInnerHTML={{ __html: katexHtml(box.extraLatex) }} />
        </div>
      )}
      {corretto ? (
        <>
          <div
            className="mt-2 max-w-full overflow-x-auto text-center text-lg font-bold text-success focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            role="region"
            aria-label={`Calcolo verificato del box ${index}: scorri orizzontalmente se necessario`}
            tabIndex={0}
          >
            <div className="w-max min-w-full" dangerouslySetInnerHTML={{ __html: katexHtml(risolta) }} />
          </div>
          {/* (27/10, foto collage_matematico + correzione utente) pillola PIÙ
              CHIARA del box (bianca sul fondo crema #FDFBF8) con L'INTERA
              ESPRESSIONE accorciata — la stessa riga progressiva del PDF,
              con il risultato del box già sostituito — scritta in BLU.
              Sempre presente in ogni box numerato risolto correttamente,
              sia numerico sia simbolico (lettere/radicali). Fallback: il
              solo pezzo risolto se le righe progressive mancano. */}
          <div className="mt-2 flex justify-center">
            <div
              className="inline-block max-w-full overflow-x-auto rounded-xl border border-[#E5E0D8] bg-white px-5 py-2 text-center text-lg text-[#2563EB] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              data-testid="pillola-formula-risolta"
              role="region"
              aria-label={`Espressione dopo il box ${index}: scorri orizzontalmente se necessario`}
              tabIndex={0}
            >
              <div className="w-max min-w-full" dangerouslySetInnerHTML={{
                __html: katexHtml(rigaConvenzionale?.latex ?? risolta),
              }} />
            </div>
          </div>
        </>
      ) : box.simbolico ? (
        /* (26/10) box con LETTERE: niente canvas numerico — solo la tastiera
           (✎), con le stesse regole di trascrizione del resto del widget.
           (26/10, foto «3 radice di 15»): risposta con RADICALE ma senza
           lettere → l'hint parla di radicali, non di lettere (es. 3√15). */
        <>
          {/* (7/11, richiesta esplicita) niente suggerimenti verdi con la
              lampadina sulla modalità di scrittura: bastano le istruzioni
              in nero di ogni box (l'op del box è già il metodo). */}
          <NumberInputCanvas
            value={value}
            onChange={onChange}
            label="INSERISCI IL RISULTATO:"
            colorClass="text-primary"
            className="mt-4"
            /* (12/11) i valori vietati della C.E. sono spesso negativi:
             * la scrittura a mano deve accettare il segno meno. */
            allowNegative={!!box.condizioniEsistenza || rispostaConvenzionale.moduliOmissi}
            soluzioneLatex={rispostaConvenzionale.latex}
            symbolicValue={testoLibero ?? undefined}
            onSymbolicValue={onTestoLibero}
            hideValue={!corretto && testoLibero != null && testoLibero.trim() !== ""}
          />
          {(testoLibero != null || value != null) && !corretto && (
            <p className="mt-6 text-center text-[1.167rem] font-bold text-destructive" role="status">
              {formaDaCompletare
                ? box.criterioDidattico === "frazione_unica"
                  ? "RACCOGLI I TERMINI IN UNA SOLA FRAZIONE."
                  : "COMPLETA IL CALCOLO PRIMA DI PROSEGUIRE."
                : "RISULTATO SBAGLIATO. CALCOLA DI NUOVO"}
            </p>
          )}
        </>
      ) : (
        <>
          {/* (27/10, richiesta utente) l'avviso «Scrivi il risultato come frazione
              impilata» è stato ELIMINATO PER SEMPRE: superfluo, non reintrodurlo. */}
          <NumberInputCanvas
            value={value}
            onChange={onChange}
            label="INSERISCI IL RISULTATO:"
            colorClass="text-primary"
            className="mt-4"
            allowNegative={false}
            soluzioneLatex={rispostaConvenzionale.latex}
            hideValue={!corretto && value != null}
          />
          {value != null && (
            <p className="mt-6 text-center text-base font-bold text-destructive">
              RISULTATO SBAGLIATO. CALCOLA DI NUOVO
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Pagina di svolgimento ──────────────────────────────────────── */

/* ─── Generazione del PDF (SCARICA PDF, solo a esercizio completato) ──
   Struttura «come sul quaderno»: l'alunno discalculico ricopia lo
   svolgimento completo dell'espressione. Ogni riga riporta TUTTA
   l'espressione con i risultati via via sostituiti al posto del
   calcolo appena eseguito, così l'espressione si accorcia di passo
   in passo fino al risultato finale:
   - in alto: Cognome e Nome, Classe e Data dello studente;
   - l'espressione completa originaria e le sue riduzioni progressive
     (una per riga, in colonna e centrati, tutti in NERO);
   - chiusura con la scritta RISULTATO FINALE e il risultato 71/27,
     entrambi in marrone; NESSUN «OTTIMO LAVORO, …».
   Se il contenuto è più lungo di una pagina il PDF continua
   naturalmente sulle pagine successive. */

/* La seconda parte dell'espressione, invariata finché i calcoli del
   primo blocco non sono conclusi (box 1-5). */
const SECONDA_PARTE =
  "\\left[\\left(1-\\dfrac{3}{5}\\right)^{2}\\cdot\\dfrac{15}{4}+\\left(\\dfrac{1}{2}+\\dfrac{2}{5}-\\dfrac{3}{5}\\right)\\right]";

/* Le righe progressive del PDF: riga 0 = espressione originaria;
   ogni riga successiva sostituisce il risultato del box corrispondente
   (1: 1/4+7/8 → 9/8; 2: 9/8−3/4 → 3/8; 3: (3/2)^2 → 9/4;
   4: 3/8:9/4 → 1/6; 5: primo blocco → 71/30; 6: 1−3/5 → 2/5;
   7: (2/5)^2 → 4/25; 8: 4/25·15/4 → 3/5; 9: (1/2+2/5−3/5) → 3/10;
   10: 3/5+3/10 → 9/10; quindi 71/30 : 9/10 = 71/27). */
const RIGHE_ESPRESSIONE: string[] = [
  ESPRESSIONE_COMPLETA,
  `\\left[2+\\dfrac{1}{5}+\\dfrac{1}{3}-\\left(\\dfrac{9}{8}-\\dfrac{3}{4}\\right):\\left(\\dfrac{3}{2}\\right)^{2}\\right]:${SECONDA_PARTE}`,
  `\\left[2+\\dfrac{1}{5}+\\dfrac{1}{3}-\\dfrac{3}{8}:\\left(\\dfrac{3}{2}\\right)^{2}\\right]:${SECONDA_PARTE}`,
  `\\left[2+\\dfrac{1}{5}+\\dfrac{1}{3}-\\dfrac{3}{8}:\\dfrac{9}{4}\\right]:${SECONDA_PARTE}`,
  `\\left[2+\\dfrac{1}{5}+\\dfrac{1}{3}-\\dfrac{1}{6}\\right]:${SECONDA_PARTE}`,
  `\\dfrac{71}{30}:${SECONDA_PARTE}`,
  `\\dfrac{71}{30}:\\left[\\left(\\dfrac{2}{5}\\right)^{2}\\cdot\\dfrac{15}{4}+\\left(\\dfrac{1}{2}+\\dfrac{2}{5}-\\dfrac{3}{5}\\right)\\right]`,
  `\\dfrac{71}{30}:\\left[\\dfrac{4}{25}\\cdot\\dfrac{15}{4}+\\left(\\dfrac{1}{2}+\\dfrac{2}{5}-\\dfrac{3}{5}\\right)\\right]`,
  `\\dfrac{71}{30}:\\left[\\dfrac{3}{5}+\\left(\\dfrac{1}{2}+\\dfrac{2}{5}-\\dfrac{3}{5}\\right)\\right]`,
  `\\dfrac{71}{30}:\\left[\\dfrac{3}{5}+\\dfrac{3}{10}\\right]`,
  `\\dfrac{71}{30}:\\dfrac{9}{10}`,
];

/* ─── Esercizio dinamico (costruito con l'IA dalla pagina di trascrizione)
   Lo studente trascrive la SUA espressione e l'IA (verificata con il
   motore esatto: numerico, simbolico o per sostituzione) costruisce box,
   frasi didattiche, righe progressive e risultato finale. L'esercizio
   attivo arriva da GET /api/esercizio/attivo; senza server resta quello
   incluso di default. */

interface EsercizioDinamico {
  espressioneLatex: string;
  sezioni: Section[];
  righeProgressive: string[];
  risultatoFinaleLatex: string;
  condizioniGenerali?: string[];
  ipotesiDiSegno?: string[];
}

/* (26/10, app UNIVERSALE): il server può marcare i box che contengono
   LETTERE (simbolico: true). La risposta dello studente allora non è un
   numero: si confronta la FORMA (polinomi normalizzati identici) oppure,
   se le forme non sono polinomi puri, si accetta la coincidenza per
   sostituzione numerica (lettere = 2, 3, 5…). MAI decimali con la
   virgola, MAI risultati compilati dall'app: solo lo studente scrive. */

const ESERCIZIO_DEFAULT: EsercizioDinamico = {
  espressioneLatex: ESPRESSIONE_COMPLETA,
  sezioni: ESERCIZIO,
  righeProgressive: RIGHE_ESPRESSIONE,
  risultatoFinaleLatex: "\\dfrac{71}{27}",
};

function validaEsercizio(raw: unknown): EsercizioDinamico | null {
  const e = raw as Partial<EsercizioDinamico> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.espressioneLatex !== "string" || !e.espressioneLatex.trim()) return null;
  if (!Array.isArray(e.sezioni) || e.sezioni.length === 0) return null;
  /* (26/10-Opzione A) righe progressive mancanti: non è più un blocco —
     si riparte dall'espressione intera (il PDF usa lo svolgimento VERO) */
  if (!Array.isArray(e.righeProgressive) || e.righeProgressive.length === 0) {
    e.righeProgressive = [String(e.espressioneLatex ?? "")];
  }
  if (typeof e.risultatoFinaleLatex !== "string" || !e.risultatoFinaleLatex.trim()) return null;
  let n = 0;
  const sezioni: Section[] = [];
  for (const s of e.sezioni) {
    if (!s || !Array.isArray(s.boxes) || s.boxes.length === 0) return null;
    const boxes: Box[] = [];
    for (const b of s.boxes) {
      if (!b || typeof b.op !== "string" || typeof b.answerLatex !== "string") return null;
      /* (26/10) i box con LETTERE (marcati dal server, o rilevati qui) non
         sono numeri: la risposta attesa resta come TESTO (rispostaAttesa) e
         lo studente la verifica per forma, non per valore */
      const testoSenzaComandi = b.op.replace(/\\[a-zA-Z]+/g, "");
      /* (26/10, foto «3 radice di 15»): risposta attesa con RADICALE ma
         senza lettere (es. 3√15 = 11,61…): il numero arrotondato NON basta
         — la risposta va verificata come TESTO (forma esatta), altrimenti
         il box rifiuta la risposta corretta scritta dallo studente. */
      const haRadicaleAtteso =
        /\\sqrt|[√∛∜]/.test(b.answerLatex) && !/[a-z]/i.test(b.answerLatex.replace(/\\[a-zA-Z]+/g, ""));
      const simbolico =
        (b as { simbolico?: unknown }).simbolico === true ||
        /[a-z]/i.test(testoSenzaComandi) ||
        parsePolyLoose(b.op)?.some((t) => t.vars.length > 0) === true ||
        haRadicaleAtteso;
      const answer = simbolico ? NaN : evaluateNumericExpression(b.answerLatex);
      /* (26/10-Opzione A) risposta non valutabile come numero: si prova la
         via simbolica invece di bocciare l'esercizio — la pagina 3 si apre
         sempre */
      // Anche un modulo numerico può avere contenuto negativo: conservarne
      // il testo invece di sostituirlo subito col valore numerico del modulo.
      const effettivoSimbolico = simbolico || answer == null || scritturaConModuliSottintesi(b.answerLatex).moduliOmissi;
      n += 1;
      boxes.push({
        id: `b${n}`,
        op: b.op,
        prompt: typeof b.prompt === "string" && b.prompt.trim() ? b.prompt : undefined,
        extraLatex: typeof b.extraLatex === "string" && b.extraLatex.trim() ? b.extraLatex : undefined,
        answer: effettivoSimbolico ? NaN : (answer as number),
        answerLatex: b.answerLatex,
        simbolico: effettivoSimbolico ? true : undefined,
        rispostaAttesa: effettivoSimbolico ? b.answerLatex : undefined,
        criterioDidattico: b.criterioDidattico === "frazione_unica" || b.criterioDidattico === "prodotto_svolto" || b.criterioDidattico === "somma_ridotta" || b.criterioDidattico === "radicale_trasformato"
          ? b.criterioDidattico : undefined,
        condizioniEsistenza: (b as { condizioniEsistenza?: unknown }).condizioniEsistenza === true ? true : undefined,
        soluzioneCe: typeof (b as { soluzioneCe?: unknown }).soluzioneCe === "string" ? (b as { soluzioneCe: string }).soluzioneCe : undefined,
      });
    }
    sezioni.push({ title: typeof s.title === "string" && s.title.trim() ? s.title : "ESERCIZIO", boxes });
  }
  return {
    espressioneLatex: e.espressioneLatex,
    sezioni,
    righeProgressive: e.righeProgressive.map((r) => String(r)).filter((r) => r.trim()),
    risultatoFinaleLatex: e.risultatoFinaleLatex,
    condizioniGenerali: Array.isArray(e.condizioniGenerali)
      ? e.condizioniGenerali.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      : undefined,
  };
}

/* I dati inseriti nella prima pagina arrivano dall'URL: nel documento di
   stampa vanno trattati sempre come testo, non come markup eseguibile. */
function testoSicuroPdf(testo: string): string {
  return testo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Dati su un'unica riga quando entrano. Il conteggio compare subito sotto
   solo nel PDF completo ed è lo stesso oggetto usato dal feedback finale. */
function intestazioneStudentePdf(statistiche?: ReturnType<typeof conteggioPrimoColpo>): string {
  const parametri = new URLSearchParams(window.location.search);
  const cognome = parametri.get("cognome")?.trim() || "";
  const nome = parametri.get("nome")?.trim() || "";
  const classe = parametri.get("classe")?.trim() || "";
  const data = parametri.get("data")?.trim() || "";
  const dati: string[] = [];
  if (cognome || nome) {
    dati.push(`<span class="pdf-studente-nome">${testoSicuroPdf([cognome, nome].filter(Boolean).join(" "))}</span>`);
  }
  if (classe) dati.push(`<span>Classe ${testoSicuroPdf(classe)}</span>`);
  if (data) dati.push(`<span>${testoSicuroPdf(data)}</span>`);
  if (dati.length === 0 && !statistiche) return "";
  const rigaDati = dati.length ? `<div class="pdf-dati-studente">${dati.join(" ")}</div>` : "";
  const punteggio = statistiche
    ? `<div class="pdf-primo-colpo">Risposte giuste al primo colpo: <strong>${statistiche.primoColpo} su ${statistiche.totale}</strong></div>`
    : "";
  return `<header class="pdf-intestazione">${rigaDati}${punteggio}</header>`;
}

/* Righe dello svolgimento «come sul quaderno»: una per riga, in colonna
   e centrate, tutte in NERO (l'espressione sempre per intero, che si
   accorcia di calcolo in calcolo — filosofia del widget). */
function righeSvolgimentoPdf(righe: string[]): string {
  let corpo = "";
  righe.forEach((riga, indice) => {
    corpo += `<div style="margin:${indice === 0 ? "16px" : "10px"} 0;page-break-inside:avoid">${katexHtml(riga)}</div>`;
  });
  return corpo;
}

/* (26/10-fix PDF dinamico) PDF PARZIALE: solo le righe fin qui svolte,
   SENZA scritta RISULTATO FINALE (l'esercizio non è finito: il finale
   non deve comparire in anticipo). */
/* (12/11) riga delle CONDIZIONI DI ESISTENZA nel PDF: dopo l'intestazione,
 * prima dello svolgimento. Una implicazione per ogni denominatore originale. */
function rigaCondizioniEsistenzaPdf(ex: { sezioni: { boxes: Box[] }[]; condizioniGenerali?: string[] }): string {
  const ce = ex.sezioni.flatMap((s) => s.boxes).filter((b) => b.condizioniEsistenza);
  const generali = ex.condizioniGenerali ?? [];
  if (!ce.length && !generali.length) return "";
  const pezzi = ce
    .map((b) => katexHtml(`${b.op} \\Rightarrow ${b.soluzioneCe ?? `x \\ne ${b.answerLatex}`}`))
    .join(`<span style="display:inline-block;width:22px"></span>`);
  return `<div style="margin:12px 0 16px;page-break-inside:avoid">`
    + `<div style="font-size:16px;font-weight:bold;color:#8B3A1A">CONDIZIONI DI ESISTENZA (C.E.)</div>`
    + `<div style="margin-top:4px">${pezzi}${generali.map((c) => katexHtml(c)).join("")}</div></div>`;
}

function rigaIpotesiSegnoPdf(ipotesi: string[] | undefined): string {
  if (!ipotesi?.length) return "";
  return `<div style="margin:12px 0 16px;page-break-inside:avoid">`
    + `<div style="font-size:16px;font-weight:bold;color:#8B3A1A">CONDIZIONI AGGIUNTIVE PER QUESTO SVOLGIMENTO</div>`
    + `<div>Lo svolgimento vale solo se queste condizioni e le condizioni di esistenza sono tutte rispettate. Gli altri casi non sono svolti.</div>`
    + ipotesi.map((c)=>katexHtml(c)).join("") + `</div>`;
}

function costruisciHtmlPdfParziale(espressione: string, righe: string[], rigaCe: string): string {
  void espressione;
  const corpo = intestazioneStudentePdf() + rigaCe + righeSvolgimentoPdf(righe);
  return involucroPdf(corpo);
}

function costruisciHtmlPdf(
  espressione: string,
  righe: string[],
  finale: string,
  statistiche: ReturnType<typeof conteggioPrimoColpo>,
  rigaCe: string,
): string {
  void espressione;
  let corpo = intestazioneStudentePdf(statistiche) + rigaCe + righeSvolgimentoPdf(righe);

  /* ── RISULTATO FINALE (marrone, senza «OTTIMO LAVORO») ── */
  corpo += `<div style="margin-top:18px;page-break-inside:avoid">`;
  corpo += `<div style="font-size:17px;font-weight:bold;color:#8B4513">RISULTATO FINALE</div>`;
  corpo += `<div style="margin-top:6px;color:#8B4513;font-weight:bold">${katexHtml(finale)}</div>`;
  corpo += `</div>`;

  return involucroPdf(corpo);
}

/* Involucro HTML del PDF (stessa impaginazione per parziale e completo).
   (esportato per i test)
   (12/11) NUMERI DI PAGINA: quando il PDF va su più pagine, il numero di
   pagina compare in basso al centro (margin-box @bottom-center di @page,
   counter(page) — Chrome 131+). Il blocco è DISATTIVATO di default: prima
   di stampare lo script misura il contenuto e lo attiva solo se supera
   l'altezza utile di una pagina A4 (26,3 cm = altezza meno i margini). */
export function involucroPdf(corpo: string): string {
  /* origine sicura anche fuori dal browser (test in node) */
  const origine = typeof window !== "undefined" && window.location ? window.location.origin : "";
  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><base href="${origine}/"><title>Espressione svolta — Widget metacognitivo per il calcolo di espressioni</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.css">
<style>
@font-face{font-family:'OpenDyslexic';src:url('fonts/OpenDyslexic-Regular-v2.woff2') format('woff2');font-weight:400;font-style:normal}
@font-face{font-family:'OpenDyslexic';src:url('fonts/OpenDyslexic-Bold-v2.woff2') format('woff2');font-weight:700;font-style:normal}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'OpenDyslexic','Cambria Math',Cambria,serif;color:#1a1a1a;padding:12px 18px;max-width:100%;margin:0 auto;text-align:center;line-height:1.65}
.pdf-intestazione{margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #E5E0D8;font-size:14pt;line-height:1.5;break-inside:avoid;page-break-inside:avoid}
.pdf-dati-studente{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:4px 18px}
.pdf-dati-studente>span{min-width:0;max-width:100%;overflow-wrap:anywhere}
.pdf-studente-nome{font-weight:700}
.pdf-primo-colpo{margin-top:6px}
.katex{font-size:1.3em}
.katex-display{margin:0}
@media print{body{padding:0}@page{size:A4;margin-top:1.8cm;margin-bottom:1.6cm;margin-left:2cm;margin-right:2cm}}
</style>
<style id="numeri-pagina" media="print" disabled="disabled">
@page{@bottom-center{content:counter(page);font-family:'OpenDyslexic','Cambria Math',Cambria,serif;font-size:11pt;color:#1a1a1a;vertical-align:top}}
</style></head>
<body>${corpo}<script>
/* Numeri di pagina SOLO se il PDF va su più pagine: si misura l'altezza
   del contenuto (dopo che i font sono pronti, così KaTeX e OpenDyslexic
   sono già disposti) e la si confronta con l'altezza utile di una pagina
   A4 senza i margini di stampa: 29,7 − 1,8 − 1,6 = 26,3 cm. */
window.onload=function(){
  /* stato predefinito SPENTO via JS: l'attributo disabled in markup non è
     onorato ovunque, la proprietà IDL sì */
  var foglio=document.getElementById('numeri-pagina');
  if(foglio)foglio.disabled=true;
  function stampa(){
    try{
      var utile=(29.7-1.8-1.6)*96/2.54;
      var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);
      if(h>utile&&foglio)foglio.disabled=false;
    }catch(e){}
    window.print();
  }
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(stampa,200)});}
  else{setTimeout(stampa,400);}
}
</script></body></html>`;
}

export default function EsercizioFrazioni() {
  const studente = useStudentInfo();
  /* valore scritto dallo studente per ogni box: mai compilato dall'app */
  const [valori, setValori] = useState<Record<string, number | null>>({});

  /* ── Esercizio da svolgere (26/10-fix PDF dinamico): prima la SESSIONE
     personale (?sid=… nell'URL: lo svolgimento costruito per QUESTO
     studente, che SCARICA PDF stamperà); senza sid, l'esercizio attivo
     sul server; senza server, quello incluso nell'app. Caricato una sola
     volta all'avvio. ── */
  const [esercizio, setEsercizio] = useState<EsercizioDinamico>(ESERCIZIO_DEFAULT);
  const [sessioneScaduta, setSessioneScaduta] = useState(false);
  const [erroreRamo, setErroreRamo] = useState<string | null>(null);
  // Con un sid si attende l'esercizio personale: non mostrare neppure per
  // un istante quello predefinito durante il caricamento o dopo un errore.
  const [sessioneInCaricamento, setSessioneInCaricamento] = useState(
    () => Boolean(new URLSearchParams(window.location.search).get("sid")?.trim()),
  );
  useEffect(() => {
    let attivo = true;
    const sid = new URLSearchParams(window.location.search).get("sid")?.trim() || "";
    const url = sid ? `/api/esercizio/sessione/${encodeURIComponent(sid)}` : "/api/esercizio/attivo";
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { esercizio?: unknown } | null) => {
        if (!attivo || !j?.esercizio) {
          if (attivo && sid) setSessioneScaduta(true);
          return;
        }
        const valido = validaEsercizio(j.esercizio);
        if (valido) {
          const ramo = creaRamoConCondizioni(valido);
          if (ramo.ok) setEsercizio(ramo.esercizio);
          else setErroreRamo(ramo.motivo);
        } else if (attivo && sid) setSessioneScaduta(true);
      })
      .catch(() => {
        /* Senza sid resta il default; con sid NON mostrare un altro esercizio. */
        if (attivo && sid) setSessioneScaduta(true);
      })
      .finally(() => {
        if (attivo) setSessioneInCaricamento(false);
      });
    return () => {
      attivo = false;
    };
  }, []);
  const tuttiBox = useMemo(() => esercizio.sezioni.flatMap((s) => s.boxes), [esercizio]);

  /* (12/11) le condizioni di esistenza NON hanno una riga progressiva (non
     cambiano l'espressione): i conti restano allineati alle righe contando
     SOLO i box di calcolo. */
  const rigaPerBoxId = useMemo(() => {
    const m = new Map<string, string>();
    let n = 0;
    for (const b of tuttiBox) {
      if (b.condizioniEsistenza) continue;
      n += 1;
      const riga = esercizio.righeProgressive[n];
      if (riga) m.set(b.id, riga);
    }
    return m;
  }, [esercizio, tuttiBox]);

  /* (26/10) risposte simboliche: testo libero per i box con lettere.
     Dichiarato QUI (prima di scaricaPdf): la stampa dipende dai valori
     e dai testi digitati, quindi le dipendenze non possono restare vuote. */
  const [testi, setTesti] = useState<Record<string, string | null>>({});

  /* (7/11) PRIMA risposta pubblicata per ogni box: serve al conteggio
     «al primo colpo» della pagina di feedback. Il canvas e la tastiera
     pubblicano UN valore per invio (RICONOSCI o submit), quindi la
     prima pubblicazione non nulla è il tentativo n. 1; cancellare
     (null) non è rispondere e non la sovrascrive. */
  const [primiValori, setPrimiValori] = useState<Record<string, PrimoValore>>({});
  // Un'unica statistica condivisa tra feedback e PDF: le correzioni non
  // sostituiscono mai il primo tentativo registrato per ciascun box.
  const statistiche = useMemo(() => conteggioPrimoColpo(tuttiBox, primiValori), [tuttiBox, primiValori]);
  const setTesto = (id: string) => (t: string | null) => {
    setTesti((prev) => ({ ...prev, [id]: t }));
    setPrimiValori((prev) => registraPrimoValore(prev, id, null, t));
  };

  /* SCARICA PDF (26/10-fix PDF dinamico): stampa lo svolgimento EFFETTIVO
     di questa pagina — ma SOLO fino all'ultimo box corretto. Se per
     qualunque motivo il PDF venisse aperto a metà svolgimento, le righe
     oltre l'ultimo calcolo svolto NON compaiono (mai risultati anticipati
     via PDF). A esercizio completato le righe sono tutte.
     (26/10-fix PDF dallo svolgimento VERO) dipendenze reali, mai vuote:
     la chiusura chiamava sempre la prima versione (esercizio di default
     71/27) anche dopo il caricamento della sessione dello studente. */
  const scaricaPdf = useCallback(() => {
    const ultimoSvolto = (() => {
      let n = 0;
      for (const b of tuttiBox) {
        const ok = boxRisposto(b, (valori[b.id] as number | null) ?? null, (testi[b.id] as string | null) ?? null);
        if (!ok) break;
        n += 1;
      }
      return n;
    })();
    /* Le C.E. NON aggiungono righe progressive: contarle qui farebbe
       anticipare uno o più risultati nel PDF parziale. */
    const contiSvolti = tuttiBox.slice(0, ultimoSvolto).filter((b) => !b.condizioniEsistenza).length;
    const righeSvolte = esercizio.righeProgressive.slice(0, Math.min(esercizio.righeProgressive.length, contiSvolti + 1));
    const finito = ultimoSvolto >= tuttiBox.length;
    const rigaCe = rigaCondizioniEsistenzaPdf(esercizio);
    const rigaIpotesi = rigaIpotesiSegnoPdf(esercizio.ipotesiDiSegno);
    /* il PDF parziale mostra la C.E. solo quando lo studente l'ha già
       calcolata: prima sarebbe la soluzione già scritta. */
    const nCe = tuttiBox.filter((b) => b.condizioniEsistenza).length;
    const ceCompletata = ultimoSvolto >= nCe;
    const html = finito
      ? costruisciHtmlPdf(esercizio.espressioneLatex, esercizio.righeProgressive, esercizio.risultatoFinaleLatex, statistiche, rigaCe + rigaIpotesi)
      : costruisciHtmlPdfParziale(esercizio.espressioneLatex, righeSvolte, (ceCompletata ? rigaCe : "") + rigaIpotesi);
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }, [esercizio, testi, tuttiBox, valori, statistiche]);

  const setValore = (id: string) => (v: number | null) => {
    setValori((prev) => ({ ...prev, [id]: v }));
    setPrimiValori((prev) => registraPrimoValore(prev, id, v, null));
  };

  /* Rivelazione progressiva: un box si apre solo dopo che tutti i
     precedenti sono corretti (prima risposta valida sancisce l'apertura,
     come nel widget). I box con lettere si verificano per forma. */
  const corretti = new Set(
    tuttiBox.filter((b) => boxRisposto(b, valori[b.id], testi[b.id])).map((b) => b.id),
  );
  const tuttiCorretti = corretti.size === tuttiBox.length;

  /* (7/11) Feedback finale: risposte giuste al primo colpo su totale
     delle risposte dell'esercizio (un box = una risposta). */
  const stelle = stellePerPrimoColpo(statistiche.primoColpo, statistiche.totale);
  const [feedbackAperto, setFeedbackAperto] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titoloEsitoRef = useRef<HTMLHeadingElement>(null);
  const mostraFeedback = !sessioneInCaricamento && !sessioneScaduta && !erroreRamo &&
    tuttiBox.length > 0 && tuttiCorretti && feedbackAperto;

  // Dopo CONTINUA il feedback appare dall'alto, anche nell'iframe del blog.
  // Il titolo riceve il focus per chi usa tastiera o screen reader; il
  // contenitore, non la pagina esterna, viene fatto scorrere.
  useEffect(() => {
    if (!mostraFeedback) return;
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    titoloEsitoRef.current?.focus({ preventScroll: true });
  }, [mostraFeedback]);

  const partesStudente: string[] = [];
  if (studente.cognome && studente.nome) partesStudente.push(`${studente.cognome} ${studente.nome}`);
  else if (studente.cognome) partesStudente.push(studente.cognome);
  else if (studente.nome) partesStudente.push(studente.nome);
  if (studente.data) partesStudente.push(studente.data);
  if (studente.classe) partesStudente.push(`Classe ${studente.classe}`);

  return (
    <div
      ref={scrollRef}
      className="expr-exercise-scroll"
      role="region"
      aria-label={mostraFeedback ? "Esito finale dell'esercizio" : "Svolgimento dell'espressione: area a scorrimento verticale"}
      tabIndex={0}
    >
    <div className="lf-svolgimento mx-auto flex w-full max-w-[680px] flex-col items-center px-3 pb-10 pt-2">
      {/* ── Intestazione studente ── */}
      {partesStudente.length > 0 && !mostraFeedback && (
        <div className="w-full rounded-[14px] border border-[#E5E0D8] bg-card px-4 py-2.5 text-center text-base leading-relaxed text-foreground">
          {partesStudente.join(" — ")}
        </div>
      )}

      {/* ── Sessione scaduta: niente esercizio altrui né quello vecchio ── */}
      {sessioneScaduta && (
        <div className="mt-4 w-full rounded-[14px] border-2 border-destructive bg-card p-4 text-center" role="alert">
          <p className="text-base font-bold text-destructive">
            Svolgimento non trovato: la sessione è scaduta o inesistente.
          </p>
          <p className="mt-2 text-base text-foreground">
            Torna alla pagina di trascrizione e ricostruisci l'esercizio con l'IA.
          </p>
        </div>
      )}

      {erroreRamo && (
        <div className="mt-4 w-full rounded-[14px] border-2 border-destructive bg-card p-4 text-center" role="alert">
          <p className="text-base font-bold text-destructive">SVOLGIMENTO NON DISPONIBILE</p>
          <p className="mt-2 text-base text-foreground">{erroreRamo}</p>
          <p className="mt-2 text-base text-foreground">Per gli altri casi occorre uno svolgimento diverso.</p>
        </div>
      )}

      {sessioneInCaricamento && (
        <p className="mt-4 text-center text-base text-foreground" role="status">
          Carico lo svolgimento della tua espressione…
        </p>
      )}

      {!sessioneInCaricamento && !sessioneScaduta && !erroreRamo && (
      mostraFeedback ? (
        <section
          className="mt-3 flex w-full flex-col items-center rounded-[18px] border border-border bg-card px-4 py-6 text-center shadow-sm sm:px-8"
          aria-labelledby="titolo-esito-finale"
          data-testid="feedback-finale"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden="true">
            <PartyPopper size={28} strokeWidth={2} />
          </div>
          <h2 ref={titoloEsitoRef} id="titolo-esito-finale" tabIndex={-1} className="mt-4 text-xl font-bold leading-snug text-primary focus:outline-none">
            HAI TERMINATO!
          </h2>
          <p className="mt-1 text-xl font-bold leading-snug text-primary">{messaggioPerStelle(stelle)}</p>
          <div className="mt-4 flex justify-center gap-1.5" role="img" aria-label={`${stelle} stelle su 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={31}
                strokeWidth={1.8}
                className={i < stelle ? "fill-[#F7BA20] text-[#B87900]" : "fill-transparent text-[#8A7D6C]"}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="mt-4 text-[1.167rem] leading-relaxed text-foreground" aria-live="polite">
            Risposte giuste al primo colpo: <strong>{statistiche.primoColpo} su {statistiche.totale}</strong>
          </p>
          <button
            type="button"
            onClick={scaricaPdf}
            className="mt-5 flex min-h-12 w-full max-w-[360px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[1.167rem] font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Scarica il PDF con tutti i passaggi dell'espressione"
          >
            <FileDown size={21} aria-hidden="true" /> SCARICA PDF
          </button>
          <button
            type="button"
            onClick={() => setFeedbackAperto(false)}
            className="mt-3 min-h-11 rounded-lg px-4 py-2 text-[1.167rem] font-bold text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            RIVEDI I PASSAGGI
          </button>
        </section>
      ) : (
      <>
      {/* ── L'espressione da risolvere ── */}
      <h2 className="mt-4 text-center text-lg font-bold tracking-wide text-foreground">
        L'ESPRESSIONE DA RISOLVERE
      </h2>
      <div className="mt-2 w-full rounded-[14px] border border-border bg-card p-3.5 md:p-4">
        <div
          className="overflow-x-auto text-center text-lg leading-loose text-foreground"
          dangerouslySetInnerHTML={{ __html: katexHtml(esercizio.espressioneLatex) }}
        />
      </div>

      {/* I vincoli che il motore non sa risolvere in valori vietati restano
          espliciti in forma generale, invece di essere omessi. */}
      {!!esercizio.condizioniGenerali?.length && (
        <section className="mt-4 w-full rounded-[14px] border border-border bg-card p-3.5 text-center" aria-label="Condizioni di esistenza in forma generale">
          <h3 className="text-base font-bold tracking-wide text-[#8B3A1A]">CONDIZIONI DI ESISTENZA</h3>
          <p className="mt-1 text-sm text-foreground">Queste condizioni restano espresse in forma generale.</p>
          {esercizio.condizioniGenerali.map((condizione, i) => (
            <div key={`${i}-${condizione}`} className="overflow-x-auto text-base text-foreground" dangerouslySetInnerHTML={{ __html: katexHtml(condizione) }} />
          ))}
        </section>
      )}

      {!!esercizio.ipotesiDiSegno?.length && (
        <section className="mt-4 w-full rounded-[14px] border border-border bg-card p-3.5 text-center" aria-label="Condizioni aggiuntive per questo svolgimento" data-testid="condizioni-aggiuntive">
          <h3 className="text-base font-bold tracking-wide text-[#8B3A1A]">CONDIZIONI AGGIUNTIVE PER QUESTO SVOLGIMENTO</h3>
          <p className="mt-1 text-sm text-foreground">Lo svolgimento vale solo se queste condizioni e le condizioni di esistenza sono tutte rispettate. Gli altri casi non sono svolti.</p>
          {esercizio.ipotesiDiSegno.map((condizione, i) => (
            <div key={`${i}-${condizione}`} className="overflow-x-auto text-base text-foreground" dangerouslySetInnerHTML={{ __html: katexHtml(condizione) }} />
          ))}
        </section>
      )}

      {/* ── I passaggi con i box ── */}
      <div className="mt-4 w-full space-y-5">
        {esercizio.sezioni.map((sezione) => {
          const primoIndiceSezione = tuttiBox.findIndex((b) => b.id === sezione.boxes[0].id);
          const sezioneAperta = corretti.has(tuttiBox[primoIndiceSezione - 1]?.id ?? "") || primoIndiceSezione === 0;
          if (!sezioneAperta) return null;
          return (
            <section key={sezione.title} className="w-full">
              <h3 className="mb-2 text-center text-base font-bold tracking-wide text-[#8B3A1A]">
                {sezione.title}
              </h3>
              <div className="space-y-3">
                {sezione.boxes.map((box) => {
                  const idx = tuttiBox.indexOf(box);
                  const aperto =
                    idx === 0 || corretti.has(tuttiBox[idx - 1].id);
                  if (!aperto) return null;
                  return (
                    <BoxCard
                      key={box.id}
                      box={box}
                      index={idx + 1}
                      rigaProgressiva={rigaPerBoxId.get(box.id)}
                      value={valori[box.id] ?? null}
                      onChange={setValore(box.id)}
                      testoLibero={testi[box.id] ?? null}
                      onTestoLibero={box.simbolico ? setTesto(box.id) : undefined}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── RISULTATO FINALE (marrone, solo a esercizio completato) ── */}
      {tuttiCorretti && (
        <div className="mt-5 w-full rounded-[14px] border-2 border-[#8B4513] bg-[#FAF8F5] p-4 text-center">
          <p className="text-base font-bold tracking-wide" style={{ color: "#8B4513" }}>
            RISULTATO FINALE
          </p>
          <div
            className="mt-1 text-xl font-bold"
            style={{ color: "#8B4513" }}
            dangerouslySetInnerHTML={{ __html: katexHtml(esercizio.risultatoFinaleLatex) }}
          />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setFeedbackAperto(true)}
              className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              CONTINUA
            </button>
          </div>
        </div>
      )}
      </>
      )
      )}
    </div>
    </div>
  );
}

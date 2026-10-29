import { useCallback, useEffect, useMemo, useState } from "react";
import katex from "katex";
import {
  latexValue,
  parsePolyLoose,
  polyEquals,
  parseExpression,
  normalizeInput,
  buildVerificationValues,
  substituteAndEvaluate,
} from "@/lib/espressioni";
import { NumberInputCanvas, normalizeTypedValueNotation, evaluateLatex } from "@/components/NumberInputCanvas";

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
    return katex.renderToString(latex, { displayMode, throwOnError: false, strict: false });
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
  answerLatex: string;   // risultato corretto (mostrato SOLO dopo la risposta esatta)
  /* (26/10, app UNIVERSALE) box con LETTERE: la risposta si verifica per
     FORMA (polinomi identici) o per sostituzione, non come numero */
  simbolico?: boolean;
  rispostaAttesa?: string;
}

/* Due forme con lettere sono la STESSA espressione? Prima il confronto
   simbolico (polinomi normalizzati), poi la sostituzione numerica
   (x=2, y=3, z=5…: se coincidono lì, il conto è giusto). */
/* (26/10, foto «3 radice di 15 data per sbagliata»): l'op contiene un
   radicale? Serve per l'hint giusto (radicali, non lettere). */
function haRadice(b: { op: string; rispostaAttesa?: string }): boolean {
  return /\\sqrt/.test(b.op ?? "") || /\\sqrt/.test(b.rispostaAttesa ?? "");
}

/* (26/10, foto «3 radice di 15 data per sbagliata»): risposta con RADICALE
   ma senza lettere (3√15) — né i polinomi né la sostituzione la reggono
   (√15 a radicando costante non è una variabile): si confronta il VALORE
   numerico esatto. La scritta può arrivare in notazione da tastiera
   («3rad2(15)», «3sqrt15», «3√15») e si normalizza come il campo DIGITA. */
function stessaForma(op: string, attesa: string, scritta: string): boolean {
  const pA = parsePolyLoose(attesa);
  const pS = parsePolyLoose(scritta);
  if (pA && pS && pA.length > 0 && pS.length > 0 && polyEquals(pA, pS)) return true;
  const numA = latexValue(attesa);
  if (numA != null && Number.isFinite(numA)) {
    let numS: number | null = null;
    try {
      numS = latexValue(scritta);
      if (numS == null) numS = evaluateLatex(normalizeTypedValueNotation(scritta));
    } catch {
      numS = null;
    }
    if (numS != null && Number.isFinite(numS)) {
      return Math.abs(numA - numS) < 1e-6 * Math.max(1, Math.abs(numA), Math.abs(numS));
    }
  }
  try {
    const valori = buildVerificationValues(parseExpression(normalizeInput(op))).values;
    const vA = substituteAndEvaluate(parseExpression(normalizeInput(attesa)), valori);
    const vS = substituteAndEvaluate(parseExpression(normalizeInput(scritta)), valori);
    if (!Number.isFinite(vA) || !Number.isFinite(vS)) return false;
    return Math.abs(vA - vS) < 1e-6 * Math.max(1, Math.abs(vA), Math.abs(vS));
  } catch {
    return false;
  }
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
    if (testo != null && !!b.rispostaAttesa && stessaForma(b.op, b.rispostaAttesa, testo)) return true;
    const attesaNum = b.rispostaAttesa != null ? latexValue(b.rispostaAttesa) : null;
    return valore != null && attesaNum != null && Math.abs(valore - attesaNum) < 1e-9;
  }
  return valore != null && Math.abs(valore - b.answer) < 1e-9;
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

  return (
    <div
      className="rounded-[14px] border border-[#E5E0D8] bg-[#FDFBF8] p-3.5 md:p-4"
      data-box={box.id}
    >
      <p className="mb-2 text-center text-sm font-bold tracking-wide text-[#8B3A1A]">
        BOX {index}
      </p>
      <div
        className="text-center text-lg leading-loose text-foreground"
        dangerouslySetInnerHTML={{ __html: katexHtml(box.op) }}
      />
      {box.prompt && (
        <p className="mt-2 text-center text-base text-foreground">{box.prompt}</p>
      )}
      {box.extraLatex && (
        <div
          className="mt-1 text-center text-lg leading-loose text-foreground"
          dangerouslySetInnerHTML={{ __html: katexHtml(box.extraLatex) }}
        />
      )}
      {corretto ? (
        <>
          <p
            className="mt-2 text-center text-lg font-bold text-success"
            dangerouslySetInnerHTML={{ __html: katexHtml(`${box.op} = ${box.answerLatex}`) }}
          />
          {/* (27/10, foto collage_matematico + correzione utente) pillola PIÙ
              CHIARA del box (bianca sul fondo crema #FDFBF8) con L'INTERA
              ESPRESSIONE accorciata — la stessa riga progressiva del PDF,
              con il risultato del box già sostituito — scritta in BLU.
              Sempre presente in ogni box numerato risolto correttamente,
              sia numerico sia simbolico (lettere/radicali). Fallback: il
              solo pezzo risolto se le righe progressive mancano. */}
          <div className="mt-2 flex justify-center">
            <div
              className="inline-block max-w-full overflow-x-auto rounded-xl border border-[#E5E0D8] bg-white px-5 py-2 text-center text-lg text-[#2563EB] shadow-sm"
              data-testid="pillola-formula-risolta"
              dangerouslySetInnerHTML={{
                __html: katexHtml(rigaProgressiva ?? `${box.op} = ${box.answerLatex}`),
              }}
            />
          </div>
        </>
      ) : box.simbolico ? (
        /* (26/10) box con LETTERE: niente canvas numerico — solo la tastiera
           (✎), con le stesse regole di trascrizione del resto del widget.
           (26/10, foto «3 radice di 15»): risposta con RADICALE ma senza
           lettere → l'hint parla di radicali, non di lettere (es. 3√15). */
        <>
          <p className="mt-3 mb-4 text-center text-base text-success">
            {haRadice(box) && !/[a-z]/i.test((box.rispostaAttesa ?? "").replace(/\\[a-zA-Z]+/g, ""))
              ? "💡 Scrivi il risultato esatto con la radice (es. 3√15)."
              : "💡 Scrivi il risultato con le lettere (es. 5x, x^{5}, 3x+2)."}
          </p>
          <NumberInputCanvas
            value={value}
            onChange={onChange}
            label="INSERISCI IL RISULTATO:"
            colorClass="text-primary"
            allowNegative={false}
            symbolicValue={testoLibero ?? undefined}
            onSymbolicValue={onTestoLibero}
            hideValue={!corretto && testoLibero != null && testoLibero.trim() !== ""}
          />
          {(testoLibero != null || value != null) && !corretto && (
            <p className="mt-1 text-center text-base font-bold text-destructive">
              RISULTATO SBAGLIATO. CALCOLA DI NUOVO
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
            allowNegative={false}
            hideValue={!corretto && value != null}
          />
          {value != null && (
            <p className="mt-1 text-center text-base font-bold text-destructive">
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
        /\\sqrt/.test(b.answerLatex) && !/[a-z]/i.test(b.answerLatex.replace(/\\[a-zA-Z]+/g, ""));
      const simbolico =
        (b as { simbolico?: unknown }).simbolico === true ||
        /[a-z]/i.test(testoSenzaComandi) ||
        parsePolyLoose(b.op)?.some((t) => t.vars.length > 0) === true ||
        haRadicaleAtteso;
      const answer = simbolico ? NaN : latexValue(b.answerLatex);
      /* (26/10-Opzione A) risposta non valutabile come numero: si prova la
         via simbolica invece di bocciare l'esercizio — la pagina 3 si apre
         sempre */
      const effettivoSimbolico = simbolico || answer == null;
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
      });
    }
    sezioni.push({ title: typeof s.title === "string" && s.title.trim() ? s.title : "ESERCIZIO", boxes });
  }
  return {
    espressioneLatex: e.espressioneLatex,
    sezioni,
    righeProgressive: e.righeProgressive.map((r) => String(r)).filter((r) => r.trim()),
    risultatoFinaleLatex: e.risultatoFinaleLatex,
  };
}

/* Intestazione studente del PDF (Cognome Nome, Classe, Data dall'URL) */
function intestazioneStudentePdf(): string {
  const parametri = new URLSearchParams(window.location.search);
  const cognome = parametri.get("cognome")?.trim() || "";
  const nome = parametri.get("nome")?.trim() || "";
  const classe = parametri.get("classe")?.trim() || "";
  const data = parametri.get("data")?.trim() || "";
  if (!cognome && !nome && !classe && !data) return "";
  let h = `<div style="margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #E5E0D8">`;
  if (cognome || nome) {
    h += `<div style="font-size:17px;font-weight:bold">${[cognome, nome].filter(Boolean).join(" ")}</div>`;
  }
  if (classe) {
    h += `<div style="font-size:15px;margin-top:3px">Classe ${classe}</div>`;
  }
  if (data) {
    h += `<div style="font-size:15px;margin-top:2px">${data}</div>`;
  }
  h += `</div>`;
  return h;
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
function costruisciHtmlPdfParziale(espressione: string, righe: string[]): string {
  void espressione;
  const corpo = intestazioneStudentePdf() + righeSvolgimentoPdf(righe);
  return involucroPdf(corpo);
}

function costruisciHtmlPdf(espressione: string, righe: string[], finale: string): string {
  void espressione;
  let corpo = intestazioneStudentePdf() + righeSvolgimentoPdf(righe);

  /* ── RISULTATO FINALE (marrone, senza «OTTIMO LAVORO») ── */
  corpo += `<div style="margin-top:18px;page-break-inside:avoid">`;
  corpo += `<div style="font-size:17px;font-weight:bold;color:#8B4513">RISULTATO FINALE</div>`;
  corpo += `<div style="margin-top:6px;color:#8B4513;font-weight:bold">${katexHtml(finale)}</div>`;
  corpo += `</div>`;

  return involucroPdf(corpo);
}

/* Involucro HTML del PDF (stessa impaginazione per parziale e completo) */
function involucroPdf(corpo: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>Espressione svolta — Widget metacognitivo per il calcolo di espressioni</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.css">
<style>
@font-face{font-family:'OpenDyslexic';src:url('fonts/OpenDyslexic-Regular-v2.woff2') format('woff2');font-weight:400;font-style:normal}
@font-face{font-family:'OpenDyslexic';src:url('fonts/OpenDyslexic-Bold-v2.woff2') format('woff2');font-weight:700;font-style:normal}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'OpenDyslexic','Cambria Math',Cambria,serif;color:#1a1a1a;padding:12px 18px;max-width:100%;margin:0 auto;text-align:center;line-height:1.65}
.katex{font-size:1.3em}
.katex-display{margin:0}
@media print{body{padding:0}@page{size:A4;margin-top:1.8cm;margin-bottom:1.6cm;margin-left:2cm;margin-right:2cm}}
</style></head>
<body>${corpo}<script>window.onload=function(){window.print()}</script></body></html>`;
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
        if (valido) setEsercizio(valido);
        else if (attivo && sid) setSessioneScaduta(true);
      })
      .catch(() => {
        /* server assente o offline: resta l'esercizio incluso */
        if (attivo && sid) setSessioneScaduta(true);
      });
    return () => {
      attivo = false;
    };
  }, []);
  const tuttiBox = useMemo(() => esercizio.sezioni.flatMap((s) => s.boxes), [esercizio]);

  /* (26/10) risposte simboliche: testo libero per i box con lettere.
     Dichiarato QUI (prima di scaricaPdf): la stampa dipende dai valori
     e dai testi digitati, quindi le dipendenze non possono restare vuote. */
  const [testi, setTesti] = useState<Record<string, string | null>>({});
  const setTesto = (id: string) => (t: string | null) =>
    setTesti((prev) => ({ ...prev, [id]: t }));

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
    /* righe = originaria + una per ogni box svolto (mai oltre) */
    const righeSvolte = esercizio.righeProgressive.slice(0, Math.min(esercizio.righeProgressive.length, ultimoSvolto + 1));
    const finito = ultimoSvolto >= tuttiBox.length;
    const html = finito
      ? costruisciHtmlPdf(esercizio.espressioneLatex, esercizio.righeProgressive, esercizio.risultatoFinaleLatex)
      : costruisciHtmlPdfParziale(esercizio.espressioneLatex, righeSvolte);
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }, [esercizio, testi, tuttiBox, valori]);

  const setValore = (id: string) => (v: number | null) =>
    setValori((prev) => ({ ...prev, [id]: v }));

  /* Rivelazione progressiva: un box si apre solo dopo che tutti i
     precedenti sono corretti (prima risposta valida sancisce l'apertura,
     come nel widget). I box con lettere si verificano per forma. */
  const corretti = new Set(
    tuttiBox.filter((b) => {
      if (b.simbolico) {
        /* (26/10, foto «3 radice di 15»): come boxRisposto — vale la forma
           (testo) OPPURE il valore numerico (mano/tastiera senza testo) */
        const t = testi[b.id];
        if (t != null && !!b.rispostaAttesa && stessaForma(b.op, b.rispostaAttesa, t)) return true;
        const attesaNum = b.rispostaAttesa != null ? latexValue(b.rispostaAttesa) : null;
        const v = valori[b.id];
        return v != null && attesaNum != null && Math.abs(v - attesaNum) < 1e-9;
      }
      const v = valori[b.id];
      return v != null && Math.abs(v - b.answer) < 1e-9;
    }).map((b) => b.id),
  );
  const tuttiCorretti = corretti.size === tuttiBox.length;

  const partesStudente: string[] = [];
  if (studente.cognome && studente.nome) partesStudente.push(`${studente.cognome} ${studente.nome}`);
  else if (studente.cognome) partesStudente.push(studente.cognome);
  else if (studente.nome) partesStudente.push(studente.nome);
  if (studente.data) partesStudente.push(studente.data);
  if (studente.classe) partesStudente.push(`Classe ${studente.classe}`);

  return (
    <div
      className="expr-exercise-scroll"
      role="region"
      aria-label="Svolgimento dell'espressione: area a scorrimento verticale"
      tabIndex={0}
    >
    <div className="lf-svolgimento mx-auto flex w-full max-w-[680px] flex-col items-center px-3 pb-10 pt-2">
      {/* ── Intestazione studente ── */}
      {partesStudente.length > 0 && (
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
                      rigaProgressiva={esercizio.righeProgressive[idx + 1]}
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
          {partesStudente.length > 0 && (
            <p className="mt-2 text-base font-bold text-foreground">
              OTTIMO LAVORO, {partesStudente[0].toUpperCase()}!
            </p>
          )}
          <button
            type="button"
            onClick={scaricaPdf}
            className="mt-4 rounded-full border border-border bg-card px-8 py-3 text-base font-bold tracking-wide text-primary shadow-sm transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Scarica il PDF con tutti i passaggi dell'espressione"
          >
            ⬇ SCARICA PDF
          </button>
        </div>
      )}
    </div>
    </div>
  );
}


import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { NumberInputCanvas } from "@/components/NumberInputCanvas";
import { SymbolInkInput } from "@/components/SymbolInkInput";
import { MathDrawCanvas, type Stroke } from "@/components/MathDrawCanvas";
import { useMathRecognition } from "@/hooks/useMathRecognition";
import { cn } from "@/lib/utils";
import katex from "katex";
import { toast } from "sonner";
import { Mic, Square, Keyboard, Loader2, Camera, Upload } from "lucide-react";
import { normalizeExpressionOcr, prettyExpression } from "@/lib/exprOcr";
import { aiTranscribeImage, AiUnavailableError, strokesToDataUrl, fileToScaledDataUrl } from "@/lib/aiTranscribe";
import { CropDialog } from "@/components/CropDialog";
import { normalizePhoto } from "@/lib/imagePrep";
import { ocrImage } from "@/lib/ocr";
import { useRecorder } from "@/hooks/useRecorder";
import {
  normalizeKeyboardNotation,
  normalizeKeyboardLive,
  normalizeKeyboardDisplayLive,
  toDisplayNotation,
  keyboardDisplayHint,
  sanitizeLatexNotation,
} from "@/lib/keyboardNotation";
import {
  analyzeExpression,
  coloredFlatLatex,
  ExprError,
  fracToLatex,
  isUserSumCorrect,
  fractionResultLatex,
  fractionStepLatex,
  normalizeInput,
  parseExpression,
  printLatex,
  canParseExpression,
  risultatoLatex,
  termToLatex,
  parsePolyLoose,
  polyEquals,
  errorHint,
  type Analysis,
  type ExprStep,
  type Frac,
  type Term,
  type TermGroup,
} from "@/lib/espressioni";
import { verifyConti, applicaVerifica } from "@/lib/aiVerify";
import { dedupeRigheAdiacenti } from "@/lib/quaderno";
import { finalizePiece } from "@/lib/recognizePiece";

import { analyzeFratte, type FrattaAnalysis } from "@/lib/fratte";
import { FratteExercise } from "@/components/FratteExercise";


/* ─── COSTRUZIONE IA (25/10): le fasi della linea di progresso mentre
   l'IA costruisce l'esercizio su misura dall'espressione trascritta */
const STADI_COSTRUZIONE = [
  "Invio l'espressione all'intelligenza artificiale…",
  "Suddivido l'espressione in passaggi minimi…",
  "Calcolo il risultato di ogni passaggio…",
  "Verifico i conti con l'aritmetica esatta…",
  "Costruisco le righe progressive per il PDF…",
  "Preparo l'esercizio per gli studenti…",
];

/** Un passo è "interattivo" quando lo studente deve scriverne il risultato */
function isInteractiveStep(s: ExprStep): boolean {
  return !!s.opLatex && !!s.answer;
}

/** GIRO 30 (filosofia scaffolding): un passo con risultato con LETTERE è
 *  svolto dallo studente scrivendo il risultato da tastiera (regole del
 *  giro 26: «3x/4», «5x», «a^2»…) — l'app lo convalida ma non lo scrive
 *  MAI lei: il risultato è sempre e solo dato dall'utente. */
function isTypedStep(s: ExprStep): boolean {
  return !!s.answerPoly;
}

/** Operazione da mostrare nell'input: il dettaglio del passo senza il
 *  promemoria «(moltiplico n volte)». */
function opDisplayLatex(s: ExprStep): string {
  return (s.detail || s.opLatex || s.latex).replace(/\s*\(moltiplico[\s\S]*$/, "");
}

/** Input del risultato di un conto con lettere: l'operazione, «=», il
 *  campo da tastiera con le regole del giro 26 e il pulsante VERIFICA.
 *  NIENTE risultato pre-scritto: corretto → ✓ e si sblocca il seguito. */
function TypedResultInput({
  step,
  value,
  attempted,
  correct,
  tries,
  onChange,
  onVerify,
  inputId,
}: {
  step: ExprStep;
  value: string;
  attempted: boolean;
  correct: boolean;
  /** (25/10, punto 5) tentativi falliti su questo passo: dal 2º errore
   *  l'aiuto si arricchisce col promemoria della proprietà (graduale). */
  tries: number;
  onChange: (v: string) => void;
  onVerify: () => void;
  inputId: string;
}) {
  // Feedback diagnostico per TIPO di sbaglio (segno, reciproco, esponenti,
  // coefficienti, valore) — MAI il risultato. Vuoto → messaggio generico.
  const hint =
    attempted && !correct
      ? errorHint(step.answerPoly ?? [], parsePolyLoose(value), step.kind, tries)
      : "";
  return (
    <div className="p-3 sm:p-4 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        <span className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(opDisplayLatex(step), false) }} />
        <span className="font-mono text-base" aria-hidden="true">=</span>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onVerify();
          }}
          aria-label="Scrivi il risultato di questo conto"
          placeholder="es. 3x/4 · 5x · a^2"
          autoComplete="off"
          className="w-44 px-3 py-2 rounded-lg border border-border bg-background font-mono text-base text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={onVerify}
          disabled={!value.trim()}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold tracking-widest transition-colors"
        >
          VERIFICA
        </button>
      </div>
      {/* (26/10) SCRITTURA A MANO anche per i risultati con LETTERE:
          il canvas trascrive soltanto e riempie il campo qui sopra;
          lo studente controlla e preme VERIFICA (mai conferme automatiche). */}
      <SymbolInkInput onText={onChange} disabled={correct} />
      {attempted && !correct && (
        <p className="text-base font-bold text-center text-destructive" role="alert">
          RIPROVA: scrivi il risultato del conto (es. 3x⁄4 si scrive 3x/4)
        </p>
      )}
      {attempted && !correct && hint && (
        <p className="text-base font-semibold text-center text-amber-700 dark:text-amber-300" role="alert">
          💡 {hint}
        </p>
      )}
      {correct && (
        <p className="text-base font-bold text-center text-success" role="status">
          ✓ CORRETTO
        </p>
      )}
    </div>
  );
}

/** Riga completa da ricopiare sul quaderno: il dettaglio del passo se
 *  contiene già «=», altrimenti operazione = risultato (es. la divisione
 *  48 : 28 con risultato 12/7 ha detail senza «=» → la completo). */
function copiaRiga(s: ExprStep): string {
  if (s.detail && s.detail.includes("=")) return s.detail;
  if (s.opLatex && s.answer) return `${s.opLatex} = ${risultatoLatex(s.answer)}`;
  return s.detail || s.latex;
}

function stepCorrect(v: number | null | undefined, answer?: Frac): boolean {
  if (!answer || v == null) return false;
  return isUserSumCorrect(v, answer);
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Estrae i parametri studente dalla URL (supporta path e hash routing) */
function getStudentSearchParams(): URLSearchParams | null {
  if (window.location.search) {
    return new URLSearchParams(window.location.search);
  }
  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx !== -1) {
    return new URLSearchParams(hash.slice(qIdx + 1));
  }
  return null;
}

/** KaTeX render helper */
function katexHtml(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, strict: false });
  } catch {
    return latex;
  }
}

/** (26/10, foto utente «la radice a mano non ha mai la linea sopra il 3»:
 *  CAUSA TROVATA — i pezzi scritti a mano/foto arrivano in notazione
 *  dell'app («√(3)», «√(3⁄7)» o «√3»), ma KaTeX disegna la barra del
 *  radicale SOLO con il comando \sqrt{...}: il carattere √ grezzo viene
 *  reso come simbolo + parentesi di testo, senza linea sopra il radicando.
 *  Dalla foto invece arriva già \sqrt{...} (per quello lì la barra c'era).
 *  Questa funzione converte la notazione dell'app in LaTeX PRIMA della resa:
 *  √(madre)/∛()/∜() → \sqrt{}/\sqrt[3]{}/\sqrt[4]{}, √x → \sqrt{x},
 *  e OGNI frazione a⁄b (⁄ = U+2044) → \frac{a}{b} — KaTeX impila SOLO
 *  con \frac, mentre la ⁄ grezza resta lineare (stessa classe di bug
 *  della barra di √: quando il motore valuta, originalLatex ha già \frac
 *  e tutto è ok; quando NON valuta — es. √2 non esatta → fallback — la ⁄
 *  restava grezza e la frazione appariva lineare, come nella foto utente).
 *  Da usare in TUTTI i punti dove una notazione dell'app finisce in KaTeX. */
/** (26/10, foto utente «frazioni non più impilate»): converte OGNI a⁄b in
 *  \frac{a}{b}, con operandi semplici (12⁄34, az⁄4, 2⁄3az → \frac{2}{3}az),
 *  gruppi tra parentesi bilanciate ((1⁄2)⁄(3⁄4)) e comandi LaTeX già
 *  presenti (\sqrt{3}⁄2 → \frac{\sqrt{3}}{2}). Va eseguita PRIMA delle
 *  radici, così √(3⁄7) diventa \sqrt{\frac{3}{7}}. */
function stackedFractionsToLatex(src: string): string {
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  const isLetter = (c: string | undefined) => c !== undefined && /[a-zA-Z]/.test(c);
  /* (26/10-fix) Una sostituzione alla volta con RIPARTENZA da capo: dopo
     aver inserito un \frac{}{} gli indici vecchi non sono più validi;
     continuare la scansione con l'indice precedente corrompeva le frazioni
     annidate/adiacenti (es. (1⁄2)⁄(3⁄4) → output spezzato). Ogni passata
     rimuove esattamente una ⁄, quindi il ciclo termina (guardia a 50). */
  const convertFirst = (s: string): string | null => {
    let i = 0;
    for (;;) {
    const k = s.indexOf("⁄", i);
    if (k < 0) return null;
    // --- operando destro (dopo la ⁄) ---
    let j = k + 1;
    while (j < s.length && s[j] === " ") j++;
    let rEnd = -1;
    if (s[j] === "(") {
      let depth = 0;
      let m = j;
      for (; m < s.length; m++) {
        if (s[m] === "(") depth++;
        else if (s[m] === ")") { depth--; if (depth === 0) break; }
      }
      if (depth === 0) rEnd = m + 1;
    } else if (isDigit(s[j])) {
      let m = j;
      while (m < s.length && (isDigit(s[m]) || s[m] === ".")) m++;
      rEnd = m;
    } else if (isLetter(s[j])) {
      let m = j;
      while (m < s.length && isLetter(s[m])) m++;
      rEnd = m;
    }
    // --- operando sinistro (prima della ⁄) ---
    let l = k - 1;
    while (l >= 0 && s[l] === " ") l--;
    let lStart = -1;
    if (s[l] === ")") {
      let depth = 0;
      let m = l;
      for (; m >= 0; m--) {
        if (s[m] === ")") depth++;
        else if (s[m] === "(") { depth--; if (depth === 0) break; }
      }
      if (depth === 0) lStart = m;
    } else if (s[l] === "}") {
      let depth = 0;
      let m = l;
      for (; m >= 0; m--) {
        if (s[m] === "}") depth++;
        else if (s[m] === "{") { depth--; if (depth === 0) break; }
      }
      if (depth === 0) {
        // risale sopra \comando (es. \sqrt{3}⁄2 → operando \sqrt{3})
        let c = m - 1;
        while (c >= 0 && isLetter(s[c])) c--;
        lStart = s[c] === "\\" ? c : m;
      }
    } else if (isDigit(s[l])) {
      let m = l;
      while (m >= 0 && (isDigit(s[m]) || s[m] === ".")) m--;
      lStart = m + 1;
    } else if (isLetter(s[l])) {
      let m = l;
      while (m >= 0 && isLetter(s[m])) m--;
      lStart = m + 1;
    }
    if (rEnd < 0 || lStart < 0) { i = k + 1; continue; }
    const left = s.slice(lStart, k).trim();
    const right = s.slice(j, rEnd).trim();
    if (!left || !right) { i = k + 1; continue; }
    return s.slice(0, lStart) + "\\frac{" + left + "}{" + right + "}" + s.slice(rEnd);
    }
    return null;
  };
  let t = src;
  for (let n = 0; n < 50; n++) {
    const next = convertFirst(t);
    if (next === null) break;
    t = next;
  }
  return t;
}
function appNotationToLatex(s: string): string {
  // PRIMA le frazioni (così le radici avvolgono frazioni già impilate),
  // POI le radici con parentesi bilanciate.
  let t = stackedFractionsToLatex(s ?? "");
  // Converte UNA occorrenza «SIMBOLO ( ... )» con parentesi BILANCIATE
  // (le regex semplici [^{}()] falliscono con radicandi che contengono
  // altre parentesi, es. √((3⁄7)·(1−4⁄7)) o radici annidate √(√(9))).
  const convertBalanced = (src: string, sym: string, cmd: string): string => {
    let out = "";
    let i = 0;
    for (;;) {
      const k = src.indexOf(sym, i);
      if (k < 0) { out += src.slice(i); break; }
      let j = k + sym.length;
      while (j < src.length && /\s/.test(src[j]!)) j++;
      if (src[j] !== "(") { out += src.slice(i, j); i = j; continue; }
      let depth = 0;
      let m = j;
      for (; m < src.length; m++) {
        if (src[m] === "(") depth++;
        else if (src[m] === ")") { depth--; if (depth === 0) break; }
      }
      if (depth !== 0) { out += src.slice(i, j + 1); i = j + 1; continue; }
      const inner = src.slice(j + 1, m).trim();
      out += src.slice(i, k) + cmd + "{" + inner + "}";
      i = m + 1;
    }
    return out;
  };
  for (let i = 0; i < 4; i++) {
    const prev = t;
    t = convertBalanced(t, "∛", "\\sqrt[3]");
    t = convertBalanced(t, "∜", "\\sqrt[4]");
    t = convertBalanced(t, "√", "\\sqrt");
    // √x / ∛x / ∜x semplici senza parentesi (cifra, lettera, fraz. impilata)
    t = t
      .replace(/∛\s*([0-9a-z](?:\u2044[0-9a-z]+)?)/gi, "\\sqrt[3]{$1}")
      .replace(/∜\s*([0-9a-z](?:\u2044[0-9a-z]+)?)/gi, "\\sqrt[4]{$1}")
      .replace(/√\s*([0-9a-z](?:[\u2044\/][0-9a-z]+)?)/gi, "\\sqrt{$1}");
    if (t === prev) break;
  }
  return t;
}

/** LaTeX di un monomio ridotto dalla somma dei coefficienti (per il RICOPIA) */
function reducedMonomialLatex(vars: { v: string; e: number }[], sum: Frac): string {
  const t: Term = { c: sum, vars: vars.map((x) => ({ ...x })) };
  return termToLatex(t, "auto");
}

/** Unisce i LaTeX dei termini di un gruppo con spaziatura leggibile */
function joinTermLatex(termLatexes: string[]): string {
  return termLatexes
    .map((s, i) => {
      if (i === 0) return s;
      return s.startsWith("-") ? ` - ${s.slice(1)}` : ` + ${s}`;
    })
    .join("");
}

// ─── Linea dei numeri (dal PDF «Mappa · le regole») ──────────────

function NumberLine({ value }: { value: number }) {
  if (!Number.isInteger(value) || value < -10 || value > 10) return null;
  const ticks: number[] = [];
  for (let i = -10; i <= 10; i++) ticks.push(i);
  const pos = (v: number) => ((v + 10) / 20) * 100;
  return (
    <div className="mt-2 px-2" role="img" aria-label={`Linea dei numeri da −10 a +10, il risultato ${value} è evidenziato`}>
      <svg viewBox="0 0 440 46" className="w-full max-w-md mx-auto" aria-hidden="true">
        <line x1="10" y1="28" x2="430" y2="28" stroke="#2B2421" strokeWidth="1.6" />
        <path d="M 430 28 l -7 -3.4 v 6.8 z" fill="#2B2421" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={10 + (pos(t) / 100) * 420} y1="23" x2={10 + (pos(t) / 100) * 420} y2="33" stroke="#2B2421" strokeWidth="1.2" />
            <text
              x={10 + (pos(t) / 100) * 420}
              y="43"
              fontSize="9.5"
              textAnchor="middle"
              fill={t === value ? "#B91C1C" : "#7A6A61"}
              fontWeight={t === value ? "bold" : "normal"}
            >
              {t}
            </text>
          </g>
        ))}
        <circle cx={10 + (pos(value) / 100) * 420} cy="28" r="5.5" fill="#B91C1C" />
      </svg>
      <p className="text-center text-[13px] text-muted-foreground -mt-1">
        Da 0 <b>scendo</b> di {Math.abs(value)} e arrivo a <b className="text-destructive">{value}</b>
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

export default function EspressioniExercises() {
  // Altezza embed: unica fonte = initHeightSync() in main.tsx.
  // Il vecchio observer locale inviava resize senza token e senza guardia
  // del ritaglio, eludendo il freeze data-lf-crop-open. Non ripristinarlo.

  // ─── PDF generation ─────────────────────────────────────────────
  const [generatingPdf, setGeneratingPdf] = useState(false);
  /* GIRO 31: SCARICA PDF visibile solo a esercizio completato */
  const [pdfReady, setPdfReady] = useState(false);

  // ─── Expression input (trascrizione a PEZZI: mano o tastiera) ───
  const { recognize, isModelReady, isLoading: modelLoading } = useMathRecognition();
  const [exprStrokes, setExprStrokes] = useState<Stroke[]>([]);
  const [recognizedLatex, setRecognizedLatex] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [eraserMode, setEraserMode] = useState(false);

  /* ---- TRASCRIZIONE A PEZZI (richiesta esplicita dell'utente) ----
     Se vuole, l'utente trascrive l'espressione in più pezzi (24/10:
     NESSUN limite di elementi per pezzo — si può scrivere anche tutto
     in un pezzo solo); ogni pezzo confermato apre una finestra vuota
     per il successivo; il pulsante finale avvia il calcolo
     dell'espressione intera.
     GIRO 22: NIENTE TASTIERA (rimossa su richiesta esplicita dell'utente).
     GIRO 24: NIENTE FOTO né CARICA (rimosse su richiesta esplicita).
     GIRO 27: pulsante TRASCRIZIONE AUDIO E CON TASTIERA sotto la finestra
     di scrittura a mano: apre TUTTI i box dell'app audio originaria
     (AUDIO-MATEMATICI) — microfono, 1 · Trascrizione letteraria
     correggibile con RIANALIZZA CON IA, 2 · Trascrizione matematica con
     campo da tastiera (regole giro 26) e ✓ AGGIUNGI COME PEZZO — sopra
     ✓ CONFERMA E CALCOLA.
     (Il conteggio degli elementi sta in lib/pieceCount.ts, usato solo più
     dai test e dal banco di prova.) */
  // solo points: bastano per la diagnostica e non trascinano lineWidth
  type PieceStroke = { points: { x: number; y: number }[] };
  type Piece = { raw: string; shown: string; strokes?: PieceStroke[] };
  /* MODALITÀ DIAGNOSTICA (?diag=1 nell'URL): su ogni card pezzo appare un
     pulsante ⤓ che scarica i TRATTI GREZZI del pezzo (JSON). Serve per
     riprodurre ESATTAMENTE la scrittura dell'utente quando un glifo non
     viene riconosciuto, invece di correggere alla cieca. Nessun impatto
     per gli studenti: senza ?diag=1 l'interfaccia è identica. */
  const DIAG =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("diag") === "1";
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [pieceBusy, setPieceBusy] = useState(false);
  const [pieceError, setPieceError] = useState<string | null>(null);
  // Correzione da tastiera di un pezzo riconosciuto a mano
  const [editingPiece, setEditingPiece] = useState<number | null>(null);
  const [editPieceText, setEditPieceText] = useState("");
  const pieceEditorRef = useRef<HTMLDivElement>(null);

  /* ─── FOTO DELL'ESPRESSIONE (26/10, come «Latino Facile») ──────────
     SCATTA UNA FOTO DEL TESTO (fotocamera) oppure CARICA UNA FOTO (file):
     la foto passa dal RITAGLIO (CropDialog 8731: box libero, maniglie dentro
     la foto, rotazione, trascinamento diretto, RUOTA/CHIUDI/RITAGLIA) e poi l'IA VISION la
     trascrive in notazione (POST /api/ai/transcribe, kind "photo"); se
     l'IA non risponde, soccorso OCR locale (Tesseract). La trascrizione
     diventa UN PEZZO della lista (correggibile con ✎, eliminabile con ✕)
     e lascia SEMPRE il controllo finale allo studente. */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = useState<{ url: string } | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoProgress, setFotoProgress] = useState(0);
  const MAX_FOTO_BYTES = 18 * 1024 * 1024;
  /* onCropConfirm usa addPiece: il corpo vive dopo la sua dichiarazione
     (sotto «Aggiunge un pezzo alla lista»), qui solo la firma. */
  const onCropConfirmRef = useRef<(f: File) => Promise<void>>(() => Promise.resolve());

  /** La foto (fotocamera o file) passa prima dal ritaglio dei margini */
  const handleFotoFile = useCallback(async (file: File) => {
    if (fotoBusy) return;
    if (file.size > MAX_FOTO_BYTES) {
      setPieceError("Il file è troppo grande (massimo 18 MB). Scatta o carica una foto più piccola e riprova.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImage =
      file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "bmp"].includes(ext);
    if (!isImage) {
      setPieceError("Formato non supportato: usa una foto (JPG, PNG, WEBP).");
      return;
    }
    try {
      const straight = await normalizePhoto(file);
      const url = URL.createObjectURL(straight);
      setCropImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url };
      });
    } catch {
      const url = URL.createObjectURL(file);
      setCropImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url };
      });
    }
  }, [fotoBusy]);

  /** Chiude il ritaglio senza riconoscere nulla */
  const closeCrop = useCallback(() => {
    setCropImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  /** Ritaglio confermato: IA vision prima, OCR locale come soccorso.
     La trascrizione diventa UN PEZZO (non calcolo automatico). Il corpo è
     assegnato DOPO addPiece (sotto), per l'ordine delle dichiarazioni. */
  const onCropConfirm = useCallback(
    (croppedFile: File) => onCropConfirmRef.current(croppedFile),
    [],
  );

  /* ---- TRASCRIZIONE A PEZZI: logica ---- */

  /** Riconosce i tratti di UN pezzo e restituisce la forma interna
   *  (stessa pipeline della vecchia espressione intera: soccorso del
   *  puntino, riparazione delle divisioni, quadre come disegnate). */
  const recognizePiece = useCallback(
    async (strokes: Stroke[]): Promise<string> => {
      // post-elaborazione in lib/recognizePiece.ts (modulo puro: lo stesso
      // codice lo valuta il banco di prova col modello reale)
      const result = await recognize(strokes, "expression");
      return finalizePiece(result, strokes);
    },
    [recognize],
  );

  /** Aggiunge un pezzo alla lista e apre la finestra vuota successiva
   *  (nuova canvas pulita). (24/10: NESSUN limite di elementi per pezzo,
   *  su richiesta dell'utente — si può scrivere anche tutto in un pezzo.) */
  const addPiece = useCallback((raw: string, shown: string, strokes?: PieceStroke[]) => {
    const piece = raw.trim();
    if (!piece) return;
    setPieceError(null);
    setPieces((prev) => [
      ...prev,
      // snapshot dei tratti (serve solo alla diagnostica ?diag=1)
      { raw: piece, shown, strokes: strokes?.map((s) => ({ points: s.points.map((p) => ({ ...p })) })) },
    ]);
    setExprStrokes([]);
    setEraserMode(false);
    setTimeout(() => {
      pieceEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }, []);

  /** Forma «leggibile dal libro» di un pezzo, per la lista e per la
   *  correzione da tastiera (· : ² √ ⁄): il parser accetta questa notazione.
   *  GIRO 35 (foto utente: «\frac{3}{4}^2)» grezzo nel campo ✎): il
   *  comando LaTeX \frac{}{} NON è un comando del widget — le frazioni si
   *  scrivono con la barra («3/4 → 3⁄4», come da legenda TASTIERA). Il
   *  sanificatore converte \frac{a}{b} → a⁄b (e gli altri comandi LaTeX)
   *  PRIMA del pretty, così né la lista né il campo ✎ mostrano mai «frac».
   *  Vale anche per i pezzi vecchi già salvati con il \frac dentro. */
  const prettyPiece = (s: string) =>
    prettyExpression(
      sanitizeLatexNotation(
        normalizeKeyboardNotation(
          s
            .replace(/\\cdot|\\times|\\bullet/g, "*")
            .replace(/\\div/g, "/")
            .replace(/\\sqrt/g, "√")
            .replace(/\\left|\\right/g, ""),
        ),
      ),
    );

  /** Aggiunge il pezzo tracciato a mano (26/10: riconosce l'IA vision, non
   *  più il modello statico ONNX che sbagliava troppo spesso). I tratti del
   *  canvas diventano un'immagine e l'IA li TRASCRIVE soltanto (mai calcolare):
   *  il pezzo resta correggibile con ✎. Il motore statico resta come
   *  soccorso solo se l'IA non risponde. */
  const addPieceHand = useCallback(async () => {
    if (exprStrokes.length === 0 || pieceBusy) return;
    setPieceBusy(true);
    setPieceError(null);
    try {
      const dataUrl = strokesToDataUrl(exprStrokes);
      /* (26/10-bis) bias «lettera»: i pezzi possono contenere variabili
         (3ab, z^2…) — MAI «nel dubbio cifra», altrimenti a→2, b→6, z→2. */
      const aiExpr = await aiTranscribeImage(dataUrl, "ink", "lettera");
      setPieceBusy(false);
      setPieceError(null);
      addPiece(aiExpr, prettyPiece(aiExpr), exprStrokes);
      toast.success("Pezzo letto con l'IA: controlla la trascrizione prima di continuare.");
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        // IA non raggiungibile: soccorso col motore statico locale.
        const piece = await recognizePiece(exprStrokes);
        setPieceBusy(false);
        if (piece) {
          addPiece(piece, prettyPiece(piece), exprStrokes);
          return;
        }
      }
      setPieceBusy(false);
      setPieceError("Nessun pezzo riconosciuto. Riprova a tracciare, oppure correggilo con la tastiera.");
      if (!(err instanceof AiUnavailableError)) {
        toast.error("L'IA non è riuscita a leggere il tratto: prova a riscriverlo con cifre più grandi.");
      }
    }
    // (24/10) avvertimento «scritto piccolo» RIMOSSO su richiesta: compariva
    // sempre e dava fastidio. Il riquadro di controllo resta comunque visibile.
  }, [exprStrokes, pieceBusy, recognizePiece, addPiece]);

  /* Corpo di onCropConfirm (dopo addPiece e prettyPiece): ritaglio
     confermato → IA vision prima, OCR locale come soccorso; la
     trascrizione diventa UN PEZZO, mai calcolo automatico. */
  onCropConfirmRef.current = async (croppedFile: File) => {
    setCropImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setFotoBusy(true);
    setFotoProgress(0);
    setPieceError(null);
    try {
      let notation = "";
      try {
        const dataUrl = await fileToScaledDataUrl(croppedFile);
        notation = await aiTranscribeImage(dataUrl, "photo");
      } catch (err) {
        if (!(err instanceof AiUnavailableError)) throw err;
        /* l'IA non risponde: soccorso OCR locale sulla stessa foto */
        const raw = await ocrImage(croppedFile, setFotoProgress);
        notation = normalizeExpressionOcr(raw);
        if (!notation.trim()) throw new Error("nessun testo riconosciuto");
      }
      const cleaned = normalizeExpressionOcr(notation, true);
      const pezzo = cleaned.trim() ? cleaned : notation;
      addPiece(pezzo, prettyPiece(pezzo));
      toast.success("Foto trascritta e aggiunta come pezzo — controllala e correggila con ✎ se serve.");
    } catch {
      setPieceError("Non sono riuscito a leggere l'espressione nella foto. Prova con un'immagine più nitida e con testo scuro su sfondo chiaro.");
    } finally {
      setFotoBusy(false);
      setFotoProgress(0);
    }
  };

  /** DIAGNOSTICA: scarica i tratti grezzi di un pezzo (JSON) per
   *  riprodurre nei test la scrittura reale dell'utente. */
  const downloadPieceStrokes = useCallback(
    (i: number) => {
      const p = pieces[i];
      if (!p?.strokes?.length) return;
      const blob = new Blob(
        [JSON.stringify({ pezzo: i + 1, shown: p.shown, raw: p.raw, strokes: p.strokes }, null, 2)],
        { type: "application/json" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pezzo-${i + 1}-tratti.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.info(`Tratti del pezzo ${i + 1} scaricati`);
    },
    [pieces],
  );

  /** Spegne i messaggi di errore: l'utente sta riscrivendo (richiesta:
   *  i messaggi come «ESPRESSIONE INCOMPLETA...» scompaiono appena si
   *  ricomincia a scrivere il pezzo con l'errore) */
  const clearInputErrors = useCallback(() => {
    setParseError(null);
    setPieceError(null);
  }, []);



  /* (26/10): il vecchio calcolo locale (analisi + percorsi fratte /
     polinomiale sulla STESSA pagina) è stato rimosso — la pagina
     trascrive soltanto; lo svolgimento si costruisce con l'IA e si apre
     sulla terza pagina. I memo analysis/fratta/verifica qui sotto sono
     spariti con lui. */

  // ─── Read student info from URL ─────────────────────────────────
  const studentInfo = useMemo(() => {
    const params = getStudentSearchParams();
    if (!params) return null;
    const cognome = params.get("cognome")?.trim() || "";
    const nome = params.get("nome")?.trim() || "";
    const data = params.get("data")?.trim() || "";
    const classe = params.get("classe")?.trim() || "";
    if (!cognome && !nome && !data && !classe) return null;
    return { cognome, nome, data, classe };
  }, []);

  const studentLabel = useMemo(() => {
    if (!studentInfo) return "";
    const parts = [];
    if (studentInfo.cognome && studentInfo.nome) parts.push(`${studentInfo.cognome} ${studentInfo.nome}`);
    else if (studentInfo.cognome) parts.push(studentInfo.cognome);
    else if (studentInfo.nome) parts.push(studentInfo.nome);
    if (studentInfo.classe) parts.push(`Classe ${studentInfo.classe}`);
    if (studentInfo.data) parts.push(studentInfo.data);
    return parts.join(" — ");
  }, [studentInfo]);

  // ─── Handlers ───────────────────────────────────────────────────


  /** Flag del pannello TRASCRIZIONE aperto (giro 32): il ref resta sempre
   *  sincronizzato via effetto. Lo usa il pulsante di costruzione IA per
   *  leggere la notazione del box 2 · TRASCRIZIONE MATEMATICA. */
  const panelConfirmRef = useRef<{ open: boolean; notation: string }>({ open: false, notation: "" });

  /* ─── COSTRUZIONE IA DELLO SVOLGIMENTO (25-26/10) ───────────────────
     Lo STUDENTE trascrive l'espressione (pezzi a mano, microfono o
     tastiera) e preme il pulsante: il server chiede all'IA di scomporla
     in passaggi minimi (box, frasi didattiche, righe progressive per il
     PDF, risultato finale) e VERIFICA ogni conto (numerico, simbolico o
     per sostituzione — max 3 tentativi: l'IA propone, il motore dispone).
     Lo svolgimento verificato diventa l'ESERCIZIO ATTIVO, salvato sul
     server: la TERZA pagina (/esercizio) lo mostra subito, nello stesso
     deployment e nella stessa cornice del blog. L'app è UNIVERSALE: va
     bene per QUALSIASI tipo di espressione (aritmetiche, algebriche con
     lettere, fratte, potenze, radici quadrate e cubiche). */
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildStage, setBuildStage] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildOk, setBuildOk] = useState<string | null>(null);
  const handleCostruisci = useCallback(async () => {
    const panel = panelConfirmRef.current;
    const espressione =
      panel.open && normalizeKeyboardNotation(panel.notation).trim()
        ? normalizeKeyboardNotation(panel.notation)
        : exprFromPieces(pieces);
    if (!espressione.trim()) {
      toast.error("Scrivi prima l'espressione: a mano, con il microfono o con la tastiera.");
      return;
    }
    setBuildBusy(true);
    setBuildStage(0);
    setBuildError(null);
    setBuildOk(null);
    const timer = window.setInterval(() => {
      setBuildStage((s) => Math.min(s + 1, STADI_COSTRUZIONE.length - 1));
    }, 4500);
    try {
      /* JOB + POLLING: la costruzione può durare qualche minuto (l'IA
         lavora e, se serve, corregge i conti); il gateway HTTP interrompe
         le richieste lunghe, quindi il server avvia il lavoro e risponde
         subito con un jobId: qui lo interroghiamo ogni 3 secondi finché
         l'esercizio non è pronto (verificato). */
      const res = await fetch("/api/ai/costruisci-esercizio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espressione }),
      });
      const avvio = (await res.json().catch(() => ({}))) as { jobId?: string; error?: string };
      if (!res.ok || !avvio.jobId) {
        throw new Error(avvio.error ?? `Costruzione fallita (${res.status}).`);
      }
      /* il lavoro sul server riprova da solo quando l'IA del gateway è
         lenta o risponde male: può servire più di un quarto d'ora —
         intanto lo studente vede la linea di progresso */
      const scadenza = Date.now() + 15 * 60 * 1000;
      let esercizioCostruito: unknown = null;
      for (;;) {
        if (Date.now() > scadenza) {
          throw new Error("La costruzione sta impiegando troppo tempo. Riprova tra qualche minuto.");
        }
        await new Promise((r) => setTimeout(r, 3000));
        const r2 = await fetch(`/api/ai/costruisci-esercizio?id=${encodeURIComponent(avvio.jobId)}`);
        const j2 = (await r2.json().catch(() => ({}))) as {
          stato?: string;
          tentativo?: number;
          esercizio?: unknown;
          error?: string;
        };
        if (j2.stato === "fatto" && j2.esercizio) {
          esercizioCostruito = j2.esercizio;
          break;
        }
        if (j2.stato === "errore") {
          throw new Error(j2.error ?? "Costruzione fallita.");
        }
        /* avanzamento reale: dall'IA va bene il primo giro; se corregge,
           la linea di progresso mostra che sta VERIFICANDO i conti */
        if ((j2.tentativo ?? 1) >= 2) {
          setBuildStage(3);
        } else {
          setBuildStage((s) => Math.max(s, 1));
        }
      }
      if (!esercizioCostruito) {
        throw new Error("Costruzione non completata.");
      }
      const res2 = await fetch("/api/esercizio/attivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ esercizio: esercizioCostruito, espressione }),
      });
      if (!res2.ok) {
        const j2 = (await res2.json().catch(() => ({}))) as { error?: string };
        throw new Error(j2.error ?? `Salvataggio fallito (${res2.status}).`);
      }
      setBuildOk("✓ Esercizio pronto e verificato! Apro lo svolgimento per gli studenti…");
      /* (26/10-fix PDF dinamico) il salvataggio restituisce il sid della
         sessione personale: la terza pagina apre QUELLO svolgimento
         (e SCARICA PDF stampa quello, non un esercizio altrui). */
      const salvato = (await res2.json().catch(() => ({}))) as { sid?: string };
      const parametri = new URLSearchParams(window.location.search);
      if (salvato.sid) parametri.set("sid", salvato.sid);
      const destinazione = "/esercizio" + (parametri.toString() ? `?${parametri.toString()}` : "");
      setTimeout(() => {
        window.location.assign(destinazione);
      }, 1400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Costruzione fallita.";
      if (/chiave API|503/i.test(msg)) {
        setBuildError("L'intelligenza artificiale non è attiva su questo server (manca la chiave API). L'esercizio attivo resta quello attuale.");
      } else if (/[a-z]{4,}[^À-ÿ]*(?:aborted|timeout|failed|network|unavailable|overloaded)/i.test(msg)) {
        /* (26/10) rete di sicurezza: residui in inglese dal browser/rete
           tradotti in italiano prima di mostrarli allo studente */
        setBuildError(
          /timeout|aborted/i.test(msg)
            ? "L'intelligenza artificiale ha messo troppo tempo a rispondere (timeout). Riprova: di solito al secondo tentativo va più veloce."
            : /network|failed|fetch/i.test(msg)
              ? "Problema di rete nel contattare l'intelligenza artificiale. Controlla la connessione e riprova tra qualche minuto."
              : "Il servizio dell'intelligenza artificiale è momentaneamente non disponibile. Riprova tra qualche minuto.",
        );
      } else {
        setBuildError(msg);
      }
    } finally {
      window.clearInterval(timer);
      setBuildBusy(false);
    }
  }, [pieces]);
  /* (26/10): RIPRISTINA rimosso — ogni studente costruisce il proprio
     svolgimento dalla propria espressione, non esiste più «l'esercizio
     originale dell'app» da ripristinare. */

  /** Unisce i pezzi in un'unica espressione (giro 23). Se un pezzo termina
   *  con «^<cifra>» e il successivo comincia con una cifra, il semplice
   *  concatenare darebbe un esponente a DUE cifre (es. «^2»+«1+1» → «^21»),
   *  che il motore rifiuta (esponenti solo 1–9) e la trascrizione in basso
   *  degradava a testo grezzo. Inserisco allora un «·» esplicito: i pezzi
   *  erano stati scritti separatamente, quindi è moltiplicazione implicita
   *  (MAI un calcolo: si ridefinisce solo la giustapposizione). */
  function exprFromPieces(list: { raw: string }[]): string {
    let out = "";
    for (const p of list) {
      const piece = p.raw;
      if (
        out &&
        /\^[0-9]$/.test(out) &&
        /^[0-9]/.test(piece)
      ) {
        out += "·";
      }
      out += piece;
    }
    return out;
  }

  /* ---- PANNELLO TRASCRIZIONE AUDIO E CON TASTIERA (giro 27, da
     AUDIO-MATEMATICI) ---- Il pulsante apre TUTTI i box dell'app audio
     originaria, SUBITO sotto la finestra di scrittura a mano e SOPRA
     ✓ CONFERMA E CALCOLA:
       · zona microfono (registrazione, auto-stop 20 s, barra);
       · box 1 · TRASCRIZIONE LETTERARIA: testo parlato correggibile, con
         RIANALIZZA CON IA e CANCELLA (come /api/math/parse);
       · box 2 · TRASCRIZIONE MATEMATICA: matematica RESA con frazioni
         impilate (stessa catena del riquadro di controllo, giro 23),
         notazione lineare e campo correggibile DA TASTIERA con le regole
         del giro 26, CANCELLA, ✓ AGGIUNGI COME PEZZO.
     Più audios di seguito si riuniscono in un'unica espressione (l'IA
     rianalizza il tutto). (24/10: NESSUN limite di elementi per pezzo.) */
  const audio = useRecorder();
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  // GIRO 37 (richiesta utente 23/10 sera): la legenda tastiera è visibile
  // solo su richiesta, dietro il pulsante ISTRUZIONI PER SCRIVERE DA TASTIERA.
  const [legendOpen, setLegendOpen] = useState(false);
  // (24/10) stessa cosa per il campo ✎ di correzione dei pezzi a mano.
  const [editorLegendOpen, setEditorLegendOpen] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [audioNotation, setAudioNotation] = useState("");
  /* GIRO 32: tiene panelConfirmRef sincronizzato (dichiarato sopra
     handleStartCompute per l'ordine delle dichiarazioni) */
  useEffect(() => {
    panelConfirmRef.current = { open: audioPanelOpen, notation: audioNotation };
  }, [audioPanelOpen, audioNotation]);
  const [parseBusy, setParseBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  /** Rianalizza un testo parlato (corretto a mano o scritto da zero) in
   *  notazione, MAI calcolare: come /api/math/parse dell'app audio */
  const analizzaSpoken = useCallback(async (testo: string) => {
    if (!testo.trim()) return;
    setParseBusy(true);
    setPanelError(null);
    try {
      const res = await fetch("/api/ai/parse-spoken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoken: testo }),
      });
      const json = (await res.json().catch(() => ({}))) as { notation?: string; error?: string };
      if (!res.ok || !json.notation) {
        // GIRO 36: se l'IA non è configurata (503) o non raggiungibile,
        // messaggio operativo invece del gergo tecnico: il campo tastiera
        // del box 2 resta comunque usabile a mano (conversione live locale).
        const rawErr = json.error ?? `Interpretazione fallita (${res.status})`;
        if (res.status === 503 || /non configurata|EASY_PEASY_API_KEY/i.test(rawErr)) {
          throw new Error(
            "L'analisi automatica con IA non è attiva su questo server: scrivi o correggi la notazione a mano nel campo qui sotto (le conversioni 3/4 → ³⁄₄, * → ·, rad2 → √ funzionano anche senza IA), poi premi ✓ AGGIUNGI COME PEZZO.",
          );
        }
        throw new Error(rawErr);
      }
      // GIRO 28: la notazione IA si mostra come nell'app audio originaria
      // («÷» per la divisione, frazioni impilate)
      setAudioNotation(toDisplayNotation(json.notation));
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Interpretazione non riuscita. Riprova.");
    } finally {
      setParseBusy(false);
    }
  }, []);

  /** Accoda un risultato del microfono al testo già presente (più audios di
   *  seguito → un'unica espressione, come nell'app audio). Usata sia dal
   *  secondo tocco sia dall'auto-stop dei 20 s (24/10). */
  const accodaRisultatoMicrofono = useCallback((res: { spoken: string; notation: string }) => {
    const nuovo = res.spoken.trim();
    if (!nuovo) return;
    const precedente = spokenText.trim();
    if (!precedente) {
      setSpokenText(nuovo);
      setAudioNotation(toDisplayNotation(res.notation));
      setPanelError(null);
    } else {
      const combinato = `${precedente} ${nuovo}`;
      setSpokenText(combinato);
      void analizzaSpoken(combinato);
    }
  }, [spokenText, analizzaSpoken]);

  /* (24/10) AUTO-STOP dei 20 s: il risultato pubblicato dall'hook in
     `audio.autoResult` si accoda DA SOLO (stessa logica del secondo tocco),
     così il dettato non va perso senza premere di nuovo il microfono. */
  const seenAutoRef = useRef<string | null>(null);
  useEffect(() => {
    const res = audio.autoResult;
    if (!res) { seenAutoRef.current = null; return; }
    const chiave = `${res.spoken}⟷${res.notation}`;
    if (seenAutoRef.current === chiave) return;
    seenAutoRef.current = chiave;
    accodaRisultatoMicrofono(res);
  }, [audio.autoResult, accodaRisultatoMicrofono]);

  /** Microfono del pannello: il risultato si ACCODA al testo già presente
   *  (più audios di seguito → un'unica espressione, come nell'app audio) */
  const handleMicPanel = useCallback(async () => {
    if (audio.transcribing || parseBusy) return;
    if (audio.recording) {
      const res = await audio.stopAndTranscribe();
      if (!res) return;
      // (24/10) segna come già visto: l'auto-stop non lo ri-accoderà
      seenAutoRef.current = `${res.spoken}⟷${res.notation}`;
      accodaRisultatoMicrofono(res);
      return;
    }
    void audio.start();
  }, [audio, parseBusy, accodaRisultatoMicrofono]);

  const clearAudioPanel = useCallback(() => {
    audio.reset();
    setSpokenText("");
    setAudioNotation("");
    setPanelError(null);
  }, [audio]);


  /** ✓ AGGIUNGI COME PEZZO: la notazione del pannello diventa un PEZZO
   *  (correggibile ✎, eliminabile ✕), con le regole del giro 26 */
  const addPieceFromPanel = useCallback(() => {
    const piece = normalizeKeyboardNotation(audioNotation);
    if (!piece) return;
    setPieceError(null);
    setPieces((prev) => [...prev, { raw: piece, shown: prettyPiece(piece) }]);
    toast.success("Trascrizione aggiunta come pezzo: controllala nel riquadro in basso.");
    clearAudioPanel();
    setAudioPanelOpen(false);
    // il riquadro «CONTROLLA PRIMA DI CONFERMARE» deve essere SUBITO visibile
    window.setTimeout(() => {
      transRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }, [audioNotation, clearAudioPanel]);

  /** Box 2: la matematica RESA (frazioni impilate) con la STESSA catena del
   *  riquadro di controllo (giro 23): analisi → fratte → pulizia → testo.
   *  GIRO 28: si analizza la notazione DELL'APP (il campo mostra «÷», il
   *  motore vuole «:») e nel LaTeX la divisione si mostra come «\div» SOLO
   *  qui nel box del pannello, come nell'app audio originaria. */
  const panelNotationDisplay = useMemo<{ kind: "latex" | "text"; value: string } | null>(
    () => {
      const appNotation = normalizeKeyboardNotation(audioNotation);
      if (!appNotation.trim()) return null;
      const comeDiviso = (latex: string) => latex.replace(/:/g, "\\div");
      /* (24/10: niente equazioni — se c'è «=» si mostra il PRIMO membro,
         il resto dopo l'uguale viene ignorato) */
      const i = appNotation.indexOf("=");
      const first = (i < 0 ? appNotation : appNotation.slice(0, i)).trim();
      if (!first) return { kind: "text" as const, value: prettyExpression(appNotation) };
      try {
        return { kind: "latex", value: comeDiviso(appNotationToLatex(analyzeExpression(first).originalLatex)) };
        return { kind: "latex", value: comeDiviso(appNotationToLatex(analyzeExpression(appNotation).originalLatex)) };
      } catch {
        try {
          return { kind: "latex", value: comeDiviso(appNotationToLatex(analyzeFratte(appNotation).originalLatex)) };
        } catch {
          /* prosegui con i fallback qui sotto */
        }
        try {
          const cleaned = normalizeExpressionOcr(appNotation, true);
          if (cleaned) {
            return { kind: "latex", value: comeDiviso(appNotationToLatex(analyzeExpression(cleaned).originalLatex)) };
          }
        } catch {
          /* ultima spiaggia: testo */
        }
      }
      /* (26/10, foto utente «radice a mano senza barra»: il pannello DEVE
         mostrare la matematica resa anche quando il motore non valuta
         (qui: √3 non è un quadrato perfetto e analyzeExpression lancia
         errore). appNotationToLatex converte √(…)/∛()/∜() in \sqrt PRIMA
         della resa: così la barra della radice compare sempre. Ultima
         spiaggia solo se la resa KaTeX fallisce davvero. */
      try {
        return { kind: "latex", value: comeDiviso(appNotationToLatex(toDisplayNotation(appNotation))) };
      } catch {
        return { kind: "text", value: prettyExpression(appNotation) };
      }
    },
    [audioNotation],
  );

  /** Box 2: la matematica RESA (frazioni impilate) con la STESSA catena del
   *  riquadro di controllo (giro 23): analisi → fratte → pulizia → testo */


  /* ---- TRASCRIZIONE DELL'APP IN BASSO (richiesta esplicita, 7/10) ----
     Prima di passare alla schermata dei CALCOLI, in basso si vede SEMPRE
     la trascrizione dell'app CON LE FRAZIONI IMPILATE: i pezzi trascritti
     a mano (LaTeX uniti). Il passaggio ai calcoli avviene
     SOLO premendo ✓ CONFERMA E CALCOLA (mai automatico). */
  const transRef = useRef<HTMLDivElement>(null);
  const transSource = exprFromPieces(pieces);
  /** Rappresentazione per il riquadro di controllo: SEMPRE matematica resa
   *  (frazioni impilate, apici), MAI testo grezzo con «/» e «^» visibili.
   *  1) analisi diretta → originalLatex (la STESSA riga dei calcoli);
   *  2) se l'analisi fallisce (tipico: simboli mismatchati) si prova
   *     la pulizia da foto (riparazione parentesi, segni raddoppiati, rumore;
   *     light=true: NESSUN operatore o esponente inventato) e si analizza di
   *     nuovo — il giro 16 mostrava qui il testo grezzo e il riquadro sembrava
   *     «tutto sbagliato»;
   *  3) solo se anche la pulizia non basta: testo «da libro» (prettyExpression). */
  const transDisplay = useMemo<{ kind: "latex" | "text"; value: string } | null>(
    () => {
      if (!transSource) return null;
      /* (24/10: niente equazioni — se c'è «=» mostro il PRIMO membro,
         il resto dopo l'uguale viene ignorato) */
      const eq = transSource.indexOf("=");
      const first = (eq < 0 ? transSource : transSource.slice(0, eq)).trim();
      if (!first) return { kind: "text", value: prettyExpression(transSource) };
      try {
        return { kind: "latex", value: appNotationToLatex(analyzeExpression(first).originalLatex) };
        return { kind: "latex", value: appNotationToLatex(analyzeExpression(transSource).originalLatex) };
      } catch {
        // FRATTE (giro 21): il percorso polinomiale fallisce, la stampa razionale no
        try {
          return { kind: "latex", value: appNotationToLatex(analyzeFratte(transSource).originalLatex) };
        } catch {
          /* prosegui con i fallback qui sotto */
        }
        try {
          const cleaned = normalizeExpressionOcr(transSource, true);
          if (cleaned) {
            return { kind: "latex", value: appNotationToLatex(analyzeExpression(cleaned).originalLatex) };
          }
        } catch {
          /* ultima spiaggia qui sotto */
        }
        /* GIRO 23: anche quando il motore NON riesce a valutare (espressione
           ancora incompleta, es. parentesi aperte non ancora chiuse mentre
           si trascrive a pezzi) la trascrizione si mostra COME MATEMATICA
           (KaTeX, frazioni impilate), mai come testo grezzo: il vecchio
           fallback mono faceva vedere «((\frac{3}{4})^21+1» — illeggibile e
           con l'esponente che sembrava «21». katexHtml usa throwOnError:
           false, quindi il render degrada con eleganza.
           (26/10: la notazione dell'app passa per appNotationToLatex, così
           anche qui le radici a mano hanno la barra sopra il radicando.) */
        return { kind: "latex", value: appNotationToLatex(transSource) };
      }
    },
    [transSource],
  );

  /* ---- DITTATURA VOCALE (giro 22) E FOTO/CARICA (giro 24) RIMOSE su
     richiesta esplicita dell'utente ----
     Nella seconda schermata resta SOLO la scrittura a mano, potenziata
     dall'IA (modello ONNX + soccorso IA vision sui tratti, sopra). Il
     pezzo resta comunque correggibile con ✎ ed eliminabile con ✕. */

  /** Correzione da TASTIERA di un pezzo (scritto a mano — richiesta
   *  esplicita dell'utente al giro 22: la correzione
   *  resta l'unico uso della tastiera): ✎ sulla card apre un campo
   *  precompilato con il pezzo in notazione del libro; OK sostituisce. */
  const cancelEditPiece = useCallback(() => {
    setEditingPiece(null);
    setEditPieceText("");
  }, []);

  const startEditPiece = useCallback(
    (i: number) => {
      setEditingPiece(i);
      // GIRO 35-fix: ricalcola il testo dal raw (non usa lo shown salvato),
      // così anche i pezzi vecchi salvati col \frac dentro si aprono già
      // sanificati (solo la barra, mai «frac»).
      setEditPieceText(prettyPiece(pieces[i].raw ?? pieces[i].shown));
      setParseError(null);
    },
    [pieces],
  );

  const saveEditPiece = useCallback(() => {
    if (editingPiece === null) return;
    // GIRO 26: le stesse regole di trascrizione da tastiera dell'app audio
    // (: divisione, * moltiplicazione, 3/4 frazione impilata, ^2 potenza,
    // rad2/rad3/rad4 radici) — già applicate MENTRE si digita, qui come
    // rete di sicurezza al salvataggio.
    const text = normalizeKeyboardNotation(editPieceText);
    if (!text) {
      cancelEditPiece();
      return;
    }
    // (24/10: NESSUN limite di elementi per pezzo, su richiesta dell'utente.)
    setPieces((prev) => prev.map((p, j) => (j === editingPiece ? { raw: text, shown: text } : p)));
    setEditingPiece(null);
    setEditPieceText("");
    setPieceError(null);
    setParseError(null);
  }, [editingPiece, editPieceText, cancelEditPiece]);

  /* (26/10): il vecchio PDF del quaderno locale è stato rimosso — il PDF
     vive sulla terza pagina (svolgimento verificato), generato dalle righe
     progressive. */

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div
      className="expr-input-page bg-background paper-grain"
      role="region"
      aria-label="Trascrizione dell'espressione: area a scorrimento verticale"
      tabIndex={0}
    >
      {/* Header: (28/10) titolo e dati studente rimossi su richiesta;
          resta solo il piccolo pulsante marrone INDIETRO. */}
      <header className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="text-center">
          <a
            href="/#/"
            aria-label="Torna alla pagina iniziale"
            className="inline-flex items-center gap-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 transition-colors"
          >
            INDIETRO
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 pb-6">
        {/* (26/10): la pagina trascrive soltanto; il vecchio motore locale
            è sparito, resta SOLO la costruzione IA con la terza pagina. */}
          <div className="space-y-4">
            {/* Suggerimento — GIRO 32: quando la TRASCRIZIONE AUDIO E CON
                TASTIERA è aperta, la scrittura a mano è nascosta e anche
                questa riga sparisce (resta solo il pannello di trascrizione). */}
            {!audioPanelOpen && (
            <div className="text-center">
              <span className="text-[13px] sm:text-sm text-foreground tracking-wider font-bold">
                SCRIVI QUI L'ESPRESSIONE
              </span>
            </div>
            )}

            {/* 27/9: paragrafo di istruzioni RIMOSSO su richiesta dell'utente
                (resta solo la riga «TRASCRIVI L'ESPRESSIONE UN PEZZO ALLA VOLTA»). */}

            {/* Pezzi già trascritti — GIRO 34: nascosti mentre la
                TRASCRIZIONE AUDIO E CON TASTIERA è aperta (come la
                finestra di scrittura a mano): i due modi non si mostrano
                insieme. I pezzi restano salvati e ricompaiono chiudendo
                il pannello; la conferma usa la notazione del pannello. */}
            {!audioPanelOpen && pieces.length > 0 && (
              <div className="max-w-2xl mx-auto w-full space-y-2" aria-label="Pezzi trascritti">
                {pieces.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 animate-pop-in">
                    <span className="flex-none w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center" aria-hidden="true">{i + 1}</span>
                    {editingPiece === i ? (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editPieceText}
                          onChange={(e) => {
                            // GIRO 26: conversione MENTRE si digita (come
                            // nell'app audio): * → ·, 3/4 → 3⁄4, rad2 → √,
                            // rad3 → ∛, rad4 → ∜ (il cursore segue)
                            const el = e.target;
                            const conv = normalizeKeyboardLive(
                              el.value,
                              el.selectionStart ?? el.value.length,
                            );
                            setEditPieceText(conv.value);
                            if (conv.value !== el.value) {
                              window.requestAnimationFrame(() => {
                                try {
                                  el.setSelectionRange(conv.caret, conv.caret);
                                } catch {
 /* input non più montato */
                                }
                              });
                            }
                            setParseError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditPiece();
                            if (e.key === "Escape") cancelEditPiece();
                          }}
                          autoFocus
                          aria-label={`Correggi con la tastiera il pezzo ${i + 1}`}
                          className="flex-1 h-9 px-2 rounded-lg border-2 border-primary bg-background text-foreground text-sm font-mono focus:outline-none"
                        />
                        <button
                          onClick={saveEditPiece}
                          aria-label={`Salva la correzione del pezzo ${i + 1}`}
                          className="flex-none h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors"
                        >
                          OK
                        </button>
                        <button
                          onClick={cancelEditPiece}
                          aria-label={`Annulla la correzione del pezzo ${i + 1}`}
                          className="flex-none w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-bold transition-colors"
                        >
                          ✕
                        </button>
                        </div>
                        {/* (24/10) istruzioni tastiera dietro pulsante, come nel
                            box 2 del pannello audio (un rigo per regola) */}
                        <div className="mt-1 text-center">
                          <button
                            onClick={() => setEditorLegendOpen((v) => !v)}
                            aria-expanded={editorLegendOpen}
                            className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary/60 text-foreground text-xs font-bold tracking-widest transition-colors"
                          >
                            {editorLegendOpen ? "▾ NASCONDI LE ISTRUZIONI" : "▸ ISTRUZIONI PER SCRIVERE DA TASTIERA"}
                          </button>
                        </div>
                        {editorLegendOpen && (
                          <div
                            className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-center space-y-0.5"
                            aria-label="Regole di trascrizione da tastiera"
                          >
                            <p className="text-sm"><span className="font-mono font-bold text-blue-700 dark:text-blue-300">Scrivi :</span> <span className="text-foreground">per il segno di divisione (si mostra ÷)</span></p>
                            <p className="text-sm"><span className="font-mono font-bold text-amber-700 dark:text-amber-300">Scrivi *</span> <span className="text-foreground">per il segno di moltiplicazione (si mostra ·)</span></p>
                            <p className="text-sm"><span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">Scrivi /</span> <span className="text-foreground">per la frazione impilata</span></p>
                            <p className="text-sm"><span className="font-mono font-bold text-violet-700 dark:text-violet-300">Scrivi ^2, ^-2</span> <span className="text-foreground">per gli esponenti di una potenza (anche negativi)</span></p>
                            <p className="text-sm"><span className="font-mono font-bold text-rose-700 dark:text-rose-300">Scrivi rad2, rad3, rad4…</span> <span className="text-foreground">per la radice quadrata, la cubica, la quarta, ecc.</span></p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Frazione impilata anche nella lista dei pezzi (richiesta
                            esplicita): il LaTeX grezzo si rende con KaTeX, non
                            il testo «1⁄2» non reso né «1 : 2» lineare */}
                        {/* 28/10: pezzo lungo → SCORRE dentro il box (piece-display
                            in index.css), non esce più dai bordi della card. */}
                        <span
                          className="piece-display flex-1 min-w-0 text-center font-mono text-base text-foreground"
                          dangerouslySetInnerHTML={{ __html: katexHtml(appNotationToLatex(p.raw)) }}
                        />
                        {DIAG && p.strokes && p.strokes.length > 0 && (
                          <button
                            onClick={() => downloadPieceStrokes(i)}
                            aria-label={`Scarica i tratti del pezzo ${i + 1} (diagnostica)`}
                            title="Scarica i tratti di questo pezzo (diagnostica)"
                            className="flex-none w-8 h-8 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground text-sm font-bold transition-colors"
                          >
                            ⤓
                          </button>
                        )}
                        <button
                          onClick={() => startEditPiece(i)}
                          aria-label={`Correggi con la tastiera il pezzo ${i + 1}`}
                          title="Correggi questo pezzo con la tastiera"
                          className="flex-none w-8 h-8 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground text-sm font-bold transition-colors"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => {
                            setPieces((prev) => prev.filter((_, j) => j !== i));
                            setParseError(null);
                          }}
                          aria-label={`Elimina il pezzo ${i + 1}`}
                          className="flex-none w-8 h-8 rounded-lg bg-secondary hover:bg-destructive hover:text-destructive-foreground text-foreground text-sm font-bold transition-colors"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Finestra del pezzo corrente (sempre vuota dopo ogni aggiunta)
                GIRO 32: nascosta mentre la TRASCRIZIONE AUDIO E CON TASTIERA
                è aperta — i due modi di trascrizione non si mostrano insieme. */}
            {!audioPanelOpen && (
            <div ref={pieceEditorRef} className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden animate-pop-in max-w-2xl mx-auto w-full shadow-md">
              <div className="px-3 pt-2 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold tracking-widest text-primary">
                  {`PEZZO ${pieces.length + 1}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {/* GIRO 22: niente TASTIERA. GIRO 24: niente FOTO né CARICA.
                      GIRO 27: la TRASCRIZIONE AUDIO E CON TASTIERA apre i box
                      dell'app audio SOTTO la finestra (non qui in testa). */}
                </div>
              </div>
              {(
                <>
                  <div className="px-2 py-2">
                    <div className="w-full h-[130px] rounded-lg border border-border overflow-hidden bg-white">
                      <MathDrawCanvas
                        strokes={exprStrokes}
                        onStrokesChange={(s) => {
                          // Appena l'utente ricomincia a scrivere il pezzo,
                          // i messaggi di errore spariscono (richiesta esplicita)
                          setExprStrokes(s);
                          clearInputErrors();
                        }}
                        tool={eraserMode ? "erase" : "write"}
                        hideWatermark
                        className="border-0 rounded-none"
                      />
                    </div>
                  </div>
                  <div className="px-3 pb-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <button
                      onClick={addPieceHand}
                      disabled={exprStrokes.length === 0 || pieceBusy}
                      className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-bold text-sm sm:text-base tracking-widest transition-all shadow-sm"
                    >
                      {pieceBusy ? "RICONOSCIMENTO..." : "AGGIUNGI PEZZO"}
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => setEraserMode(!eraserMode)}
                        disabled={exprStrokes.length === 0 && !eraserMode}
                        className={`flex-1 sm:flex-none py-3 px-4 rounded-xl font-bold text-sm sm:text-base tracking-widest transition-all ${
                          eraserMode
                            ? "bg-destructive text-destructive-foreground shadow-sm"
                            : "bg-secondary hover:bg-secondary/80 text-foreground"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                        title={eraserMode ? "Modalità gomma attiva — clicca per tornare a scrivere" : "Attiva la gomma per cancellare parti del disegno"}
                      >
                        {eraserMode ? "✕ GOMMA" : "GOMMA"}
                      </button>
                      <button
                        onClick={() => {
                          setExprStrokes([]);
                          setEraserMode(false);
                        }}
                        disabled={exprStrokes.length === 0}
                        className="flex-1 sm:flex-none py-3 px-4 rounded-xl bg-secondary hover:bg-secondary/80 disabled:opacity-30 disabled:cursor-not-allowed text-foreground font-bold text-sm sm:text-base tracking-widest transition-all"
                      >
                        CANCELLA
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            )}

            {/* GIRO 27: pulsante che apre i box della TRASCRIZIONE AUDIO E CON
                TASTIERA (microfono + 1 · letteraria + 2 · matematica), subito
                sotto la finestra di scrittura a mano e sopra CONFERMA E CALCOLA */}
            <div className="mx-auto flex w-full max-w-md justify-center">
              <button
                onClick={() => setAudioPanelOpen((v) => !v)}
                aria-expanded={audioPanelOpen}
                aria-controls="pannello-audio"
                className="inline-flex w-full cursor-pointer select-none items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
                <Keyboard className="h-4 w-4" aria-hidden="true" />
                {audioPanelOpen ? "CHIUDI LA TRASCRIZIONE" : "TRASCRIZIONE AUDIO E CON TASTIERA"}
              </button>
            </div>

            {/* (26/10) FOTO come in «Latino Facile»: SCATTA (fotocamera) e
                CARICA (file) — la foto passa dal ritaglio e l'IA la
                trascrive come UN PEZZO (mai calcolo automatico). */}
            {!audioPanelOpen && (
              <div className="space-y-2">
                <div className="mx-auto grid w-full max-w-md gap-3">
                  <button
                    type="button"
                    disabled={fotoBusy}
                    aria-label="Scatta una foto dell'espressione con la fotocamera posteriore"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex w-full cursor-pointer select-none items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    {fotoBusy ? "LETTURA DELLA FOTO…" : "SCATTA UNA FOTO DEL TESTO"}
                  </button>
                  <button
                    type="button"
                    disabled={fotoBusy}
                    aria-label="Carica una foto dell'espressione dal dispositivo"
                    onClick={() => uploadInputRef.current?.click()}
                    className="inline-flex w-full cursor-pointer select-none items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    CARICA UNA FOTO
                  </button>
                </div>
                {fotoBusy && fotoProgress > 0 && (
                  <p className="text-center text-xs font-bold text-muted-foreground" role="status" aria-live="polite">
                    RICONOSCIMENTO IN CORSO… {Math.round(fotoProgress * 100)}%
                  </p>
                )}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFotoFile(f);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFotoFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            <CropDialog
              open={cropImage != null}
              imageUrl={cropImage?.url ?? null}
              onConfirm={(f) => void onCropConfirm(f)}
              onClose={closeCrop}
            />

            {audioPanelOpen && (
              <div id="pannello-audio" className="rounded-xl border-2 border-primary/30 bg-card p-5 sm:p-6 max-w-2xl mx-auto w-full shadow-md space-y-6 animate-pop-in">
                {/* Zona microfono (come nell'app audio originaria) */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={handleMicPanel}
                    disabled={audio.transcribing || parseBusy}
                    aria-pressed={audio.recording}
                    aria-label={
                      audio.recording
                        ? "Ferma la registrazione e trascrivi"
                        : "Inizia a registrare il dettato"
                    }
                    className={`flex-none flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      audio.recording ? "bg-destructive" : "bg-primary hover:bg-primary/90"
                    }`}
                  >
                    {audio.transcribing ? (
                      <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                    ) : audio.recording ? (
                      <Square className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Mic className="h-7 w-7" aria-hidden="true" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-center text-foreground" role="status" aria-live="polite">
                      {audio.transcribing
                        ? "L'IA STA TRASCRIVENDO IL DETTATO…"
                        : audio.recording
                          ? "REGISTRAZIONE IN CORSO: DETTA L'ESPRESSIONE, POI RIPREMI IL MICROFONO PER FERMARTI IN ANTICIPO"
                          : "PREMI IL MICROFONO, DETTA L'ESPRESSIONE E, QUANDO HAI FINITO, PREMI DI NUOVO"}
                    </p>
                    {audio.recording && (
                      <div className="mt-2" aria-hidden="true">
                        <div className="h-1.5 w-full max-w-56 mx-auto rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-primary transition-[width] duration-300 ease-linear"
                            style={{ width: `${(audio.elapsed / audio.maxSeconds) * 100}%` }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 text-center">
                          {audio.elapsed} s / {audio.maxSeconds} s — poi la registrazione si ferma da sola
                        </p>
                      </div>
                    )}
                    {(audio.error || panelError) && (
                      <p className="mt-3 text-sm text-destructive text-center font-semibold" role="alert">
                        {audio.error ?? panelError}
                      </p>
                    )}
                  </div>
                </div>

                {/* BOX 1 · TRASCRIZIONE LETTERARIA (correggibile, come nell'app audio) */}
                <div className="rounded-lg border border-border bg-background p-4 sm:p-5 space-y-3">
                  <p className="text-xs font-bold tracking-widest text-primary text-center">1 · TRASCRIZIONE LETTERARIA</p>
                  <textarea
                    value={spokenText}
                    onChange={(e) => setSpokenText(e.target.value)}
                    rows={2}
                    aria-label="Testo dettato"
                    placeholder="Esempio: parentesi tonda due terzi più un quarto chiusa parentesi tonda, alla seconda, diviso cinque"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={() => void analizzaSpoken(spokenText)}
                      disabled={parseBusy || audio.transcribing || !spokenText.trim()}
                      className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold tracking-widest transition-colors"
                    >
                      ✨ ANALIZZA CON IA
                    </button>
                    <button
                      onClick={clearAudioPanel}
                      className="px-4 py-2.5 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold tracking-widest transition-colors"
                    >
                      CANCELLA
                    </button>
                  </div>
                  {parseBusy && (
                    <p className="text-sm text-muted-foreground text-center" role="status" aria-live="polite">
                      ANALISI IA DELLA TRASCRIZIONE IN CORSO…
                    </p>
                  )}
                </div>

                {/* BOX 2 · TRASCRIZIONE MATEMATICA (resa + campo tastiera) */}
                <div className="rounded-lg border-2 border-primary/30 bg-secondary/40 p-4 sm:p-5 space-y-3">
                  <p className="text-xs font-bold tracking-widest text-primary text-center">2 · TRASCRIZIONE MATEMATICA</p>
                  <div
                    className="piece-display rounded-xl bg-card border border-border p-5 min-h-[76px] flex items-center justify-center"
                    aria-live="polite"
                    aria-label="Espressione trascritta"
                  >
                    {panelNotationDisplay ? (
                      panelNotationDisplay.kind === "latex" ? (
                        <span className="text-xl text-foreground" dangerouslySetInnerHTML={{ __html: katexHtml(panelNotationDisplay.value) }} />
                      ) : (
                        <span className="font-mono text-lg break-words text-foreground">{panelNotationDisplay.value}</span>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground text-center">
                        Qui puoi vedere la trascrizione matematica
                      </span>
                    )}
                  </div>
                  <textarea
                    id="notazione-pannello"
                    value={audioNotation}
                    rows={2}
                    onChange={(e) => {
                      // GIRO 28: conversione MENTRE si digita con le regole del
                      // pannello (app audio originaria): la barra "/" è SEMPRE
                      // frazione impilata (anche le fratte) e i due punti scritti
                      // si mostrano come «÷»; al pezzo si salva «:» (giro 26)
                      const el = e.target;
                      const conv = normalizeKeyboardDisplayLive(el.value, el.selectionStart ?? el.value.length);
                      setAudioNotation(conv.value);
                      if (conv.value !== el.value) {
                        window.requestAnimationFrame(() => {
                          try {
                            el.setSelectionRange(conv.caret, conv.caret);
                          } catch {
                            /* input non più montato */
                          }
                        });
                      }
                      setPanelError(null);
                    }}
                    placeholder="Esempio: (3/4*4/6)^2-2+5:(1/5)"
                    aria-label="Notazione da tastiera"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[44px]"
                  />
                  {/* GIRO 37 (richiesta utente 23/10 sera): la legenda sta
                      dietro il pulsante ISTRUZIONI PER SCRIVERE DA TASTIERA —
                      il box si apre/chiude nella STESSA posizione (contenuto
                      invariato dal giro 36: stessi colori, un rigo per regola). */}
                  <div className="text-center">
                    <button
                      onClick={() => setLegendOpen((v) => !v)}
                      aria-expanded={legendOpen}
                      className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary/60 text-foreground text-xs font-bold tracking-widest transition-colors"
                    >
                      {legendOpen ? "▾ NASCONDI LE ISTRUZIONI" : "▸ ISTRUZIONI PER SCRIVERE DA TASTIERA"}
                    </button>
                  </div>
                  {legendOpen && (
                    <div
                      className="rounded-lg border border-border bg-card px-3 py-2 text-center space-y-0.5"
                      aria-label="Regole di trascrizione da tastiera"
                    >
                      <p className="text-sm"><span className="font-mono font-bold text-blue-700 dark:text-blue-300">Scrivi :</span> <span className="text-foreground">per il segno di divisione (si mostra ÷)</span></p>
                      <p className="text-sm"><span className="font-mono font-bold text-amber-700 dark:text-amber-300">Scrivi *</span> <span className="text-foreground">per il segno di moltiplicazione (si mostra ·)</span></p>
                      <p className="text-sm"><span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">Scrivi /</span> <span className="text-foreground">per la frazione impilata</span></p>
                      <p className="text-sm"><span className="font-mono font-bold text-violet-700 dark:text-violet-300">Scrivi ^2, ^-2</span> <span className="text-foreground">per gli esponenti di una potenza (anche negativi)</span></p>
                      <p className="text-sm"><span className="font-mono font-bold text-rose-700 dark:text-rose-300">Scrivi rad2, rad3, rad4…</span> <span className="text-foreground">per la radice quadrata, la cubica, la quarta, ecc.</span></p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={addPieceFromPanel}
                      disabled={!audioNotation.trim()}
                      className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold tracking-widest transition-colors"
                    >
                      ✓ AGGIUNGI COME PEZZO
                    </button>
                    <button
                      onClick={() => setAudioNotation("")}
                      disabled={!audioNotation.trim()}
                      className="px-4 py-2.5 rounded-lg bg-destructive hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed text-destructive-foreground text-xs font-bold tracking-widest transition-colors"
                    >
                      CANCELLA
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Errore del pezzo — GIRO 34: nascosto col pannello aperto
                (parla dei pezzi, che in quel momento non si vedono) */}
            {!audioPanelOpen && pieceError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 max-w-2xl mx-auto w-full text-center">
                <span className="text-sm font-semibold text-destructive">{pieceError}</span>
              </div>
            )}

            {/* Errore dell'espressione completa (al primo avvio del calcolo)
                — GIRO 34: nascosto col pannello aperto (parla dei pezzi) */}
            {!audioPanelOpen && parseError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 animate-pop-in max-w-2xl mx-auto w-full text-center">
                <span className="text-base font-semibold text-destructive">{parseError}</span>
              </div>
            )}

            {/* (26/10): unico pulsante finale — lo STUDENTE fa costruire
                all'IA lo svolgimento su misura dall'espressione trascritta
                (pezzi a mano OPPURE notazione del pannello TRASCRIZIONE
                AUDIO E CON TASTIERA quando è aperto e non vuoto). Il vecchio
                calcolo locale (CONFERMA E CALCOLA) è stato rimosso. */}
            <div className="flex justify-center pt-1">
              <button
                onClick={handleCostruisci}
                disabled={
                  buildBusy ||
                  (pieces.length === 0 && !(audioPanelOpen && normalizeKeyboardNotation(audioNotation).trim()))
                }
                aria-label="Fai costruire con l'intelligenza artificiale l'esercizio su misura da questa espressione"
                className="px-6 py-4 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-900 font-bold text-base tracking-widest transition-all duration-200 shadow-sm animate-pop-in disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🤖 COSTRUISCI L'ESERCIZIO CON L'IA
              </button>
            </div>
            {buildBusy && (
              <div
                className="rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-4 max-w-2xl mx-auto w-full text-center shadow-md animate-pop-in"
                role="status"
                aria-live="polite"
              >
                <span className="text-xs font-bold tracking-widest text-sky-900">
                  L'IA STA COSTRUENDO L'ESERCIZIO
                </span>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-sky-900">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{STADI_COSTRUZIONE[Math.min(buildStage, STADI_COSTRUZIONE.length - 1)]}</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sky-200">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-700"
                    style={{ width: `${((buildStage + 1) / STADI_COSTRUZIONE.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {buildError && (
              <div
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 max-w-2xl mx-auto w-full text-center animate-pop-in"
                role="alert"
                aria-live="assertive"
              >
                <span className="text-sm font-semibold text-destructive">{buildError}</span>
              </div>
            )}
            {buildOk && (
              <div
                className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 max-w-2xl mx-auto w-full text-center animate-pop-in"
                role="status"
                aria-live="polite"
              >
                <span className="text-sm font-bold text-emerald-800">{buildOk}</span>
              </div>
            )}
            {/* TRASCRIZIONE DELL'APP IN BASSO (richiesta esplicita, 7/10):
                vale sia per i pezzi fatti A MANO sia per il testo scritto con
                la TASTIERA (o dettata a voce). Ai calcoli si passa SOLO
                dopo aver premuto ✓ CONFERMA E CALCOLA.
                GIRO 34: nascosto mentre il pannello è aperto — mostra i
                pezzi, che in quel momento non si vedono; la resa del
                pannello vive già nel box 2 · TRASCRIZIONE MATEMATICA. */}
            {!audioPanelOpen && transSource && transDisplay && (
              <div
                ref={transRef}
                className="rounded-xl border-2 border-primary/30 bg-card px-4 py-3 max-w-2xl mx-auto w-full text-center shadow-md"
                role="status"
                aria-live="polite"
              >
                <span className="text-xs font-bold tracking-widest text-primary">
                  CONTROLLA PRIMA DI CONFERMARE
                </span>
                <div className="mt-2 text-xl text-foreground overflow-x-auto">
                  {transDisplay.kind === "latex" ? (
                    <span dangerouslySetInnerHTML={{ __html: katexHtml(transDisplay.value) }} />
                  ) : (
                    <span className="font-mono text-lg break-words">{transDisplay.value}</span>
                  )}
                </div>
              </div>
            )}
          </div>

        {/* (26/10): i vecchi percorsi di calcolo locale (fratte,
            polinomiale, PDF del quaderno) sono stati rimossi — dopo la
            trascrizione c'è SOLO la costruzione IA, che apre la terza
            pagina con lo svolgimento verificato. */}
      </main>

    </div>
  );
}

// ─── NOTEBOOK GUIDE COMPONENT ──────────────────────────────────────

function NotebookGuide({
  title,
  defaultOpen = false,
  forceOpen = false,
  visible = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  visible?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!visible) return null;

  const open = forceOpen || isOpen;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center px-4 py-2.5 hover:bg-primary/10 transition-colors relative"
      >
        <span className="text-base font-bold text-primary text-center">{title}</span>
        <span className={cn("text-primary/60 text-base transition-transform duration-300 absolute right-4", open && "rotate-180")}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1">
          <div className="notebook-content rounded-lg bg-card border border-border p-3.5 space-y-2 text-base leading-loose text-foreground text-center">
            <div
              className="relative"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 1.55rem, rgba(139,92,62,0.06) 1.55rem, rgba(139,92,62,0.06) 1.6rem)",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OPERAZIONE INTERATTIVA (input studente) ────────────────────

/**
 * Un'operazione da SVOLGERE: mostra il calcolo senza risultato (es. «6 : 3 =»)
 * e lo studente scrive il risultato a mano. Finché non è corretto, mostra il
 * feedback di errore; quando è corretto mostra l'uguaglianza completa in verde.
 */
function InteractiveOpInput({
  step,
  value,
  onChange,
  lastOp,
}: {
  step: ExprStep;
  value: number | null;
  onChange: (v: number | null) => void;
  /** true se dopo questo passo non restano altri calcoli nell'espressione */
  lastOp?: boolean;
}) {
  const correct = stepCorrect(value, step.answer);
  // Divisione non esatta (es. 1 : 6): il risultato si accetta come frazione
  // impilata (o numero equivalente) e si mostra SEMPRE come frazione
  // impilata, mai come decimale con la virgola (richiesta 27/9).
  const nonInt = !!step.answer && step.answer.d !== 1;
  const risLatex = nonInt
    ? fractionStepLatex(step.answer!, !!lastOp)
    : risultatoLatex(step.answer!);
  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <span className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(`${step.opLatex!} =`) }} />
      </div>
      {!correct ? (
        <>
          {/* (27/10, richiesta utente) l'avviso «Scrivi il risultato come frazione
              impilata» è stato ELIMINATO PER SEMPRE: superfluo, non reintrodurlo. */}
          <NumberInputCanvas
            value={value}
            onChange={onChange}
            label="INSERISCI IL RISULTATO:"
            colorClass="text-primary"
            allowNegative
            /* (26/10-ter) risultato sbagliato: SOLO il messaggio rosso,
               niente trascrizione in blu del valore pubblicato */
            hideValue={value != null && !correct}
          />
          {value != null && (
            <p className="text-base font-bold text-center text-destructive">RISULTATO SBAGLIATO. CALCOLA DI NUOVO</p>
          )}
        </>
      ) : (
        <p
          className="font-mono text-base text-center font-bold text-success"
          dangerouslySetInnerHTML={{ __html: katexHtml(`${step.opLatex!} = ${risLatex}`) }}
        />
      )}
    </div>
  );
}

// ─── ESPRESSIONI EXERCISE SUB-COMPONENT ───────────────────────────

interface EspressioniExerciseProps {
  analysis: Analysis;
  userSums: Record<string, number | null>;
  setUserSums: (v: Record<string, number | null>) => void;
  userResult: number | null;
  setUserResult: (v: number | null) => void;
  feedbackFinale: { testo: string; corretto: boolean } | null;
  setFeedbackFinale: (v: { testo: string; corretto: boolean } | null) => void;
  onNew: () => void;
  generatingPdf: boolean;
  studentLabel: string;
  /** GIRO 31: il padre mostra SCARICA PDF solo a esercizio completato */
  setPdfReady: (v: boolean) => void;
}

function EspressioniExercise({
  analysis,
  userSums,
  setUserSums,
  userResult,
  setUserResult,
  feedbackFinale,
  setFeedbackFinale,
  onNew,
  generatingPdf,
  studentLabel,
  setPdfReady,
}: EspressioniExerciseProps) {
  const { steps, groups, hasVars, finalPoly, finalLatex, originalLatex, uselessParens } = analysis;

  // Riga «senza parentesi»: l'ultimo passo di tipo parentesi, se esiste;
  // per le espressioni solo numeriche la catena prosegue fino al risultato,
  // ma il passo didattico «riscrivo senza parentesi» è quello intermedio.
  // ⚠️ «div-num» NON è tra i tipi parentesi: le divisioni esterne (es.
  // 27 : 3 in 27 : 3 + 48 : 28) sono CALCOLO IN ORDINE (punto 4), non
  // scioglimento delle parentesi (punto 2). Con «div-num» dentro,
  // lastParenIdx atterrava sull'ULTIMO passo (9 + 12/7): la stessa
  // espressione si ripeteva 4 volte (punto 3, suo RICOPIA, inizio del
  // punto 4 e suo RICOPIA).
  // «paren-prod» (19/10): i prodotti/potenze/radici DENTRO le parentesi
  // tonde appartengono al punto 2 — altrimenti nel percorso «risultato
  // diretto» il punto 3 li saltava e l'app li calcolava da sola.
  // «paren-div» (19/10): le divisioni DENTRO le parentesi tonde appartengono
  // al punto 2 — altrimenti, se c'è una catena ±, nessun punto le chiedeva e
  // l'app le calcolava da sola.
  const parenKinds = ["paren-value", "paren-sign", "paren-mul", "paren-prod", "paren-div", "paren-unwrap"];
  const lastParenIdx = (() => {
    for (let i = steps.length - 1; i > 0; i--) {
      if (parenKinds.includes(steps[i].kind)) return i;
    }
    return 0;
  })();
  const flatStep = steps[lastParenIdx];
  // C'è una catena di ± da svolgere (fold-add-num)? Se sì, le divisioni
  // numeriche esterne entrano nel punto 4 (calcolo in ordine); se no
  // (l'espressione termina con le divisioni, es. 9 : 5, 1 : (3 : 4)) restano
  // nel percorso «risultato diretto» come prima.
  const hasAddChain = steps.some((s, i) => i > 0 && s.kind === "fold-add-num");
  // ⚠️ FASI RIGOROSE (niente calcoli anticipati): il motore riduce SOLO
  // parentesi finché ce ne sono, quindi divisioni/prodotti/catena esterni.
  // Il punto 2 propone quindi TUTTI i passi fino all'ultimo passo di
  // parentesi NELL'ORDINE ESATTO del motore: ogni operazione mostrata è
  // ancora da svolgere, nessun risultato compare prima del tempo.
  // (25/10) anche i passi delle RADICI n-esime («root») e delle proprietà
  // delle radici («root-prop», riscritture segnalate) entrano nel punto 2
  // dei monomi: prima la radice n-esima compariva solo come √ (segnalazione).
  const monomialSteps = steps.filter(
    (s, i) =>
      i > lastParenIdx &&
      // (25/10) i pow-prop/pow-prop-final con base tra PARENTESI (inParen)
      // appartengono al punto 2 «Risolvo le parentesi tonde», non da qui
      !(s.inParen && (s.kind === "pow-prop" || s.kind === "pow-prop-final")) &&
      ["mul-terms", "pow-term", "sqrt", "div-mono", "root", "root-prop", "rad-rad", "rad-pow", "rad-pow-final", "pow-prop", "pow-prop-final", "pow-frac", "pow-prod", "pow-prod-final", "pow-flip"].includes(
        s.kind,
      ),
  );
  const numericChain = steps.filter((s, i) => i > 0 && s.kind === "fold-add-num");
  // Catena COMPLETA del punto 4: prima le divisioni ESTERNE (27 : 3 = 9,
  // 48 : 28 = 12/7), poi la catena dei ± (9 + 12/7 = 75/7). L'ordine è
  // quello del motore: le divisioni vengono sempre prima della catena.
  // ⚠️ SOLO divisioni DOPO l'ultimo passo di parentesi: le divisioni
  // DENTRO le parentesi (es. 4 : 2 in 27 : (4 : 2 - 5 - 3) + …) sono già
  // state svolte nel punto 2 e hanno lo stesso tipo «div-num»: se entrano
  // nella catena il punto 4 le rifà e riparte dall'espressione CON
  // parentesi (segnalazione 26/9).
  const chainSteps = hasAddChain
    ? [...steps.filter((s, i) => i > lastParenIdx && s.kind === "div-num"), ...numericChain]
    : numericChain;
  // Da dove parte il «calcolo in ordine»: il passo PRIMA del primo passo
  // della catena (es. 27 : 3 + 48 : 28, cioè l'espressione senza parentesi
  // con le operazioni ancora da svolgere). Stessa regola: si cerca solo
  // DOPO l'ultimo passo di parentesi, altrimenti con le parentesi il
  // «passo prima» atterra sull'espressione originale (con parentesi).
  const firstChainIdx = steps.findIndex(
    (s, i) => i > lastParenIdx && (s.kind === "div-num" || s.kind === "fold-add-num")
  );
  const chainStartLatex = firstChainIdx > 0 ? steps[firstChainIdx - 1].latex : null;
  // ⚠️ Caso «operazione già finita»: espressione numerica che dopo il punto 2
  // è già un numero solo (es. 1 : (3 : 4) → dopo 3 : 4 resta solo 1 : 3 : 4;
  // oppure 9 : 5). Non ha senso «Riscrivo senza parentesi» né «Calcolo in
  // ordine»: dopo il box 2 c'è SOLO il box «3. Inserisci il tuo risultato»,
  // senza box sotto.
  const isDirectResult = !hasVars && numericChain.length === 0;
  const lastStep = steps[steps.length - 1];
  // ⚠️ L'ULTIMA operazione (es. la divisione 1 : 3 : 4) NON è un esercizio
  // del box 2: è l'operazione del box 3 «Inserisci il tuo risultato», con
  // cui l'espressione termina. Così lo studente non la svolge due volte.
  const parenSteps = [
    ...steps.slice(1, lastParenIdx + 1),
    // (25/10, richiesta utente) le proprietà delle potenze su basi tra
    // PARENTESI (es. (1/3)^-4 : (1/3)^-2) si mostrano nel punto 2:
    // entrambe le frazioni + la spiegazione, poi SOLO il risultato finale.
    ...steps.filter((s, i) => i > lastParenIdx && s.inParen && (s.kind === "pow-prop" || s.kind === "pow-prop-final")),
    ...steps.filter(
      (s, i) =>
        i > lastParenIdx && (s.kind === "div-mono" || (s.kind === "div-num" && !hasAddChain))
    ),
  ].filter((s) => !(isDirectResult && s === lastStep && isInteractiveStep(lastStep)));
  // L'operazione da svolgere nel box 3 del caso diretto (es. «1 : 3 : 4»)
  const directOpLatex = isDirectResult && lastStep ? (lastStep.opLatex ?? lastStep.latex) : null;

  // ⚠️ PUNTO 3 CONDIZIONATO (segnalazione 27/9): se non ci sono parentesi da
  // sciogliere né prodotti/potenze da fare, «Riscrivo senza parentesi»
  // riscriverebbe l'espressione IDENTICA a quella del punto 1 — nel PDF la
  // stessa operazione compariva 3 volte (punto 1, punto 3 e partenza del
  // punto 4). In quel caso il punto 3 si salta del tutto e la numerazione
  // scala: «Calcolo in ordine» diventa il punto 3 e «Risultato» il punto 4.
  const showRewriteStep = hasVars || parenSteps.length > 0 || monomialSteps.length > 0;
  // 27/9-quinquies: senza parentesi la card «Risolvo le parentesi» NON esiste
  // più (nel PDF la scritta «Niente parentesi: passo direttamente al calcolo»
  // e l'espressione ripetuta sotto erano un doppione) → dopo il punto 1 si
  // parte direttamente da «Riscrivo senza parentesi» rinumerato 2.
  const noParens = parenSteps.length === 0;
  const numRiscrivo = noParens ? 2 : 3;
  const numCalcoloOrdine = showRewriteStep ? numRiscrivo + 1 : noParens ? 2 : 3;
  const numRisultato = numCalcoloOrdine + 1;

  // ─── Input dello studente sui passi interattivi ───────────────────
  // Chiavi: «paren-i» (operazioni nelle parentesi), «mono-i» (prodotti e
  // potenze), «chain-i» (calcolo in ordine). Ogni operazione va SVOLTA
  // dallo studente (scrittura a mano): la successiva compare solo dopo
  // che la precedente è stata risolta correttamente (regola BES/DSA:
  // un passo alla volta, niente risultati già scritti).
  const [stepValues, setStepValues] = useState<Record<string, number | null>>({});
  const setStepValue = (key: string, v: number | null) =>
    setStepValues((prev) => ({ ...prev, [key]: v }));

  /* GIRO 30: risultati dei conti con LETTERE scritti da tastiera (regole del
     giro 26). La correttezza si calcola al volo col parser dell'app; il
     feedback di errore appare solo dopo VERIFICA (mai while typing). */
  const [typedValues, setTypedValues] = useState<Record<string, string>>({});
  const [typedAttempted, setTypedAttempted] = useState<Record<string, boolean>>({});
  // (25/10, punto 5) tentativi per passo → aiuto GRADUALE (dal 2º errore
  // arriva anche il promemoria della proprietà, mai il risultato)
  const [typedTries, setTypedTries] = useState<Record<string, number>>({});
  const setTypedValue = (key: string, v: string) =>
    setTypedValues((prev) => ({ ...prev, [key]: v }));
  const setTypedTried = (key: string) => {
    setTypedAttempted((prev) => ({ ...prev, [key]: true }));
    setTypedTries((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  };
  const typedCorrect = (key: string, s: ExprStep): boolean => {
    if (!s.answerPoly) return false;
    const p = parsePolyLoose(typedValues[key] ?? "");
    return p !== null && polyEquals(p, s.answerPoly);
  };

  /** Primo passo ancora DA SVOLGERE (input numerico o risultato con
      lettere da tastiera): i passi successivi restano nascosti. */
  const firstOpenIdx = (list: ExprStep[], prefix: string): number => {
    for (let i = 0; i < list.length; i++) {
      const key = `${prefix}-${i}`;
      if (isInteractiveStep(list[i]) && !stepCorrect(stepValues[key], list[i].answer)) return i;
      if (isTypedStep(list[i]) && !typedCorrect(key, list[i])) return i;
    }
    return -1;
  };

  const parenOpenIdx = firstOpenIdx(parenSteps, "paren");
  const allParenCorrect = parenOpenIdx === -1;
  const monoOpenIdx = firstOpenIdx(monomialSteps, "mono");
  const chainOpenIdx = firstOpenIdx(chainSteps, "chain");

  // Sblocco a cascata dei passi: il 3 compare solo dopo le parentesi (2),
  // il 4 solo dopo prodotti/potenze (3): niente risposte svelate in anticipo.
  const parenDone = parenSteps.length === 0 || allParenCorrect;
  const monoDone = monoOpenIdx === -1;
  const upperDone = parenDone && monoDone;

  // Le somme inserite sono tutte corrette?
  const inputGroups = groups.filter((g) => g.needsInput);
  const groupCorrect = (g: TermGroup) => userSums[g.key] != null && isUserSumCorrect(userSums[g.key] as number, g.sum);
  const allGroupsCorrect = inputGroups.every(groupCorrect);
  const anyGroupWrong = inputGroups.some((g) => userSums[g.key] != null && !groupCorrect(g));

  // Caso solo numerico: il risultato finale è l'ULTIMA operazione della
  // catena, scritta dallo studente (niente risultato già calcolato).
  const numericResult: number | null = !hasVars && finalPoly.length > 0 ? finalPoly[0].c.n / finalPoly[0].c.d : null;
  const numericCorrect =
    chainSteps.length > 0
      ? chainOpenIdx === -1
      : userResult !== null && numericResult !== null && Math.round(userResult * 100) === Math.round(numericResult * 100);

  // Caso letterale (GIRO 30): il risultato finale appare SOLO dopo che
  // TUTTI i conti sono stati svolti dallo studente (input numerici,
  // risultati con lettere da tastiera e somme dei gruppi) — MAI prima.
  const hasTypedSteps = parenSteps.some(isTypedStep) || monomialSteps.some(isTypedStep);
  const needsAnyInput = inputGroups.length > 0 || (!hasVars && true) || (hasVars && hasTypedSteps);
  const resultVisible =
    !needsAnyInput || (hasVars ? allGroupsCorrect && upperDone : numericCorrect);
  /* GIRO 31: il PDF (RICOPIA con risultati validati) si sblocca solo a
     esercizio completato — mai risultati in anticipo via PDF.
     ⚠️ (25/10-fix) il vecchio «|| !needsAnyInput» mostrava SCARICA PDF
     anche con passi interattivi ancora da svolgere (bucato quando non
     c'erano input tiped): ora il pulsante compare SOLO quando TUTTI i
     passi (parentesi, monomi, catena) sono stati risolti in modo
     corretto e il risultato finale è visibile. */
  useEffect(() => {
    setPdfReady(upperDone && chainOpenIdx === -1 && resultVisible);
  }, [resultVisible, upperDone, chainOpenIdx, setPdfReady]);

  const finalIsZero = finalPoly.length === 0;
  // MAPPA CONCETTUALE (PDF): RIMOSSA su richiesta dell'utente (26/9) —
  // niente pulsante 🗺️ né lib/mappaPdf.ts.

  /* GIRO 30: classe di SCOPO per il CSS — tutte le scritte della pagina
     esercizi ≥ 14pt (scala dell'app audio originaria); la prima pagina
     (WelcomePage) resta ESATTAMENTE com'è. */
  return (
    <div className="expr-exercise-page space-y-5">
      {/* MAPPA CONCETTUALE (PDF): RIMOSSA su richiesta dell'utente (26/9) */}

      {/* Step 1: Espressione inserita */}
      <div className="p-5 rounded-xl bg-card/40 border border-border space-y-5 leading-loose">
        <p className="text-base font-bold text-primary">1. Espressione inserita:</p>
        <div className="flex justify-center">
          <div className="inline-block px-4 py-2 rounded-lg bg-muted font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(originalLatex) }} />
        </div>
        <NotebookGuide title="RICOPIA SUL QUADERNO:" forceOpen={generatingPdf}>
          <p className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(originalLatex) }} />
        </NotebookGuide>
      </div>

      {/* Step 2: Risolvo le parentesi — la CARD sparisce del tutto quando
          non ci sono parentesi (27/9-quinquies): niente scritta «Niente
          parentesi: passo direttamente al calcolo» né RICOPIA duplicata. */}
      {parenSteps.length > 0 && (
      <div className="p-5 rounded-xl bg-card/40 border border-border space-y-5 leading-loose">
        <p className="text-base font-bold text-primary">2. Risolvo le parentesi tonde:</p>
        {parenSteps.length === 0 ? (
          <p className="text-base text-center opacity-80">
            In questa espressione <b>non ci sono parentesi</b> da sciogliere: vado avanti! ✓
          </p>
        ) : (
          <div className="space-y-3">
            {/* Risoluzione PROGRESSIVA: ogni operazione nelle parentesi va
                svolta dallo studente; la successiva compare solo dopo che
                la precedente è corretta (es. prima 6 : 3, poi 10 : 5). */}
            {parenSteps.map((s, i) => {
              if (parenOpenIdx !== -1 && i > parenOpenIdx) return null;
              if (isInteractiveStep(s)) {
                const risolta = stepCorrect(stepValues[`paren-${i}`], s.answer);
                return (
                  <div key={i} className="space-y-2">
                    <InteractiveOpInput
                      step={s}
                      value={stepValues[`paren-${i}`] ?? null}
                      onChange={(v) => setStepValue(`paren-${i}`, v)}
                      lastOp={steps.indexOf(s) === steps.length - 1}
                    />
                    {risolta && !(isDirectResult && i === parenSteps.length - 1) && (
                      <p className="font-mono text-base text-center" dangerouslySetInnerHTML={{ __html: katexHtml(s.latex) }} />
                    )}
                  </div>
                );
              }
              /* GIRO 30: risultato con LETTERE → lo scrive lo studente da
                 tastiera (regole giro 26); l'espressione di stato segue si
                 mostra solo dopo la convalida (mai risultati pre-scritti). */
              if (isTypedStep(s)) {
                const key = `paren-${i}`;
                const ok = typedCorrect(key, s);
                return (
                  <div key={i} className="space-y-2">
                    <TypedResultInput
                      step={s}
                      value={typedValues[key] ?? ""}
                      attempted={!!typedAttempted[key]}
                      correct={ok}
                      tries={typedTries[key] ?? 0}
                      onChange={(v) => setTypedValue(key, v)}
                      onVerify={() => setTypedTried(key)}
                      inputId={`typed-paren-${i}`}
                    />
                    {ok && (
                      <p className="font-mono text-base text-center" dangerouslySetInnerHTML={{ __html: katexHtml(s.latex) }} />
                    )}
                  </div>
                );
              }
              return (
                <div key={i} className="space-y-1">
                  <p className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(s.latex) }} />
                  {s.detail && (
                    <p className="font-mono text-sm opacity-80" dangerouslySetInnerHTML={{ __html: katexHtml(s.detail, false) }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <NotebookGuide title="RICOPIA SUL QUADERNO:" visible={parenSteps.length === 0 || allParenCorrect} forceOpen={generatingPdf}>
          {parenSteps.length === 0 ? (
            <p className="font-mono text-base">Niente parentesi: passo direttamente al calcolo.</p>
          ) : (
            <>
              <p className="text-base font-bold text-primary text-center">RISOLVO PRIMA LE PARENTESI</p>
              {/* Dedup adiacente (segnalazione 27/9): un rigo identico al
                  precedente non si ricopia — usato sia dall'anteprima sia
                  dal PDF. */}
              {dedupeRigheAdiacenti(
                parenSteps.map((s, i) => ({ s, i, riga: s.detail || s.opLatex ? copiaRiga(s) : null })),
                (p) => p.riga ?? "",
              ).map((p) =>
                p.riga ? (
                  <p key={p.i} className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(p.riga, false) }} />
                ) : null
              )}
            </>
          )}
        </NotebookGuide>
      </div>
      )}

      {/* Caso «operazione già finita»: SOLO il box 3 con il risultato,
          niente «Riscrivo senza parentesi», niente «Calcolo in ordine»,
          niente box 5: dopo il punto 2 l'espressione è già un numero. */}
      {parenDone && isDirectResult && (
        <div className="p-5 rounded-xl bg-card/40 border border-border space-y-5 leading-loose">
          <p className="text-base font-bold text-primary">{noParens ? "2." : "3."} Inserisco il risultato finale:</p>
          {/* Riquadro con l'operazione da svolgere (es. 1 : 3 : 4):
              ESSENZIALE per lo studente, che così sa cosa calcolare. */}
          {directOpLatex && (
            <div className="flex justify-center">
              <div className="inline-block px-4 py-2 rounded-lg bg-muted font-mono text-xl" dangerouslySetInnerHTML={{ __html: katexHtml(directOpLatex) }} />
            </div>
          )}
          <NumberInputCanvas
            value={userResult}
            onChange={(v) => {
              setUserResult(v);
              setFeedbackFinale(null);
            }}
            label="INSERISCO IL RISULTATO FINALE:"
            colorClass="text-primary"
            allowNegative
            /* (26/10-ter) sbagliato: solo il messaggio rosso, niente blu */
            hideValue={userResult !== null && !numericCorrect}
          />
          {userResult !== null && (
            <p className={cn("text-base font-bold text-center mt-2", numericCorrect ? "text-success" : "text-destructive")}>
              {numericCorrect ? "CORRETTO" : "RISULTATO SBAGLIATO. CALCOLA DI NUOVO"}
            </p>
          )}
          {numericCorrect && numericResult !== null && numericResult < 0 && <NumberLine value={numericResult} />}
          {numericCorrect && (
            <NotebookGuide title="RICOPIA SUL QUADERNO:" forceOpen={generatingPdf}>
              {/* (25/10) scritta RISULTATO FINALE in marrone anche nel PDF */}
              <p className="text-base font-bold text-primary tracking-widest">RISULTATO FINALE</p>
              {directOpLatex && <p className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(directOpLatex) }} />}
              <p className="font-mono text-2xl font-bold text-primary" dangerouslySetInnerHTML={{ __html: katexHtml(finalIsZero ? "0" : (fractionResultLatex(finalPoly) ?? finalLatex)) }} />
            </NotebookGuide>
          )}
        </div>
      )}

      {/* Step 3: Riscrivo senza parentesi — i monomi.
          ⚠️ Visibile SOLO quando il punto 2 è completato con il risultato
          corretto (parenDone): prima non appare NIENTE, nemmeno il segnaposto. */}
      {parenDone && !isDirectResult && showRewriteStep && (
      <div className="p-5 rounded-xl bg-card/40 border border-border space-y-5 leading-loose">
        <p className="text-base font-bold text-primary">
          {hasVars ? `${numRiscrivo}. Riscrivo senza parentesi (monomi):` : `${numRiscrivo}. Riscrivo senza parentesi:`}
        </p>
        <>
        {/* 27/9-quinquies: senza parentesi (caso numerico) l'espressione
            «riscritta» è IDENTICA a quella del punto 1 → non si rimostra:
            la card parte direttamente da «Calcolo prima prodotti e potenze». */}
        {/* GIRO 31 (progressività assoluta, 2° livello della sentinella):
            nel caso LETTERALE l'espressione piatta contiene i risultati dei
            prodotti (es. 6x² da 2x·3x): resta NASCOSTA finché lo studente
            non ha inserito il risultato corretto di TUTTI i prodotti/potenze
            dei monomi (monoOpenIdx: nessun passo ancora da svolgere). Nel
            caso numerico i righi piatti restano visibili (i conti lì sono
            solo ricopiati, mai risultati nuovi). */}
        {(!noParens || hasVars) && (!hasVars || monoOpenIdx === -1) && (
        <div className="flex justify-center">
          <div className="inline-block px-4 py-2 rounded-lg bg-muted font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(hasVars ? coloredFlatLatex(analysis.flatTerms, groups) : flatStep.latex) }} />
        </div>
        )}
        {monomialSteps.length > 0 && (
          <div className="space-y-2">
            <p className="text-base text-center opacity-80">
              Calcolo prima prodotti e potenze{hasVars ? " dei monomi" : ""}:
            </p>
            {/* Anche qui svolgimento progressivo: il secondo prodotto (o la
                seconda potenza) compare solo dopo il risultato giusto del primo. */}
            {monomialSteps.map((s, i) => {
              if (monoOpenIdx !== -1 && i > monoOpenIdx) return null;
              if (isInteractiveStep(s)) {
                const risolta = stepCorrect(stepValues[`mono-${i}`], s.answer);
                return (
                  <div key={i} className="space-y-2">
                    <InteractiveOpInput
                      step={s}
                      value={stepValues[`mono-${i}`] ?? null}
                      onChange={(v) => setStepValue(`mono-${i}`, v)}
                      lastOp={steps.indexOf(s) === steps.length - 1}
                    />
                    {/* Niente riga latex dopo la risoluzione: l'espressione di
                        riferimento è già quella piatta in cima alla card (e
                        rimostrare il latex del passo reintrodurrebbe parentesi
                        già risolte nel passo 2). */}
                  </div>
                );
              }
              /* GIRO 30: risultato con LETTERE → input dello studente */
              if (isTypedStep(s)) {
                const key = `mono-${i}`;
                return (
                  <TypedResultInput
                    key={i}
                    step={s}
                    value={typedValues[key] ?? ""}
                    attempted={!!typedAttempted[key]}
                    correct={typedCorrect(key, s)}
                    tries={typedTries[key] ?? 0}
                    onChange={(v) => setTypedValue(key, v)}
                    onVerify={() => setTypedTried(key)}
                    inputId={`typed-mono-${i}`}
                  />
                );
              }
              return (
                <p key={i} className="font-mono text-sm opacity-80" dangerouslySetInnerHTML={{ __html: katexHtml(s.detail, false) }} />
              );
            })}
          </div>
        )}
        {hasVars && (
          <p className="text-base text-center opacity-80">
            Ogni colore è un <b>gruppo di monomi simili</b> (stessa parte letterale).
          </p>
        )}
        {(!noParens || hasVars) && (
        <NotebookGuide title="RICOPIA SUL QUADERNO:" visible={parenDone} forceOpen={generatingPdf}>
          <p className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(flatStep.latex) }} />
        </NotebookGuide>
        )}
        </>
      </div>
      )}

      {/* Step 4: Raggruppo i monomi simili (letterale) o calcolo in ordine (numerico)
          — si sblocca solo dopo il punto 3 (parentesi e prodotti/potenze fatti).
          ⚠️ Anche qui: visibile SOLO quando il punto 2 è completato con il
          risultato corretto (parenDone): prima non appare NIENTE. */}
      {parenDone && !isDirectResult && (hasVars ? (
        <div className="p-5 rounded-xl bg-card/40 border border-border space-y-5 leading-loose">
          <p className="text-base font-bold text-primary">{numCalcoloOrdine}. Raggruppo i monomi simili:</p>
          {!upperDone && (
            <p className="text-base text-center opacity-80">
              ⬆ Completa prima {noParens ? "il punto 2" : "i punti 2" + (showRewriteStep ? " e 3" : "")}: poi potrai raggruppare i monomi simili.
            </p>
          )}
          {upperDone && (<>
          <div className="space-y-4">
            {groups.map((g) => {
              const correct = groupCorrect(g);
              const attempted = userSums[g.key] != null;
              const isNegative = !fIsZeroGroup(g.sum) && g.sum.n < 0;
              return (
                <div key={g.key} className="p-3 rounded-lg border" style={{ borderColor: g.color.hex + "55" }}>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span
                      className="inline-block w-4 h-4 rounded-sm border border-black/20"
                      style={{ backgroundColor: g.color.hex }}
                      aria-hidden="true"
                    />
                    <span className="font-bold text-sm" style={{ color: g.color.hex }}>
                      {g.color.name.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      · parte letterale:{" "}
                      <span dangerouslySetInnerHTML={{ __html: katexHtml(g.typeLatex === "\\text{numero}" ? "\\text{numero}" : g.typeLatex, false) }} />
                    </span>
                  </div>
                  <p className="font-mono text-base text-center mt-2" dangerouslySetInnerHTML={{ __html: katexHtml(joinTermLatex(g.termLatexes)) }} />
                  {g.needsInput ? (
                    <>
                      <NumberInputCanvas
                        value={userSums[g.key] ?? null}
                        onChange={(v) => setUserSums({ ...userSums, [g.key]: v })}
                        label={
                          <>
                            SOMMA DEI COEFFICIENTI{" "}
                            {g.typeLatex !== "\\text{numero}" && (
                              <>
                                DI <span className="math-var" dangerouslySetInnerHTML={{ __html: katexHtml(g.typeLatex, false) }} />
                              </>
                            )}
                            :
                          </>
                        }
                        colorClass="text-primary"
                        allowNegative
                        /* (26/10-ter) sbagliato: solo il messaggio rosso */
                        hideValue={(userSums[g.key] ?? null) !== null && !correct}
                      />
                      {attempted && (
                        <p className={cn("text-base font-bold text-center mt-2", correct ? "text-success" : "text-destructive")}>
                          {correct ? "CORRETTO" : "RISULTATO SBAGLIATO. CALCOLA DI NUOVO"}
                        </p>
                      )}
                      {correct && isNegative && <NumberLine value={g.sum.n / g.sum.d} />}
                      <NotebookGuide title="RICOPIA SUL QUADERNO:" visible={correct} forceOpen={generatingPdf}>
                        <p className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(`${joinTermLatex(g.termLatexes)} = ${reducedMonomialLatex(g.vars, g.sum)}`) }} />
                        {!fIsZeroGroup(g.sum) && g.sum.n < 0 && (
                          <p className="text-base text-primary">Il risultato è NEGATIVO: mi aiuto con la linea dei numeri.</p>
                        )}
                      </NotebookGuide>
                    </>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground mt-1">
                      Un solo monomio in questo gruppo:{" "}
                      <span className="font-bold" dangerouslySetInnerHTML={{ __html: katexHtml(g.termLatexes[0], false) }} /> — non devo sommare nulla.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {anyGroupWrong && (
            <p className="text-center text-base text-destructive font-semibold">
              Attenzione: i monomi simili si sommano SOLO nei coefficienti, la parte letterale non cambia!
            </p>
          )}
        </>)}
        </div>
      ) : upperDone ? (
        <div className="p-5 rounded-xl bg-card/40 border border-border space-y-5 leading-loose">
          <p className="text-base font-bold text-primary">{numCalcoloOrdine}. Calcolo in ordine, da sinistra a destra:</p>
          {/* 27/9-sexties: la card «Calcolo in ordine» NON si mostra affatto
              finché il punto precedente non è completato (prima c'era il
              segnaposto «⬆ Completa prima il punto 2…» — rimosso). */}
          {upperDone && (<>
          <div className="space-y-3">
            {chainSteps.length > 0 && (
              <> 
                {/* Catena aritmetica SVOLTA DALLO STUDENTE, una coppia alla
                    volta: il risultato non è mai pre-scritto. La coppia
                    successiva (es. dopo 4 − 8) compare solo dopo che la
                    precedente è stata inserita correttamente. Si parte
                    dall'espressione SENZA parentesi e con le operazioni
                    ancora da svolgere (es. 27 : 3 + 48 : 28): mai dal risultato
                    di un passo già mostrato, altrimenti si ripete. */}
                {(() => {
                  // Se il punto «senza parentesi» è saltato, l'espressione di
                  // partenza è IDENTICA a quella del punto 1: non ripeterla
                  // (segnalazione 27/9, «3+2-5:2» compariva 3 volte).
                  /* GIRO 31 (progressività assoluta): il rigo di partenza
                     contiene il risultato del conto precedente (es. 21:2 già
                     svolto in «27:3+48:28»): resta NASCOSTO finché lo
                     studente non inserisce il risultato corretto del primo
                     conto della catena. */
                  const firstChainDone =
                    chainSteps.length === 0 ||
                    stepCorrect(stepValues["chain-0"], chainSteps[0].answer) ||
                    typedCorrect("chain-0", chainSteps[0]);
                  const startLatex =
                    chainStartLatex !== originalLatex && firstChainDone ? chainStartLatex : null;
                  return (
                    <>
                      {startLatex && (
                        <div className="flex justify-center">
                          <div className="inline-block px-4 py-2 rounded-lg bg-muted font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(startLatex) }} />
                        </div>
                      )}
                      {chainSteps.map((s, i) => {
                        if (chainOpenIdx !== -1 && i > chainOpenIdx) return null;
                        /* GIRO 30: passo di catena con risultato con lettere
                           (es. 6x:2 in una somma) → input dello studente. */
                        if (isTypedStep(s)) {
                          const key = `chain-${i}`;
                          const ok = typedCorrect(key, s);
                          return ok ? (
                            <div key={i} className="space-y-2">
                              {i < chainSteps.length - 1 && (
                                <p className="font-mono text-base text-center" dangerouslySetInnerHTML={{ __html: katexHtml(s.latex) }} />
                              )}
                            </div>
                          ) : (
                            <TypedResultInput
                              key={i}
                              step={s}
                              value={typedValues[key] ?? ""}
                              attempted={!!typedAttempted[key]}
                              correct={false}
                              tries={typedTries[key] ?? 0}
                              onChange={(v) => setTypedValue(key, v)}
                              onVerify={() => setTypedTried(key)}
                              inputId={`typed-chain-${i}`}
                            />
                          );
                        }
                        if (!stepCorrect(stepValues[`chain-${i}`], s.answer)) {
                          if (i !== chainOpenIdx) return null;
                          return (
                            <InteractiveOpInput
                              key={i}
                              step={s}
                              value={stepValues[`chain-${i}`] ?? null}
                              onChange={(v) => setStepValue(`chain-${i}`, v)}
                              lastOp={steps.indexOf(s) === steps.length - 1}
                            />
                          );
                        }
                        return (
                          <div key={i} className="space-y-2">
                            <p
                              className="font-mono text-base text-center font-bold text-success"
                              dangerouslySetInnerHTML={{ __html: katexHtml(`${s.opLatex!} = ${risultatoLatex(s.answer!)}`) }}
                            />
                            {i < chainSteps.length - 1 && (
                              <p className="font-mono text-base text-center" dangerouslySetInnerHTML={{ __html: katexHtml(s.latex) }} />
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </>
            )}
          </div>
          {numericCorrect && numericResult !== null && numericResult < 0 && <NumberLine value={numericResult} />}
          <NotebookGuide title="RICOPIA SUL QUADERNO:" visible={numericCorrect} forceOpen={numericCorrect || generatingPdf}>
            {/* Prima riga: l'espressione con i prodotti già svolti ma la
                catena ancora da fare (es. 36 − 6 + 2), poi i calcoli in ordine. */}
            {(() => {
              // 27/9-bis (rigo duplicato nel quaderno): il rigo di partenza
              // «Calcolo in ordine» (es. 27 : 3 + 48 : 28) NON si ripete se
              // è GIÀ l'ultimo rigo del RICOPIA del punto precedente
              // «Riscrivo senza parentesi» (flatStep.latex) — per questa
              // espressione i due righi coincidono e il quaderno mostrava
              // «27 : 3 + 48 : 28» DUE volte consecutive. Vale anche la
              // regola storica: se coincide con l'espressione del punto 1
              // (originalLatex), non si ripete comunque.
              const punto3RicopiaMostrato = showRewriteStep && (!noParens || hasVars);
              const ricStartLatex =
                chainStartLatex !== originalLatex &&
                !(punto3RicopiaMostrato && chainStartLatex === flatStep.latex)
                  ? chainStartLatex
                  : null;
              // Dedup adiacente (filtro di sicurezza usato sia dall'anteprima
              // sia dal PDF): un rigo consecutivo identico al precedente non
              // si ricopia mai sul quaderno.
              const righeQuaderno = dedupeRigheAdiacenti(
                [...(ricStartLatex ? [ricStartLatex] : []), ...chainSteps.map(copiaRiga)],
                (r) => r,
              );
              return (
                <>
                  {righeQuaderno.map((r, i) => (
                    <p key={i} className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(r, false) }} />
                  ))}
                  {/* Solo nel PDF: spazio vuoto sotto l'espressione con i
                      prodotti svolti (es. 18 − 3 − 9 + 1) per lasciare
                      spazio di lavoro allo studente sul quaderno. */}
                  {generatingPdf && ricStartLatex && <div style={{ height: "85px" }} aria-hidden="true" />}
                </>
              );
            })()}
          </NotebookGuide>
          </>)}
        </div>
      ) : null)}

      {/* Step 5: Risultato finale — nel caso «operazione già finita» il
          risultato è già mostrato nel box 3: qui non compare nulla. */}
      {resultVisible && !isDirectResult && (
        <div className="p-5 rounded-xl bg-card/40 border border-border space-y-5 leading-loose">
          {/* (25/10) scritta RISULTATO FINALE in marrone, risultato sotto
              in marrone: sia nell'app sia nel PDF (RICOPIA). */}
          <p className="text-base font-bold text-primary tracking-widest">{numRisultato}. RISULTATO FINALE</p>
          {finalIsZero ? (
            <p className="text-2xl font-bold text-primary text-center font-mono">0</p>
          ) : (
            <div className="flex justify-center">
              {/* Risultato non intero (es. 9 : 5) → SOLO frazione impilata,
                  mai decimale con la virgola (richiesta 27/9). */}
              <div className="inline-block px-6 py-3 rounded-lg bg-muted font-mono text-2xl font-bold text-primary" dangerouslySetInnerHTML={{ __html: katexHtml(fractionResultLatex(finalPoly) ?? finalLatex) }} />
            </div>
          )}
          {hasVars && (
            <p className="text-base text-center opacity-80">
              È un <b>POLINOMIO ridotto</b>: monomi ordinati dal grado più alto al più basso.
            </p>
          )}
          <NotebookGuide title="RICOPIA SUL QUADERNO:" forceOpen={generatingPdf}>
            {/* (25/10) scritta RISULTATO FINALE in marrone anche nel PDF */}
            <p className="text-base font-bold text-primary tracking-widest">RISULTATO FINALE</p>
            <p className="font-mono text-2xl font-bold text-primary" dangerouslySetInnerHTML={{ __html: katexHtml(finalIsZero ? "0" : (fractionResultLatex(finalPoly) ?? finalLatex)) }} />
          </NotebookGuide>
        </div>
      )}

      {/* New exercise */}
      <button
        onClick={onNew}
        className="max-w-xs mx-auto w-full py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-base font-bold tracking-widest transition-all duration-200"
      >
        NUOVO ESERCIZIO
      </button>
    </div>
  );
}

function fIsZeroGroup(f: Frac): boolean {
  return f.n === 0;
}

function formatNumber(v: number): string {
  const r = Math.round(v * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(".", ",");
}

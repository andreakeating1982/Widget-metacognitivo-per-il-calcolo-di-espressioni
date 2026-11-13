// ⚠️ PIPELINE DI RICONOSCIMENTO A MANO — modulo PURO (nessun React, nessun DOM).
// Estratto da hooks/useMathRecognition.ts (6/10) senza cambiare comportamento,
// così lo STESSO codice gira in Node col modello reale per il banco di prova
// (client/src/lib/bench/, v. GUIDA-IA.md sezione m) oltre che nel browser.
// L'hook React resta un involucro sottile: carica il modello, tiene il flag
// di rientranza e chiama recognizeInk().
import { dotsBetweenFractions } from "./fracDots";
import { rewritePlusSigns } from "./plusSigns";
import type { Stroke } from "../components/MathDrawCanvas";
import { rewriteDotSigns, type SimpleStroke } from "./dotSigns";
import { collapseRepeatedMinus } from "./exprOcr";
import { detectCurlyResidues, rewriteBrackets } from "./squareBrackets";
import {
  digitsFromNumberLatex,
  eightOrNineFromInk,
  repairModelNine,
  repairModelSqrt,
  rewriteEqualSigns,
  rewriteEights,
  rewriteMinusSigns,
  rewriteRadicalSigns,
  rewriteStackedFractions,
} from "./inkSigns";
import {
  dedupeIdenticalStrokes,
  extractSuperscripts,
  stripModelExponents,
  type ExtraBase,
  type SupExponent,
} from "./supScript";
import { closeWideGaps, modelGapFrac } from "./gapClose";
import { timesToLetterX, composeLatex, type AtomKind, type ComposeExp, type ComposeItem } from "./composeLatex";

// Caratteri di reinserimento per le parentesi estratte geometricamente
// (squareBrackets.ts rewriteBrackets): graffa e quadra tornano col TIPO
// disegnato dall'utente (regola 7: le parentesi non si trasformano mai).
const BRACKET_OPEN = { square: "[", round: "(", curly: "{" } as const;
const BRACKET_CLOSE = { square: "]", round: ")", curly: "}" } as const;

/** Le barre dei MENO restano nell'inchiostro letto dal modello (come in produzione fino al 5/10):
 *  il «-» viene comunque reinserito per posizione da composeLatex e i doppi («--») collassano.
 *  PROVA A/B del 5/10 notte (banco P2–P7, 570 letture, modello reale): toglierle dall'inchiostro
 *  (true) fa PERDERE la «x» tra due cifre (`2x-1` → `2\\cdot-1`: senza barra il modello legge
 *  «2 x 1» come moltiplicazione) e peggiora P5 (52% → 42%); lasciarle (false) dà 60% → 64% con
 *  27 letture migliorate e 3 peggiorate rispetto a prima del collegamento di composeLatex. */
export const MINUS_BARS_OUT = false;

export interface RecognitionResult {
  latex: string;
  tokenIds: number[];
  encoderMs: number;
  decoderMs: number;
  totalMs: number;
  /** Cosa la riscrittura geometrica ha trovato nell'inchiostro: coppie
   *  di puntini (: e ÷) sintetizzate in barra e puntini isolati (·). Serve
   *  al soccorso del puntino di moltiplicazione (rescueLoneDotSign). */
  dotRewrite?: { colons: number; divSigns: number; loneDots: number };
  /** Uguali «=» sintetizzati geometricamente (inkSigns.ts): quando > 0,
   *  un «=» nel LaTeX del modello è un UGUALE VERO e repairDivisionSigns
   *  non deve convertirlo in «:» (le barre disegnate sono state già
   *  riscritte in uguale sintetico prima del modello). */
  eqEquals?: number;
  /** Numero di «8» rilevati geometricamente e reinseriti nel LaTeX
   *  (inkSigns.ts rewriteEights): il modello legge l'8 disegnato come
   *  «3B»/«Z»/«s», quindi il glifo viene tolto dall'inchiostro e «8»
   *  riattaccato alla posizione proporzionale (come \sqrt). */
  eights?: number;
  /** SOLO diagnostica (banco di prova): LaTeX del modello sull'inchiostro RIMASTO,
   *  prima del reinserimento di parentesi, puntini, meno, uguali, radici, ottavi, frazioni */
  debugModelLatex?: string;
}

export type RecognitionMode = "auto" | "number" | "expression";

/** Dipendenze iniettate: nel browser vengono da ink-on/core + onnxruntime-web,
 *  nel banco di prova da Node (stesso pacchetto, canvas @napi-rs). */
export interface InkDeps {
  engine: { recognize(input: any, vocab: any, mode: string): Promise<any> };
  vocab: any;
  preprocessStrokes: (strokes: any) => any;
  isStrokeMeaningful: (strokes: any) => boolean;
  repairLatex?: ((tokens: string[]) => string[]) | null;
  decodeToTokenArray?: ((ids: number[], vocab: any) => string[]) | null;
}

/** Gli stadi GEOMETRICI della pipeline, nell'ordine in cui girano:
 *  parentesi → puntini/due punti → frazioni impilate → radici → 8 → uguale →
 *  meno. Funzione pura (nessun modello): ogni stadio toglie dall'inchiostro i
 *  tratti che riconosce e restituisce ciò che resta. */
export function runGeometry(ink: SimpleStroke[], extractPlus = false) {
  const brk = rewriteBrackets(ink);
  const rewritten = rewriteDotSigns(brk.strokes);
  const dotRewrite = {
    colons: rewritten.colons,
    divSigns: rewritten.divSigns,
    loneDots: rewritten.loneDots,
  };
  const fr = rewriteStackedFractions(rewritten.strokes);
  const fracDots = dotsBetweenFractions(fr.strokes, fr.fracs);
  const rad = rewriteRadicalSigns(fracDots.strokes);
  const eights = rewriteEights(rad.strokes);
  const plusProbe = rewritePlusSigns(eights.strokes);
  // (7/10, giro 7) estrazione SOLO a richiesta: tolta la croce il modello legge male la cifra vicina
  const plus = extractPlus ? plusProbe : { strokes: eights.strokes, centers: [] as number[], pluses: 0 };
  const eq = rewriteEqualSigns(plus.strokes);
  const minus = rewriteMinusSigns(eq.strokes);
  return { brk, rewritten, dotRewrite, fr, fracDots, rad, eights, plus, plusProbe, eq, minus };
}

/** (7/10, giro 7) Due passate: la storica (nessuna estrazione del «+»); se la geometria trova PIU' croci
 *  di quanti «+» il modello abbia scritto (`2+3` → `243`), si rifà la lettura con la croce estratta. */
export async function recognizeInk(
  deps: InkDeps,
  strokes: Stroke[],
  mode: RecognitionMode = "auto",
): Promise<RecognitionResult | null> {
  const first = await recognizeInkCore(deps, strokes, mode, false);
  const probe = runGeometry(
    dedupeIdenticalStrokes(strokes).map((s) => ({ points: s.points.map((p) => ({ x: p.x, y: p.y })), lineWidth: s.lineWidth })),
  ).plusProbe.pluses;
  if (probe === 0) return first;
  const have = (first?.latex.match(/\+/g) ?? []).length;
  if (have >= probe) return first;
  const second = await recognizeInkCore(deps, strokes, mode, true);
  return second ?? first;
}

async function recognizeInkCore(
  deps: InkDeps,
  strokes: Stroke[],
  mode: RecognitionMode,
  forcePlus: boolean,
): Promise<RecognitionResult | null> {
  // ⚠️ Tratti DUPLICATI (27/9-septies): lo stesso tratto può essere
  // registrato due volte (ripasso, double-event): le copie identiche
  // fondono l'apice e producono esponenti «22». Deduplica PRIMA di
  // qualsiasi analisi geometrica o del modello.
  // Convert our Stroke format to ink-on's expected format
  const dedupedStrokes = dedupeIdenticalStrokes(strokes);
  const inkOnStrokes = dedupedStrokes.map((s) => ({
    points: s.points.map((p) => ({ x: p.x, y: p.y })),
    lineWidth: s.lineWidth,
  }));

  // ⚠️ Riscrittura geometrica dei segni puntinati: ":" (due puntini
  // impilati) e "÷" (puntino-lineetta-puntino) NON esistono nel
  // vocabolario del modello → li trasformo in una barra "/" sintetica
  // che il modello riconosce bene (poi repairDivisionSigns → ":").
  // ⚠️ PARENTESI GRAFFE E QUADRE (27/9: «il riconoscimento a mano ha
  // difficoltà con le graffe e le quadre»): il modello legge una
  // graffa disegnata come «3»/«\sum» (verificato nel browser: «{3}» →
  // «33\sum2») e le quadre a volte spariscono o mutano tipo. STESSA
  // TECNICA di √, 8, = e −: le shape ALTE classificate come graffa o
  // quadra vengono TOLTE dall'inchiostro (guardie anti-falsi-positivi:
  // una «3» o una «E» non sono mai parentesi; la shape dev'essere molto
  // più alta del resto), il modello legge il contenuto e le parentesi
  // vengono REINSERITE nel LaTeX alla posizione proporzionale (ancore).
  // Le TONDE restano nell'inchiostro (il modello le legge bene).
  // PRIMO passo della pipeline: le ancore dei segni successivi restano
  // coerenti con l'inchiostro che il modello vede davvero.
  // (i sette stadi geometrici girano in runGeometry, sotto: stesso ordine
  // e stesse chiamate di sempre — così si provano anche senza modello)
  const { brk, rewritten, dotRewrite, fr, fracDots, rad, eights, plus, eq, minus } = runGeometry(inkOnStrokes, forcePlus);

  // ⚠️ RADICE «√» (segnalazione 26/9): il modello NON sa leggere il
  // segno di radice — qualsiasi variante disegnata produce solo
  // «v»/«\sigma»/«\theta» e il RADICANDO viene perso (verificato nel
  // browser con 5 varianti diverse). Soluzione: V e barra vengono
  // TOLTE dall'inchiostro (solo con prova del vinculum, per non
  // scartare la lettera «v»), il modello legge il radicando («9») e
  // «\sqrt» viene REINSERITO nel LaTeX alla posizione proporzionale
  // del segno (anchors, stessa tecnica degli esponenti).
  // ⚠️ FRAZIONE IMPILATA (27/9: «il riconoscimento dei numeri e in
  // particolare delle frazioni è ancora terribile»): il risultato si
  // scrive impilato (numeratore, linea, denominatore) ma il modello
  // NON sa leggere la struttura impilata («7-5», \frac{\infty}{m/m},
  // cifre sbagliate). STESSA TECNICA di apici, √, 8, = e −: la linea
  // si individua GEOMETRICAMENTE (barra piatta con cifre sopra e
  // sotto), numeratore e denominatore vengono TOLTI dall'inchiostro,
  // riconosciuti A PARTE in modalità «numero» (dove le cifre da sole
  // le legge bene) e «\frac{n}{d}» viene REINSERITO nel LaTeX alla
  // posizione proporzionale (ancora, come per \sqrt e «8»). NB: DOPO
  // rewriteDotSigns — il «÷» (barra con puntini sopra e sotto) è
  // geometricamente simile a una frazione e va già sintetizzato in
  // barra diagonale prima; la linea della frazione non viene toccata
  // dai puntini (guardia isFlatBar).

  // ⚠️ OTTARI «8» (segnalazione 26/9): il modello legge l'8 disegnato
  // come «3B»/«Z»/«s» (verificato nel browser). Firma geometrica
  // unica tra i glifi scolastici: tratto CHIUSO con UN incrocio al
  // centro (o due anelli chiusi impilati) → l'8 viene TOLTO
  // dall'inchiostro e «8» REINSERITO nel LaTeX alla posizione
  // proporzionale del segno (come \sqrt).

  // ⚠️ UGUALE «=» (segnalazioni 26 e 27/9): due barre impilate vengono
  // lette come «:» (o \div) → riparate in divisione! Verificato anche:
  // l'uguale SINTETICO viene letto male dal modello quando l'uguale è
  // da solo («\frac{\infty}{m/m}»). Soluzione definitiva, come per
  // radici e 8: le barre vengono TOLTE dall'inchiostro e «=» viene
  // REINSERITO nel LaTeX alla posizione proporzionale. NB: l'uguale
  // si processa PER ULTIMO così le sue ancore sono relative
  // all'inchiostro che il modello vede davvero (senza radici né 8).

  // ⚠️ MENO «-» (segnalazione 27/9 «-8»): un meno scritto a mano è
  // SOLO una barra orizzontale — da sola viene scartata o fraintesa
  // dal modello, e in «-8» il segno sparisce (l'app leggeva «8» o
  // niente). Stessa soluzione di =, √ e 8: la barra viene TOLTA
  // dall'inchiostro (per ultima, così le ancore di =, √ e 8 restano
  // coerenti) e «-» viene REINSERITO nel LaTeX alla posizione
  // proporzionale.

  // ⚠️ 8 ISOLATO sfuggito a rewriteEights (27/9-quater): il modello
  // legge questi 8 come «θ» (verificato anche nel browser). Se TUTTO
  // l'inchiostro del pezzo ha la firma larga-alto + larga-basso +
  // vita stretta, il pezzo È un 8: LaTeX diretto senza modello
  // (l'eventuale anello superiore non finisce negli esponenti).
  if (
    fr.fracs.length === 0 &&
    eights.eights === 0 &&
    minus.minuses === 0 &&
    eightOrNineFromInk(eq.strokes) === "8"
  ) {
    return {
      latex: "8",
      tokenIds: [],
      encoderMs: 0,
      decoderMs: 0,
      totalMs: 0,
      dotRewrite,
      eqEquals: eq.equals,
      eights: 1,
    };
  }

  // ⚠️ FRAZIONI ESTRATTE: riconoscimento a parte di numeratore e
  // denominatore in modalità «numero» (dove le cifre da sole le legge
  // bene) con mappa degli omonimi («9»→g/q, «0»→o, «1»→l/I…). Se una
  // delle due parti non dà cifre → fallback col modello su TUTTO
  // l'inchiostro (frazione compresa): percorso storico, meglio di nulla.
  const inkWithFracs = [
    ...fr.fracs.flatMap((f) => [...f.lineStrokes, ...f.numStrokes, ...f.denStrokes]),
  ];
  let partsRead: { num: string; den: string }[] | null = fr.fracs.length > 0 ? null : [];
  if (fr.fracs.length > 0) {
    try {
      const arr: { num: string; den: string }[] = [];
      for (const f of fr.fracs) {
        const numR = await deps.engine.recognize(
          deps.preprocessStrokes(f.numScaled),
          deps.vocab,
          "number",
        );
        const denR = await deps.engine.recognize(
          deps.preprocessStrokes(f.denScaled),
          deps.vocab,
          "number",
        );
        let num = digitsFromNumberLatex(numR?.latex ?? "");
        let den = digitsFromNumberLatex(denR?.latex ?? "");
        // (7/10, giro 8) LETTERE nel numeratore/denominatore («x/2», «1/x», «a/b», «2x/3»): la modalità
        // «numero» le legge come cifre (x→1/11/10). Se la lettura normale (auto) dà una LETTERA plausibile,
        // si usa quella; i num/den di sole cifre restano IDENTICI al percorso storico.
        const letterRead = async (strokes: typeof f.numScaled, digits: string): Promise<string> => {
          try {
            const r = await deps.engine.recognize(deps.preprocessStrokes(strokes), deps.vocab, "auto");
            const t = (r?.latex ?? "").replace(/\\left|\\right/g, "").replace(/\s+/g, "");
            return /^[0-9]*[xyabcnm][0-9xyabcnm]*$/.test(t) && /[xyabcnm]/.test(t) ? t : digits;
          } catch {
            return digits;
          }
        };
        num = await letterRead(f.numScaled, num);
        den = await letterRead(f.denScaled, den);
        if (num && den) arr.push({ num, den });
        else break;
      }
      if (arr.length === fr.fracs.length) partsRead = arr;
    } catch {
      partsRead = null;
    }
    if (partsRead === null) {
      try {
        const all = [...minus.strokes, ...inkWithFracs];
        const full = await deps.engine.recognize(
          deps.preprocessStrokes(all),
          deps.vocab,
          mode,
        );
        if (full?.latex) {
          let fb = full.latex;
          fb = repairModelSqrt(fb, rad.radicals, all);
          fb = repairModelNine(fb, eightOrNineFromInk(all));
          fb = timesToLetterX(fb, all).replace(/\\times/g, "\\cdot");
          return {
            latex: collapseRepeatedMinus(fb),
            tokenIds: [],
            encoderMs: 0,
            decoderMs: 0,
            totalMs: 0,
            dotRewrite,
            eqEquals: eq.equals,
            eights: eights.eights,
          };
        }
      } catch {
        /* si prosegue senza frazione */
      }
      partsRead = [];
    }
  }
  const parts = partsRead ?? [];

  // ⚠️ POSIZIONE ASSOLUTA (5/10 sera, «parentesi consecutive e parentesi + numeri»): tutti gli
  // elementi TOLTI dall'inchiostro (parentesi, puntini ·, meno, uguali, radici, 8, frazioni)
  // portano la x REALE del loro centro e vengono rimessi nel LaTeX del modello per POSIZIONE
  // (composeLatex.ts), non più per frazione della lunghezza della stringa: l'indice di
  // inserimento non può cadere dentro un esponente, e due elementi vicini restano
  // nell'ordine della pagina.
  const minusOut: boolean = (globalThis as { __MINUS_BARS_OUT?: boolean }).__MINUS_BARS_OUT ?? MINUS_BARS_OUT;
  const inkBase: SimpleStroke[] = minusOut ? minus.strokes : eq.strokes;
  const items: ComposeItem[] = [
    ...brk.brackets.map((b, i) => ({
      x: b.cx,
      tex: b.isOpen ? BRACKET_OPEN[b.kind] : BRACKET_CLOSE[b.kind],
      kind: (b.isOpen ? "open" : "close") as AtomKind,
      key: `b${i}`,
    })),
    ...rewritten.dots.map((d) => ({ x: d.cx, tex: "\\cdot", kind: "op" as AtomKind })),
    ...fracDots.centers.map((x) => ({ x, tex: "\\cdot", kind: "op" as AtomKind })),
    ...rewritten.divCenters.map((x) => ({ x, tex: ":", kind: "op" as AtomKind })),
    ...minus.centers.map((x) => ({ x, tex: "-", kind: "op" as AtomKind })),
    ...plus.centers.map((x) => ({ x, tex: "+", kind: "op" as AtomKind })),
    ...eq.centers.map((x) => ({ x, tex: "=", kind: "op" as AtomKind })),
    ...rad.centers.map((x) => ({ x, tex: "\\sqrt", kind: "cmd" as AtomKind })),
    ...eights.centers.map((x, i) => ({ x, tex: "8", kind: "digit" as AtomKind, key: `e${i}` })),
  ];
  fr.fracs.forEach((f, i) => {
    const p = parts[i];
    if (p) items.push({ x: f.cx, tex: `\\frac{${p.num}}{${p.den}}`, kind: "frac" });
  });
  // BASI VIRTUALI degli esponenti: «[3]²», «{x+1}³», «8²» — la parentesi chiusa o l'8 non sono
  // più nell'inchiostro, ma l'esponente è loro
  const extraBases: ExtraBase[] = [
    ...brk.brackets.flatMap((b, i) => (b.isOpen ? [] : [{ key: `b${i}`, box: brk.boxes[i]! }])),
    ...eights.boxes.map((box, i) => ({ key: `e${i}`, box })),
  ];

  // ⚠️ Esponenti in apice (x², (2x)³): il modello li PERDE spesso
  // (la trascrizione diventa «x» o «x2» = 2x). Analisi geometrica:
  // gli apici (piccoli e in alto) vengono isolati, riconosciuti a
  // parte INGRANDITI in modalità «numero» e riattaccati come ^{d}.
  const sup = extractSuperscripts(inkBase, extraBases);
  const exps: ComposeExp[] = sup.sups.length > 0 ? await readExponents(deps, sup.sups) : [];

  // Pezzo con SOLI segni sintetizzati e/o frazioni estratte (es. il risultato «75/7» scritto
  // impilato, «-8», un pezzo di sole parentesi): niente modello, il LaTeX è direttamente la
  // composizione ordinata per posizione (es. «-8», «\\frac{75}{7}», «{[()]}»).
  if (
    (sup.strokes.length === 0 ||
      !deps.isStrokeMeaningful(sup.strokes) ||
      // (7/10, giro 8) frazione + SOLO il meno davanti: la barra del meno resta nell'inchiostro e il
      // modello, vedendola da sola, la legge «m»/«-\\infty»
      (fr.fracs.length > 0 && minus.strokes.length === 0 && minus.minuses > 0)) &&
    items.some((it) => it.tex !== "\\cdot")
  ) {
    const latex = collapseRepeatedMinus(composeLatex({ latex: "", ink: [], items, exps }));
    return {
      latex,
      tokenIds: [],
      encoderMs: 0,
      decoderMs: 0,
      totalMs: 0,
      dotRewrite,
      eqEquals: eq.equals,
      eights: eights.eights,
    };
  }

  // ⚠️ Con una frazione estratta l'inchiostro restante può essere
  // VUOTO (o non significativo): non è un fallimento, il LaTeX verrà
  // ricostruito dalle parti riconosciute.
  if (!deps.isStrokeMeaningful(sup.strokes) && parts.length === 0) {
    return null;
  }

  // ⚠️ VUOTI LARGHI (5/10 notte): gli elementi TOLTI dall'inchiostro lasciano vuoti che il modello
  // riempie con simboli inventati («3·[2x+1]» → «3+2x+1», «)  5» → «)/5»). Per il MODELLO si
  // chiudono i vuoti > MODEL_GAP_FRAC × altezza; composeLatex allinea sulle x ORIGINALI.
  // (i meno restano nell'inchiostro se !MINUS_BARS_OUT: non sono buchi)
  const holesX = items.filter((it) => !(it.tex === "-" && !minusOut)).map((it) => it.x);
  const modelStrokes = holesX.length > 0 ? closeWideGaps(sup.strokes, modelGapFrac(), holesX) : sup.strokes;
  const input = deps.preprocessStrokes(modelStrokes);
  const result =
    sup.strokes.length > 0
      ? await deps.engine.recognize(input, deps.vocab, mode)
      : null;

  // Apply LaTeX repair to fix common recognition errors (e.g., digit 9)
  if (result && result.tokenIds && deps.vocab && deps.repairLatex && deps.decodeToTokenArray) {
    const tokens = deps.decodeToTokenArray(result.tokenIds, deps.vocab);
    const repairedTokens = deps.repairLatex(tokens);
    result.latex = repairedTokens.join('');
  }

  // ⚠️ «8» letto come RADICE (segnalazione 27/9): un 8 che sfugge
  // alla geometria (isEightStroke) resta nell'inchiostro e il
  // modello lo decodifica a volte come «\sqrt» (token del
  // vocabolario). Se NON ci sono radici geometriche e nell'inchiostro
  // c'è un glifo ad anello, ogni «\sqrt» del modello è quasi
  // certamente un 8 frainteso: si ripara (radicali VERI rimossi da
  // rewriteRadicalSigns e reinseriti sotto con le ancore).
  if (result) {
    result.latex = repairModelSqrt(result.latex, rad.radicals, sup.strokes);
    // ⚠️ «9» letto «g»/«q» (segnalazione 27/9-quater): nelle
    // espressioni scolastiche g e q non sono variabili usate: un
    // g/q isolato del modello è un 9 (\sigma e \log restano intatti);
    // la firma d'inchiostro smista 8/9/0 (θ → 8/9/0, g/q → 8/9).
    result.latex = repairModelNine(result.latex, eightOrNineFromInk(sup.strokes));
    // ⚠️ REGOLA 27/9-ter: la moltiplicazione si scrive SEMPRE e SOLO
    // come puntino (\cdot), MAI come «×» (\times si confonde con la
    // variabile x). Qualunque \times prodotto dal modello (croce
    // disegnata, puntino sintetico, x fra cifre) diventa \cdot qui
    // alla fonte; repairDivisionSigns in EspressioniExercises lo
    // rifà sul pezzo e normalizeInput converte comunque in *.
    //   ECCEZIONE (6/10): un `\times` il cui glifo è ALTO COME UNA LETTERA è la variabile x
    //   («3x(2x+1)» perdeva la x → «3·(2x+1)»): la croce piccola di un puntino resta \cdot.
    result.latex = timesToLetterX(result.latex, sup.strokes).replace(/\\times/g, "\\cdot");
    // ⚠️ GRAFFA letta «\sum» (segnalazione 5/10: «la graffa disegnata
    // viene spesso riconosciuta come SUM»): una graffa che sfugge alla
    // estrazione geometrica resta nell'inchiostro e il modello la
    // decodifica «\sum» (verificato nel browser: «{3}» → «33\\sum2»).
    // In queste espressioni una sommatoria NON esiste mai: se nel
    // LaTeX compaiono «\sum» e nell'inchiostro residuo ci sono shape
    // ALTE con firma da graffa (detectCurlyResidues), ogni «\sum» — in
    // ordine di posizione, come le ancore delle parentesi estratte —
    // diventa la graffa attestata dall'inchiostro (aperta/chiusa dal
    // lato della punta). Si interviene SOLO con prova d'inchiostro:
    // stesso numero di occorrenze, oppure una sola con almeno una
    // shape — mai trasformazioni a caso.
    const sumCount = (result.latex.match(/\\sum/g) ?? []).length;
    if (sumCount > 0) {
      const residues = detectCurlyResidues(sup.strokes);
      if (residues.length === sumCount || (sumCount === 1 && residues.length > 0)) {
        let k = 0;
        result.latex = result.latex.replace(/\\sum/g, () => {
          const r = residues[Math.min(k, residues.length - 1)]!;
          k++;
          return r.isOpen ? "{ " : " }";
        });
      }
    }
  }

  // Riattacco degli esponenti riconosciuti a parte. `alignInk` = inchiostro che il modello ha
  // VISTO (serve ad allineare gli atomi del suo LaTeX alle x della pagina).
  let alignInk: SimpleStroke[] = sup.strokes;
  if (result && sup.sups.length > 0) {
    let latex = stripModelExponents(result.latex);
    if (exps.length === 0) {
      // ⚠️ RETE DI SICUREZZA (27/9-septies, «2 alla seconda»): apici
      // rilevati dalla geometria ma NESSUNA cifra leggibile — l'apice
      // è stato TOLTO dall'inchiostro principale, quindi il modello
      // non lo vedrà mai (risulterebbe «x» senza potenza). Si riprova
      // sull'inchiostro ORIGINARIO (l'apice magari è fuso con la base
      // e il modello lo legge come apice suo).
      try {
        const full = await deps.engine.recognize(
          deps.preprocessStrokes(inkBase),
          deps.vocab,
          mode,
        );
        if (full?.latex) {
          let fb = full.latex;
          fb = repairModelSqrt(fb, rad.radicals, inkBase);
          fb = repairModelNine(fb, eightOrNineFromInk(inkBase));
          fb = timesToLetterX(fb, inkBase).replace(/\\times/g, "\\cdot");
          latex = collapseRepeatedMinus(fb);
          alignInk = inkBase;
        }
      } catch {
        /* si prosegue senza apice */
      }
    }
    result.latex = latex;
  }

  if (result) result.debugModelLatex = result.latex;
  if (result && (items.length > 0 || exps.length > 0)) {
    // ⚠️ DOPPIO MENO (27/9): un tick residuo letto «-» dal modello si somma al meno sintetico
    // inserito → «--»: si collassa.
    result.latex = collapseRepeatedMinus(
      composeLatex({ latex: result.latex, ink: alignInk, items, exps }),
    );
  }

  return { ...(result as RecognitionResult), dotRewrite, eqEquals: eq.equals, eights: eights.eights };
}

/** Legge le cifre di ogni apice (ingrandito, modalità «numero») e le associa alla base. */
async function readExponents(deps: InkDeps, sups: SupExponent[]): Promise<ComposeExp[]> {
  const exps: ComposeExp[] = [];
  for (const c of sups) {
    try {
      const sub = await deps.engine.recognize(
        deps.preprocessStrokes(c.scaled),
        deps.vocab,
        "number",
      );
      // ⚠️ (segnalazione 27/9) un «2» piccolo e isolato in modalità
      // «numero» viene a volte letto come LETTERA (verificato nel
      // browser: «z»). L'apice può essere solo una cifra: mappo i
      // comuni omonimi del 2 prima di filtrare le cifre.
      const mapped = (sub?.latex ?? "").replace(/[zZaA]/g, "2");
      // (25/10) APICE NEGATIVO: il «-» letto nel gruppo apice (la barra
      // assorbita da extractSuperscripts viene letta col la cifra) DEVE
      // sopravvivere: prima il filtro [^0-9] lo scartava e «2^-2» scritto
      // a mano diventava sempre «2^2».
      const hasMinus = /-|−/.test(mapped);
      let digits = mapped.replace(/[^0-9]/g, "");
      // ⚠️ (27/9-sexies, pezzo 2 reale) un ² quadregno ingrandito
      // può essere letto «z2»/«zz» → la mappa omonimi dà «22». Un
      // APICE a TRATTO SINGOLO non può contenere due cifre UGUALI
      // scritte di fila (un vero «22» ha due tratti o due gruppi):
      // collasso il raddoppio. «12» e apici multi-tratto restano.
      if (c.strokes.length === 1 && digits.length > 1 && /^(\d)\1+$/.test(digits)) {
        digits = digits[0]!;
      }
      if (digits) exps.push({ digits: hasMinus ? `-${digits}` : digits, baseX: c.baseX, baseKey: c.baseKey });
    } catch {
      /* apice non riconosciuto: si prosegue senza */
    }
  }
  return exps;
}

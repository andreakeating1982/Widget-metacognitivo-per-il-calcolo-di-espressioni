// ⚠️ POST-ELABORAZIONE DEL PEZZO A MANO — modulo PURO (6/10).
// Prima viveva dentro il componente EspressioniExercises (closure
// `recognizePiece`); estratto qui, senza cambiare comportamento, perché il
// banco di prova (lib/bench/) valuti ESATTAMENTE ciò che l'utente vede nel
// pezzo trascritto, non una copia che potrebbe divergere.
import type { Stroke } from "../components/MathDrawCanvas";
import { rescueLoneDotSign } from "./dotSigns";
import { collapseRepeatedMinus } from "./exprOcr";
import { repairDivisionSigns } from "./espressioni";
import { recognizeInk, type InkDeps, type RecognitionResult } from "./recognizePipeline";
import { restoreSquareBrackets } from "./squareBrackets";

/** Dal risultato grezzo del modello alla forma interna del pezzo
 *  (stessa pipeline della vecchia espressione intera: soccorso del
 *  puntino, riparazione delle divisioni, quadre come disegnate). */
export function finalizePiece(result: RecognitionResult | null, strokes: Stroke[]): string {
  if (!result || !result.latex) return "";
  let normalized = result.latex
    .replace(/X(?=\^|\{|\s|[0-9]|[+-]|=|$|\)|\/)/g, "x")
    .replace(/\bX\b/g, "x");
  normalized = normalized
    .replace(/\bA\b/g, "a")
    .replace(/\bB\b/g, "b")
    .replace(/\bC\b/g, "c")
    .replace(/\bT\b/g, "t")
    .replace(/\bY\b/g, "y");
  normalized = normalized.replace(/\\div/g, "/");
  // ⚠️ RADICI (segnalazione 26/9): la barra della radice viene tolta
  // dall'inchiostro (inkSigns.ts) e il modello legge la V — o la scrive
  // direttamente. V/v prima di cifra/parentesi = radice («V9» → «√9»);
  // la conversione serve sia al DISPLAY sia al parser (normalizeInput
  // la rifà, ma qui copre anche il caso «\sqrt9» senza graffe via
  // prettyPiece). Un «v» minuscolo seguito direttamente da cifra non è
  // quasi mai una variabile: la moltiplicazione si scrive «2v», non «v2».
  normalized = normalized.replace(/[Vv](?=[0-9(\[{])/g, "√");
  // «\sqrt» senza argomento evidente (es. «\sqrt9») resta valido:
  // normalizeInput lo converte in «√» e prettyPiece lo mostra «√9».
  // ⚠️ UGUALE VERO (segnalazione 26/9): quando la riscrittura
  // geometrica ha sintetizzato degli uguali (inkSigns.ts), un «=» nel
  // LaTeX del modello è un uguale disegnato DAVVERO — repairDivisionSigns
  // (che converte «=» fra operandi in «:» perché a volte sono due
  // puntini letti male) non deve toccarlo: si protegge con un segnaposto.
  const eqs = result.eqEquals ?? 0;
  const guarded = eqs > 0 ? normalized.replace(/=/g, "\u0001") : normalized;
  let repaired = rescueLoneDotSign(
    guarded,
    result.dotRewrite ?? { colons: 0, divSigns: 0, loneDots: 0 },
  );
  repaired = repairDivisionSigns(repaired);
  normalized = eqs > 0 ? repaired.replace(/\u0001/g, "=") : repaired;
  normalized = restoreSquareBrackets(normalized, strokes);
  // ⚠️ DOPPIO MENO (27/9): rete di sicurezza finale sul pezzo — due
  // meni consecutivi non esistono nelle espressioni scolastiche
  // (sintetici vicini, tick del modello, segmenti staccati): uno solo.
  return collapseRepeatedMinus(normalized);
}

/** Riconosce i tratti di UN pezzo con un motore già pronto (banco di prova
 *  in Node o altri chiamanti non React). */
export async function recognizePieceWith(deps: InkDeps, strokes: Stroke[]): Promise<string> {
  return finalizePiece(await recognizeInk(deps, strokes, "expression"), strokes);
}

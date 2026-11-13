import { useCallback, useEffect, useState } from "react";
import { env as ortEnv } from "onnxruntime-web";
import type { Stroke } from "@/components/MathDrawCanvas";
import {
  recognizeInk,
  type RecognitionMode,
  type RecognitionResult,
} from "@/lib/recognizePipeline";

export type { RecognitionMode, RecognitionResult };



// Dynamic imports for ink-on — it loads ONNX Runtime Web
let InferenceEngine: any = null;
let preprocessStrokesFn: any = null;
let isStrokeMeaningfulFn: any = null;
let loadVocabFn: any = null;
let VocabType: any = null;
let repairLatexFn: any = null;
let decodeToTokenArrayFn: any = null;

// ⚠️ I wrapper ESM (.mjs) e i .wasm di onnxruntime sono AUTO-OSPITATI in
// /wasm/ (public/wasm, stesse versioni dei modelli). Nel build di
// produzione il resolver di default cerca /assets/ort-wasm-simd-threaded.*.mjs
// che NON esiste: il fallback SPA risponde con index.html, l'import del
// modulo fallisce e l'inizializzazione del modello resta APPESA PER SEMPRE
// su «CARICAMENTO...» — la mano non funziona mai (segnalazione 26/9).
// In sviluppo il problema non si vede perché Vite risolve i .mjs da
// node_modules (anzi: in dev l'import di file in /public è BLOCCATO da
// Vite stesso, quindi wasmPaths si imposta SOLO in produzione).
if (import.meta.env.PROD) {
  ortEnv.wasm.wasmPaths = "/wasm/";
}

async function ensureInkOn() {
  if (!InferenceEngine) {
    const mod = await import("ink-on/core");
    InferenceEngine = mod.InferenceEngine;
    preprocessStrokesFn = mod.preprocessStrokes;
    isStrokeMeaningfulFn = mod.isStrokeMeaningful;
    loadVocabFn = mod.loadVocab;
    repairLatexFn = mod.repairLatex;
    decodeToTokenArrayFn = mod.decodeToTokenArray;
  }
  return { InferenceEngine, preprocessStrokesFn, isStrokeMeaningfulFn, loadVocabFn, repairLatexFn, decodeToTokenArrayFn };
}

/* ─── SINGLETON DEL MODELLO (26/10, velocità — richiesta esplicita) ─────
 *
 * PRIMA: ogni canvas della terza pagina chiamava useMathRecognition e
 * creava il PROPRIO motore (encoder+decoder int8, single thread): con
 * 9 box erano 9 inizializzazioni complete e «CARICAMENTO MODELLO AI...»
 * restava a schermo (e i pulsanti bloccati) per decine di secondi.
 *
 * ORA: il motore è UNO SOLO per tutta l'app e si carica IN BACKGROUND,
 * senza bloccare l'interfaccia — l'IA vision resta la prima scelta e il
 * modello ONNX serve solo come soccorso. «CARICAMENTO MODELLO AI...»
 * appare solo se l'utente preme RICONOSCI e il soccorso non è ancora
 * pronto (caso raro: di norma il pre-caricamento silenzioso finisce
 * prima che serva).
 *
 * ⚠️ SINGLE-THREAD OBBLIGATORIO: nel build di produzione la variante
 * jsep di onnxruntime con pthread worker (numThreads>1) resta APPESA
 * durante la creazione delle sessioni (segnalazione 26/9). Nell'embed
 * Blogger l'iframe non è cross-origin isolato (no SharedArrayBuffer) e
 * il multithread fallirebbe comunque. Va impostato DOPO ensureInkOn()
 * perché ink-on sovrascrive numThreads all'import.
 */

interface EngineBundle {
  engine: any;
  vocab: any;
}

let enginePromise: Promise<EngineBundle> | null = null;
let engineReadyFlag = false;
const prontiListeners = new Set<() => void>();

function avviaCaricamento(): Promise<EngineBundle> {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    await ensureInkOn();
    ortEnv.wasm.numThreads = 1;
    const vocab = await loadVocabFn("/models/comer/vocab.json");
    const engine = new InferenceEngine({
      encoderUrl: "/models/comer/encoder_int8.onnx",
      decoderUrl: "/models/comer/decoder_int8.onnx",
      beamWidth: 5,
      executionProvider: "wasm",
    });
    await engine.init();
    engineReadyFlag = true;
    prontiListeners.forEach((l) => l());
    return { engine, vocab };
  })();
  /* init fallita: si riparte puliti al prossimo tentativo */
  enginePromise.catch(() => {
    enginePromise = null;
  });
  return enginePromise;
}

/* Mutex GLOBALE: il motore condiviso esegue UNA inferenza alla volta
   (i 9 canvas concorrono sulla stessa sessione ONNX). */
let codaInferenza: Promise<unknown> = Promise.resolve();

export function useMathRecognition() {
  const [isWaiting, setIsWaiting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(engineReadyFlag);

  useEffect(() => {
    /* Pre-caricamento SILENIOSO 2 s dopo il primo canvas: l'utente non
       vede più «CARICAMENTO MODELLO AI...» e i pulsanti non sono mai
       bloccati in attesa (l'IA vision funziona comunque). */
    const t = setTimeout(() => {
      void avviaCaricamento().catch(() => {});
    }, 2000);
    const onPronti = () => setIsModelReady(true);
    prontiListeners.add(onPronti);
    return () => {
      clearTimeout(t);
      prontiListeners.delete(onPronti);
    };
  }, []);

  const recognize = useCallback(
    async (
      strokes: Stroke[],
      mode: RecognitionMode = "auto",
    ): Promise<RecognitionResult | null> => {
      if (!strokes || strokes.length === 0) return null;
      try {
        setIsWaiting(true);
        const bundle = await avviaCaricamento();
        /* la pipeline vera (riscritture geometriche + modello + riparazioni)
           sta in lib/recognizePipeline.ts: modulo puro, provabile in Node.
           Il mutex globale evita inferenze concorrenti sul motore unico. */
        const run = codaInferenza.then(() =>
          recognizeInk(
            {
              engine: bundle.engine,
              vocab: bundle.vocab,
              preprocessStrokes: preprocessStrokesFn,
              isStrokeMeaningful: isStrokeMeaningfulFn,
              repairLatex: repairLatexFn,
              decodeToTokenArray: decodeToTokenArrayFn,
            },
            strokes,
            mode,
          ),
        );
        codaInferenza = run.catch(() => {});
        return await run;
      } catch (err) {
        console.error("Recognition error:", err);
        setLoadError(
          err instanceof Error
            ? err.message
            : "Riconoscimento della scrittura a mano non disponibile",
        );
        return null;
      } finally {
        setIsWaiting(false);
      }
    },
    [],
  );

  return {
    recognize,
    /* «CARICAMENTO MODELLO AI...» SOLO mentre un riconoscimento attende
       il soccorso ONNX: mai durante il pre-caricamento silenzioso */
    isLoading: isWaiting,
    loadError,
    isModelReady,
  };
}

// Utility to render LaTeX with KaTeX in the browser
let katexInstance: any = null;

export async function renderLatex(latex: string): Promise<string> {
  if (!katexInstance) {
    katexInstance = await import("katex");
  }
  try {
    return katexInstance.default.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      trust: true,
    });
  } catch {
    return latex;
  }
}

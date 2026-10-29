// ⚠️ BANCO DI PROVA (6/10) — il modello REALE (ink-on / CoMER int8 + ONNX Runtime
// wasm) in Node, senza browser. Stesso pacchetto, stessi modelli
// (client/public/models/comer), stesso `beamWidth` dell'hook: la pipeline
// recognizeInk() gira identica a quella dell'app.
//
// Requisiti (NON sono dipendenze dell'app, quindi niente in package.json):
//   npm i --no-save @napi-rs/canvas      (rasterizzazione dei tratti)
//   MODEL_BENCH=1 npx vitest run src/lib/bench
// Se @napi-rs/canvas sta altrove: CANVAS_MODULE=/percorso/assoluto/index.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InkDeps } from "../recognizePipeline";

const PUBLIC_DIR = fileURLToPath(new URL("../../../public/", import.meta.url));
const FAKE_HOST = "http://bench.local";

let cached: Promise<{ deps: InkDeps; canvas: any }> | null = null;

export function loadNodeEngine(): Promise<{ deps: InkDeps; canvas: any }> {
  if (!cached) cached = init();
  return cached;
}

async function init(): Promise<{ deps: InkDeps; canvas: any }> {
  const canvasPath = process.env.CANVAS_MODULE ?? "@napi-rs/canvas";
  const canvas: any = await import(/* @vite-ignore */ canvasPath);
  // ink-on rasterizza i tratti con document.createElement("canvas")
  (globalThis as any).document = {
    createElement: (t: string) => {
      if (t === "canvas") return canvas.createCanvas(1, 1);
      throw new Error("createElement non simulato: " + t);
    },
  };
  (globalThis as any).ImageData = canvas.ImageData;

  // i modelli si leggono da client/public (gli URL dell'hook sono relativi)
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url: string = typeof input === "string" ? input : (input?.url ?? String(input));
    if (url.startsWith(FAKE_HOST)) {
      const file = path.join(PUBLIC_DIR, new URL(url).pathname);
      const buf = fs.readFileSync(file);
      return new Response(buf, {
        status: 200,
        headers: { "content-length": String(buf.length), "content-type": "application/octet-stream" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const mod: any = await import("ink-on/core");
  const ort: any = await import("onnxruntime-web");
  ort.env.wasm.numThreads = 1;

  const vocab = await mod.loadVocab(FAKE_HOST + "/models/comer/vocab.json");
  const engine = new mod.InferenceEngine({
    encoderUrl: FAKE_HOST + "/models/comer/encoder_int8.onnx",
    decoderUrl: FAKE_HOST + "/models/comer/decoder_int8.onnx",
    beamWidth: 5,
    executionProvider: "wasm",
  });
  await engine.init();

  const deps: InkDeps = {
    engine,
    vocab,
    preprocessStrokes: mod.preprocessStrokes,
    isStrokeMeaningful: mod.isStrokeMeaningful,
    repairLatex: mod.repairLatex,
    decodeToTokenArray: mod.decodeToTokenArray,
  };
  return { deps, canvas };
}

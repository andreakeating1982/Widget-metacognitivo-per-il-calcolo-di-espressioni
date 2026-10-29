// BANCO FOTO — esegue in Node la pipeline REALE delle foto, la stessa dell'app:
//   enhanceForOcr → Tesseract (eng.traineddata.gz di public/tessdata) → rebuildFromSymbols →
//   resolveSuperscripts (template degli apici) → normalizeExpressionOcr
// con @napi-rs/canvas al posto del canvas del browser. Serve a verificare IN MODO RIPRODUCIBILE
// (non a occhio) che una foto sia trascritta per intero, ad es. `4²` nella prima espressione.
//
//   PHOTO=1 CANVAS_MODULE=/home/user/ocr-bench/node_modules/@napi-rs/canvas/index.js \
//   PHOTO_SPECS='/tmp/foto_full.png|0,150,618,205|(2+5^2):(4^2-2*5-3)+48:(6^2-2^3)=' \
//   npx vitest run src/lib/bench/photoBench.test.ts
//
// PHOTO_SPECS = elenco separato da «;» di `file|x0,y0,x1,y1|verità` (il ritaglio è in pixel NATIVI,
// come fa CropDialog; con `|` vuoto si usa tutta l'immagine). La verità è confrontata ignorando
// spazi e con · × ⋅ \cdot = «*».
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// PHOTO_TARGET_H=<px>: altezza obiettivo delle cifre diversa da DIGIT_TARGET_PX (solo per le misure
// A/B del banco: l'app non legge nessuna variabile d'ambiente).
vi.mock("../glyphScale", async (orig) => {
  const m = await orig<typeof import("../glyphScale")>();
  const t = Number(process.env.PHOTO_TARGET_H ?? 0);
  return t > 0 ? { ...m, DIGIT_TARGET_PX: t } : m;
});

vi.mock("tesseract.js", async () => {
  const actual: any = await vi.importActual("tesseract.js");
  const path = await import("node:path");
  const langPath = path.resolve(process.cwd(), "public/tessdata");
  const createWorker = async (lang: unknown, oem: unknown, opts: any) => {
    // in Node niente workerPath/corePath del browser: si usano quelli di node_modules
    const w = await actual.createWorker(lang, oem, {
      langPath,
      gzip: true,
      cacheMethod: "none",
      logger: opts?.logger,
    });
    if (process.env.PHOTO_FRAC_DEBUG) (globalThis as { __PHOTO_FRAC_DEBUG__?: boolean }).__PHOTO_FRAC_DEBUG__ = true;
    const rec = w.recognize.bind(w);
    let nRec = 0;
    w.recognize = async (img: any, ...rest: any[]) => {
      if (img && typeof img.arrayBuffer === "function") img = Buffer.from(await img.arrayBuffer());
      const res = await rec(img, ...rest);
      if (process.env.PHOTO_SYMS) {
        // dump diagnostico: immagine PREPARATA (quella che vede Tesseract) e simboli con riquadro/confidenza
        const k = nRec++;
        (await import("node:fs")).writeFileSync(`/tmp/photo_prep_${k}.png`, img);
        const out: string[] = [];
        for (const b of (res as any).data.blocks ?? [])
          for (const pa of b.paragraphs ?? [])
            for (const l of pa.lines ?? [])
              for (const wd of l.words ?? [])
                for (const sy of wd.symbols ?? [])
                  out.push(`${JSON.stringify(sy.text)}[${sy.bbox.x0},${sy.bbox.y0},${sy.bbox.x1},${sy.bbox.y1}]c${Math.round(sy.confidence)}`);
        console.log(`PHOTOSYM #${k}: ` + out.join(" "));
      }
      return res;
    };
    return w;
  };
  return { ...actual, createWorker, default: { ...(actual.default ?? {}), createWorker } };
});

const ON = !!process.env.PHOTO;
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const comparable = (s: string): string =>
  s
    .replace(/\s+/g, "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => `^${SUP[c]}`)
    .replace(/\\cdot|[·×⋅∙*]/g, "*")
    .replace(/[\/÷\u2044]/g, ":") // ⁄ = frazione impilata (19/10): stessa divisione per il confronto
    .replace(/\\left|\\right/g, "")
    .replace(/\^\{(\d+)\}/g, "^$1")
    .replace(/\\[{}]/g, (m) => m[1]!)
    .replace(/=+$/, "");

describe.skipIf(!ON)("banco foto (pipeline reale)", () => {
  it("OCR delle foto indicate", { timeout: 900_000 }, async () => {
    const req = createRequire(import.meta.url);
    const nc = req(process.env.CANVAS_MODULE ?? "@napi-rs/canvas");
    // tesseract.js decide «browser o Node» quando viene CARICATO (`typeof document`): va importato
    // PRIMA di definire lo shim di document, altrimenti cerca window/Worker del browser.
    await import("tesseract.js");
    if (process.env.PHOTO_TUNE) Object.assign((await import("../ocrReconcile")).TUNE, JSON.parse(process.env.PHOTO_TUNE));
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag !== "canvas") throw new Error(`createElement(${tag}) non simulato`);
        const cv = nc.createCanvas(1, 1);
        cv.toBlob = (cb: (b: Blob | null) => void, type = "image/png", quality?: number) => {
          const buf = type === "image/jpeg" ? cv.toBuffer("image/jpeg", quality ?? 0.92) : cv.toBuffer("image/png");
          cb(new Blob([buf], { type }));
        };
        return cv;
      },
    };
    (globalThis as any).createImageBitmap = async (blob: Blob) => {
      const img = await nc.loadImage(Buffer.from(await blob.arrayBuffer()));
      (img as any).close = () => {};
      return img;
    };

    const { ocrImage, ocrDebug } = await import("../ocr");
    if (process.env.PHOTO_NO_RECONCILE) ocrDebug.skipReconcile = true;
    if (process.env.PHOTO_RECON) {
      // diagnosi: glifi reali, lettura a template e simboli di Tesseract prima/dopo la riconciliazione
      const { extractGlyphs } = await import("../ocrReconcile");
      const f = (a: { x0: number; y0: number; x1: number; y1: number }): string => `[${a.x0},${a.y0},${a.x1},${a.y1}]`;
      ocrDebug.onReconcile = ({ field, readers, before, after }) => {
        const { glyphs, Hd } = extractGlyphs(field);
        console.log("RECON Hd=" + Hd + " glifi: " + glyphs.map((g) => f(g) + (g.blobs > 1 ? "x" + g.blobs : "")).join(" "));
        console.log(
          "RECON tmpl : " +
            glyphs
              .filter((g) => g.y1 - g.y0 + 1 >= 0.7 * Hd && g.y1 - g.y0 + 1 <= 1.15 * Hd && g.blobs === 1)
              .map((g) => {
                const r = readers.rank?.(g);
                return r ? `${f(g)}→${r.digit}/${r.dist.toFixed(3)}` : `${f(g)}→∅`;
              })
              .join(" "),
        );
        console.log("RECON prima : " + before.map((x) => JSON.stringify(x.text) + f(x)).join(" "));
        console.log("RECON dopo  : " + after.map((x) => JSON.stringify(x.text) + f(x)).join(" "));
      };
    }
    const { normalizeExpressionOcr } = await import("../exprOcr");

    interface Spec { file: string; box?: string | null; truth: string; meta?: Record<string, unknown> }
    const specs: Spec[] = process.env.PHOTO_SPEC_FILE
      ? (JSON.parse(fs.readFileSync(process.env.PHOTO_SPEC_FILE, "utf8")) as Spec[]).filter(
          (sp) => !process.env.PHOTO_FILTER || new RegExp(process.env.PHOTO_FILTER).test(JSON.stringify(sp.meta ?? {}) + sp.file),
        )
      : (process.env.PHOTO_SPECS ?? "")
          .split(";")
          .filter(Boolean)
          .map((x) => {
            const [file, box, truth = ""] = x.split("|");
            return { file: file!, box, truth };
          });
    // senza specifiche: le TRE RIGHE REALI della foto dell'utente (fixtures/foto-esercizi.png)
    if (specs.length === 0) {
      const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/foto-esercizi.png");
      specs.push(
        { file, box: "48,140,618,189", truth: "(2+5^2):(4^2-2*5-3)+48:(6^2-2^3)=", meta: { row: "A" } },
        { file, box: "47,233,618,287", truth: "{(6^2:4-3^2*8^0)^2+10^2-[5*3^2+(100:25)^2]}=", meta: { row: "B" } },
        { file, box: "48,327,618,381", truth: "9^2-{3^3*2+5*[7-(4^2-3*2^2):2]-3^1}+1=", meta: { row: "C" } },
      );
      // CASO REALE PERMANENTE (giro 18, 21/10): foto a mano di (3⁄7:9⁄14)²-7⁄12·2 —
      // prima del giro 18 usciva «87/0/14^28122». Parentesi alte (≈3·Hd) attorno a
      // frazioni impilate, meno letto «i», «2» finale letto «7», numeratore tagliato
      // dal ritaglio. fixtures/foto-parentesi-frazione.jpg
      const fotoPF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/foto-parentesi-frazione.jpg");
      specs.push({ file: fotoPF, box: "", truth: "(3/7:9/14)^2-7/12*2", meta: { row: "PF" } });
    }
    let ok = 0;
    const lines: string[] = [];
    const results: Record<string, unknown>[] = [];
    const tally: Record<string, [number, number]> = {};
    for (const spec of specs) {
      const { file, box, truth } = spec;
      const img = await nc.loadImage(fs.readFileSync(file));
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (box) [sx, sy, sw, sh] = box.split(",").map(Number).map((v, i, a) => (i < 2 ? v! : a[i]! - a[i - 2]!)) as [number, number, number, number];
      const cv = nc.createCanvas(sw, sh);
      cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = new Blob([cv.toBuffer("image/png")], { type: "image/png" });
      const raw = await ocrImage(blob);
      const expr = normalizeExpressionOcr(raw);
      const good = truth ? comparable(expr) === comparable(truth) : undefined;
      if (good) ok++;
      results.push({ file, ok: !!good, raw, app: expr, truth, meta: spec.meta });
      for (const k of Object.entries(spec.meta ?? {}).filter(([n]) => n === "digit_h" || n === "level" || n === "font")) {
        const key = `${k[0]}=${k[1]}`;
        (tally[key] ??= [0, 0])[1]++;
        if (good) tally[key]![0]++;
      }
      lines.push(
        `PHOTO ${good === undefined ? "?" : good ? "OK " : "KO "} ${file}@${box || "tutta"}\n` +
          `PHOTO    grezzo : ${JSON.stringify(raw)}\n` +
          `PHOTO    app    : ${expr}\n` +
          (truth ? `PHOTO    verità : ${truth}\n` : ""),
      );
    }
    if (process.env.PHOTO_OUT) fs.writeFileSync(process.env.PHOTO_OUT, JSON.stringify(results, null, 1));
    const by = Object.entries(tally)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([k, [g, n]]) => `${k} ${g}/${n}`)
      .join(" | ");
    const verbose = !process.env.PHOTO_QUIET;
    console.log("\n" + (verbose ? lines.join("\n") : lines.filter((l) => l.startsWith("PHOTO KO")).join("\n")) + `\nPHOTO TOT ${ok}/${specs.length}` + (by ? `\nPHOTO BY ${by}` : ""));
    expect(specs.length).toBeGreaterThan(0);
  });
});

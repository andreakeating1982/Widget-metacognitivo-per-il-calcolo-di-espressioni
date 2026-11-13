import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Le route HTTP e il motore sono reali; modello, archivio /tmp e DB sono
// interamente simulati in memoria. Non toccare cache o sessioni dell'utente.
const qa = vi.hoisted(() => ({ files: new Map<string,string>(), modelCalls: 0, dbCalls: 0 }));
const raw = {
  espressioneLatex: "2+3*4",
  sezioni: [{ title:"CALCOLI", boxes:[
    { op:"3*4", answerLatex:"12", prompt:"Moltiplico: il risultato è 12.", extraLatex:"12" },
    { op:"2+12", answerLatex:"14", prompt:"Sommo." },
  ] }],
  righeProgressive: ["2+3*4","14","14"],
  risultatoFinaleLatex:"14",
};
vi.mock("./audio", () => ({ chatCompletion: vi.fn(async () => { qa.modelCalls++; return JSON.stringify(raw); }) }));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => { qa.dbCalls++; throw new Error("DB bloccato nel test isolato"); }) }));
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  // La cartella configurata è sempre virtuale: anche con WIDGET_STORAGE_DIR
  // tutte le scritture ammesse restano nella sola mappa in memoria.
  const synthetic = (v: unknown) => {
    const root = (process.env.WIDGET_STORAGE_DIR || "/tmp").replace(/\/$/, "");
    return typeof v === "string" && v.startsWith(`${root}/`) &&
      /^(esercizio-(attivo|job-|sessione-)|cache-costruzioni\.json)/.test(v.slice(root.length + 1));
  };
  return {
    ...original,
    readFileSync: (p: unknown, options?: unknown) => {
      if (!synthetic(p)) return (original.readFileSync as any)(p, options);
      if (!qa.files.has(String(p))) { const e = new Error("File sintetico assente") as NodeJS.ErrnoException; e.code="ENOENT"; throw e; }
      const value=qa.files.get(String(p))!;
      return options === "utf8" || (options && typeof options === "object" && (options as any).encoding === "utf8") ? value : Buffer.from(value);
    },
    writeFileSync: (p: unknown, data: unknown, options?: unknown) => {
      if (!synthetic(p)) throw new Error(`Scrittura NON permessa nel test: ${String(p)}`);
      qa.files.set(String(p),String(data));
      void options;
    },
    unlinkSync: (p: unknown) => {
      if (!synthetic(p)) throw new Error("Cancellazione NON permessa nel test");
      qa.files.delete(String(p));
    },
  };
});

import express from "express";
import { registerEsercizioRoutes, trascrizioneFedele } from "./costruisci";
import { sameExpressionStructure } from "../client/src/lib/progressiveExpression";

let server: Server;
let base: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  qa.files.clear(); qa.modelCalls=0; qa.dbCalls=0;
  const app=express(); registerEsercizioRoutes(app);
  server=await new Promise<Server>((resolve) => {
    const s=app.listen(0,"127.0.0.1",()=>resolve(s));
  });
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  vi.unstubAllEnvs();
});
async function request(path: string, body?: unknown) {
  const response=await fetch(base+path,body===undefined?undefined:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  return {status:response.status,json:await response.json() as any};
}
async function job(id: string) {
  for(let i=0;i<100;i++) {
    const r=await request(`/api/ai/costruisci-esercizio?id=${encodeURIComponent(id)}`);
    if(r.json.stato==="fatto" || r.json.stato==="errore") return r.json;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error("Il job sintetico non si è concluso");
}

describe("API reali con IA e archivi simulati in memoria", () => {
  it.each(["0,0_5per?+x", "2+?", String.raw`0,\overline{05}?+x`])(
    "non avvia il calcolo quando la lettura fotografica contiene una incertezza: %s", async (espressione) => {
      const calls = qa.modelCalls;
      const files = qa.files.size;
      const result = await request("/api/ai/costruisci-esercizio", { espressione });
      expect(result.status).toBe(400);
      expect(result.json.error).toContain("punto incerto");
      expect(qa.modelCalls).toBe(calls);
      expect(qa.files.size).toBe(files);
    },
  );
  it("esegue job, correzione, sessione personale e cache senza toccare dati reali", async () => {
    const start=await request("/api/ai/costruisci-esercizio",{espressione:"2+3*4"});
    expect(start.status).toBe(200); expect(start.json.jobId).toBeTruthy();
    const ready=await job(start.json.jobId);
    expect(ready.stato).toBe("fatto");
    expect(sameExpressionStructure(ready.esercizio.righeProgressive[1],"2+12")).toBe(true);
    expect(ready.esercizio.sezioni[0].boxes[0].prompt).not.toContain("12");
    expect(ready.esercizio.sezioni[0].boxes[0].extraLatex).toBeUndefined();
    const saved=await request("/api/esercizio/attivo",{esercizio:ready.esercizio,espressione:"2+3*4"});
    expect(saved.status).toBe(200); expect(saved.json.sid).toBeTruthy();
    const session=await request(`/api/esercizio/sessione/${saved.json.sid}`);
    expect(session.status).toBe(200);
    expect(session.json.esercizio.espressioneLatex).toBe("2+3*4");
    expect(sameExpressionStructure(session.json.esercizio.righeProgressive[1],"2+12")).toBe(true);
    const repeat=await request("/api/ai/costruisci-esercizio",{espressione:"2+3*4"});
    const cached=await job(repeat.json.jobId);
    expect(cached.stato).toBe("fatto");
    expect(qa.modelCalls).toBe(1);
    expect(qa.dbCalls).toBe(0);
  });
  it("usa il prodotto notevole coniugato e conserva i criteri nella sessione simulata", async () => {
    const chiamatePrima = qa.modelCalls;
    const cachePrima = qa.files.get(`${(process.env.WIDGET_STORAGE_DIR || "/tmp").replace(/\/$/, "")}/cache-costruzioni.json`);
    const start = await request("/api/ai/costruisci-esercizio", { espressione: "3/(x-2)+2/(x+2)" });
    expect(start.status).toBe(200);
    const ready = await job(start.json.jobId);
    expect(ready.stato).toBe("fatto");
    const boxes = ready.esercizio.sezioni.flatMap((s: any) => s.boxes);
    /* (12/11) la sezione CONDIZIONI DI ESISTENZA sta in testa */
    const conti = boxes.filter((b: any) => !b.condizioniEsistenza);
    expect(conti).toHaveLength(6);
    expect(conti[0].criterioDidattico).toBe("frazione_unica");
    expect(conti.at(-1).criterioDidattico).toBe("prodotto_svolto");
    expect(ready.esercizio.sezioni.at(-1).title).toBe("PRODOTTO NOTEVOLE AL DENOMINATORE");
    expect(qa.modelCalls).toBe(chiamatePrima);
    expect(qa.files.get(`${(process.env.WIDGET_STORAGE_DIR || "/tmp").replace(/\/$/, "")}/cache-costruzioni.json`)).toBe(cachePrima);
    const saved = await request("/api/esercizio/attivo", { esercizio: ready.esercizio, espressione: "3/(x-2)+2/(x+2)" });
    expect(saved.status).toBe(200);
    const loaded = await request(`/api/esercizio/sessione/${saved.json.sid}`);
    expect(loaded.status).toBe(200);
    const caricati = loaded.json.esercizio.sezioni.flatMap((s: any) => s.boxes);
    const caricatiConti = caricati.filter((b: any) => !b.condizioniEsistenza);
    expect(caricatiConti[0].criterioDidattico).toBe("frazione_unica");
    expect(caricatiConti.at(-1).criterioDidattico).toBe("prodotto_svolto");
    expect(caricati.every((b: any) => b.simbolico === true)).toBe(true);
    expect(qa.dbCalls).toBe(0);
  });
  it.each([
    "3⁄(x−2)+2⁄(x+2)",
    String.raw`\dfrac{3}{x-2}+\dfrac{2}{x+2}`,
  ])("riconosce la notazione alternativa %s senza chiamare l'IA", async (espressione) => {
    const chiamatePrima = qa.modelCalls;
    const start = await request("/api/ai/costruisci-esercizio", { espressione });
    expect(start.status).toBe(200);
    const ready = await job(start.json.jobId);
    expect(ready.stato).toBe("fatto");
    expect(ready.esercizio.sezioni.at(-1).title).toBe("PRODOTTO NOTEVOLE AL DENOMINATORE");
    expect(qa.modelCalls).toBe(chiamatePrima);
    expect(qa.dbCalls).toBe(0);
  });
  it.each([
    "x/(x+1)+2*x/(4-x)",
    "x⁄(x+1)+2·x⁄(4-x)",
    String.raw`\dfrac{x}{x+1}+2\cdot\dfrac{x}{4-x}`,
  ])("costruisce e salva la forma della foto con percorso verificato e archivi simulati: %s", async (espressione) => {
    const chiamatePrima = qa.modelCalls;
    const cachePrima = qa.files.get(`${(process.env.WIDGET_STORAGE_DIR || "/tmp").replace(/\/$/, "")}/cache-costruzioni.json`);
    const start = await request("/api/ai/costruisci-esercizio", { espressione });
    expect(start.status).toBe(200);
    const ready = await job(start.json.jobId);
    expect(ready.stato).toBe("fatto");
    const esercizio = ready.esercizio;
    expect(trascrizioneFedele(espressione, esercizio.espressioneLatex)).toBe(true);
    expect(esercizio.sezioni.map((s: any) => s.title)).toEqual([
      "CONDIZIONI DI ESISTENZA (C.E.)", "FATTORE ESTERNO", "DENOMINATORE COMUNE", "SVOLGO IL NUMERATORE", "SVOLGO IL DENOMINATORE",
    ]);
    expect(esercizio.sezioni.flatMap((s: any) => s.boxes)).toHaveLength(9);
    /* le righe progressive restano quelle dei SOLI conti: la C.E. non
       cambia l'espressione */
    expect(esercizio.righeProgressive).toHaveLength(8);
    expect(qa.modelCalls).toBe(chiamatePrima);
    expect(qa.files.get(`${(process.env.WIDGET_STORAGE_DIR || "/tmp").replace(/\/$/, "")}/cache-costruzioni.json`)).toBe(cachePrima);
    const saved = await request("/api/esercizio/attivo", { esercizio, espressione });
    expect(saved.status).toBe(200);
    const loaded = await request(`/api/esercizio/sessione/${saved.json.sid}`);
    expect(loaded.status).toBe(200);
    expect(loaded.json.esercizio.espressioneLatex).toBe(esercizio.espressioneLatex);
    expect(loaded.json.esercizio.sezioni[0].boxes[0].condizioniEsistenza).toBe(true);
    expect(loaded.json.esercizio.sezioni.flatMap((s: any) => s.boxes).filter((b: any) => !b.condizioniEsistenza)[0].criterioDidattico).toBe("frazione_unica");
    expect(qa.dbCalls).toBe(0);
  });
  it.each([
    ["periodico e radice su tutta la frazione", String.raw`[(3⁄2-0.5)^2*√(9⁄4)+1,\overline{3}]:(2-1⁄3)`],
    ["radice con lettere sul solo numeratore", "√(9x^3)*√(x)-2x√(4x^2)+(√(25x^4))⁄x"],
    ["somma di radici cubiche", "2∛(81)-5∛(32)-3∛(24)+4∛(108)"],
  ])("costruisce la trascrizione della foto: %s", async (_descrizione, espressione) => {
    const chiamatePrima = qa.modelCalls;
    const start = await request("/api/ai/costruisci-esercizio", { espressione });
    expect(start.status).toBe(200);
    const ready = await job(start.json.jobId);
    expect(ready.stato).toBe("fatto");
    expect(trascrizioneFedele(espressione, ready.esercizio.espressioneLatex)).toBe(true);
    if (_descrizione === "periodico e radice su tutta la frazione") {
      // La route reale deve restituire più box ordinati, non chiedere di
      // risolvere l'espressione completa come primo e unico calcolo.
      const boxes = ready.esercizio.sezioni.flatMap((s: any) => s.boxes);
      expect(boxes.length).toBeGreaterThan(5);
      expect(boxes[0].op).toMatch(/^0(?:\{,\}|,)5$/);
      expect(boxes.some((b: any) => /periodic|frazione generatrice/i.test(b.prompt ?? ""))).toBe(true);
      expect(boxes.at(-1).prompt).toMatch(/divid/i);
    }
    expect(qa.modelCalls).toBe(chiamatePrima); // percorso deterministico verificato
    const saved = await request("/api/esercizio/attivo", { esercizio: ready.esercizio, espressione });
    expect(saved.status).toBe(200);
    const loaded = await request(`/api/esercizio/sessione/${saved.json.sid}`);
    expect(loaded.status).toBe(200);
    expect(loaded.json.esercizio.espressioneLatex).toBe(ready.esercizio.espressioneLatex);
    expect(qa.dbCalls).toBe(0); // DB e archivi sono simulati, non dati reali
  });
  it("rifiuta il salvataggio se la traccia dichiarata non coincide, senza modificare l'archivio", async () => {
    const before=JSON.stringify([...qa.files]);
    const wrong=await request("/api/esercizio/attivo",{esercizio:raw,espressione:"1+4"});
    expect(wrong.status).toBe(400);
    expect(JSON.stringify([...qa.files])).toBe(before);
    expect(qa.dbCalls).toBe(0);
  });
});


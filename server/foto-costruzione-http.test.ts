import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Rotte, controlli matematici e progressione reali. Solo il modello e gli
// archivi sono simulati: nessun contatto con le sessioni dell'utente.
const qa = vi.hoisted(() => ({ files: new Map<string, string>(), dbCalls: 0 }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => { qa.dbCalls++; throw new Error("DB non permesso"); } }));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  // Anche con un archivio configurato, la prova non scrive sul filesystem:
  // i soli nomi ammessi sono memorizzati nella mappa sintetica qa.files.
  const data = (p: unknown) => {
    const root = (process.env.WIDGET_STORAGE_DIR || "/tmp").replace(/\/$/, "");
    return typeof p === "string" && p.startsWith(`${root}/`) &&
      /^(esercizio-(attivo|job-|sessione-)|cache-costruzioni\.json)/.test(p.slice(root.length + 1));
  };
  return {
    ...fs,
    readFileSync: (p: any, options?: any) => {
      if (!data(p)) return fs.readFileSync(p, options);
      const value = qa.files.get(String(p));
      if (value === undefined) { const err = new Error("Assente in memoria") as NodeJS.ErrnoException; err.code = "ENOENT"; throw err; }
      return options === "utf8" || options?.encoding === "utf8" ? value : Buffer.from(value);
    },
    writeFileSync: (p: any, value: any, options?: any) => {
      if (!data(p)) throw new Error("Scrittura esterna al test non permessa");
      qa.files.set(String(p), String(value)); void options;
    },
    unlinkSync: () => { throw new Error("Cancellazione non permessa"); },
  };
});
vi.mock("./audio", () => ({ chatCompletion: async () => JSON.stringify({
  espressioneLatex: String.raw`\dfrac{\left(\sqrt{ab+1}\right)^2}{\sqrt{ab+1}}+\left(\dfrac{2}{6}\right)^{-1}`,
  sezioni: [{title:"CALCOLI", boxes:[
    {op:String.raw`\left(\dfrac{2}{6}\right)^{-1}`, answerLatex:String.raw`\dfrac{6}{2}`, prompt:"Scrivo la potenza con esponente negativo come frazione capovolta."},
    {op:String.raw`\dfrac{\left(\sqrt{ab+1}\right)^2}{\sqrt{ab+1}}`, answerLatex:String.raw`\sqrt{ab+1}`, prompt:"Semplifico la frazione con radice al numeratore e denominatore."},
    {op:String.raw`\sqrt{ab+1}+\dfrac{6}{2}`, answerLatex:String.raw`\sqrt{ab+1}+3`, prompt:"Semplifico la frazione."},
  ]}],
  righeProgressive:[], risultatoFinaleLatex:String.raw`\sqrt{ab+1}+3`,
}) }));
import express from "express";
import { registerEsercizioRoutes, trascrizioneFedele } from "./costruisci";
const source = "(√(ab+1))^2⁄√(ab+1)+(2⁄6)^-1";
let server:Server, base:string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  const app=express(); registerEsercizioRoutes(app);
  server=await new Promise<Server>(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); vi.unstubAllEnvs();});
async function call(url:string, body?:unknown) {
  const r=await fetch(base+url,body===undefined?undefined:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  return {status:r.status, body:await r.json() as any};
}
describe("foto: costruzione e sessione con dati isolati", () => {
  it("accetta la frazione visibile, costruisce e carica l'esercizio senza anticipare risposte", async () => {
    const start=await call("/api/ai/costruisci-esercizio",{espressione:source});
    expect(start.status).toBe(200); expect(start.body.jobId).toBeTruthy();
    let state:any;
    for(let i=0;i<100;i++) {
      state=(await call(`/api/ai/costruisci-esercizio?id=${encodeURIComponent(start.body.jobId)}`)).body;
      if(state.stato==="fatto" || state.stato==="errore") break;
      await new Promise(r=>setTimeout(r,10));
    }
    expect(state.stato).toBe("fatto");
    expect(trascrizioneFedele(source,state.esercizio.espressioneLatex)).toBe(true);
    const boxes=state.esercizio.sezioni.flatMap((s:any)=>s.boxes);
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    expect(boxes.every((b:any)=>!b.extraLatex && typeof b.prompt === "string")).toBe(true);
    const saved=await call("/api/esercizio/attivo",{esercizio:state.esercizio,espressione:source});
    expect(saved.status).toBe(200); expect(saved.body.sid).toBeTruthy();
    const loaded=await call(`/api/esercizio/sessione/${saved.body.sid}`);
    expect(loaded.status).toBe(200);
    expect(trascrizioneFedele(source,loaded.body.esercizio.espressioneLatex)).toBe(true);
    expect(qa.dbCalls).toBe(0);
  });
});


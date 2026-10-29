import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StrokeRecorder } from "./strokeRecorder";

/**
 * Regressione 6/10: `MathDrawCanvas` leggeva il tratto in corso dallo stato React dentro i gestori;
 * con più eventi prima del render i punti andavano persi (`{[(3+2)]}` letto `{[[3+2)]}` con un
 * evento ogni 3 ms, giusto con uno ogni 16 ms). Il registratore è la fonte di verità: nessun punto
 * si perde, comunque veloci arrivino gli eventi.
 */
describe("StrokeRecorder", () => {
  it("non perde punti con eventi molto più veloci del render (nessuno snapshot riletto)", () => {
    const rec = new StrokeRecorder();
    rec.start({ x: 0, y: 0 });
    // 1000 «mousemove» consecutivi SENZA che nessuno rilegga lo snapshot (= nessun render React)
    for (let i = 1; i <= 1000; i++) rec.move({ x: i, y: i * 2 });
    const s = rec.end();
    expect(s).not.toBeNull();
    expect(s!.points).toHaveLength(1001);
    expect(s!.points[0]).toEqual({ x: 0, y: 0 });
    expect(s!.points[1000]).toEqual({ x: 1000, y: 2000 });
    // ordine conservato
    for (let i = 1; i < s!.points.length; i++) expect(s!.points[i]!.x).toBeGreaterThan(s!.points[i - 1]!.x);
  });

  it("il primo movimento subito dopo l'inizio non viene ignorato (isDrawing non ancora aggiornato)", () => {
    const rec = new StrokeRecorder();
    rec.start({ x: 5, y: 5 });
    expect(rec.active).toBe(true);
    const snap = rec.move({ x: 6, y: 7 });
    expect(snap!.points).toEqual([{ x: 5, y: 5 }, { x: 6, y: 7 }]);
  });

  it("un movimento senza tratto iniziato (tasto non premuto) viene ignorato", () => {
    const rec = new StrokeRecorder();
    expect(rec.active).toBe(false);
    expect(rec.move({ x: 1, y: 1 })).toBeNull();
    expect(rec.end()).toBeNull();
  });

  it("end() restituisce il tratto una sola volta e svuota il registratore", () => {
    const rec = new StrokeRecorder();
    rec.start({ x: 1, y: 1 }, 4);
    rec.move({ x: 2, y: 2 });
    const s = rec.end();
    expect(s).toEqual({ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], lineWidth: 4 });
    expect(rec.active).toBe(false);
    expect(rec.end()).toBeNull();
    expect(rec.move({ x: 3, y: 3 })).toBeNull();
  });

  it("un tocco senza movimento è un tratto di un solo punto (puntino)", () => {
    const rec = new StrokeRecorder();
    rec.start({ x: 10, y: 10 });
    expect(rec.end()!.points).toHaveLength(1);
  });

  it("start() scarta un tratto non concluso e cancel() lo annulla", () => {
    const rec = new StrokeRecorder();
    rec.start({ x: 1, y: 1 });
    rec.move({ x: 2, y: 2 });
    rec.start({ x: 50, y: 50 });
    expect(rec.end()!.points).toEqual([{ x: 50, y: 50 }]);
    rec.start({ x: 1, y: 1 });
    rec.cancel();
    expect(rec.active).toBe(false);
    expect(rec.end()).toBeNull();
  });

  it("gli snapshot già consegnati a React non vengono modificati dai movimenti successivi", () => {
    const rec = new StrokeRecorder();
    const a = rec.start({ x: 0, y: 0 });
    const b = rec.move({ x: 1, y: 1 })!;
    const c = rec.move({ x: 2, y: 2 })!;
    expect(a.points).toHaveLength(1);
    expect(b.points).toHaveLength(2);
    expect(c.points).toHaveLength(3);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });
});

describe("MathDrawCanvas usa il registratore (guardia contro il ritorno dello stato vecchio)", () => {
  const src = readFileSync(resolve(__dirname, "../components/MathDrawCanvas.tsx"), "utf8");

  it("importa e usa StrokeRecorder", () => {
    expect(src).toContain('from "@/lib/strokeRecorder"');
    expect(src).toContain("recorder.start(");
    expect(src).toContain("recorder.move(");
    expect(src).toContain("recorder.end()");
    expect(src).toContain("recorder.cancel()");
  });

  it("non ricostruisce il tratto dallo stato `currentStroke` nei gestori", () => {
    expect(src).not.toMatch(/\.\.\.currentStroke/);
    expect(src).not.toMatch(/currentStroke\.points\.length\s*>\s*0\)\s*\{\s*onStrokesChange/);
  });

  it("la gomma e il salvataggio usano l'elenco aggiornato (strokesRef), non `strokes` della closure", () => {
    expect(src).toContain("strokesRef.current");
    expect(src).not.toMatch(/onStrokesChange\(\[\.\.\.strokes,/);
    expect(src).not.toMatch(/strokes\.filter\(\(s\) => !isNearStroke/);
  });
});

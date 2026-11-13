import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyProfile, profileOf } from "./bracketProfile";
import { rewriteBrackets } from "./squareBrackets";

/**
 * Regressione 6/10 — «tonda letta come quadra» per il rumore di quantizzazione.
 *
 * Caso REALE catturato dal canvas del browser (fixture `bench/fixtures/uiCanvasRoundOpen.json`):
 * `{[(3+2)]}` scritto a mano, con `clientX/clientY` troncati a interi CSS e il canvas mostrato a
 * 476,44×136 px (dimensioni interne 476×140). La `(` (tratto #2, 9×55 px) ha lo STESSO profilo della
 * versione non quantizzata tranne `corners 0→1` ed `endWidth 0,06→0,08`: la vecchia regola
 * «corners ≥ 1 ∧ endWidth ≥ 0,08» la leggeva quadra e il risultato era `{[[3+2)]}` (il modello
 * vedeva solo `3 + 2 )`).
 *
 * Banco `bench/squareRise.test.ts` (200 semi × 2 stili, quantizzazione del canvas reale, H=38):
 * la regola scatta su 1/800 tonde (endWidth 0,09) e su 655/800 quadre, TUTTE con endWidth ≥ 0,13;
 * `rise` NON separa (le quadre vere arrivano a 0,47). Nuova regola: quadra se `hTick` ∨
 * (`corners ≥ 1` ∧ `endWidth ≥ 0,12`) ∨ (`corners ≥ 2` ∧ `endWidth ≥ 0,08`).
 */
type Stroke = { points: { x: number; y: number }[]; lineWidth?: number };
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "bench/fixtures/uiCanvasRoundOpen.json"), "utf8"),
) as { expr: string; strokes: Stroke[] }[];
const strokes = fixture[0]!.strokes;
const IDX_ROUND_OPEN = 2;

describe("la `(` catturata dal canvas reale", () => {
  it("ha il profilo «a un angolo, uncino 0,08» che prima la faceva leggere quadra", () => {
    const pr = profileOf([strokes[IDX_ROUND_OPEN]!] as never)!;
    expect(pr.corners).toBe(1);
    expect(pr.endWidth).toBeGreaterThanOrEqual(0.08);
    expect(pr.endWidth).toBeLessThan(0.12);
  });

  it("viene classificata TONDA", () => {
    const pr = profileOf([strokes[IDX_ROUND_OPEN]!] as never)!;
    expect(classifyProfile(pr)?.kind).toBe("round");
  });

  it("rewriteBrackets estrae solo { [ ] } e lascia `(` e `)` al modello (6 tratti rimasti)", () => {
    const rb = rewriteBrackets(strokes as never);
    expect(rb.brackets.map((b) => (b.isOpen ? "" : "/") + b.kind[0]).join(" ")).toBe("c s /s /c");
    expect(rb.strokes).toHaveLength(6);
  });
});

describe("classifyProfile: regola angoli + tick", () => {
  const base = profileOf([strokes[IDX_ROUND_OPEN]!] as never)!;
  const kindOf = (over: Partial<typeof base>) => classifyProfile({ ...base, ...over })?.kind;

  it("un angolo con tick MEDIO (0,08–0,11) è una tonda (rumore)", () => {
    expect(kindOf({ corners: 1, endWidth: 0.08 })).toBe("round");
    expect(kindOf({ corners: 1, endWidth: 0.11 })).toBe("round");
  });
  it("un angolo con tick LARGO (≥ 0,12) è una quadra", () => {
    expect(kindOf({ corners: 1, endWidth: 0.12 })).toBe("square");
    expect(kindOf({ corners: 1, endWidth: 0.2 })).toBe("square");
  });
  it("due angoli bastano anche con tick medio (≥ 0,08)", () => {
    expect(kindOf({ corners: 2, endWidth: 0.08 })).toBe("square");
    expect(kindOf({ corners: 2, endWidth: 0.1 })).toBe("square");
  });
  it("due angoli senza tick (uncini < 0,08) restano una tonda", () => {
    expect(kindOf({ corners: 2, endWidth: 0.05 })).toBe("round");
  });
  it("il tick orizzontale separato (hTick) fa sempre una quadra", () => {
    expect(kindOf({ hTick: true, corners: 0, endWidth: 0.02 })).toBe("square");
  });
});

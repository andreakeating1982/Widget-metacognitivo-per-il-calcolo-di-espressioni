/**
 * SEQUENZA DI PARENTESI letta dalla geometria (SENZA modello: pochi secondi).
 *
 * Per ogni espressione del catalogo con parentesi confronta la sequenza VERA dei tipi (tonda/quadra/
 * graffa) delle parentesi aperte e chiuse con quella di `detectBracketKinds` (stessa classificazione
 * che usa `restoreSquareBrackets` per ricolorare il testo del modello). Serve a vedere QUALE parentesi
 * sbaglia in contesto (annidate, vicine alle cifre) e come cambia con la scala e i pixel interi.
 *
 *   SEQ=1 [SEQ_H=38] [SEQ_ROUND=1] [SEQ_SEEDS=6] [SEQ_FILTER='^P2-'] [SEQ_SHOW=12]
 *     npx vitest run src/lib/bench/bracketSeq.test.ts
 *
 * SEQ_TYPEONLY=1 mostra solo gli errori di TIPO (stesso numero di parentesi); SEQ_TOP=<n> voci di confusione.
 * SEQ_H: altezza delle cifre (px; default casuale 46–68 come il catalogo); SEQ_ROUND=1: punti a pixel
 * interi come gli eventi mouse.
 */
import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import { synthDetailed, type SpacingStyle } from "./synthInk";
import { detectBracketKinds } from "../squareBrackets";

const ON = !!process.env.SEQ;
const STYLES: SpacingStyle[] = ["normal", "tight", "touch"];
const KIND: Record<string, string> = { "(": "round", ")": "round", "[": "square", "]": "square", "{": "curly", "}": "curly" };

/** tipi veri delle parentesi aperte e chiuse, nell'ordine dell'espressione (gli apici ^d si saltano) */
function truth(expr: string): { opens: string[]; closes: string[] } {
  const opens: string[] = [];
  const closes: string[] = [];
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]!;
    if (ch === "^") {
      i++;
      continue;
    }
    if ("([{".includes(ch)) opens.push(KIND[ch]!);
    else if (")]}".includes(ch)) closes.push(KIND[ch]!);
  }
  return { opens, closes };
}

describe.skipIf(!ON)("sequenza di parentesi (geometria, senza modello)", () => {
  it("catalogo × stili × semi", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.SEQ_SEEDS ?? 6);
    const filter = process.env.SEQ_FILTER ? new RegExp(process.env.SEQ_FILTER) : null;
    const show = Number(process.env.SEQ_SHOW ?? 0);
    const H = process.env.SEQ_H ? Number(process.env.SEQ_H) : undefined;
    const round = !!process.env.SEQ_ROUND;
    const byCls = new Map<string, { ok: number; n: number }>();
    const byStyle = new Map<string, { ok: number; n: number }>();
    const confusion = new Map<string, number>();
    const examples: string[] = [];
    let ok = 0;
    let n = 0;
    for (const c of CASES) {
      if (!/[()[\]{}]/.test(c.expr)) continue;
      if (filter && !filter.test(c.id)) continue;
      const want = truth(c.expr);
      for (const style of STYLES) {
        for (let s = 1; s <= seeds; s++) {
          const { strokes } = synthDetailed(c.expr, { seed: 700 + s * 977 + c.id.length * 31 + c.expr.length, style, ...(H ? { H } : {}) });
          if (round) for (const st of strokes) for (const p of st.points) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
          const got = detectBracketKinds(strokes as never);
          const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
          const good = same(want.opens, got.opens) && same(want.closes, got.closes);
          n++;
          if (good) ok++;
          for (const [map, key] of [[byCls, c.cls], [byStyle, style]] as const) {
            const e = map.get(key) ?? { ok: 0, n: 0 };
            e.n++;
            if (good) e.ok++;
            map.set(key, e);
          }
          if (!good) {
            // confusione per posizione quando le lunghezze coincidono, altrimenti «conteggio»
            for (const [lab, a, b] of [["aperte", want.opens, got.opens], ["chiuse", want.closes, got.closes]] as const) {
              if (a.length !== b.length) confusion.set(`${lab}: conteggio ${a.length}→${b.length}`, (confusion.get(`${lab}: conteggio ${a.length}→${b.length}`) ?? 0) + 1);
              else a.forEach((v, i) => { if (v !== b[i]) { const k = `${lab}: ${v}→${b[i]}`; confusion.set(k, (confusion.get(k) ?? 0) + 1); } });
            }
            const typeOnly = want.opens.length === got.opens.length && want.closes.length === got.closes.length;
            if (examples.length < show && (!process.env.SEQ_TYPEONLY || typeOnly)) examples.push(`${c.expr.padEnd(18)} ${style.padEnd(6)} s${s}  vere ${want.opens.map((k) => k[0]).join("")}|${want.closes.map((k) => k[0]).join("")}  lette ${got.opens.map((k) => k[0]).join("")}|${got.closes.map((k) => k[0]).join("")}`);
          }
        }
      }
    }
    const pct = (e: { ok: number; n: number }) => `${Math.round((100 * e.ok) / e.n)}% (${e.ok}/${e.n})`;
    const lines = [
      `SEQ H=${H ?? "46–68"} ${round ? "INTERI" : "decimali"} semi=${seeds}: **${Math.round((100 * ok) / n)}%** (${ok}/${n})`,
      "SEQ per classe: " + [...byCls.entries()].sort().map(([k, v]) => `${k} ${pct(v)}`).join(" · "),
      "SEQ per stile:  " + [...byStyle.entries()].map(([k, v]) => `${k} ${pct(v)}`).join(" · "),
      "SEQ errori:     " + ([...confusion.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.SEQ_TOP ?? 14)).map(([k, v]) => `${k} ×${v}`).join(" | ") || "—"),
      ...examples.map((e) => "SEQ es: " + e),
    ];
    console.log("\n" + lines.join("\n"));
    expect(n).toBeGreaterThan(0);
  });
});

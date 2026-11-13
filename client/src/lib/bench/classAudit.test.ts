// Matrice di confusione della CLASSIFICAZIONE geometrica delle parentesi
// (senza modello). Verità: tipo + aperta/chiusa del glifo sintetico.
//   GEO_AUDIT=1 [GEO_SEEDS=60] [GEO_CTX=2] [GEO_H=38] [GEO_ROUND=1] npx vitest run src/lib/bench/classAudit.test.ts
// GEO_H=<px>: altezza delle cifre; GEO_ROUND=1: punti a pixel interi (prova di sensibilità alla quantizzazione).
// GEO_CTX="2": la parentesi viene scritta fra cifre («2B2»), si legge SOLO il candidato
// la cui x cade sul glifo-parentesi (le cifre non contano).
import { describe, it } from "vitest";
import { synthDetailed, type SpacingStyle } from "./synthInk";
import { shapeCandidates } from "../squareBrackets";
import { profileOf, curlyTip } from "../bracketProfile";

const ON = !!process.env.GEO_AUDIT;
const TRUTH: Record<string, string> = {
  "(": "(round", ")": ")round", "[": "(square", "]": ")square", "{": "(curly", "}": ")curly",
};

describe.skipIf(!ON)("confusione classificazione parentesi", () => {
  it("isolate e in contesto", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.GEO_SEEDS ?? 60);
    const ctx = process.env.GEO_CTX ?? "";
    const styles: SpacingStyle[] = (process.env.GEO_STYLES ?? "normal,tight").split(",") as SpacingStyle[];
    const lines: string[] = [];
    for (const b of (process.env.GEO_TARGETS ?? "()[]{}").split("")) {
      const tally: Record<string, number> = {};
      let n = 0;
      let shown = 0;
      for (const style of styles) {
        for (let s = 1; s <= seeds; s++) {
          const expr = ctx ? (ctx.includes("|") ? `${ctx.split("|")[0]}${b}${ctx.split("|")[1]}` : `${ctx}${b}${ctx}`) : b;
          const { strokes, owners } = synthDetailed(expr, { seed: s * 1013 + b.charCodeAt(0), style, ...(process.env.GEO_H ? { H: Number(process.env.GEO_H) } : {}) });
          // GEO_ROUND=1: coordinate a pixel INTERI (come gli eventi mouse)
          if (process.env.GEO_ROUND) for (const st of strokes) for (const pt of st.points) { pt.x = Math.round(pt.x); pt.y = Math.round(pt.y); }
          // tratti del glifo-parentesi
          const idxB = owners.map((o, i) => (o.ch === b ? i : -1)).filter((i) => i >= 0);
          let x0 = Infinity, x1 = -Infinity;
          for (const i of idxB) for (const p of strokes[i]!.points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
          const cands = shapeCandidates(strokes as any).filter((c) => c.gb.x1 >= x0 - 2 && c.gb.x0 <= x1 + 2 && (c.gb.x0 + c.gb.x1) / 2 >= x0 - 4 && (c.gb.x0 + c.gb.x1) / 2 <= x1 + 4);
          const key = cands.length === 0 ? "—" : cands.map((c) => `${c.isOpen ? "(" : ")"}${c.kind}${c.strength === "weak" ? "~" : ""}`).join("+");
          tally[key] = (tally[key] ?? 0) + 1;
          n++;
          if (process.env.GEO_SHOW && key.replace(/~/g, "") !== TRUTH[b]! && shown < Number(process.env.GEO_SHOWN ?? 10) && (process.env.GEO_SHOW === b)) {
            const idx = idxB;
            const p = profileOf(idx.map((i) => strokes[i]!) as any)!;
            console.log(`SHOW ${b} s${s} ${style[0]} → ${key} | tratti ${idx.length} asp ${p.aspect.toFixed(2)} asym ${p.asym.toFixed(2)} flat ${p.flat.toFixed(2)} g ${p.g.toFixed(2)} rise ${p.rise.toFixed(2)} uMid ${p.uMid.toFixed(1)} uSh ${p.uSh.toFixed(1)} tip ${curlyTip(p)} corners ${p.corners} endW ${p.endWidth.toFixed(2)} depth ${p.depth.toFixed(3)}`);
            shown++;
          }
        }
      }
      const parts = Object.entries(tally).sort((a, b2) => b2[1] - a[1]).map(([k, v]) => `${k}:${Math.round((100 * v) / n)}%`);
      lines.push(`${b} (vero ${TRUTH[b] ?? "cifra"}) → ${parts.join("  ")}`);
    }
    console.log(`\nCONTESTO="${ctx}" stili=${styles}\n` + lines.join("\n"));
  });
});

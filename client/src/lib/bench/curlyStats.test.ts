/**
 * Statistiche delle candidate che la geometria chiama GRAFFA (o tonda/quadra): per ogni candidata
 * del catalogo (in CONTESTO: parentesi annidate, cifre vicine) si registra la VERITÀ (il glifo
 * disegnato) e le misure del profilo, per vedere quale misura separa le graffe vere dalle false.
 *
 *   CURLY=1 [CURLY_H=38] [CURLY_ROUND=1] [CURLY_SEEDS=8] [CURLY_PRED=curly] npx vitest run src/lib/bench/curlyStats.test.ts
 *
 * Senza modello: pochi secondi. CURLY_PRED = tipo previsto da mostrare in dettaglio (curly | round | square).
 */
import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import { synthDetailed, type SpacingStyle } from "./synthInk";
import { shapeCandidates } from "../squareBrackets";
import { profileOf, curlyTip, digitLike } from "../bracketProfile";

const ON = !!process.env.CURLY;
const STYLES: SpacingStyle[] = ["normal", "tight", "touch"];
const KIND: Record<string, string> = { "(": "round", ")": "round", "[": "square", "]": "square", "{": "curly", "}": "curly" };

const q = (xs: number[], p: number): number => {
  const a = xs.filter((x) => isFinite(x)).sort((m, n) => m - n);
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))]! : NaN;
};
const f = (x: number): string => (isFinite(x) ? x.toFixed(2) : " nan");
const t3 = (xs: number[]) => `${f(q(xs, 0.1))} ${f(q(xs, 0.5))} ${f(q(xs, 0.9))}`;

interface Rec {
  pred: string;
  truth: string;
  strength: string;
  endW: number;
  g: number;
  rise: number;
  ratio: number;
  corners: number;
  aspect: number;
  depth: number;
  tip: string;
  digit: boolean;
  expr: string;
}

describe.skipIf(!ON)("statistiche candidate (in contesto)", () => {
  it("catalogo × stili × semi", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.CURLY_SEEDS ?? 8);
    const H = process.env.CURLY_H ? Number(process.env.CURLY_H) : undefined;
    const round = !!process.env.CURLY_ROUND;
    const want = process.env.CURLY_PRED ?? "curly";
    const recs: Rec[] = [];
    for (const c of CASES) {
      if (!/[()[\]{}]/.test(c.expr)) continue;
      for (const style of STYLES) {
        for (let s = 1; s <= seeds; s++) {
          const { strokes, owners } = synthDetailed(c.expr, { seed: 1300 + s * 541 + c.expr.length * 17 + c.id.length, style, ...(H ? { H } : {}) });
          if (round) for (const st of strokes) for (const p of st.points) { p.x = Math.round(p.x); p.y = Math.round(p.y); }
          for (const cand of shapeCandidates(strokes as never)) {
            const chs = new Set(cand.idxs.map((i) => owners[i]!.ch));
            if (chs.size !== 1) continue; // fusa con altro: non analizzabile
            const ch = [...chs][0]!;
            const truth = KIND[ch] ?? "no:" + ch;
            const pr = profileOf(cand.idxs.map((i) => strokes[i]!) as never);
            if (!pr) continue;
            recs.push({
              pred: cand.kind,
              truth,
              strength: cand.strength,
              endW: pr.endWidth,
              g: pr.g,
              rise: pr.rise,
              ratio: Math.abs(pr.uMid) / Math.max(1e-6, Math.abs(pr.uSh)),
              corners: pr.corners,
              aspect: pr.aspect,
              depth: pr.depth,
              tip: curlyTip(pr) ?? "-",
              digit: digitLike(pr),
              expr: c.expr,
            });
          }
        }
      }
    }
    const lines: string[] = [`CURLY H=${H ?? "46–68"} ${round ? "INTERI" : "decimali"} semi=${seeds}: ${recs.length} candidate`];
    // matrice pred × verità
    const mat = new Map<string, number>();
    for (const r of recs) mat.set(`${r.pred}←${r.truth.startsWith("no:") ? "altro" : r.truth}`, (mat.get(`${r.pred}←${r.truth.startsWith("no:") ? "altro" : r.truth}`) ?? 0) + 1);
    lines.push("CURLY matrice (previsto←vero): " + [...mat.entries()].sort().map(([k, v]) => `${k}:${v}`).join("  "));
    // dettaglio per le candidate del tipo previsto `want`
    for (const truth of new Set(recs.filter((r) => r.pred === want).map((r) => (r.truth.startsWith("no:") ? "altro" : r.truth)))) {
      const rs = recs.filter((r) => r.pred === want && (r.truth.startsWith("no:") ? "altro" : r.truth) === truth);
      lines.push(
        `CURLY previsto ${want}, vero ${truth.padEnd(6)} n=${String(rs.length).padStart(4)} forti ${rs.filter((r) => r.strength === "strong").length} | endW ${t3(rs.map((r) => r.endW))} | g ${t3(rs.map((r) => r.g))} | rise ${t3(rs.map((r) => r.rise))} | ratio ${t3(rs.map((r) => r.ratio))} | corners ${t3(rs.map((r) => r.corners))} | asp ${t3(rs.map((r) => r.aspect))} | depth ${t3(rs.map((r) => r.depth))} | tipB ${rs.filter((r) => r.tip === "B").length} tipA ${rs.filter((r) => r.tip === "A").length}`,
      );
    }
    // graffe VERE che la geometria non chiama graffa (mancate): misure del profilo
    for (const pred of ["round", "square"]) {
      const rs = recs.filter((r) => r.truth === "curly" && r.pred === pred);
      if (rs.length) {
        lines.push(
          `CURLY mancate: vero curly previsto ${pred.padEnd(6)} n=${String(rs.length).padStart(4)} | endW ${t3(rs.map((r) => r.endW))} | g ${t3(rs.map((r) => r.g))} | rise ${t3(rs.map((r) => r.rise))} | ratio ${t3(rs.map((r) => r.ratio))} | corners ${t3(rs.map((r) => r.corners))} | asp ${t3(rs.map((r) => r.aspect))} | depth ${t3(rs.map((r) => r.depth))} | tipB ${rs.filter((r) => r.tip === "B").length}`,
        );
      }
    }
    // regole candidate «previsto graffa → tonda»: quante graffe vere si perderebbero, quante false si correggerebbero
    const rules: Record<string, (r: Rec) => boolean> = {
      "endW<0.05 & corners=0": (r) => r.endW < 0.05 && r.corners === 0,
      "endW<0.06 & corners=0": (r) => r.endW < 0.06 && r.corners === 0,
      "endW<0.05": (r) => r.endW < 0.05,
      "endW<0.05 & corners=0 & asp<0.24": (r) => r.endW < 0.05 && r.corners === 0 && r.aspect < 0.24,
      "corners=0 & endW<0.07 & g>0.48": (r) => r.corners === 0 && r.endW < 0.07 && r.g > 0.48,
    };
    const pc = recs.filter((r) => r.pred === "curly");
    const tc = pc.filter((r) => r.truth === "curly").length;
    const fc = pc.filter((r) => r.truth === "round").length;
    for (const [name, fn] of Object.entries(rules)) {
      const lost = pc.filter((r) => r.truth === "curly" && fn(r)).length;
      const fixed = pc.filter((r) => r.truth === "round" && fn(r)).length;
      lines.push(`CURLY regola «${name}»: graffe vere perse ${lost}/${tc}, tonde false corrette ${fixed}/${fc}`);
    }
    // regole di RILASSAMENTO della punta: graffe vere recuperate (previste non-graffa) vs nuovi falsi positivi
    const relax: Record<string, (r: Rec) => boolean> = {
      "K1 ratio≥1.35 g≤.66 rise≥.38 endW≥.07 corners≥1 asp≥.2": (r) => !r.digit && r.ratio >= 1.35 && r.g <= 0.66 && r.rise >= 0.38 && r.endW >= 0.07 && r.corners >= 1 && r.aspect >= 0.2,
      "K2 ratio≥1.25 (resto K1)": (r) => !r.digit && r.ratio >= 1.25 && r.g <= 0.66 && r.rise >= 0.38 && r.endW >= 0.07 && r.corners >= 1 && r.aspect >= 0.2,
      "K3 ratio≥1.4 g≤.64 rise≥.4 endW≥.07 corners≥1": (r) => !r.digit && r.ratio >= 1.4 && r.g <= 0.64 && r.rise >= 0.4 && r.endW >= 0.07 && r.corners >= 1,
      "K4 endW≥.08 corners≥1 ratio≥1.4 asp≥.2": (r) => !r.digit && r.endW >= 0.08 && r.corners >= 1 && r.ratio >= 1.4 && r.aspect >= 0.2,
      "K5 endW≥.07 corners≥1 ratio≥1.3 asp≥.2 rise≥.38": (r) => !r.digit && r.endW >= 0.07 && r.corners >= 1 && r.ratio >= 1.3 && r.aspect >= 0.2 && r.rise >= 0.38,
    };
    const nonCurlyPred = recs.filter((r) => r.pred !== "curly");
    const misses = nonCurlyPred.filter((r) => r.truth === "curly");
    const others = nonCurlyPred.filter((r) => r.truth !== "curly");
    for (const [name, fn] of Object.entries(relax)) {
      const rec = misses.filter(fn).length;
      const fp = others.filter(fn);
      const byTruth = new Map<string, number>();
      for (const r of fp) byTruth.set(r.truth, (byTruth.get(r.truth) ?? 0) + 1);
      const split = (rs: Rec[]) => ["round", "square"].map((k) => `${k[0]}:${rs.filter((r) => r.pred === k).length}`).join(" ");
      lines.push(`CURLY rilassa «${name}»: graffe recuperate ${rec}/${misses.length} [previste ${split(misses.filter(fn))}], nuovi falsi positivi ${fp.length}/${others.length} (${[...byTruth.entries()].map(([k, v]) => `${k}:${v}`).join(" ")}) [previste ${split(fp)}]`);
    }
    console.log("\n" + lines.join("\n"));
    expect(recs.length).toBeGreaterThan(0);
  });
});

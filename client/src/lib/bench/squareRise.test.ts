/**
 * Sonda: quanto separa `rise` le TONDE «( )» dalle QUADRE «[ ]» fra i tratti che soddisfano la regola
 * `corners ≥ 1 && endWidth ≥ 0,08` di classifyProfile? (senza modello)
 *
 * La quantizzazione imita il CANVAS REALE (6/10): il browser TRONCA clientX/clientY a interi CSS e
 * `getCanvasCoords` riscala con canvas.width/rect.width (qui 476/476,44 in x e 140/136 in y), con
 * l'offset frazionario del canvas (rect.left = 399,78; rect.top = 351,75).
 *   SQR=1 SQR_SEEDS=200 SQR_H=38 SQR_Q=ui|round|none npx vitest run src/lib/bench/squareRise.test.ts | grep ^SQR
 */
import { describe, expect, it } from "vitest";
import { synthDetailed, type SpacingStyle } from "./synthInk";
import { profileOf, classifyProfile } from "../bracketProfile";

const ON = !!process.env.SQR;

type Row = { g: string; corners: number; endW: number; rise: number; gg: number; asp: number; cls: string };

const q = (v: number[], p: number) => {
  const a = [...v].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]! : NaN;
};
const fmt = (v: number[]) => (v.length ? `n=${v.length} min ${q(v, 0).toFixed(2)} p10 ${q(v, 0.1).toFixed(2)} p50 ${q(v, 0.5).toFixed(2)} p90 ${q(v, 0.9).toFixed(2)} max ${q(v, 1).toFixed(2)}` : "n=0");

describe.skipIf(!ON)("sonda rise tonde/quadre", () => {
  it("statistiche", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.SQR_SEEDS ?? 200);
    const H = process.env.SQR_H ? Number(process.env.SQR_H) : undefined;
    const mode = process.env.SQR_Q ?? "ui";
    const rows: Row[] = [];
    let rs = 777;
    const rnd = () => (rs = (Math.imul(rs, 1103515245) + 12345) >>> 0) / 4294967296;
    for (const b of "()[]") {
      for (const style of ["normal", "tight"] as SpacingStyle[]) {
        for (let s = 1; s <= seeds; s++) {
          const { strokes, owners } = synthDetailed(`2${b}2`, { seed: s * 1013 + b.charCodeAt(0), style, ...(H ? { H } : {}) });
          const L = rnd(), T = rnd();
          const sx = 476.4375 / 476, sy = 136 / 140;
          for (const st of strokes) for (const pt of st.points) {
            if (mode === "ui") { pt.x = (Math.floor(L + pt.x * sx) - L) / sx; pt.y = (Math.floor(T + pt.y * sy) - T) / sy; }
            else if (mode === "round") { pt.x = Math.round(pt.x); pt.y = Math.round(pt.y); }
          }
          const idx = owners.map((o, i) => (o.ch === b ? i : -1)).filter((i) => i >= 0);
          const pr = profileOf(idx.map((i) => strokes[i]!) as never);
          if (!pr) continue;
          const c = classifyProfile(pr);
          rows.push({ g: b, corners: pr.corners, endW: pr.endWidth, rise: pr.rise, gg: pr.g, asp: pr.aspect, cls: c ? `${c.kind}` : "—" });
        }
      }
    }
    const out: string[] = [`SQR ===== H=${H ?? "cat."} quantizzazione=${mode} semi=${seeds}×2 stili`];
    for (const [name, glyphs] of [["TONDE ( )", "()"], ["QUADRE [ ]", "[]"]] as const) {
      const rs2 = rows.filter((r) => glyphs.includes(r.g));
      const rule = rs2.filter((r) => r.corners >= 1 && r.endW >= 0.08);
      out.push(`SQR ${name}: ${rs2.length} tratti | classificati quadra ${rs2.filter((r) => r.cls === "square").length} · tonda ${rs2.filter((r) => r.cls === "round").length} · altro ${rs2.filter((r) => r.cls !== "square" && r.cls !== "round").length}`);
      out.push(`SQR    regola «corners≥1 ∧ endW≥0,08»: ${rule.length}/${rs2.length}  rise: ${fmt(rule.map((r) => r.rise))}`);
      out.push(`SQR    …di cui endW: ${fmt(rule.map((r) => r.endW))}`);
      for (const th of [0.24, 0.27, 0.3, 0.33]) {
        out.push(`SQR    con rise ≤ ${th.toFixed(2)} la regola scatta su ${rule.filter((r) => r.rise <= th).length}/${rs2.length}`);
      }
    }
    console.log("\n" + out.join("\n"));
    expect(rows.length).toBeGreaterThan(0);
  });
});

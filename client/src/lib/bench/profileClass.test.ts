// Accuratezza del classificatore a profilo (unità = glifo intero, raggruppamento ideale).
//   GEO_AUDIT=1 [GEO_SEEDS=150] npx vitest run src/lib/bench/profileClass.test.ts
import { describe, it } from "vitest";
import { synthExpression, type SpacingStyle } from "./synthInk";
import { classifyProfile, profileOf } from "../bracketProfile";

const ON = !!process.env.GEO_AUDIT;
const TRUTH: Record<string, string> = { "(": "(round", ")": ")round", "[": "(square", "]": ")square", "{": "(curly", "}": ")curly" };
describe.skipIf(!ON)("accuratezza classifyProfile", () => {
  it("parentesi e cifre", { timeout: 600_000 }, () => {
    const seeds = Number(process.env.GEO_SEEDS ?? 150);
    const styles: SpacingStyle[] = ["normal"];
    const lines: string[] = [];
    for (const g of "()[]{}0123456789xya") {
      const tally: Record<string, number> = {};
      let n = 0;
      for (const st of styles) for (let s = 1; s <= seeds; s++) {
        const strokes = synthExpression(g, { seed: s * 7919 + g.charCodeAt(0), style: st });
        const p = profileOf(strokes as any);
        const c = p ? classifyProfile(p) : null;
        const key = c ? `${c.isOpen ? "(" : ")"}${c.kind}` : "—";
        tally[key] = (tally[key] ?? 0) + 1;
        n++;
      }
      const parts = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${Math.round((100 * v) / n)}%`);
      lines.push(`${g} ${(TRUTH[g] ?? "cifra/lettera").padEnd(14)} → ${parts.join("  ")}`);
    }
    console.log("\n" + lines.join("\n"));
  });
});

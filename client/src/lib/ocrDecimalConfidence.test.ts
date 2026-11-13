import { describe, expect, it } from "vitest";
import { segnalaDecimaliDiscordanti } from "./ocrDecimalConfidence";
import { cleanAiExpression } from "./aiClean";
import { normalizeExpressionOcr } from "./exprOcr";
import { normalizeInput } from "./espressioni";

describe("doppia lettura OCR dei decimali", () => {
  it.each([
    ["0,0_5per", "0,05per"],
    ["0,05per", "0,0_5per"],
    ["1,1_23per", "1,12_3per"],
    ["0,05", "0,0_5per"],
    ["0,25", "0,35"],
  ])("segnala un periodo o una cifra discordante, senza decidere cosa sia corretto: %s vs %s", (prima, seconda) => {
    const out = segnalaDecimaliDiscordanti(`x+${prima}`, `x+${seconda}`);
    expect(out.discordanti).toBe(true);
    expect(out.text).toContain("?");
    const pulito = normalizeExpressionOcr(cleanAiExpression(out.text), true, { keepDivision: true });
    expect(pulito).toContain("?");
    expect(() => normalizeInput(pulito, true)).toThrow();
  });
  it.each([
    ["0,05per", String.raw`0,\overline{05}`],
    ["0,0_5per", String.raw`0,0\overline{5}`],
    ["0,5", "0.5"],
    ["1,3per", String.raw`1,\overline{3}`],
    ["12+3", "12+3"],
  ])("non segnala la stessa lettura espressa in notazioni equivalenti: %s e %s", (prima, seconda) => {
    const out = segnalaDecimaliDiscordanti(prima, seconda);
    expect(out.discordanti).toBe(false);
    expect(out.text).toBe(seconda);
    expect(out.text).not.toContain("?");
  });
  it("indica un decimale mancante senza scegliere quale sia giusto", () => {
    const out = segnalaDecimaliDiscordanti("0,5+1,3per", "0,5+3");
    expect(out.discordanti).toBe(true);
    expect(out.text.endsWith("?")).toBe(true);
  });
  it("marca soltanto i decimali diversi quando la stessa foto contiene più numeri", () => {
    const out = segnalaDecimaliDiscordanti("0,5+1,3per+0,0_5per", "0,5+1,3per+0,05per");
    expect(out.discordanti).toBe(true);
    expect(out.text).toBe(String.raw`0,5+1,\overline{3}+0,\overline{05}?`);
  });
});


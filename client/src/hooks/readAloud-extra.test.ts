import { describe, expect, it } from "vitest";
import { latexToSpeech, notationToSpeech, splitSentences } from "./useReadAloud";

describe("lettura matematica senza calcolare", () => {
  it.each([
    ["2{,}05", "due virgola zero cinque"],
    ["0,007", "zero virgola zero zero sette"],
    ["12.30", "dodici virgola tre zero"],
    ["-0,05", "meno zero virgola zero cinque"],
  ])("decimale fedele %s", (input, expected) => {
    expect(latexToSpeech(input)).toBe(expected);
  });
  it.each([
    ["0{,}\\overline{03}", "zero virgola periodo zero tre fine periodo"],
    ["1{,}2\\overline{06}", "uno virgola due periodo zero sei fine periodo"],
    ["0,3per", "zero virgola periodo tre fine periodo"],
    ["0,1_6per", "zero virgola uno periodo sei fine periodo"],
    ["0,16\u0305", "zero virgola uno periodo sei fine periodo"],
  ])("periodico esplicito %s", (input, expected) => {
    expect(latexToSpeech(input)).toBe(expected);
  });
  it.each([
    ["\\sqrt[-13]{a+1}", "radice con indice meno tredici di a più uno fine radice"],
    ["\\sqrt[45]{x}", "radice con indice quarantacinque di x fine radice"],
    ["\\sqrt[3]{27}", "radice cubica di ventisette fine radice"],
    ["⁻¹³√(a+1)", "radice con indice meno tredici di parentesi tonda aperta a più uno parentesi tonda chiusa"],
  ])("indici non perduti %s", (input, expected) => {
    expect(latexToSpeech(input)).toBe(expected);
  });
  it("interpreta anche gli spazi nei comandi e negli argomenti LaTeX", () => {
    expect(latexToSpeech("\\frac {2} {\\sqrt [-13] {x+1}}"))
      .toBe("inizio frazione due fratto radice con indice meno tredici di x più uno fine radice fine frazione");
  });
  it("distingue frazioni annidate e radici nel denominatore", () => {
    expect(latexToSpeech("\\frac{x+1}{\\sqrt{y+2}}"))
      .toBe("inizio frazione x più uno fratto radice quadrata di y più due fine radice fine frazione");
  });
  it("distingue la portata delle parentesi e dell'esponente", () => {
    expect(latexToSpeech("[2+(3x)]^{2}"))
      .toBe("parentesi quadra aperta due più parentesi tonda aperta tre x parentesi tonda chiusa parentesi quadra chiusa al quadrato");
    expect(latexToSpeech("x^{2+1}")).toBe("x alla due più uno");
    expect(latexToSpeech("x¹³")).toBe("x alla tredici");
  });
  it("legge la formula colorata senza annunciare il codice del colore", () => {
    expect(latexToSpeech("\\textcolor{red}{2+x}"))
      .toBe("due più x");
  });
  it("legge confronti e condizioni senza eliminarne il significato", () => {
    expect(latexToSpeech("x \\ne -1 \\Rightarrow x > 2"))
      .toBe("x diverso da meno uno implica x maggiore di due");
  });
  it.each([
    ["2,05+3", "due virgola zero cinque più tre"],
    ["0,1_6per", "zero virgola uno periodo sei fine periodo"],
    ["rad13(x+1)", "radice con indice tredici di x più uno fine radice"],
  ])("legge la notazione digitata %s", (input, expected) => {
    expect(notationToSpeech(input)).toBe(expected);
  });
});

describe("lettura lunga", () => {
  it("suddivide una frase lunga senza perdere parole", () => {
    const text = Array.from({ length: 250 }, (_, n) => `parola${n}`).join(" ");
    const chunks = splitSentences(text);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 180)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
  it("suddivide anche parole eccezionalmente lunghe senza troncarle", () => {
    const text = "x".repeat(520);
    const chunks = splitSentences(text);
    expect(chunks.every((chunk) => chunk.length <= 180)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });
});


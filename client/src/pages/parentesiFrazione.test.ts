import { describe, expect, it } from "vitest";
import { evaluateLatex, normalizeTypedValueNotation } from "@/components/NumberInputCanvas";
import { formaDidatticaValida } from "@/lib/criteriDidattici";
import { conteggioPrimoColpo, stessaForma } from "./EsercizioFrazioni";

// Risposte sintetiche: i valori attesi sono usati soltanto nel test, non UI o TTS.
const attesa = "\\dfrac{3\\cdot(x+2)+2\\cdot(x-2)}{(x-2)(x+2)}";
const box = {
  id: "b1",
  op: "\\dfrac{3}{x-2}+\\dfrac{2}{x+2}",
  answer: NaN,
  answerLatex: attesa,
  simbolico: true,
  rispostaAttesa: attesa,
  criterioDidattico: "frazione_unica" as const,
};

describe("frazione composta: parentesi equivalenti nella risposta dello studente", () => {
  it.each([
    ["tonde", "(3*(x+2)+2*(x-2))/((x-2)*(x+2))"],
    ["quadre al numeratore", "[3*(x+2)+2*(x-2)]/((x-2)*(x+2))"],
    ["quadre al denominatore", "(3*(x+2)+2*(x-2))/[(x-2)*(x+2)]"],
    ["quadre a entrambi", "[3*(x+2)+2*(x-2)]/[(x-2)*(x+2)]"],
    ["graffe al numeratore", "{3*[(x+2)]+2*[(x-2)]}/((x-2)*(x+2))"],
    ["graffe al denominatore", "(3*(x+2)+2*(x-2))/{[(x-2)*(x+2)]}"],
    ["graffe su entrambi, con quadre e tonde interne", "{3*[(x+2)]+2*[(x-2)]}/{[(x-2)*(x+2)]}"],
    ["raggruppamenti misti", "{3*[x+2]+2*(x-2)}/[(x-2)*(x+2)]"],
  ])("accetta %s e registra il primo colpo", (_descrizione, risposta) => {
    expect(normalizeTypedValueNotation(risposta)).toBe(risposta);
    expect(stessaForma(box.op, attesa, risposta)).toBe(true);
    expect(formaDidatticaValida(box.criterioDidattico, risposta)).toBe(true);
    expect(conteggioPrimoColpo([box], { b1: { valore: null, testo: risposta } }))
      .toEqual({ primoColpo: 1, totale: 1 });
  });

  it.each([
    ["parentesi di tipo diverso", "[3*(x+2)+2*(x-2))/[(x-2)*(x+2)]"],
    ["parentesi non chiusa", "[3*(x+2)+2*(x-2)/[(x-2)*(x+2)]"],
    ["denominatore nullo", "[3*(x+2)+2*(x-2)]/{0}"],
    ["denominatore identicamente nullo", "[3*(x+2)+2*(x-2)]/{(x-2)-(x-2)}"],
    ["numeratore errato", "[4*(x+2)+2*(x-2)]/{[(x-2)*(x+2)]}"],
    ["frazione non raggruppata correttamente", "3*(x+2)+2*(x-2)/[(x-2)*(x+2)]"],
  ])("non accetta %s", (_descrizione, risposta) => {
    expect(stessaForma(box.op, attesa, risposta)).toBe(false);
    expect(conteggioPrimoColpo([box], { b1: { valore: null, testo: risposta } }))
      .toEqual({ primoColpo: 0, totale: 1 });
  });

  it("non confonde la somma originaria con una singola frazione", () => {
    const ripetuta = "3/(x-2)+2/(x+2)";
    expect(stessaForma(box.op, attesa, ripetuta)).toBe(true);
    expect(formaDidatticaValida("frazione_unica", ripetuta)).toBe(false);
    expect(conteggioPrimoColpo([box], { b1: { valore: null, testo: ripetuta } }))
      .toEqual({ primoColpo: 0, totale: 1 });
  });

  it("accetta anche esponenti tra graffe dentro la frazione", () => {
    const attesaSvolta = "\\dfrac{x^2+6x}{-x^2+3x+4}";
    expect(stessaForma("", attesaSvolta, "{x^{2}+6x}/{-x^{2}+3x+4}")).toBe(true);
  });
});

describe("parentesi nel campo numerico", () => {
  it.each([
    "(2+4)/(3)",
    "[2+4]/(3)",
    "(2+4)/[3]",
    "{[2+4]}/[(3)]",
  ])("valuta la forma corretta %s", (risposta) => {
    expect(evaluateLatex(normalizeTypedValueNotation(risposta))).toBe(2);
  });
  it.each(["[2+4}/(3)", "{[2+4]}/[0]", "{[2+4]/[3]"])("non inventa un valore per %s", (risposta) => {
    expect(evaluateLatex(normalizeTypedValueNotation(risposta))).toBeNull();
  });
});


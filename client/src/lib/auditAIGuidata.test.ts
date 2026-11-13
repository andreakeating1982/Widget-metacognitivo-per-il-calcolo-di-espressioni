import { describe, expect, it } from "vitest";
import { replaceExpressionStep, safeFractionReciprocal, sameExpressionStructure } from "./progressiveExpression";
import { canonizzaEspressione, contoGiusto, riparaEsercizio, trascrizioneFedele, validoPerArchivio } from "../../../server/costruisci";

describe("passaggi progressivi: una sola operazione già svolta", () => {
  it("ricostruisce 2+3·4 dopo il primo e il secondo box", () => {
    const r1=replaceExpressionStep("2+3*4","3*4","12");
    expect(r1).not.toBeNull();
    expect(sameExpressionStructure(r1!,"2+12")).toBe(true);
    expect(sameExpressionStructure(r1!,"14")).toBe(false);
    const r2=replaceExpressionStep(r1!,"2+12","14");
    expect(sameExpressionStructure(r2!,"14")).toBe(true);
  });
  it("mantiene le parentesi e i decimali fino al rispettivo box", () => {
    const a=replaceExpressionStep("[0,1+0,2]*2","0,1","1/10");
    expect(a).toContain("\\left[");
    expect(a).toContain("0{,}2");
    expect(contoGiusto(a,"[0,1+0,2]*2").ok).toBe(true);
  });
  it("mantiene sia le graffe sia le quadre annidate dopo un conto", () => {
    const next=replaceExpressionStep("{[2+3]}+4","2+3","5");
    expect(next).not.toBeNull();
    expect(next).toContain("\\left\\{\\left[5\\right]\\right\\}");
    expect(contoGiusto(next,"{[2+3]}+4").ok).toBe(true);
  });
  it("mantiene il valore dopo una sostituzione sotto il segno meno", () => {
    const original="6x^2-2x-(x+4)(x-2)+5x";
    const next=replaceExpressionStep(original,"(x+4)(x-2)","x^2+2x-8");
    expect(next).not.toBeNull();
    expect(contoGiusto(original,next).ok).toBe(true);
    expect(sameExpressionStructure(next!,"6x^2-2x-(x^2+2x-8)+5x")).toBe(true);
  });
  it("riconosce termini simili separati senza sommare gli altri", () => {
    const next=replaceExpressionStep("x-3+2x-8","x+2x","3x");
    expect(next).not.toBeNull();
    expect(contoGiusto(next,"x-3+2x-8").ok).toBe(true);
    expect(sameExpressionStructure(next!,"3x-3-8")).toBe(true);
  });
  it("gestisce una parentesi preceduta da meno mantenendo i segni", () => {
    const next=replaceExpressionStep("3a^2-6a-2(a^2+5)+4a","-2(a^2+5)","-2a^2-10");
    expect(next).not.toBeNull();
    expect(contoGiusto(next,"3a^2-6a-2(a^2+5)+4a").ok).toBe(true);
  });
  it("mantiene impilata una frazione letterale già risolta", () => {
    const source="\\dfrac{x}{x+1}+\\dfrac{2x}{4-x}+6:2";
    const operation="\\dfrac{x}{x+1}+\\dfrac{2x}{4-x}";
    const answer="\\dfrac{x^2+6x}{-x^2+3x+4}";
    const next=replaceExpressionStep(source,operation,answer);
    expect(next).not.toBeNull();
    expect(next).toContain("\\dfrac{");
    expect(next).toContain(" : 2"); // divisione ancora da svolgere
    expect(next).not.toMatch(/x\^\{?2\}?\s*\+\s*6x\\right\)\s*:/);
    expect(contoGiusto(source,next).ok).toBe(true);
  });
  it("non inventa un passaggio se l'operazione non è nell'espressione", () => {
    expect(replaceExpressionStep("2+3*4", "7+8", "15")).toBeNull();
  });
  it("confronta la struttura, non solo il valore", () => {
    expect(sameExpressionStructure("2+3","1+4")).toBe(false);
    expect(sameExpressionStructure("[2+3]","(2+3)")).toBe(true);
  });
});

const aiRaw = () => ({
  espressioneLatex:"2+3*4",
  sezioni:[{title:"CALCOLI",boxes:[
    {op:"3*4",answerLatex:"12",prompt:"Moltiplico."},
    {op:"2+12",answerLatex:"14",prompt:"Sommo."},
  ]}],
  // Due righe pericolose: anticipano il risultato finale dopo il primo box.
  righeProgressive:["2+3*4","14","14"], risultatoFinaleLatex:"14",
});

describe("IA simulata: righe corrette e nessuna soluzione anticipata", () => {
  it("sostituisce le righe IA sbagliate con quelle reali e graduali", () => {
    const out=riparaEsercizio(aiRaw());
    expect(out.esercizio).not.toBeNull();
    const rows=out.esercizio!.righeProgressive;
    expect(rows).toHaveLength(3);
    expect(sameExpressionStructure(rows[1],"2+12")).toBe(true);
    expect(sameExpressionStructure(rows[1],"14")).toBe(false);
    expect(sameExpressionStructure(rows[2],"14")).toBe(true);
  });
  it("non consegna box non collegati all'espressione", () => {
    const raw=aiRaw();raw.sezioni[0].boxes[0]={op:"7+8",answerLatex:"15",prompt:"Sommo."};
    const out=riparaEsercizio(raw);
    expect(out.esercizio).toBeNull();
    expect(out.problemi.length).toBeGreaterThan(0);
  });
  it("non scopre il risultato finale quando manca un box", () => {
    const raw=aiRaw();raw.sezioni[0].boxes.pop();
    const out=riparaEsercizio(raw);
    expect(out.esercizio).toBeNull();
    expect(out.problemi.length).toBeGreaterThan(0);
  });
  it("la cache storica viene ripulita in memoria senza modificare l'originale", () => {
    const raw=aiRaw(); const before=JSON.stringify(raw);
    const checked=validoPerArchivio(raw);
    expect(checked).not.toBeNull();
    expect(sameExpressionStructure(checked!.righeProgressive[1],"2+12")).toBe(true);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("consente solo una riscrittura della divisione tra frazioni", () => {
    expect(safeFractionReciprocal("\\dfrac{3}{8}:\\dfrac{9}{4}","\\dfrac{3}{8}\\cdot\\dfrac{4}{9}")).toBe(true);
    expect(safeFractionReciprocal("3*4","12")).toBe(false);
  });
  it("ripulisce titolo e guida se anticipano una risposta futura", () => {
    const raw=aiRaw();
    raw.sezioni[0].title="Alla fine si ottiene 14";
    raw.sezioni[0].boxes[0].prompt="Moltiplico e alla fine ottengo 14.";
    const out=riparaEsercizio(raw);
    expect(out.esercizio).not.toBeNull();
    expect(out.esercizio!.sezioni[0].title).not.toContain("14");
    expect(out.esercizio!.sezioni[0].boxes[0].prompt).not.toContain("14");
  });
  it("non mostra come extra il risultato che lo studente deve scrivere", () => {
    const raw=aiRaw();
    (raw.sezioni[0].boxes[0] as typeof raw.sezioni[0].boxes[0] & {extraLatex:string}).extraLatex="12";
    const out=riparaEsercizio(raw);
    expect(out.esercizio).not.toBeNull();
    expect(out.esercizio!.sezioni[0].boxes[0].extraLatex).toBeUndefined();
  });
});


describe("fedeltà della trascrizione e apici a più cifre", () => {
  it("riconosce frazioni da tastiera e radici senza cambiare la traccia", () => {
    expect(trascrizioneFedele("(2/3+1/6):5/4-1/2", "\\left(\\dfrac{2}{3}+\\dfrac{1}{6}\\right):\\dfrac{5}{4}-\\dfrac{1}{2}")).toBe(true);
    expect(trascrizioneFedele("sqrt(49)+sqrt(16)-3", "\\sqrt{49}+\\sqrt{16}-3")).toBe(true);
    expect(trascrizioneFedele("0,5+1", "\\dfrac{1}{2}+1")).toBe(false);
    expect(trascrizioneFedele("2+3", "1+4")).toBe(false);
  });
  it("preserva il tipo e la posizione delle parentesi quadre e graffe dello studente", () => {
    expect(trascrizioneFedele("[2+3]*4", "\\left[2+3\\right]\\cdot4")).toBe(true);
    expect(trascrizioneFedele("[2+3]*4", "\\left(2+3\\right)\\cdot4")).toBe(false);
    expect(trascrizioneFedele("{[2+3]*4}", "\\left\\{\\left[2+3\\right]\\cdot4\\right\\}")).toBe(true);
    expect(trascrizioneFedele("{[2+3]*4}", "\\left[\\left(2+3\\right)\\cdot4\\right]")).toBe(false);
    expect(trascrizioneFedele("(2+3)*4", "\\left[2+3\\right]\\cdot4")).toBe(false);
    expect(trascrizioneFedele("[2/3+1/6]:5/4", "\\left[\\dfrac{2}{3}+\\dfrac{1}{6}\\right]:\\dfrac{5}{4}")).toBe(true);
  });
  it("mantiene interi gli apici Unicode e anche il loro segno", () => {
    expect(canonizzaEspressione("x¹⁰+2⁻²")).toBe("x^10+2^-2");
  });
});


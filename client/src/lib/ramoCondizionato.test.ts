import { describe, expect, it } from "vitest";
import { creaRamoConCondizioni, type EsercizioPerRamo } from "./ramoCondizionato";
import { contenutiPerCondizioniDiSegno } from "./moduliSottintesi";
import { evaluateNumericExpression } from "./espressioni";
import { soluzioneInFormatoCalcolatrice } from "./soluzioneCalcolatrice";
import { sostituisciLettere, recuperaPrefissoFinaleVerificato } from "../../../server/costruisci";
import fixtures from "../../../server/fixtures/foto-periodici-prefissi-ia.json";

const S=String.raw;
const inputFoto=S`(⁻⁵√(x^5-5x^4+10x^3-10x^2+5x-1)*1,\overline{333}+(∜(x^4+4x^3+6x^2+4x+1))^-1*0,\overline{3})⁄(⁻⁶√(0,00\overline{1}*(x-1)^6)*0,03)`;
function essenziale(op:string, answer:string, seconda?:string):EsercizioPerRamo {
  const box={id:"b1",op,answer:NaN,answerLatex:answer,rispostaAttesa:answer,simbolico:true};
  const boxes=seconda ? [box,{id:"b2",op:answer,answer:NaN,answerLatex:seconda,rispostaAttesa:seconda,simbolico:true}] : [box];
  return {espressioneLatex:op,sezioni:[{title:"passaggi",boxes}],righeProgressive:[op,answer,...(seconda?[seconda]:[])],risultatoFinaleLatex:seconda??answer};
}
const adX=(s:string,x:number)=>evaluateNumericExpression(sostituisciLettere(s,{x}));
function originaleFoto():EsercizioPerRamo {
 const es=recuperaPrefissoFinaleVerificato(inputFoto,JSON.parse(JSON.stringify(fixtures[0].raw)));
 expect(es).not.toBeNull(); let i=0;
 return {...es!.esercizio,sezioni:es!.esercizio.sezioni.map(s=>({...s,boxes:s.boxes.map(b=>({...b,id:`b${++i}`,answer:NaN,rispostaAttesa:b.answerLatex,simbolico:true}))}))};
}

describe("ramo senza moduli: ipotesi esplicite e calcoli conseguenti",()=>{
 it.each([[S`|x+1|`,["x+1"]],[S`\left|x+\left|y-2\right|\right|`,["y-2",S`x+\left(y-2\right)`]],[S`\dfrac{|x|}{|y|}`,["x","y"]]])("estrae TUTTE le condizioni anche annidate: %s",(s,attesi)=>{
   expect(contenutiPerCondizioniDiSegno(s)).toEqual(attesi);
 });
 it("non cambia esercizi senza moduli e non modifica l'originale",()=>{
   const ex=essenziale("x+1","1+x"); const prima=JSON.stringify(ex),r=creaRamoConCondizioni(ex);
   expect(r.ok).toBe(true);if(!r.ok)return;expect(r.applicato).toBe(false);expect(JSON.stringify(ex)).toBe(prima);
 });
 it("trasforma risultato, operazioni successive, righe e finale; non solo la grafica",()=>{
   const ex=essenziale(S`\sqrt{(x+3)^2}`,S`|x+3|`,S`|x+3|+1`);const prima=JSON.stringify(ex);const r=creaRamoConCondizioni(ex);
   expect(r.ok).toBe(true);if(!r.ok)return;
   expect(r.esercizio.ipotesiDiSegno).toEqual([S`x+3 \ge 0`]);
   const [b1,b2]=r.esercizio.sezioni[0].boxes;
   expect(b1.answerLatex).toBe("x+3");expect(b2.op).not.toContain("|");expect(b2.answerLatex).not.toContain("|");
   expect(r.esercizio.righeProgressive.slice(1).join(" ")).not.toContain("|");
   expect(r.esercizio.risultatoFinaleLatex).not.toContain("|");expect(JSON.stringify(ex)).toBe(prima);
 });
 it.each([-5,-1,0,3,8])("genera le condizioni con costante diversa: %i",(n)=>{
   const inner=`x${n>=0?'+':''}${n}`;const r=creaRamoConCondizioni(essenziale(S`\sqrt{(${inner})^2}`,`|${inner}|`));
   expect(r.ok).toBe(true);if(!r.ok)return;expect(r.esercizio.ipotesiDiSegno).toEqual([`${inner} \\ge 0`]);
 });
 it("arresta con chiarezza i casi impossibili e i delimitatori ambigui",()=>{
   expect(creaRamoConCondizioni(essenziale("|-8|","|-8|"))).toMatchObject({ok:false,motivo:expect.stringMatching(/impossibile/i)});
   expect(creaRamoConCondizioni(essenziale("|x+1","|x+1"))).toMatchObject({ok:false,motivo:expect.stringMatching(/sicurezza/i)});
 });
 it("sulla foto mantiene C.E. e aggiunge ipotesi diverse, senza toccare la sessione",()=>{
   const ex=originaleFoto(),prima=JSON.stringify(ex);const r=creaRamoConCondizioni(ex);
   expect(r.ok).toBe(true);if(!r.ok)return;
   expect(r.esercizio.ipotesiDiSegno).toEqual(expect.arrayContaining([S`x-1 \ge 0`,S`x+1 \ge 0`]));
   expect(r.esercizio.sezioni.flatMap(s=>s.boxes).filter(b=>b.condizioniEsistenza).length).toBe(ex.sezioni.flatMap(s=>s.boxes).filter(b=>b.condizioniEsistenza).length);
   expect(r.esercizio.espressioneLatex).toBe(ex.espressioneLatex);
   expect(JSON.stringify(ex)).toBe(prima);
   expect(r.esercizio.sezioni.flatMap(s=>s.boxes).length).toBeGreaterThan(ex.sezioni.flatMap(s=>s.boxes).length);
   for(const b of r.esercizio.sezioni.flatMap(s=>s.boxes)){
     expect(b.op).not.toContain("|");expect(b.answerLatex).not.toContain("|");
     if(!b.condizioniEsistenza){expect(soluzioneInFormatoCalcolatrice(b.answerLatex)).not.toContain("|");}
   }
   expect(r.esercizio.righeProgressive.slice(1).join(' ')).not.toContain('|');
 });
 it("sulla foto i passaggi e il finale coincidono nei valori che rispettano le ipotesi",()=>{
   const ex=originaleFoto(),r=creaRamoConCondizioni(ex);expect(r.ok).toBe(true);if(!r.ok)return;
   for(const x of [2,3,4,5,8,11]) {
     for(const c of r.esercizio.ipotesiDiSegno??[]){const v=adX(c.replace(/\\ge\s*0$/,''),x);expect(v).not.toBeNull();expect(v!).toBeGreaterThanOrEqual(0);}
     const a=adX(ex.risultatoFinaleLatex,x),b=adX(r.esercizio.risultatoFinaleLatex,x);expect(a).not.toBeNull();expect(b).not.toBeNull();expect(Math.abs(a!-b!)).toBeLessThan(1e-8*Math.max(1,Math.abs(a!)));
     for(const box of r.esercizio.sezioni.flatMap(s=>s.boxes).filter(b=>!b.condizioniEsistenza)){
       const v=adX(box.op,x),w=adX(box.answerLatex,x);if(v===null||w===null)continue;expect(Math.abs(v-w)).toBeLessThan(1e-8*Math.max(1,Math.abs(v),Math.abs(w)));
     }
   }
   // Fuori dalle ipotesi il ramo non è una soluzione dell'espressione originale.
   const x=-3;expect(adX(S`x-1`,x)!).toBeLessThan(0);
   const a=adX(ex.risultatoFinaleLatex,x),b=adX(r.esercizio.risultatoFinaleLatex,x);expect(a).not.toBeNull();expect(b).not.toBeNull();expect(Math.abs(a!-b!)).toBeGreaterThan(1e-5);
 });
});


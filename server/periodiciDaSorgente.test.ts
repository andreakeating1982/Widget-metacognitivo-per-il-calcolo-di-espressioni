import { describe, expect, it } from "vitest";
import { ripristinaPeriodiciDaSorgente, ripristinaPeriodiciCandidato } from "./periodiciDaSorgente";
import { contoGiusto, indicazioniPeriodiciDaSorgente, riparaEsercizio, trascrizioneFedele } from "./costruisci";

const s = String.raw;
describe("periodici dall'espressione confermata", () => {
  it.each([
    [s`1,\overline{333}`, s`1,\overline{3}33`],
    [s`0,00\overline{1}`, s`0,0\overline{0}1`],
    [s`8,2\overline{457}`, s`8,2\overline{45}7`],
    [s`12,01\overline{243}`, s`12,0\overline{12}43`],
    [s`0,\overline{2356}`, s`0,\overline{235}6`],
  ])("ripristina dalla fonte esatta %s, non da una supposizione", (fonte, corrotto) => {
    expect(ripristinaPeriodiciDaSorgente(`x+${fonte}`, `x+${corrotto}`)).toBe(`x+${fonte}`);
  });
  it("accetta i periodici nella notazione da tastiera", () => {
    expect(ripristinaPeriodiciDaSorgente("1,333per+x", s`1,\overline{3}33+x`)).toBe(s`1,\overline{333}+x`);
    expect(ripristinaPeriodiciDaSorgente("0,00_1per+x", s`0,0\overline{0}1+x`)).toBe(s`0,00\overline{1}+x`);
  });
  it("non indovina se le stesse cifre identificano più barre diverse nella sorgente", () => {
    const source = s`0,1\overline{23}+0,12\overline{3}`;
    const ambiguous = s`0,\overline{1}23`;
    expect(ripristinaPeriodiciDaSorgente(source, ambiguous)).toBe(ambiguous);
  });
  it("non modifica se le cifre non sono quelle confermate", () => {
    expect(ripristinaPeriodiciDaSorgente(s`1,\overline{333}`, s`1,\overline{3}34`)).toBe(s`1,\overline{3}34`);
  });
  it("non modifica mai un periodico già valido o un decimale ordinario", () => {
    const source = s`0,\overline{12}+1,\overline{333}`;
    const valid = s`0,1\overline{2}+1,33+1,\overline{3}`;
    expect(ripristinaPeriodiciDaSorgente(source,valid)).toBe(valid);
  });
  it("modifica solo i campi matematici, non testi didattici o metadati", () => {
    const fonte=s`1,\overline{333}`, corrotto=s`1,\overline{3}33`;
    const input={espressioneLatex:corrotto,sezioni:[{title:corrotto,boxes:[{op:corrotto,prompt:corrotto,answerLatex:"4/3"}]}],righeProgressive:[corrotto],risultatoFinaleLatex:"4/3"};
    const out=ripristinaPeriodiciCandidato(fonte,input) as typeof input;
    expect(out.espressioneLatex).toBe(fonte);
    expect(out.sezioni[0].boxes[0].op).toBe(fonte);
    expect(out.righeProgressive[0]).toBe(fonte);
    expect(out.sezioni[0].title).toBe(corrotto);
    expect(out.sezioni[0].boxes[0].prompt).toBe(corrotto);
    expect(input.espressioneLatex).toBe(corrotto);
  });
  it("la riparazione non nasconde altre alterazioni della trascrizione", () => {
    const source=s`1,\overline{333}+x`;
    const out=ripristinaPeriodiciDaSorgente(source,s`1,\overline{3}33+x+7`);
    expect(trascrizioneFedele(source,out)).toBe(false);
  });
  it.each([
    [s`1,\overline{333}`, s`\dfrac{4}{3}`],
    [s`0,00\overline{1}`, s`\dfrac{1}{900}`],
    [s`0,\overline{3}`, s`\dfrac{1}{3}`],
    [s`0,12\overline{3}`, s`\dfrac{37}{300}`],
  ])("calcola l'ancora interna esatta e verificata di %s", (numero, frazione) => {
    const notes=indicazioniPeriodiciDaSorgente(`${numero}+x`);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(frazione);
    expect(contoGiusto(numero,frazione).ok).toBe(true);
  });
  it("corregge con aritmetica esatta un risultato scorretto dopo il ripristino", () => {
    const fonte=s`0,00\overline{1}`;
    const raw={espressioneLatex:s`0,0\overline{0}1`,sezioni:[{title:"CALCOLI",boxes:[{op:s`0,0\overline{0}1`,answerLatex:s`\dfrac{1}{90}`,prompt:"Scrivo la frazione generatrice."}]}],righeProgressive:[],risultatoFinaleLatex:s`\dfrac{1}{90}`};
    const esito=riparaEsercizio(ripristinaPeriodiciCandidato(fonte,raw));
    expect(esito.esercizio).not.toBeNull();
    expect(esito.esercizio!.risultatoFinaleLatex).toBe(s`\dfrac{1}{900}`);
    expect(esito.esercizio!.sezioni[0].boxes[0].answerLatex).toBe(s`\dfrac{1}{900}`);
    expect(contoGiusto(fonte, esito.esercizio!.risultatoFinaleLatex).ok).toBe(true);
    expect(contoGiusto(fonte, s`\dfrac{1}{90}`).ok).toBe(false);
  });
});


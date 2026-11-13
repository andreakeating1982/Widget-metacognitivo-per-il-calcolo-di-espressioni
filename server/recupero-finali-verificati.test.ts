import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixtures from './fixtures/foto-periodici-prefissi-ia.json';
import { haContoPendente } from '../client/src/lib/progressiveExpression';
import { evaluateNumericExpression } from '../client/src/lib/espressioni';

const mocked=vi.hoisted(()=>({replies:[] as string[],calls:0}));
vi.mock('./audio',()=>({chatCompletion:vi.fn(async()=>{mocked.calls++;const x=mocked.replies.shift();if(!x)throw Error('Fixture esaurita');return x;})}));
import { contoGiusto, costruisciEsercizioConIA, recuperaPrefissoFinaleVerificato, sostituisciLettere, trascrizioneFedele } from './costruisci';
const S=String.raw;
const inputFoto=S`(⁻⁵√(x^5-5x^4+10x^3-10x^2+5x-1)*1,\overline{333}+(∜(x^4+4x^3+6x^2+4x+1))^-1*0,\overline{3})⁄(⁻⁶√(0,00\overline{1}*(x-1)^6)*0,03)`;
const inputVariante=S`(⁻⁵√(x^5-10x^4+40x^3-80x^2+80x-32)*2,\overline{111}+(∜(x^4+8x^3+24x^2+32x+16))^-1*0,\overline{6})⁄(⁻⁶√(0,00\overline{2}*(x-2)^6)*0,04)`;
const copia=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
beforeEach(()=>{mocked.replies=[];mocked.calls=0;});

describe('frazioni e modulo: recupero finale completo senza inventare risultati',()=>{
  it.each([[0,inputFoto],[1,inputVariante]])('ricostruisce i passaggi reali del caso %i dopo un finale dell’IA errato',async(index,input)=>{
    const raw=copia(fixtures[index].raw);
    expect(contoGiusto(raw.espressioneLatex,raw.risultatoFinaleLatex).ok).toBe(false);
    mocked.replies.push(JSON.stringify(raw));
    const result=await costruisciEsercizioConIA(input);
    expect(mocked.calls).toBe(1);
    expect(trascrizioneFedele(input,result.esercizio.espressioneLatex)).toBe(true);
    const box=result.esercizio.sezioni.flatMap(s=>s.boxes).filter(b=>!b.condizioniEsistenza);
    expect(box.length).toBeGreaterThan(10);
    expect(box.length).toBeLessThan(raw.sezioni.flatMap(s=>s.boxes).length);
    expect(box.every(b=>contoGiusto(b.op,b.answerLatex).ok)).toBe(true);
    expect(contoGiusto(input,result.esercizio.risultatoFinaleLatex).ok).toBe(true);
    expect(haContoPendente(result.esercizio.risultatoFinaleLatex)).toBe(false);
    expect(result.esercizio.righeProgressive).toHaveLength(box.length+1);
    expect(result.esercizio.sezioni.some(s=>s.title.includes('CONDIZIONI')) || (result.esercizio.condizioniGenerali?.length ?? 0)>0).toBe(true);
    expect(result.avvertenze.some(a=>a.includes('semplificazione finale non corretta'))).toBe(true);
  });
  it.each([[0,inputFoto],[1,inputVariante]])('controlla ulteriori valori positivi e negativi della traccia %i', (index,input)=>{
    const esito=recuperaPrefissoFinaleVerificato(input,copia(fixtures[index].raw));
    expect(esito).not.toBeNull();
    const casi=[-12,-9,-7,-5,-4,-3,-2,0,3,4,5,6,7,8,10,12];
    let confronti=0;
    for(const x of casi) {
      const a=evaluateNumericExpression(sostituisciLettere(input,{x}));
      const b=evaluateNumericExpression(sostituisciLettere(esito!.esercizio.risultatoFinaleLatex,{x}));
      if(a===null||b===null) continue;
      expect(Math.abs(a-b)).toBeLessThan(1e-8*Math.max(1,Math.abs(a),Math.abs(b)));
      confronti++;
    }
    expect(confronti).toBeGreaterThan(10);
  });
  it('applica la stessa regola anche a una lettera diversa',()=>{
    const sorgente=inputFoto.replace(/x/g,'y');
    const f=copia(fixtures[0].raw);
    f.espressioneLatex=f.espressioneLatex.replace(/x/g,'y');
    f.risultatoFinaleLatex=f.risultatoFinaleLatex.replace(/x/g,'y');
    for(const sez of f.sezioni) for(const b of sez.boxes) {
      b.op=b.op.replace(/x/g,'y'); b.answerLatex=b.answerLatex.replace(/x/g,'y');
    }
    const esito=recuperaPrefissoFinaleVerificato(sorgente,f);
    expect(esito).not.toBeNull();
    expect(contoGiusto(sorgente,esito!.esercizio.risultatoFinaleLatex).ok).toBe(true);
    expect(trascrizioneFedele(sorgente,esito!.esercizio.espressioneLatex)).toBe(true);
  });
  it('non usa un prefisso se una risposta precedente è errata',()=>{
    const f=copia(fixtures[0].raw);f.sezioni[0].boxes[4].answerLatex=S`(x+4)^5`;
    expect(recuperaPrefissoFinaleVerificato(inputFoto,f)).toBeNull();
  });
  it('non recupera una trascrizione diversa dalla fonte',()=>{
    const f=copia(fixtures[0].raw);f.espressioneLatex=f.espressioneLatex.replace('x^{5}-5x^{4}','x^{5}-7x^{4}');
    expect(recuperaPrefissoFinaleVerificato(inputFoto,f)).toBeNull();
  });
  it('non rimuove passaggi se il finale dell’IA è già equivalente',()=>{
    const f=copia(fixtures[0].raw);f.risultatoFinaleLatex=f.sezioni[0].boxes.at(-2)!.answerLatex;
    expect(recuperaPrefissoFinaleVerificato(inputFoto,f)).toBeNull();
  });
  it('non tratta il rapporto tra modulo e base come uguale a uno',()=>{
    expect(contoGiusto(S`\dfrac{|x-1|}{x-1}`,'1').ok).toBe(false);
    expect(contoGiusto(S`\dfrac{|x-2|}{x-2}`,'1').ok).toBe(false);
  });
});

describe('precedenza delle frazioni impilate durante i controlli',()=>{
  it.each([
    [S`\dfrac{1}{2}:\dfrac{3\sqrt[6]{900}}{100|3-1|}`,S`\dfrac{1}{2}\cdot\dfrac{100|3-1|}{3\sqrt[6]{900}}`],
    [S`\dfrac{1}{3}:\dfrac{2\sqrt[4]{50}}{7|4-2|}`,S`\dfrac{1}{3}\cdot\dfrac{7|4-2|}{2\sqrt[4]{50}}`],
  ])('divisione e reciproco hanno lo stesso valore', (a,b)=>{
    const x=evaluateNumericExpression(a),y=evaluateNumericExpression(b);
    expect(x).not.toBeNull();expect(y).not.toBeNull();expect(x).toBeCloseTo(y!,10);
  });
  it('non considera uguale la divisione con il reciproco sbagliato',()=>{
    expect(contoGiusto(S`\dfrac{1}{x}:\dfrac{2\sqrt[4]{50}}{7|x-2|}`,S`\dfrac{1}{x}\cdot\dfrac{2\sqrt[4]{50}}{7|x-2|}`).ok).toBe(false);
  });
});


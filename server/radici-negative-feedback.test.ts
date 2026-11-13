import { describe, expect, it, vi } from 'vitest';
const qa = vi.hoisted(() => ({ prompts: [] as string[] }));
vi.mock('./audio', () => ({ chatCompletion: async (prompt: string) => {
  qa.prompts.push(prompt);
  const op=String.raw`\sqrt[-5]{\dfrac{1}{32}}`;
  return JSON.stringify({ espressioneLatex:op, sezioni:[{title:'RADICI',boxes:[{op,answerLatex:'2',prompt:'Svolgo la radice indicata.'}]}], righeProgressive:[], risultatoFinaleLatex:'2' });
}}));
import { costruisciEsercizioConIA, costruisciPrompt, indicazioniRadiciNegativeNumeriche, riparaEsercizio } from './costruisci';

describe('ancore esatte interne per le radici con indice negativo', () => {
  it.each([3, 4, 5, 7, 13])('riconosce il reciproco di una radice perfetta con indice −%i', (indice) => {
    const op = String.raw`\sqrt[-${indice}]{\dfrac{1}{${2 ** indice}}}`;
    const note = indicazioniRadiciNegativeNumeriche(`${op}\\cdot x+1`);
    expect(note).toHaveLength(1);
    expect(note[0]).toContain(`\\sqrt[-${indice}]`);
    expect(note[0]).toContain('valore ESATTO è 2');
    expect(note[0]).toContain('reciproco');
  });
  it('considera anche un radicando negativo quando la radice dispari è reale', () => {
    const note = indicazioniRadiciNegativeNumeriche(String.raw`\sqrt[-3]{-\dfrac{1}{27}}+x`);
    expect(note).toHaveLength(1);
    expect(note[0]).toContain('valore ESATTO è -3');
  });
  it('non inventa valori per radici non reali, reciproco di zero o radicandi con lettere', () => {
    expect(indicazioniRadiciNegativeNumeriche(String.raw`\sqrt[-4]{-16}`)).toEqual([]);
    expect(indicazioniRadiciNegativeNumeriche(String.raw`\sqrt[-5]{0}`)).toEqual([]);
    expect(indicazioniRadiciNegativeNumeriche(String.raw`\sqrt[-3]{x-1}`)).toEqual([]);
  });
  it('deduplica le radici identiche senza confondere radicandi diversi', () => {
    const note=indicazioniRadiciNegativeNumeriche(String.raw`\sqrt[-3]{\dfrac{1}{8}}+\sqrt[-3]{\dfrac{1}{8}}+\sqrt[-3]{\dfrac{1}{27}}`);
    expect(note).toHaveLength(2);
  });
  it('trasmette le ancore verificate al generatore nel primo tentativo senza mostrarle allo studente', async () => {
    qa.prompts.length=0;
    const op=String.raw`\sqrt[-5]{\dfrac{1}{32}}`;
    const esito=await costruisciEsercizioConIA(op);
    expect(qa.prompts).toHaveLength(1);
    expect(qa.prompts[0]).toContain('valore ESATTO è 2');
    const box=esito.esercizio.sezioni.flatMap(s=>s.boxes).find(b=>!b.condizioniEsistenza)!;
    expect(box.prompt).not.toContain('2');
    expect(box.extraLatex).toBeUndefined();
  });
  it('mette le ancore nel prompt interno fin dal primo tentativo, mai nelle istruzioni allo studente', () => {
    const op=String.raw`\sqrt[-5]{\dfrac{1}{32}}`;
    const prompt=costruisciPrompt(op, null, [], indicazioniRadiciNegativeNumeriche(op));
    expect(prompt).toContain('CONTROLLI INTERNI ESATTI');
    expect(prompt).toContain('mai inserirli nel prompt');
    expect(prompt).toContain('valore ESATTO è 2');
    const esito=riparaEsercizio({espressioneLatex:op,sezioni:[{title:'RADICI',boxes:[{op,answerLatex:'2',prompt:'Svolgo la radice senza anticipare il valore.'}]}],righeProgressive:[],risultatoFinaleLatex:'2'});
    expect(esito.esercizio).not.toBeNull();
    const box=esito.esercizio!.sezioni.flatMap(s=>s.boxes).find(b=>!b.condizioniEsistenza)!;
    expect(box.prompt).not.toContain('2');
    expect(box.extraLatex).toBeUndefined();
  });
});


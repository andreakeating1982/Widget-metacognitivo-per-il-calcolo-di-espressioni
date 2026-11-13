import { describe, expect, it } from 'vitest';
import { evaluateNumericExpression, normalizeInput, parseExpression, printLatex } from '../client/src/lib/espressioni';
import { normalizeKeyboardNotation } from '../client/src/lib/keyboardNotation';
import { cleanAiExpression } from '../client/src/lib/aiClean';
import { normalizeExpressionOcr, groupRadicalNumerators } from '../client/src/lib/exprOcr';
import { contoGiusto, riparaEsercizio, verificaPerSostituzione, sezioneCondizioniEsistenza } from './costruisci';

describe('indici di radice negativi generalizzati', () => {
  it.each([4, 5, 6, 7, 9, 12, 13, 20, 45, 99])('parser, tastiera e reciproco esatto: indice −%i', (k) => {
    const raw = `(2)^(-1/${k})`;
    const shown = normalizeKeyboardNotation(raw);
    const node = parseExpression(normalizeInput(shown));
    expect(node.k).toBe('root');
    if (node.k === 'root') expect(node.n).toBe(-k);
    expect(evaluateNumericExpression(shown)).toBeCloseTo(2 ** (-1 / k), 10);
    const radical = `\\sqrt[-${k}]{2}`;
    const reciprocal = `\\dfrac{1}{\\sqrt[${k}]{2}}`;
    expect(contoGiusto(radical, reciprocal).ok).toBe(true);
    expect(contoGiusto(radical, `\\dfrac{1}{\\sqrt[${k}]{3}}`).ok).toBe(false);
  });
  it.each([4,5,7,13,20])('radicandi potenze perfette con indice −%i', (k) => {
    expect(contoGiusto(`\\sqrt[-${k}]{${2 ** k}}`, '\\dfrac{1}{2}').ok).toBe(true);
  });
  it.each([3, 4, 5, 13, 20, 45, 99])('rileva lo zero vietato per una radice di indice −%i', (indice) => {
    const ce = sezioneCondizioniEsistenza(`\\sqrt[-${indice}]{(x-3)^{${indice}}}`);
    expect(ce?.boxes.map((b) => b.answerLatex)).toContain('3');
  });
  it('analizza ogni fattore letterale nel denominatore di un prodotto misto', () => {
    const expr = String.raw`\dfrac{\sqrt[-3]{(x-1)^3}+(\sqrt[4]{(x-2)^4})^{-1}}{\sqrt[-2]{1/90}\cdot(x+1)^2\cdot 1/10}`;
    const boxes = sezioneCondizioniEsistenza(expr)?.boxes ?? [];
    expect([...new Set(boxes.map((b) => b.answerLatex))].sort()).toEqual(['-1', '1', '2']);
  });
  it('non ammette radicandi non reali o il reciproco di zero', () => {
    expect(evaluateNumericExpression('\\sqrt[-4]{-16}')).toBeNull();
    expect(evaluateNumericExpression('\\sqrt[-5]{0}')).toBeNull();
    expect(contoGiusto('\\sqrt[-4]{-16}', '\\dfrac{1}{\\sqrt[4]{-16}}').ok).toBe(false);
    expect(contoGiusto('\\sqrt[-5]{0}', '\\dfrac{1}{\\sqrt[5]{0}}').ok).toBe(false);
    expect(evaluateNumericExpression('\\sqrt[-5]{-32}')).toBeCloseTo(-0.5, 10);
  });
});

describe('valori assoluti non eliminati senza condizioni', () => {
  it.each([2, 4, 6])('radice pari di una potenza pari di indice %i', (k) => {
    const rad = `\\sqrt[${k}]{(x-2)^{${k}}}`;
    expect(contoGiusto(rad, 'x-2').ok).toBe(false);
    expect(contoGiusto(rad, '\\left|x-2\\right|').ok).toBe(true);
  });
  it.each([20, 100, 1000])('rifiuta la rimozione del modulo anche con soglia %i', (soglia) => {
    expect(contoGiusto(`\\sqrt{(x-${soglia})^{2}}`, `x-${soglia}`).ok).toBe(false);
    expect(contoGiusto(`\\sqrt{(x-${soglia})^{2}}`, `\\left|x-${soglia}\\right|`).ok).toBe(true);
    expect(contoGiusto(`\\sqrt{(x+${soglia})^{2}}`, `x+${soglia}`).ok).toBe(false);
  });
  it('verifica prodotti impliciti prima e dopo il valore assoluto', () => {
    expect(evaluateNumericExpression('3|-2|')).toBe(6);
    expect(evaluateNumericExpression('(-4)|-2|')).toBe(-8);
    expect(contoGiusto(String.raw`3\left|x-2\right|`, String.raw`\left|x-2\right|\cdot3`).ok).toBe(true);
    expect(contoGiusto(String.raw`\dfrac{1}{3\left|x-2\right|}`, String.raw`\dfrac{1}{3\left|x-2\right|}`).ok).toBe(true);
  });
  it('respinge una risposta non definita dove il passo iniziale è definito', () => {
    expect(contoGiusto(String.raw`\sqrt{(x-1)(x+1)}`, String.raw`\sqrt{x-1}\cdot\sqrt{x+1}`).ok).toBe(false);
  });
  it('confronta un finale con modulo per la variante con fattore fuori radice', () => {
    const foto = String.raw`\dfrac{\sqrt[-3]{x^{3}-3x^{2}+3x-1}\cdot1,\overline{6}+(\sqrt[4]{x^{4}-8x^{3}+24x^{2}-32x+16})^{-1}\cdot0,\overline{6}}{\sqrt[-2]{0,0\overline{1}}\cdot(x^{2}+2x+1)\cdot0,1}`;
    const finale = String.raw`\dfrac{10(5\left|x-2\right|+2(x-1))}{9\sqrt{10}(x-1)\left|x-2\right|(x+1)^2}`;
    expect(contoGiusto(foto, finale).ok).toBe(true);
    expect(contoGiusto(foto, finale.replace(String.raw`\left|x-2\right|`, '(x-2)')).ok).toBe(false);
  });
  it('conserva dalla trascrizione OCR il polinomio sotto la radice al denominatore', () => {
    const ocr = '(⁻³√(x^3-3x^2+3x-1)*1,6per+(∜(x^4-8x^3+24x^2-32x+16))^-1*0,6per)⁄(⁻²√(0,0_1per*(x^2+2x+1))*0,1)';
    const cleaned = groupRadicalNumerators(normalizeExpressionOcr(cleanAiExpression(ocr), true, {keepDivision: true}));
    const latex = printLatex(parseExpression(normalizeInput(cleaned)));
    const ast = parseExpression(normalizeInput(latex));
    expect(latex).toContain(String.raw`\sqrt[-2]`);
    expect(latex).toMatch(/\\sqrt\[-2\]\{[^]*x\^\{2\}[^]*\}/);
    expect(contoGiusto(latex, cleaned).ok).toBe(true);
    expect(ast.k).toBe('div');
  });
  it('conserva il fattore che nella foto è sotto la radice al denominatore', () => {
    const denominatore = String.raw`\sqrt[-2]{\dfrac{1}{90}\cdot(x^2+2x+1)}`;
    const formaCorretta = String.raw`\dfrac{\sqrt{90}}{\left|x+1\right|}`;
    const formaSenzaModulo = String.raw`\dfrac{\sqrt{90}}{x+1}`;
    expect(contoGiusto(denominatore, formaCorretta).ok).toBe(true);
    expect(contoGiusto(denominatore, formaSenzaModulo).ok).toBe(false);
    const ce = sezioneCondizioniEsistenza(denominatore);
    expect(ce?.boxes.map((b) => b.answerLatex)).toContain('-1');
  });
  it('respinge la precedente forma intermedia quando cambia segno a sinistra di 2', () => {
    const op = String.raw`\sqrt[-3]{(x-1)^3}\cdot\dfrac{5}{3}+\left(\sqrt[4]{(x-2)^4}\right)^{-1}\cdot\dfrac{2}{3}`;
    const sbagliata = String.raw`\dfrac{5}{3(x-1)}+\dfrac{2}{3(x-2)}`;
    const corretta = String.raw`\dfrac{5}{3(x-1)}+\dfrac{2}{3\left|x-2\right|}`;
    expect(verificaPerSostituzione(op, sbagliata)?.ok).toBe(false);
    expect(verificaPerSostituzione(op, corretta)?.ok).toBe(true);
  });
  it('non accetta un esercizio che elimina erroneamente le barre', () => {
    const candidato = {espressioneLatex: String.raw`\sqrt{(x-2)^2}`, sezioni:[{title:'RADICE',boxes:[{op:String.raw`\sqrt{(x-2)^2}`,answerLatex:'x-2',prompt:'Svolgo la radice.'}]}], risultatoFinaleLatex:'x-2'};
    expect(riparaEsercizio(candidato).esercizio).toBeNull();
  });
});


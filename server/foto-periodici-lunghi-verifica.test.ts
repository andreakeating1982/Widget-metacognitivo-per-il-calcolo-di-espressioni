import { describe, expect, it } from 'vitest';
import { contoGiusto, verificaPerSostituzione } from './costruisci';
import { verificaPerSostituzione as verificaClient } from '../client/src/lib/verificaSostituzione';
const S=String.raw;

describe('verifica esatta dei periodici nelle espressioni con radicali', () => {
  it.each([
    [S`\sqrt[6]{0,00\overline{1}*(x-1)^6}`,S`\sqrt[6]{\dfrac{(x-1)^6}{900}}`],
    [S`1,\overline{333}*\sqrt{(x+3)^2}`,S`\dfrac{4}{3}*|x+3|`],
    [S`2,\overline{111}*\sqrt[4]{(x-2)^4}`,S`\dfrac{19}{9}*|x-2|`],
    [S`1,3\overline{45}*\sqrt{(x+1)^2}`,S`\dfrac{74}{55}*|x+1|`],
    [S`0,\overline{3}*\sqrt{x^2}`,S`\dfrac{1}{3}*|x|`],
  ])('confronta esattamente il periodico e non perde le barre', (originale, equivalente) => {
    expect(contoGiusto(originale,equivalente).ok).toBe(true);
    expect(verificaPerSostituzione(originale,equivalente)?.ok).toBe(true);
    expect(verificaClient(originale,equivalente)).toBe(true);
  });
  it('conserva i valori assoluti nella foto e rigetta la semplificazione abusiva', () => {
    const original=S`\dfrac{\sqrt[-5]{x^{5}-5x^{4}+10x^{3}-10x^{2}+5x-1}\cdot1,\overline{333}+\left(\sqrt[4]{x^{4}+4x^{3}+6x^{2}+4x+1}\right)^{-1}\cdot0,\overline{3}}{\sqrt[-6]{0,00\overline{1}\cdot(x-1)^{6}}\cdot0,03}`;
    const corretta=S`\dfrac{(4\left|x+1\right|+x-1)\cdot100\left|x-1\right|}{9(x-1)\left|x+1\right|\sqrt[6]{900}}`;
    const errata=S`\dfrac{100(4\left|x+1\right|+x-1)}{9\left|x+1\right|\sqrt[6]{900}}`;
    expect(contoGiusto(original,corretta).ok).toBe(true);
    expect(contoGiusto(original,errata).ok).toBe(false);
    expect(contoGiusto(corretta,errata).ok).toBe(false);
  });
  it('non introduce approssimazioni sui decimali finiti e non confonde periodi differenti', () => {
    expect(contoGiusto(S`1,333*\sqrt{x^2}`,S`1,\overline{333}*|x|`).ok).toBe(false);
    expect(contoGiusto(S`0,0\overline{1}*\sqrt{x^2}`,S`0,00\overline{1}*|x|`).ok).toBe(false);
  });
});


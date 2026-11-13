/**
 * Conteggio degli ELEMENTI di un pezzo — limite «MAX 10 ELEMENTI ALLA VOLTA».
 *
 * REGOLA (decisione dell'utente): un pezzo può avere al massimo `MAX_PEZZO` elementi
 * (7/10: ridotto a 5; 21/10 giro 19: alzato a 10 su richiesta esplicita).
 * Si CONTANO numeri (una cifra = 1), lettere, segni (+ − · : =), radici (`\sqrt` = 1 + il radicando),
 * frazioni (`\frac` = 1 + numeratore e denominatore), le cifre degli esponenti e le parentesi
 * TONDE e QUADRE.
 * Le parentesi GRAFFE { } NON CONTANO: né quelle disegnate dall'utente (`{`, `\{`, `\lbrace`) né i
 * marcatori LaTeX di gruppo (`^{2}`); non contano i comandi di dimensione (`\left`, `\right`, `\big…`)
 * né gli spazi. Esempio: `{[(2)]}` vale 5 (`[ ( 2 ) ]`), non 7.
 *
 * Funzione PURA, usata dalla pagina (`addPiece`, `saveEditPiece`) e dal banco di prova
 * (`bench/cases.ts`): l'app e il banco applicano la STESSA regola.
 */

/** Massimo di elementi per pezzo. */
export const MAX_PEZZO = 10;

export function countElements(s: string): number {
  return (
    s
      // graffe come COMANDI e comandi di dimensione: non sono elementi
      .replace(/\\(?:left|right|lbrace|rbrace|[Bb]ig{1,2}[lr]?)(?![a-zA-Z])/g, "")
      .replace(/\\[{}]/g, "")
      // un segno o una radice = 1 elemento
      .replace(/\\(?:cdot|times|bullet|div|sqrt)/g, "#")
      // ogni altro comando (\frac, \sum, \alpha…) = 1 elemento
      .replace(/\\[a-zA-Z]+/g, "#")
      // marcatori: apice, graffe di gruppo/graffe disegnate, dollaro, backslash residui
      .replace(/[\\^{}$]/g, "")
      .replace(/\s+/g, "").length
  );
}

/** true se il pezzo rispetta il limite (le graffe non contano). */
export function pieceFitsLimit(s: string): boolean {
  return countElements(s) <= MAX_PEZZO;
}

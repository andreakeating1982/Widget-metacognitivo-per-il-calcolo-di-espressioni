/**
 * audioNotation.ts — normalizzazione della NOTAZIONE restituita dall'IA
 * per il dettato vocale (giro 25, da AUDIO-MATEMATICI).
 *
 * L'IA converte il dettato in notazione lineare; qui la portiamo nella forma
 * che il parser di lib/espressioni.ts (e la UI dell'app) si aspettano:
 *  - niente spazi (il parser li toglie comunque, ma i pezzi restano compatti
 *    come quelli riconosciuti a mano);
 *  - trattini unicode (− – —) → meno ASCII;
 *  - ÷ → : (divisione vera, richiesta esplicita dell'utente);
 *  - frazioni scritte con la barra «a/b» → frazione impilata «a⁄b»
 *    (U+2044): l'utente vuole le frazioni SEMPRE impilate e il parser lega
 *    ⁄ più strettamente di · e :, così «2⁄3·3⁄4» è (2:3)·(3:4).
 */
export function normalizeAudioNotation(notation: string): string {
  let s = (notation ?? "").trim();
  if (!s) return "";
  // meno unicode → ASCII (− U+2212, – en dash, — em dash)
  s = s.replace(/[−–—]/g, "-");
  // niente spazi
  s = s.replace(/\s+/g, "");
  // divisione vera: sempre i due punti (mai la barra)
  s = s.replace(/[÷]/g, ":");
  // frazioni «a/b» (numeri, decimali con virgola→già punto, o variabile
  // singola) → frazione impilata «a⁄b»; i due punti NON si toccano
  s = s.replace(
    /(\d(?:\.\d+)?|[a-z])\/(\d(?:\.\d+)?|[a-z])/g,
    (_m, a: string, b: string) => `${a}\u2044${b}`,
  );
  return s;
}

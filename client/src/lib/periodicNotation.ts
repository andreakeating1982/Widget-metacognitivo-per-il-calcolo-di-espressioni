/**
 * Porta le notazioni esplicite di un numero periodico alla forma interna
 * «1,\overline{3}». Non deduce mai un periodo da un decimale ordinario.
 *
 * Supporta il comando dell'utente (0,3per; 0,1_6per), i segni Unicode
 * combinanti U+0304/U+0305 e \bar/\overline dell'IA. Nel testo Unicode
 * ogni segno appartiene solo alla cifra immediatamente precedente:
 * 0,16̅ significa quindi antiperiodo 1 e periodo 6, non periodo 16.
 */
export function canonicalizePeriodicNotation(input: string): string {
  let s = input ?? "";
  // Variante LaTeX della virgola: 0{,}\overline{3}.
  s = s.replace(/(\d+)\s*\{,\}\s*(?=\d*\\(?:overline|bar)\s*\{)/gi, "$1,");
  // Comandi LaTeX espliciti, anche con punto decimale o \bar.
  s = s.replace(
    /(\d+)[,.](\d*)\\(?:overline|bar)\s*\{\s*(\d+)\s*\}/gi,
    (_m, intera: string, nonRipetuta: string, ripetuta: string) =>
      `${intera},${nonRipetuta}\\overline{${ripetuta}}`,
  );
  // I segni combinanti consecutivi individuano solo le cifre effettivamente
  // marcate, anche quando il periodo è formato da più di una cifra.
  s = s.replace(
    /(\d+)[,.](\d*)((?:\d[\u0304\u0305])+)/g,
    (_m, intera: string, nonRipetuta: string, marcate: string) =>
      `${intera},${nonRipetuta}\\overline{${marcate.replace(/[\u0304\u0305]/g, "")}}`,
  );
  // Se è stato riconosciuto solo un frammento marcato (senza la parte
  // intera/virgola), conserva comunque il segno invece di cancellarlo.
  s = s.replace(/((?:\d[\u0304\u0305])+)/g, (_m, marcate: string) =>
    `\\overline{${marcate.replace(/[\u0304\u0305]/g, "")}}`,
  );
  s = s.replace(
    /(\d+)[,.](?:(\d+)_)?(\d+)per(?![a-z])/gi,
    (_m, intera: string, nonRipetuta: string | undefined, ripetuta: string) =>
      `${intera},${nonRipetuta ?? ""}\\overline{${ripetuta}}`,
  );
  return s;
}

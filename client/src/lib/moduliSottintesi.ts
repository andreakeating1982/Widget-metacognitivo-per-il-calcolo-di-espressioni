/** Riscrittura del solo RAMO in cui il contenuto di OGNI modulo è >= 0.
 * La funzione non stabilisce le ipotesi: il chiamante deve estrarle con
 * `contenutiPerCondizioniDiSegno`, mostrarle e applicarle all'intera catena.
 * Mai usare questa proiezione come uguaglianza valida su tutto il dominio.
 * L'originale verificato e le sessioni archiviate restano invariati.
 */
export interface ScritturaConModuliSottintesi {
  latex: string;
  moduliOmissi: boolean;
  unSoloModuloIntero: boolean;
}

interface Delimitatore {
  start: number;
  end: number;
  tipo: "apre" | "chiude" | "simmetrico";
}

export function scritturaConModuliSottintesi(latex: string): ScritturaConModuliSottintesi {
  const invariato = (): ScritturaConModuliSottintesi => ({ latex, moduliOmissi: false, unSoloModuloIntero: false });
  if (!latex || (!latex.includes("|") && !/\\(?:lvert|rvert|vert)\b/.test(latex))) return invariato();

  // Distinguo i delimitatori espliciti \left|...\right| o \lvert...\rvert
  // dalle coppie di barre semplici. Con delimitatori irregolari non indovino.
  const pattern = /\\left\s*(?:\\(?:lvert|vert)\b|\|)|\\right\s*(?:\\(?:rvert|vert)\b|\|)|\\(?:lvert|rvert|vert)\b|(?<!\\)\|/g;
  const delimitatori: Delimitatore[] = [];
  for (const m of latex.matchAll(pattern)) {
    const token = m[0];
    const tipo: Delimitatore["tipo"] = /^\\left\b|^\\lvert\b/.test(token)
      ? "apre"
      : /^\\right\b|^\\rvert\b/.test(token)
        ? "chiude"
        : "simmetrico";
    delimitatori.push({ start: m.index!, end: m.index! + token.length, tipo });
  }
  if (delimitatori.length === 0) return invariato();

  const pila: Delimitatore[] = [];
  const coppie: Array<{ apertura: Delimitatore; chiusura: Delimitatore }> = [];
  for (const d of delimitatori) {
    const cima = pila[pila.length - 1];
    const chiude = d.tipo === "chiude" || (d.tipo === "simmetrico" && cima?.tipo === "simmetrico");
    if (!chiude) {
      pila.push(d);
      continue;
    }
    // Non accoppio una barra semplice con un \left o viceversa.
    if (!cima || (d.tipo === "chiude" && cima.tipo !== "apre") ||
        (d.tipo === "simmetrico" && cima.tipo !== "simmetrico")) return invariato();
    pila.pop();
    if (!latex.slice(cima.end, d.start).trim()) return invariato();
    coppie.push({ apertura: cima, chiusura: d });
  }
  if (pila.length || !coppie.length) return invariato();

  const primo = latex.search(/\S/);
  const ultimo = latex.trimEnd().length;
  const intera = coppie.find(c => c.apertura.start === primo && c.chiusura.end === ultimo);
  const sostituzioni = new Map<number, string>();
  for (const c of coppie) {
    // Il contenuto dell'intera risposta non ha bisogno di ulteriori parentesi.
    // Negli altri casi le parentesi sono necessarie per non cambiare la forma.
    const soloContenuto = c === intera;
    sostituzioni.set(c.apertura.start, soloContenuto ? "" : "\\left(");
    sostituzioni.set(c.chiusura.start, soloContenuto ? "" : "\\right)");
  }
  let proiezione = "";
  let da = 0;
  for (const d of delimitatori) {
    proiezione += latex.slice(da, d.start) + (sostituzioni.get(d.start) ?? "");
    da = d.end;
  }
  proiezione += latex.slice(da);
  return { latex: proiezione, moduliOmissi: true, unSoloModuloIntero: !!intera && coppie.length === 1 };
}


/** Estrae i contenuti di tutte le coppie, comprese quelle annidate. Le
 * condizioni sono esse stesse riscritte sotto le ipotesi dei moduli più
 * interni: |x+|y|| richiede y>=0 e x+y>=0. Null se la scrittura è ambigua:
 * in tal caso non si deve eseguire alcuna riscrittura condizionata. */
export function contenutiPerCondizioniDiSegno(latex: string): string[] | null {
  if (!latex || (!latex.includes("|") && !/\\(?:lvert|rvert|vert)\b/.test(latex))) return [];
  const pattern = /\\left\s*(?:\\(?:lvert|vert)\b|\|)|\\right\s*(?:\\(?:rvert|vert)\b|\|)|\\(?:lvert|rvert|vert)\b|(?<!\\)\|/g;
  const pila: Delimitatore[] = [];
  const contenuti: string[] = [];
  for (const m of latex.matchAll(pattern)) {
    const token = m[0];
    const tipo: Delimitatore["tipo"] = /^\\left\b|^\\lvert\b/.test(token) ? "apre"
      : /^\\right\b|^\\rvert\b/.test(token) ? "chiude" : "simmetrico";
    const d: Delimitatore = { start: m.index!, end: m.index! + token.length, tipo };
    const cima = pila[pila.length - 1];
    const chiude = tipo === "chiude" || (tipo === "simmetrico" && cima?.tipo === "simmetrico");
    if (!chiude) { pila.push(d); continue; }
    if (!cima || (tipo === "chiude" && cima.tipo !== "apre") ||
      (tipo === "simmetrico" && cima.tipo !== "simmetrico")) return null;
    pila.pop();
    const contenuto = latex.slice(cima.end, d.start).trim();
    if (!contenuto) return null;
    const convertito = scritturaConModuliSottintesi(contenuto);
    if ((contenuto.includes("|") || /\\(?:lvert|rvert|vert)\b/.test(contenuto)) && !convertito.moduliOmissi) return null;
    contenuti.push(convertito.latex);
  }
  if (pila.length || !contenuti.length) return null;
  return contenuti;
}


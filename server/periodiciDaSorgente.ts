/** Ripristino conservativo delle sole barre periodiche illeggibili restituite
 * dal generatore. La trascrizione confermata dallo studente è la fonte, non
 * si deduce mai un periodo dall'aspetto del numero.
 *
 * Se il modello scrive 1,\overline{3}33 al posto di 1,\overline{333}, la
 * prima forma non è un decimale periodico valido per il motore: i tre 3
 * restano identici ma alcune cifre sono fuori dalla barra. Il ripristino è
 * possibile SOLO se esiste UNA forma originale con esattamente quelle cifre.
 * In caso di fonti ambigue o cifre cambiate il candidato resta invariato e
 * il normale controllo lo respinge; tutte le verifiche matematiche restano. */
import { canonicalizePeriodicNotation } from "../client/src/lib/periodicNotation";

export function ripristinaPeriodiciDaSorgente(sorgente: string, testo: string): string {
  if (!sorgente || !testo) return testo;
  const originali = new Map<string, Set<string>>();
  const canonica = canonicalizePeriodicNotation(sorgente.replace(/(\d)\.(?=\d)/g, "$1,"));
  const pattern = /(\d+),(\d*)\\overline\s*\{\s*(\d+)\s*\}/g;
  for (const m of canonica.matchAll(pattern)) {
    const chiave = `${m[1]},${m[2]}${m[3]}`;
    const forme = originali.get(chiave) ?? new Set<string>();
    forme.add(`${m[1]},${m[2]}\\overline{${m[3]}}`);
    originali.set(chiave, forme);
  }
  return testo.replace(
    /(\d+)(?:,|\{,\})(\d*)\\(?:overline|bar)\s*\{\s*(\d+)\s*\}(\d+)/g,
    (intero, parte: string, ante: string, periodo: string, resto: string) => {
      const forme = originali.get(`${parte},${ante}${periodo}${resto}`);
      return forme?.size === 1 ? [...forme][0] : intero;
    },
  );
}

/** Applica il ripristino solo ai campi matematici, mai a frasi o metadati. */
export function ripristinaPeriodiciCandidato(sorgente: string, candidato: unknown): unknown {
  const math = new Set(["espressioneLatex", "op", "answerLatex", "extraLatex", "risultatoFinaleLatex"]);
  function visit(v: unknown, key = ""): unknown {
    if (typeof v === "string") return math.has(key) || key === "righeProgressive" ? ripristinaPeriodiciDaSorgente(sorgente, v) : v;
    if (Array.isArray(v)) return v.map(item => visit(item, key));
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, value]) => [k, visit(value, k)]));
    }
    return v;
  }
  return visit(candidato);
}


/**
 * Diagnostica dell'espressione della foto «ma_cos.png»:
 * (√(x²+6x+9) + ∛(x³−3x²+3x−1)) / √(x+7)
 * Verifica quali costruttori deterministici la accettano e se la
 * trascrizione fedele la riconosce. Non chiama l'IA.
 */
import { canonizzaEspressione, trascrizioneFedele } from "../server/costruisci";
import { costruisciRadiciNesime, costruisciRadicaliLetterali, costruisciCatenaEsatta, costruisciIndiceComune } from "../server/guida-radicali";
import { costruisciSommaFrazioniLetterali } from "../server/frazioniLetteraliGuidate";
import { costruisciFrazioniConiugate } from "../server/prodottiNotevoli";

const varianti = [
  "(√(x^2+6x+9)+∛(x^3-3x^2+3x-1)):√(x+7)",
  "(√(x²+6x+9)+∛(x³−3x²+3x−1))/√(x+7)",
  "(√(x^2+6x+9)+∛(x^3-3x^2+3x-1))/√(x+7)",
];

for (const v of varianti) {
  const canon = canonizzaEspressione(v.trim());
  const costruttori: Record<string, (s: string) => unknown> = {
    coniugate: costruisciFrazioniConiugate as unknown as (s: string) => unknown,
    sommaFrazioniLetterali: costruisciSommaFrazioniLetterali as unknown as (s: string) => unknown,
    radiciNesime: costruisciRadiciNesime as unknown as (s: string) => unknown,
    radicaliLetterali: costruisciRadicaliLetterali as unknown as (s: string) => unknown,
    catenaEsatta: costruisciCatenaEsatta as unknown as (s: string) => unknown,
    indiceComune: costruisciIndiceComune as unknown as (s: string) => unknown,
  };
  console.log("=== input:", JSON.stringify(v), "→ canonico:", JSON.stringify(canon));
  for (const [nome, fn] of Object.entries(costruttori)) {
    let candidato: unknown = null;
    try {
      candidato = fn(canon);
    } catch (e) {
      console.log(`  ${nome}: ECCEZIONE`, e instanceof Error ? e.message : e);
      continue;
    }
    if (candidato != null) {
      const latex = (candidato as { espressioneLatex?: string }).espressioneLatex ?? "(n/d)";
      const fedele = trascrizioneFedele(canon, latex);
      console.log(`  ${nome}: candidato OK, latex=${JSON.stringify(latex)}, trascrizioneFedele=${fedele}`);
    } else {
      console.log(`  ${nome}: null`);
    }
  }
  console.log("  trascrizioneFedele(canon, canon):", trascrizioneFedele(canon, canon));
}

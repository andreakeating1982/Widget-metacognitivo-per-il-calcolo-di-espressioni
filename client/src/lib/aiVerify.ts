/** VERIFICA IA DEI CONTI (25/10, richiesta utente: «implementa quella
 *  sezione con l'intelligenza artificiale in modo che fornisca sempre i
 *  conti in modo corretto secondo la filosofia generale dell'app»).
 *
 *  Architettura «l'IA propone, il motore dispone»:
 *   1. DETERMINISTICO (sempre, anche senza IA): auditConti() del motore —
 *      i passi «conto-vuoto» (interattivi ma senza operazioni, come il
 *      «(1/3) =» della segnalazione 25/10) diventano sola notazione.
 *   2. IA (se il server ha EASY_PEASY_API_KEY): la catena dei passi VISIBILI
 *      (mai le risposte attese dello studente, mai i dati personali) viene
 *      verificata da /api/ai/verify-steps; un passo segnalato errato viene
 *      corretto SOLO se la correzione propuesta dall'IA ha lo stesso valore
 *      del resto della catena (latexValue), altrimenti il passo viene
 *      SCARTATO — un conto sbagliato non si mostra mai.
 *   3. IA assente (503/rete/timeout): l'app resta ESATTAMENTE com'era.
 *
 *  Filosofia inviolata: il risultato del conto resta sempre allo studente;
 *  l'IA non genera passi nuovi e non scrive mai risultati al posto suo. */

import { auditConti, latexValue, type ExprStep } from "./espressioni";

export interface VerificaStepIA {
  i: number;
  ok: boolean;
  motivo?: string;
  correzione?: string;
}

export interface EsitoVerificaIA {
  ok: boolean;
  steps: VerificaStepIA[];
}

export interface StepPerVerifica {
  kind: string;
  latex: string;
  detail?: string;
  opLatex?: string;
}

/** Chiama /api/ai/verify-steps; null = IA non disponibile (l'app va avanti
 *  com'è). Timeout lato client: 20 s. */
export async function verifyConti(
  expression: string,
  steps: ExprStep[],
): Promise<EsitoVerificaIA | null> {
  try {
    const res = await fetch("/api/ai/verify-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expression,
        steps: steps.map((s, i) => ({
          i,
          kind: s.kind,
          latex: s.latex,
          detail: s.detail ?? "",
          opLatex: s.opLatex ?? "",
        })),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.steps)) return null;
    const parsed: VerificaStepIA[] = [];
    for (const x of data.steps) {
      if (typeof x?.i !== "number") continue;
      parsed.push({
        i: x.i,
        ok: x.ok !== false,
        motivo: typeof x.motivo === "string" ? x.motivo.slice(0, 300) : undefined,
        correzione: typeof x.correzione === "string" ? x.correzione.slice(0, 600) : undefined,
      });
    }
    return { ok: !!data.ok, steps: parsed };
  } catch {
    return null; // rete lenta, 503, timeout: nessun cambiamento
  }
}

/** Stesso valore (tolleranza relativa, come auditConti). */
const stessoValore = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Applica la verifica e restituisce la catena da mostrare.
 *  - senza violazioni e senza IA → STESSO array (nessun re-render);
 *  - conto-vuoto deterministico → il passo resta ma come sola notazione;
 *  - passo segnalato dall'IA con correzione VALIDA (stesso valore della
 *    catena) → stato corretto, il passo diventa notazione (il conto vero
 *    lo ricalcola il motore al passo successivo);
 *  - passo segnalato senza correzione valida → SCARTATO (mai conti sbagliati);
 *  - se l'IA segnala troppi passi (> metà) la si considera inaffidabile e si
 *    ignora (resta il deterministico): mai distruggere una catena buona. */
export function applicaVerifica(
  steps: ExprStep[],
  esito: EsitoVerificaIA | null,
): ExprStep[] {
  // 1) DETERMINISTICO: conto-vuoto → sola notazione (niente input falso)
  let out: ExprStep[] = steps;
  const vuoti = auditConti(steps).filter((v) => v.tipo === "conto-vuoto");
  if (vuoti.length > 0) {
    const idxVuoti = new Set(vuoti.map((v) => v.indice));
    out = steps.map((s, i) =>
      idxVuoti.has(i) ? { ...s, opLatex: undefined, answer: undefined } : s,
    );
  }
  if (!esito) return out;

  // 2) IA: troppi errori segnalati → inaffidabile, si ignora
  const flag = new Map<number, VerificaStepIA>();
  for (const x of esito.steps) if (x && x.ok === false) flag.set(x.i, x);
  if (flag.size === 0) return out;
  if (flag.size * 2 > out.length) return out;

  const ultimoVal = latexValue(out[out.length - 1].latex);
  const result: ExprStep[] = [];
  for (let i = 0; i < out.length; i++) {
    const f = flag.get(i);
    if (!f) {
      result.push(out[i]);
      continue;
    }
    const corr = (f.correzione ?? "").trim();
    let accettata = false;
    if (corr) {
      const vc = latexValue(corr);
      if (vc !== null) {
        // la correzione deve combaciare col valore del passo successivo
        // oppure col valore finale della catena (il motore fa da giudice)
        const next = out[i + 1] ? latexValue(out[i + 1].latex) : null;
        const target = next !== null ? next : ultimoVal;
        accettata = target !== null && stessoValore(vc, target);
      }
    }
    if (accettata) {
      // stato corretto: la catena resta intuta col passo riparato
      result.push({ ...out[i], latex: corr, opLatex: undefined, answer: undefined });
    }
    // else: niente correzione fidata → il passo sbagliato NON si mostra affatto
  }
  // guardia: se la catena sopravvissuta è troppo corta, l'IA aveva torto —
  // resta il deterministico (mai distruggere un'esercitazione buona)
  if (result.length < Math.max(2, out.length - flag.size)) return out;
  return result;
}

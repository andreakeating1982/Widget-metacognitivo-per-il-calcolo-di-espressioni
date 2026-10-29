/** FRATTE EXERCISE (giro 21) — percorso dedicato alle espressioni con
 *  l'incognita al denominatore:
 *  1. CAMPO DI ESISTENZA: per ogni denominatore l'app mostra la condizione
 *     «denominatore = 0» e lo studente trova i valori da escludere (input guidato,
 *     feedback immediato) — l'app NON le calcola mai da sola;
 *  2. SVOLGIMENTO: i passi di riduzione razionale (una operazione per
 *     volta, frazioni impilate, mai decimali);
 *  3. RISULTATO finale + RICOPIA SUL QUADERNO.
 *
 *  Il flusso polinomiale (EspressioniExercise) resta INTATTO: questo
 *  componente viene montato solo quando `isFratte(ast)`. */

import { useMemo, useState } from "react";
import katex from "katex";
import { isUserSumCorrect } from "@/lib/espressioni";
import type { FrattaAnalysis } from "@/lib/fratte";

function katexHtml(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, strict: false });
  } catch {
    return latex;
  }
}

interface CeInputKey {
  item: number;
  root: number;
}

export function FratteExercise({
  fratta,
  studentLabel,
  onNew,
}: {
  fratta: FrattaAnalysis;
  studentLabel: string;
  onNew: () => void;
}) {
  /** Valori digitati dallo studente per le radici dei denominatori */
  const [ceValues, setCeValues] = useState<Record<string, string>>({});
  /** Feedback per ogni radice: null = da verificare, true/false = esito */
  const [ceFeedback, setCeFeedback] = useState<Record<string, boolean>>({});
  /** GIRO 32: condizioni di esistenza «prese in carico» dallo studente.
   *  Per i denominatori che l'app NON sa risolvere esattamente (grado ≥ 3,
   *  discriminante non quadrato, più variabili) non c'è un input da
   *  verificare: lo studente deve comunque DICHIARARE di averle ricavate
   *  col libro («HO RICAVATO QUESTA CONDIZIONE») prima di vedere lo
   *  svolgimento. La chiave è `nota-${i}`. */
  const [ceAcked, setCeAcked] = useState<Record<string, boolean>>({});

  /** GIRO 31 (progressività assoluta, sentinella dello svolgimento):
   *  regola centrale — «mai il passo dopo prima del risultato corretto».
   *  frattaDoneCount = numero di conti dello svolgimento SVOLTI dallo
   *  studente (passo 0 = l'espressione inserita, sempre visibile).
   *  - i conti da svolgere si leggono nell'ordine (CONTO i DI n + s.op);
   *  - lo stato di riduzione N si mostra solo dopo la convalida del conto N;
   *  - i valori calcolati (s.computed: mcm, denominatori…) si rivelano solo
   *    dopo la convalida del conto a cui appartengono.
   *  Risultato finale, RICOPIA e (nella pagina) il PDF restano bloccati
   *  finché l'ultimo conto non è convalidato. */
  /** Tutte le radici da far calcolare allo studente (l'app non le calcola mai da sola) */
  const ceInputs = useMemo(() => {
    const list: { key: string; item: number; root: number; opLatex: string; value: number }[] = [];
    fratta.ce.forEach((c, i) => {
      if (c.exact && c.roots.length > 0) {
        c.roots.forEach((r, j) => {
          list.push({
            key: `${i}-${j}`,
            item: i,
            root: j,
            opLatex: `\\left(${c.denLatex}\\right) = 0`,
            value: r.n / r.d,
          });
        });
      }
    });
    return list;
  }, [fratta]);

  /* GIRO 32: lo svolgimento si sblocca solo quando TUTTE le condizioni di
     esistenza sono state calcolate dallo studente: radici esatte verificate
     (input) + note «col libro» dichiarate lette («HO RICAVATO»). Le note
     informative ad esclusione nulla (denominatore numerico, Δ negativo)
     richiedono comunque la dichiarazione: è il patto CE-prima. */
  const allCeDone =
    ceInputs.every((inp) => ceFeedback[inp.key] === true) &&
    fratta.ce.every((c, i) =>
      c.exact && c.roots.length > 0 ? true : !!ceAcked[`nota-${i}`],
    );

  /* GIRO 31 (sentinella dello svolgimento): frattaDoneCount = numero di
     conti SVOLTI dallo studente (passo 0 = espressione inserita, sempre
     visibile). Stato N visibile solo dopo la convalida del conto N−1. */
  const [frattaDoneCount, setFrattaDoneCount] = useState(0);

  const checkCe = (key: string, raw: string, expected: number) => {
    const normalized = raw.trim().replace(",", ".");
    const v = parseFloat(normalized);
    if (normalized === "" || Number.isNaN(v)) {
      setCeFeedback((f) => ({ ...f, [key]: false }));
      return;
    }
    const ok = isUserSumCorrect(v, { n: Math.round(expected * 100), d: 100 });
    setCeFeedback((f) => ({ ...f, [key]: ok }));
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Intestazione */}
      <div className="p-4 rounded-xl bg-card/60 border border-border text-center space-y-2">
        <p className="text-xs tracking-widest text-muted-foreground font-semibold">ESPRESSIONE FRATTA (INCOGNITA AL DENOMINATORE)</p>
        {studentLabel && <p className="text-sm text-muted-foreground">{studentLabel}</p>}
        <div className="inline-block px-4 py-2 rounded-lg bg-muted font-mono text-lg" dangerouslySetInnerHTML={{ __html: katexHtml(fratta.originalLatex) }} />
      </div>

      {/* PASSO 1 — CAMPO DI ESISTENZA */}
      <div className="p-5 rounded-xl bg-card border-2 border-amber-300/60 space-y-4">
        <p className="text-base font-bold text-primary">1. Campo di esistenza</p>
        <p className="text-sm text-foreground/90 leading-relaxed">
          Un'espressione fratta esiste solo se i <b>denominatori non fanno zero</b>.
          Per ogni denominatore, trova i valori che rendono vera l'uguaglianza «denominatore = 0»: i valori trovati
          sono i numeri <b>da escludere</b>.
        </p>

        {fratta.ce.map((c, i) => (
          <div key={i} className="rounded-lg border border-border bg-background/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Denominatore:</span>
              <span className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(c.denLatex) }} />
            </div>
            {c.exact && c.roots.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-mono">
                  Risolvi:{" "}
                  <span dangerouslySetInnerHTML={{ __html: katexHtml(`\\left(${c.denLatex}\\right) = 0`) }} />
                </p>
                {c.roots.map((r, j) => {
                  const key = `${i}-${j}`;
                  const fb = ceFeedback[key];
                  const val = ceValues[key] ?? "";
                  const multiple = c.roots.length > 1;
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-2">
                      <label className="text-sm font-semibold" htmlFor={`ce-${key}`}>
                        {multiple ? (j === 0 ? "Prima soluzione:" : "Seconda soluzione:") : "Soluzione:"}
                      </label>
                      <span className="font-mono text-sm">x =</span>
                      <input
                        id={`ce-${key}`}
                        type="text"
                        inputMode="decimal"
                        value={val}
                        disabled={fb === true}
                        onChange={(e) => {
                          setCeValues((v) => ({ ...v, [key]: e.target.value }));
                          setCeFeedback((f) => ({ ...f, [key]: false }));
                        }}
                        onBlur={(e) => checkCe(key, e.target.value, r.n / r.d)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") checkCe(key, (e.target as HTMLInputElement).value, r.n / r.d);
                        }}
                        aria-label={`Valore che annulla ${c.denLatex}${multiple ? `, soluzione ${j + 1}` : ""}`}
                        className={`w-24 h-10 px-3 rounded-lg border-2 bg-background text-foreground font-mono text-base focus:outline-none disabled:opacity-70 ${
                          fb === true ? "border-green-600 bg-green-50" : fb === false ? "border-red-400" : "border-border"
                        }`}
                      />
                      {fb === true && <span className="text-green-700 font-bold text-sm" role="status">✓ Esatto: questo valore va escluso</span>}
                      {fb === false && val !== "" && <span className="text-red-600 text-sm">Non è la soluzione: riprova.</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {/* GIRO 32: OGNI nota richiede la dichiarazione dello studente
                («HO RICAVATO QUESTA CONDIZIONE») prima dello svolgimento:
                l'aiuto sulle CE viene sempre prima, al di là del tipo di
                denominatore. Dopo la dichiarazione resta il ✓ verde. */}
            {!c.exact && c.note && !ceAcked[`nota-${i}`] && (
              <div className="space-y-2">
                <p className="text-sm text-foreground/80" role="note">
                  ⚠️ {c.note}. Finché non ricavi questa condizione, resta la condizione{" "}
                  <span dangerouslySetInnerHTML={{ __html: katexHtml(`\\left(${c.denLatex}\\right) \\ne 0`) }} />.
                </p>
                <button
                  onClick={() => setCeAcked((v) => ({ ...v, [`nota-${i}`]: true }))}
                  className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold tracking-widest transition-colors"
                >
                  ✓ HO RICAVATO QUESTA CONDIZIONE (COL LIBRO)
                </button>
              </div>
            )}
            {!c.exact && c.note && ceAcked[`nota-${i}`] && (
              <p className="text-sm text-green-800 font-semibold" role="status">✓ Condizione ricavata: resta la condizione{" "}
                <span dangerouslySetInnerHTML={{ __html: katexHtml(`\\left(${c.denLatex}\\right) \\ne 0`) }} />.
              </p>
            )}
            {c.exact && c.roots.length === 0 && c.note && !ceAcked[`nota-${i}`] && (
              <div className="space-y-2">
                <p className="text-sm text-green-800" role="note">✓ {c.note}.</p>
                <button
                  onClick={() => setCeAcked((v) => ({ ...v, [`nota-${i}`]: true }))}
                  className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold tracking-widest transition-colors"
                >
                  ✓ HO CAPITO: NESSUN VALORE DA ESCLUDERE
                </button>
              </div>
            )}
            {c.exact && c.roots.length === 0 && c.note && ceAcked[`nota-${i}`] && (
              <p className="text-sm text-green-800 font-semibold" role="status">✓ {c.note}.</p>
            )}
          </div>
        ))}

        {/* Campo di esistenza completo: solo quando lo studente ha finito */}
        {allCeDone && fratta.ceLatex && (
          <div className="rounded-lg bg-green-50 border border-green-300 p-4 text-center animate-pop-in" role="status">
            <p className="text-sm font-bold text-green-800 mb-1">CAMPO DI ESISTENZA:</p>
            <p className="font-mono text-lg text-green-900" dangerouslySetInnerHTML={{ __html: katexHtml(fratta.ceLatex) }} />
          </div>
        )}
        {ceInputs.length > 0 && !allCeDone && (
          <p className="text-xs text-muted-foreground text-center">
            Trova tutti i valori da escludere per vedere il campo di esistenza e lo svolgimento.
          </p>
        )}
      </div>

      {/* PASSO 2 — SVOLGIMENTO (dopo il campo di esistenza) */}
      {allCeDone && (
        <div className="p-5 rounded-xl bg-card border border-border space-y-4 animate-pop-in">
          <p className="text-base font-bold text-primary">2. Svolgimento passo per passo</p>
          {/* GIRO 31: la sentinella nasconde ogni stato con risultati finché
              il conto precedente non è convalidato (mai il passo dopo prima
              del risultato corretto). */}
          <ol className="space-y-3">
            {fratta.steps.map((s, i) => {
              if (i > frattaDoneCount) return null;
              const done = i < frattaDoneCount;
              const nConti = fratta.steps.length - 1;
              return (
                <li key={i} className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
                  {i > 0 && !done ? (
                    <div className="space-y-3 text-center">
                      <p className="text-base font-bold text-primary">
                        CONTO {i} DI {nConti}: {s.op ?? s.detail}
                      </p>
                      <p className="text-sm text-foreground/80">
                        Svolgilo sul quaderno, poi premi per vedere il passaggio successivo.
                      </p>
                      <button
                        onClick={() => setFrattaDoneCount(i)}
                        className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold tracking-widest transition-colors"
                      >
                        ✓ HO SVOLTO QUESTO CONTO
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto text-center">
                      <span className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(s.latex) }} />
                    </div>
                  )}
                  {i > 0 && done && s.computed && (
                    <p className="text-xs text-muted-foreground text-center">{s.computed}</p>
                  )}
                  {i > 0 && done && !s.computed && s.detail && (
                    <p className="text-xs text-muted-foreground text-center">{s.detail}</p>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Risultato finale + RICOPIA: SOLO dopo l'ultimo conto (la
              sentinella frattaDoneCount li include entrambi). */}
          {frattaDoneCount >= fratta.steps.length - 1 && (
            <>
              <div className="p-4 rounded-lg bg-muted/60 border border-border text-center space-y-2">
                <p className="text-sm font-bold text-primary">RISULTATO FINALE:</p>
                <p className="font-mono text-xl font-bold text-primary" dangerouslySetInnerHTML={{ __html: katexHtml(fratta.finalLatex) }} />
                {fratta.finalIsRational && (
                  <p className="text-xs text-muted-foreground">
                    Il risultato è una frazione: vale solo per i valori del campo di esistenza.
                  </p>
                )}
              </div>
              <div className="rounded-xl border-2 border-dashed border-primary/50 p-4 space-y-2 text-center notebook-content">
                <p className="text-xs font-bold tracking-widest text-primary">RICOPIA SUL QUADERNO:</p>
                <p className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(fratta.originalLatex) }} />
                {fratta.ceLatex && (
                  <>
                    <p className="text-xs font-bold tracking-widest text-primary">CAMPO DI ESISTENZA:</p>
                    <p className="font-mono text-base" dangerouslySetInnerHTML={{ __html: katexHtml(fratta.ceLatex) }} />
                  </>
                )}
                <p className="text-xs font-bold tracking-widest text-primary">RISULTATO:</p>
                <p className="font-mono text-lg font-bold text-primary" dangerouslySetInnerHTML={{ __html: katexHtml(fratta.finalLatex) }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Nuovo esercizio */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onNew}
          className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-widest transition-all shadow-sm"
        >
          ↔ NUOVO ESERCIZIO
        </button>
      </div>
    </div>
  );
}

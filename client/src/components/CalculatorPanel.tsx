import { useEffect, useCallback } from 'react';

const DESMOS_URL = 'https://www.desmos.com/scientific?lang=it';

/**
 * Pannello CALCOLATRICE — versione "nuova scheda" (26/10).
 * Desmos blocca l'incorporamento in iframe («refused to connect») in ogni
 * ambiente, quindi il pulsante 🧮 CALCOLATRICE (NumberInputCanvas) apre la
 * VERA Desmos in una NUOVA SCHEDA direttamente nel gestore del clic
 * (gesture utente → nessun blocco pop-up) e mostra qui solo un PROMEMORIA.
 * - L'app non naviga MAI: esercizio, canvas, campi e passaggi restano montati
 *   e intatti; lo studente torna sulla scheda dell'app e riprende esattamente
 *   dove si era interrotto, poi chiude il promemoria (o con ESC).
 * - Il link «RIAPRI LA CALCOLATRICE ↗» serve se la scheda è stata chiusa per
 *   sbaglio o se il browser ha bloccato l'apertura.
 */
export default function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Calcolatrice aperta in una nuova scheda"
      data-testid="calculator-overlay"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#efebe9] p-6 text-center shadow-2xl lf-dsa">
        <div className="text-4xl" aria-hidden="true">
          🧮
        </div>
        <h2 className="mt-2 text-lg font-bold text-primary">
          CALCOLATRICE APERTA IN UNA NUOVA SCHEDA
        </h2>
        {/* (27/10, richiesta utente) testo breve; icona, titolo in grassetto e
            i due pulsanti restano; il marrone è quello dei pulsanti dell'app */}
        <p className="mt-3 text-base text-primary">
          Quando hai finito con la calcolatrice, premi il pulsante sotto
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground shadow transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Chiudi il promemoria e torna all'esercizio"
            data-testid="calculator-close"
          >
            ← TORNA ALL'ESERCIZIO
          </button>
          <a
            href={DESMOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-primary underline decoration-primary/60 underline-offset-2 hover:text-primary/80"
            data-testid="calculator-newtab-link"
          >
            RIAPRI LA CALCOLATRICE ↗
          </a>
        </div>
      </div>
    </div>
  );
}

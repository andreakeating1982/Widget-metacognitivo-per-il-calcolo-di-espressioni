import { useEffect, useState } from "react";
import { AlignJustify, Contrast, Ruler, Type, Volume2 } from "lucide-react";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useReadAloud } from "@/hooks/useReadAloud";

/**
 * Barra di accessibilità — 5 moduli: FONT, INTERLINEA, RIGHELLO, MODALITÀ, ASCOLTO.
 *
 * Colori IDENTICI alla barra di riferimento (stile Cornice Universale), rilevati
 * dai pixel reali della foto:
 *   - barra:        bianco caldo #fdfbf8, bordo #dedbd6, ombra morbida
 *   - capsule:      crema #f5f0e6, SENZA bordo (il contrasto col bianco caldo
 *                   della barra le separa; intervallo tra capsule ≈ 6px)
 *   - pulsanti:     trasparenti (mostrano il crema della capsula) con bordo
 *                   sottile #dedbd6 e testo #2e2118 — NESSUNA pillola bianca
 *   - testo/icone:  #2e2118 (marrone scuro caldo)
 *   - anello focus: #b71c1c (solo navigazione da tastiera, non nella foto)
 *
 * Ogni gruppo (etichetta + comandi) è un blocco unico "whitespace-nowrap":
 * l'etichetta NON scende mai sotto i propri pulsanti, anche quando la barra
 * si restringe (i gruppi vanno a capo come blocchi interi).
 *
 * ♿ ACCESSIBILITÀ PER SCREEN READER (fix: "i pulsanti della barra non vengono
 * letti"):
 *   1. Ogni icona lucide è decorativa → `aria-hidden="true"` (lucide NON lo
 *      mette di default: senza, lo screen reader può annunciare "immagine" o
 *      leggere i path degli SVG, confondendo la navigazione).
 *   2. Ogni capsula è un `role="group"` con `aria-label` descrittivo: lo
 *      screen reader annuncia "Gruppo Font", "Gruppo Ascolto" ecc. e i
 *      pulsanti interni vengono letti con il loro contesto.
 *   3. Il pulsante ASCOLTO ha nel nome accessibile la parola "Ascolto"
 *      ("Ascolto: leggi il testo ad alta voce" / "Ascolto: interrompi la
 *      lettura ad alta voce"): un alunno cieco che naviga per pulsanti lo
 *      trova subito come "Ascolto", insieme allo stato (aria-pressed).
 *   4. Descrizione introduttiva `sr-only` all'inizio della barra: viene letta
 *      dagli screen reader in modalità browse e dalla lettura vocale, e
 *      annuncia l'esistenza di tutti i comandi (compreso ASCOLTO).
 *   5. Live region `role="status"` all'avvio: appena l'app carica, lo screen
 *      reader annuncia "Barra di accessibilità disponibile. Usa il pulsante
 *      Ascolto per la lettura ad alta voce" — così un alunno completamente
 *      cieco sa subito che il pulsante ASCOLTO esiste.
 *   NOTA: la funzione "Leggi ad alta voce" del browser (es. Edge) salta per
 *   progettazione gli elementi interattivi (pulsanti): per un alunno cieco lo
 *   strumento corretto è uno screen reader vero (NVDA, JAWS, VoiceOver,
 *   TalkBack), per il quale la barra è ora completamente annunciabile.
 */
export function AccessibilityToolbar() {
  const acc = useAccessibility();
  const readAloud = useReadAloud();
  const [annuncio, setAnnuncio] = useState("");

  // ♿ Annuncio all'avvio: informa subito un utente cieco della presenza della
  // barra e del pulsante ASCOLTO (ritardo breve: attende che l'app sia pronta).
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnuncio(
        "Barra di accessibilità disponibile. Usa il pulsante Ascolto per la lettura ad alta voce del testo."
      );
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // Capsula gruppo: crema, senza bordo (come nella foto)
  const groupCls =
    "flex items-center gap-1 whitespace-nowrap rounded-lg bg-[#f5f0e6] px-2 py-1";
  // Etichetta: maiuscola, compatta, marrone scuro caldo
  const labelCls =
    "flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#2e2118]";
  // Pulsante: trasparente sulla capsula, bordo sottile grigio caldo, testo scuro
  const btnCls =
    "grid h-6 min-w-6 place-items-center rounded-md border border-[#dedbd6] bg-transparent px-1 text-[11px] font-bold text-[#2e2118] transition-colors hover:bg-white/40 focus-visible:outline-3 focus-visible:outline-[#b71c1c]";
  // Stato attivo: stesso stile della foto (nessuna pillola bianca);
  // lo stato è comunicato dal testo (ON/OFF, Contrasto/Normale, Stop/Leggi)
  const activeBtnCls =
    "grid h-6 min-w-6 place-items-center rounded-md border border-[#dedbd6] bg-transparent px-1 text-[11px] font-bold text-[#2e2118] transition-colors hover:bg-white/40 focus-visible:outline-3 focus-visible:outline-[#b71c1c]";

  return (
    <>
      {/* ♿ Descrizione introduttiva (nascosta visivamente, letta dagli screen
          reader e dalla lettura vocale in modalità browse) */}
      <span className="sr-only">
        Barra di accessibilità: comandi per Font, Interlinea, Righello,
        Modalità e Ascolto. Il pulsante Ascolto legge il testo ad alta voce.
      </span>

      <div
        role="toolbar"
        aria-label="Barra di accessibilità: font, interlinea, righello, modalità e ascolto"
        className="relative z-10 mx-auto mb-1 mt-2 flex w-fit max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-[#dedbd6] bg-[#fdfbf8] px-2.5 py-2 shadow-lg"
      >
        {/* FONT: dimensione del testo */}
        <div role="group" aria-label="Font: dimensione del testo" className={groupCls}>
          <span className={labelCls}>
            <Type className="h-3 w-3" aria-hidden="true" />
            Font
          </span>
          <button
            type="button"
            onClick={() => acc.setFontScale(acc.fontScale - 0.1)}
            className={btnCls}
            aria-label="Riduci la dimensione del testo"
            title="Riduci il testo"
          >
            A−
          </button>
          <span
            className="min-w-[2.6rem] text-center text-[11px] font-bold text-[#2e2118]"
            aria-live="polite"
          >
            {Math.round(acc.fontScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => acc.setFontScale(acc.fontScale + 0.1)}
            className={btnCls}
            aria-label="Aumenta la dimensione del testo"
            title="Ingrandisci il testo"
          >
            A+
          </button>
        </div>

        {/* INTERLINEA */}
        <div role="group" aria-label="Interlinea: spazio tra le righe" className={groupCls}>
          <span className={labelCls}>
            <AlignJustify className="h-3 w-3" aria-hidden="true" />
            Interlinea
          </span>
          <button
            type="button"
            onClick={acc.cycleLineHeight}
            className={btnCls}
            aria-label="Cambia l'interlinea del testo"
            title="Cambia l'interlinea"
          >
            {acc.lineHeight.toFixed(1).replace(".", ",")}
          </button>
        </div>

        {/* RIGHELLO: banda di lettura che segue il mouse */}
        <div role="group" aria-label="Righello: guida di lettura" className={groupCls}>
          <span className={labelCls}>
            <Ruler className="h-3 w-3" aria-hidden="true" />
            Righello
          </span>
          <button
            type="button"
            onClick={acc.toggleRuler}
            className={acc.ruler ? activeBtnCls : btnCls}
            aria-pressed={acc.ruler}
            aria-label="Attiva o disattiva il righello di lettura"
            title="Righello di lettura"
          >
            {acc.ruler ? "ON" : "OFF"}
          </button>
        </div>

        {/* MODALITÀ: normale / alto contrasto */}
        <div role="group" aria-label="Modalità: normale o alto contrasto" className={groupCls}>
          <span className={labelCls}>
            <Contrast className="h-3 w-3" aria-hidden="true" />
            Modalità
          </span>
          <button
            type="button"
            onClick={acc.cycleMode}
            className={acc.mode === "contrasto" ? activeBtnCls : btnCls}
            aria-pressed={acc.mode === "contrasto"}
            aria-label="Cambia la modalità di lettura"
            title="Modalità di lettura"
          >
            {acc.mode === "contrasto" ? "Contrasto" : "Normale"}
          </button>
        </div>

        {/* ASCOLTO: lettura ad alta voce (text-to-speech) per DSA */}
        <div role="group" aria-label="Ascolto: lettura ad alta voce" className={groupCls}>
          <span className={labelCls}>
            <Volume2 className="h-3 w-3" aria-hidden="true" />
            Ascolto
          </span>
          <button
            type="button"
            onClick={readAloud.toggle}
            className={readAloud.speaking ? activeBtnCls : btnCls}
            aria-pressed={readAloud.speaking}
            aria-label={
              readAloud.speaking
                ? "Ascolto: interrompi la lettura ad alta voce"
                : "Ascolto: leggi il testo ad alta voce"
            }
            title={readAloud.speaking ? "Interrompi la lettura" : "Leggi ad alta voce"}
          >
            {readAloud.speaking ? "Stop" : "Leggi"}
          </button>
        </div>
      </div>

      {/* ♿ Live region: annuncia all'avvio la disponibilità della barra e del
          pulsante ASCOLTO (nascosta visivamente, letta dagli screen reader) */}
      <span role="status" aria-live="polite" className="sr-only">
        {annuncio}
      </span>
    </>
  );
}

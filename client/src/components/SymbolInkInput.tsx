/** (26/10) SYMBOLIC INK INPUT — canvas di scrittura a mano per i RISULTATI
 *  CON NUMERI E LETTERE (es. 22a^3b, 3x/4, a^2) dei passi «da tastiera»
 *  (GIRO 30). Finora quei passi avevano SOLO il campo tastiera: chi scrive
 *  a mano non poteva inserire il risultato.
 *
 *  Filosofia invariata: il canvas TRASCRIVE SOLO ciò che lo studente ha
 *  scritto (IA vision, soccorso ONNX statico) — NON calcola mai. Il testo
 *  trascritto riempie il campo del passo; lo studente lo CONTROLLA e preme
 *  VERIFICA. Nessuna conferma automatica. */
import { useCallback, useState } from "react";
import { MathDrawCanvas, type Stroke } from "@/components/MathDrawCanvas";
import { useMathRecognition } from "@/hooks/useMathRecognition";
import { aiTranscribeImage, AiUnavailableError, strokesToDataUrl } from "@/lib/aiTranscribe";

/** LaTeX del modello statico (soccorso) → notazione del widget.
 *  MAI valutare: solo una resa leggibile per il campo del passo. */
export function latexToNotation(latex: string): string {
  let s = (latex ?? "").trim();
  if (!s) return "";
  s = s.replace(/\\left|\\right|\\displaystyle|\\!|\\,|\\;/g, "");
  s = s.replace(/\\cdot/g, "·").replace(/\\times/g, "·").replace(/\\div/g, ":");
  // \frac{a}{b} → a/b (annidamento non gestito: soccorso raro)
  s = s.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2");
  // esponenti con graffe: ^{3} → ^3
  s = s.replace(/\^\s*\{([^{}]*)\}/g, "^$1");
  // radici: \sqrt{x} → √(x), \sqrt[3]{x} → ∛(x)
  s = s.replace(/\\sqrt\s*\[\s*([0-9])\s*\]\s*\{([^{}]*)\}/g, (_m, n, r) =>
    n === "3" ? `∛(${r})` : n === "4" ? `∜(${r})` : `√(${r})`);
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
  // comandi residui e graffe
  s = s.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
  return s.replace(/\s+/g, "").trim();
}

interface SymbolInkInputProps {
  /** Testo trascritto → riempie il campo del passo (lo studente verifica). */
  onText: (t: string) => void;
  disabled?: boolean;
}

export function SymbolInkInput({ onText, disabled = false }: SymbolInkInputProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { recognize } = useMathRecognition();

  const riconosci = useCallback(async () => {
    if (strokes.length === 0 || busy || disabled) return;
    setBusy(true);
    setMsg(null);
    let text = "";
    try {
      const dataUrl = strokesToDataUrl(strokes);
      /* risultati con lettere: MAI il bias «nel dubbio cifra» */
      const ai = await aiTranscribeImage(dataUrl, "ink", "lettera");
      text = (ai ?? "").replace(/\$/g, "").trim();
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) {
        // L'IA ha risposto ma non è utilizzabile: niente invenzioni.
        setMsg("L'IA non ha letto bene: riscrivi più grande e chiaro");
        setBusy(false);
        return;
      }
      // IA non raggiungibile: soccorso col modello statico locale.
      try {
        const r = await recognize(strokes, "expression");
        text = r?.latex ? latexToNotation(r.latex) : "";
      } catch {
        text = "";
      }
    }
    if (text && !text.includes("?")) {
      onText(text);
      /* messaggio di riconoscimento PICCOLO, rosso e NON in grassetto
         (preferenza 25/10) */
      setMsg(`Trascritto: ${text} — controlla e premi VERIFICA`);
      setStrokes([]);
    } else {
      setMsg("Non riconosco: riscrivi più grande e chiaro");
    }
    setBusy(false);
  }, [strokes, busy, disabled, onText, recognize]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3 space-y-2">
      <p className="text-sm text-center text-foreground/90">
        OPPURE SCRIVI A MANO IL RISULTATO (numeri e lettere, es. 22a^3b)
      </p>
      <MathDrawCanvas
        strokes={strokes}
        onStrokesChange={(s) => {
          setStrokes(s);
          if (s.length === 0) setMsg(null);
        }}
        tool="write"
        height={120}
        disabled={disabled || busy}
      />
      <div className="flex justify-center gap-3">
        <button
          onClick={riconosci}
          disabled={strokes.length === 0 || busy || disabled}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold tracking-widest transition-colors"
        >
          {busy ? "RICONOSCO…" : "RICONOSCI"}
        </button>
        <button
          onClick={() => { setStrokes([]); setMsg(null); }}
          disabled={strokes.length === 0 || disabled}
          className="px-4 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs font-bold tracking-widest transition-colors"
        >
          CANCELLA
        </button>
      </div>
      {msg && (
        <p className="text-xs text-destructive text-center" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

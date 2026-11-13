/**
 * Registratore del TRATTO IN CORSO del canvas di scrittura a mano.
 *
 * ⚠️ PERCHÉ ESISTE (6/10). Prima `MathDrawCanvas` teneva il tratto in corso e il flag «sto disegnando»
 * SOLO nello stato React e li rileggeva dentro i gestori degli eventi (`{...currentStroke, points:
 * [...currentStroke.points, coords]}`). Se arrivano più eventi `mousemove`/`touchmove` PRIMA che React
 * abbia fatto il render (scrittura veloce, penna ad alta frequenza, telefono lento), ogni gestore
 * vede lo stato VECCHIO: il punto precedente va perso e, all'inizio del tratto, `isDrawing` è ancora
 * `false` e i primi punti vengono ignorati. Il risultato sono tratti più RADI di quelli disegnati e un
 * riconoscimento peggiore proprio dove serve precisione (parentesi vicine, cifre piccole, esponenti).
 * Riprodotto nel browser con il modello reale: la stessa espressione `{[(3+2)]}` veniva letta
 * `{[[3+2)]}` con un evento ogni 3 ms e correttamente con un evento ogni 16 ms.
 *
 * Qui il tratto vive in un oggetto MUTABILE sempre aggiornato (la fonte di verità); lo stato React
 * serve solo a ridisegnare, con l'ultimo snapshot restituito da `start`/`move`.
 * Gli snapshot restituiti sono IMMUTABILI: un `move` successivo non modifica quelli già consegnati.
 */
import type { Stroke, StrokePoint } from "../components/MathDrawCanvas";

export class StrokeRecorder {
  private current: Stroke | null = null;

  /** Inizia un nuovo tratto (scarta un eventuale tratto non concluso) e restituisce lo snapshot. */
  start(p: StrokePoint, lineWidth = 4): Stroke {
    this.current = { points: [p], lineWidth };
    return this.current;
  }

  /**
   * Aggiunge un punto al tratto in corso e restituisce il nuovo snapshot; `null` se nessun tratto è
   * iniziato (movimento del mouse senza il tasto premuto: va ignorato).
   */
  move(p: StrokePoint): Stroke | null {
    if (!this.current) return null;
    this.current = { ...this.current, points: [...this.current.points, p] };
    return this.current;
  }

  /** Conclude il tratto e lo restituisce (`null` se non c'era un tratto con almeno un punto). */
  end(): Stroke | null {
    const s = this.current;
    this.current = null;
    return s && s.points.length > 0 ? s : null;
  }

  /** Scarta il tratto in corso (il puntatore ha lasciato il canvas senza essere rilasciato). */
  cancel(): void {
    this.current = null;
  }

  /** `true` fra `start` e `end`/`cancel`. */
  get active(): boolean {
    return this.current !== null;
  }
}

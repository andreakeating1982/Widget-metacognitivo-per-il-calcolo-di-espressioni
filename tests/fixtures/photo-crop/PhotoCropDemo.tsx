import { useState } from "react";
import { PhotoCropBridge } from "@/components/PhotoCropBridge";

/** Fixture di collaudo: nessuna chiamata OCR o IA, nessun download.
 * Montata SOLO nella route temporanea /photo-crop-test (da rimuovere prima
 * della consegna). Il Toaster è già montato a livello App: qui non si rimonta.
 */
export function PhotoCropDemo() {
  const [result, setResult] = useState("");
  const [count, setCount] = useState(0);
  return (
    <main style={{ padding: 24, minHeight: 1400 }}>
      <h1>Prova del photo crop</h1>
      <p>Il test decodifica il PNG generato: non riconosce né analizza il testo.</p>
      <PhotoCropBridge onCropped={async file => {
        const bitmap = await createImageBitmap(file);
        const message = `${file.type} ${bitmap.width}×${bitmap.height}`;
        bitmap.close();
        setResult(message);
        setCount(previous => previous + 1);
      }} />
      <output data-photo-crop-result data-count={count} aria-live="polite">{result}</output>
    </main>
  );
}

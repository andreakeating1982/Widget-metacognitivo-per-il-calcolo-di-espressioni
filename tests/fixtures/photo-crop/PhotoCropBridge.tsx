import { useEffect, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { CropDialog } from "@/components/CropDialog";
import { normalizePhoto } from "@/lib/imagePrep";

/** Adattatore generico di integrazione, NON collegato a un servizio IA.
 * Montare un solo CropDialog per volta. onCropped riceve un File PNG.
 * Non sostituisce Home.tsx: usare o adattare solo questa piccola frontiera.
 *
 * (In questa app è usato SOLO dalla route temporanea di collaudo
 * /photo-crop-test: la pagina dell'esercizio ha il suo flusso SCATTA/CARICA.)
 */
export function PhotoCropBridge({
  onCropped,
}: {
  onCropped: (file: File) => void | Promise<void>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<string | null>(null);
  const mounted = useRef(true);
  const selecting = useRef(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (imageRef.current) URL.revokeObjectURL(imageRef.current);
      imageRef.current = null;
    };
  }, []);

  const close = () => {
    if (imageRef.current) URL.revokeObjectURL(imageRef.current);
    imageRef.current = null;
    setImageUrl(null);
  };

  const choose = async (file?: File) => {
    if (!file || selecting.current || busy) return;
    setError(null);
    if (file.size > 18 * 1024 * 1024) {
      setError("La foto supera 18 MB. Scegli un file più piccolo.");
      return;
    }
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
      setError("Usa una foto JPG, PNG o WEBP, non un PDF.");
      return;
    }
    selecting.current = true;
    setBusy(true);
    try {
      let ready = file;
      try { ready = await normalizePhoto(file); }
      catch { /* Come nella sorgente: tenta la foto originale se EXIF fallisce. */ }
      if (!mounted.current) return;
      if (imageRef.current) URL.revokeObjectURL(imageRef.current);
      const url = URL.createObjectURL(ready);
      imageRef.current = url;
      setImageUrl(url);
    } finally {
      selecting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const cropped = (file: File) => {
    // Il canvas ha già prodotto il File; ora si può revocare la sorgente.
    close();
    setBusy(true);
    // Consente anche a un consumer sincrono di lanciare un errore gestibile.
    void Promise.resolve().then(() => onCropped(file)).catch(() => {
      if (mounted.current) setError("Non è stato possibile elaborare la foto ritagliata. Riprova.");
    }).finally(() => {
      if (mounted.current) setBusy(false);
    });
  };

  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-[#a85b3c] bg-[#a85b3c] px-5 py-2.5 text-base font-bold text-white hover:bg-[#96603f] disabled:opacity-50";
  return (
    <div className="space-y-3">
      <input ref={cameraRef} aria-label="Scatta una foto" type="file" accept="image/*" capture="environment" className="sr-only"
        onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void choose(file); }} />
      <input ref={uploadRef} aria-label="Carica una foto" type="file" accept="image/*" className="sr-only"
        onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void choose(file); }} />
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className={button} disabled={busy || imageUrl !== null} onClick={() => cameraRef.current?.click()}>
          <Camera className="h-4 w-4" aria-hidden="true" /> SCATTA UNA FOTO
        </button>
        <button type="button" className={button} disabled={busy || imageUrl !== null} onClick={() => uploadRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" /> CARICA UNA FOTO
        </button>
      </div>
      {busy && <p role="status">Elaborazione della foto…</p>}
      {error && <p role="alert">{error}</p>}
      <CropDialog open={imageUrl !== null} imageUrl={imageUrl} onClose={close} onConfirm={cropped} />
    </div>
  );
}

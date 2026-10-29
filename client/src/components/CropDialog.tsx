import { useCallback, useEffect, useRef, useState } from "react"; // useCallback usato da computeDisp
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Crop, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useCropDialogViewport } from "@/hooks/useCropDialogViewport";
import {
  MIN_BOX,
  moveBox,
  resizeBox,
  resizeCorner,
  type Box,
  type Corner,
  type Edge,
} from "@/lib/cropBox";

/** Spessore della zona di presa per il trascinamento (px), tutta DENTRO la foto */
const HANDLE_SIZE = 44;
const CORNER_SIZE = 44;

/**
 * Ampiezza minima standard (px) della foto MOSTRATA nel ritaglio: anche le
 * foto piccole vengono INGRANDITE (solo a schermo, la foto originale non è
 * toccata) finché il lato lungo non raggiunge questa larghezza, così le
 * maniglie restano sempre agibili a prescindere dalle dimensioni originarie.
 */
const MIN_IMG_W = 560;

type DragState =
  | { mode: "resize"; edge: Edge; start: number; startBox: Box }
  | { mode: "corner"; corner: Corner; startX: number; startY: number; startBox: Box }
  | { mode: "move"; startX: number; startY: number; startBox: Box };

/**
 * Modale di ritaglio della foto: la finestra chiara (bordo tratteggiato) è un
 * box libero. Maniglie (4 bordi + 4 angoli) posizionate TUTTE DENTRO la foto,
 * così non vengono mai tagliate da overflow-hidden — in particolare il lato
 * DESTRO, che prima restava a filo e non si poteva restringere.
 * Il trascinamento usa listener sulla window (non solo sulla maniglia), così
 * il gesto continua anche se il puntatore esce dalla barretta.
 *
 * (28/10: sincronizzato con la gemella «Widget metacognitivo per il calcolo
 * di espressioni» — maniglie da tastiera, PNG lossless, beige #f8f1e4 — con
 * testi adattati al dominio latino.)
 */
export function CropDialog({
  open,
  imageUrl,
  onConfirm,
  onClose,
}: {
  open: boolean;
  imageUrl: string | null;
  onConfirm: (croppedFile: File) => void;
  onClose: () => void;
}) {
  const cropViewport = useCropDialogViewport(open);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 100, h: 100 });
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState<string | null>(imageUrl);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<(DragState & { pointerId: number; width: number; height: number }) | null>(null);
  const extraUrls = useRef<string[]>([]);
  /** dimensioni MOSTRATE della foto: ingrandite finché il lato lungo non
   *  raggiunge MIN_IMG_W, per poter ritagliare anche le foto piccole */
  const [disp, setDisp] = useState<{ w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const natRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setBox({ x: 0, y: 0, w: 100, h: 100 });
    setSrc(imageUrl);
    setDisp(null);
    natRef.current = null;
    extraUrls.current.forEach((u) => URL.revokeObjectURL(u));
    extraUrls.current = [];
    dragRef.current = null;
  }, [open, imageUrl]);

  useEffect(() => {
    return () => {
      extraUrls.current.forEach((u) => URL.revokeObjectURL(u));
      extraUrls.current = [];
    };
  }, []);

  /* Listener globali: il trascinamento non si interrompe se il dito/mouse esce dalla maniglia */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const wrap = wrapRef.current;
      if (!d || !wrap || e.pointerId !== d.pointerId) return;
      if (e.cancelable) e.preventDefault();
      // Incrementi rispetto all'ultimo evento, non all'inizio del gesto:
      // dopo un limite l'inversione risponde subito, senza una zona morta.
      let next: Box;
      if (d.mode === "resize") {
        const position = d.edge === "top" || d.edge === "bottom" ? e.clientY : e.clientX;
        const size = d.edge === "top" || d.edge === "bottom" ? d.height : d.width;
        next = resizeBox(d.startBox, d.edge, ((position - d.start) / size) * 100);
        dragRef.current = { ...d, start: position, startBox: next };
      } else {
        const dxPct = ((e.clientX - d.startX) / d.width) * 100;
        const dyPct = ((e.clientY - d.startY) / d.height) * 100;
        next = d.mode === "corner"
          ? resizeCorner(d.startBox, d.corner, dxPct, dyPct)
          : moveBox(d.startBox, dxPct, dyPct);
        dragRef.current = { ...d, startX: e.clientX, startY: e.clientY, startBox: next };
      }
      setBox(next);
    };
    const onUp = (e: PointerEvent) => {
      if (dragRef.current?.pointerId !== e.pointerId) return;
      dragRef.current = null;
      const wrap = wrapRef.current;
      if (wrap?.hasPointerCapture(e.pointerId)) wrap.releasePointerCapture(e.pointerId);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  /** Calcola le dimensioni mostrate: entra nello spazio disponibile, ma MAI
   *  sotto l'ampiezza minima standard (il lato lungo scala fino a MIN_IMG_W:
   *  se serve, il contenitore scorre). Il ritaglio è in percentuale, quindi
   *  l'ingrandimento a schermo NON altera il taglio della foto originale. */
  const computeDisp = useCallback((natW: number, natH: number) => {
    if (!natW || !natH) return;
    natRef.current = { w: natW, h: natH };
    // I 4px del bordo non devono comprimere l'immagine solo in larghezza.
    const availW = Math.max(1, (stageRef.current?.clientWidth ?? MIN_IMG_W) - 4);
    const maxH = Math.round((cropViewport?.height ?? window.innerHeight) * 0.58);
    let scale = Math.min(availW / natW, maxH / natH);
    /* 26/10y (mantenuto da Latino Facile): l'ingrandimento delle foto piccole
       (MIN_IMG_W) non deve MAI superare la larghezza disponibile, altrimenti
       su mobile l'anteprima esce DEFORMATA (CSS la comprime in larghezza ma
       l'altezza resta calcolata per 560 px). Il ritaglio usa percentuali:
       resta identico. */
    scale = Math.max(
      scale,
      Math.min(MIN_IMG_W / Math.max(natW, natH), availW / natW)
    );
    setDisp({ w: Math.round(natW * scale), h: Math.round(natH * scale) });
  }, [cropViewport?.height]);

  /* Ricalcola l'ingrandimento quando la finestra cambia dimensione */
  useEffect(() => {
    const onResize = () => {
      if (natRef.current) computeDisp(natRef.current.w, natRef.current.h);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeDisp]);

  const startDrag = (e: React.PointerEvent, state: DragState) => {
    if (busy || !e.isPrimary || e.button !== 0 || dragRef.current) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Cattura sul contenitore della FOTO: è stabile mentre maniglie e box
    // si spostano. Nessuna perdita di eventi quando il dito esce dalla presa.
    wrap.setPointerCapture(e.pointerId);
    dragRef.current = { ...state, pointerId: e.pointerId, width: rect.width, height: rect.height };
  };

  const onMoveKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    setBox((prev) => moveBox(prev, dx, dy));
  };

  /* (27/10, collaudo) anche le maniglie dei lati e degli angoli si usano da
     tastiera: frecce = 2% (Maiusc = 10%). Freccia verso l'ESTERNO allarga,
     verso l'interno stringe il lato (per gli angoli muovono l'angolo). */
  const onEdgeKeyDown = (edge: Edge) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    let d = 0;
    if (edge === "top" || edge === "bottom") {
      if (e.key === "ArrowUp") d = -step;
      else if (e.key === "ArrowDown") d = step;
      else return;
    } else {
      if (e.key === "ArrowLeft") d = -step;
      else if (e.key === "ArrowRight") d = step;
      else return;
    }
    e.preventDefault();
    setBox((prev) => resizeBox(prev, edge, d));
  };
  const onCornerKeyDown = (corner: Corner) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    setBox((prev) => resizeCorner(prev, corner, dx, dy));
  };

  const rotate90 = async (dir: 1 | -1) => {
    if (!src || busy) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = src;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("immagine non caricabile"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas non disponibile");
      if (dir === 1) {
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
      } else {
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.drawImage(img, 0, 0);
      /* PNG lossless anche qui: la ruotata diventa la sorgente del ritaglio */
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("impossibile ruotare");
      const url = URL.createObjectURL(blob);
      extraUrls.current.push(url);
      setSrc(url);
      setBox({ x: 0, y: 0, w: 100, h: 100 });
    } catch {
      toast.error("Non sono riuscito a ruotare la foto. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!src) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = src;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("immagine non caricabile"));
      });
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const sx = (nw * box.x) / 100;
      const sy = (nh * box.y) / 100;
      const sw = (nw * box.w) / 100;
      const sh = (nh * box.h) / 100;
      if (sw < 8 || sh < 8) throw new Error("ritaglio troppo piccolo");
      /* Il ritaglio va all'OCR in PNG lossless: il JPEG (blocchi DCT), dopo
         l'ingrandimento per l'OCR, si trasforma in rumore che affoga
         Tesseract (verificato con sonde A/B). Lato massimo 2200 px:
         abbastanza per gli apici, file leggero. */
      const MAX_CROP_EDGE = 2200;
      let cw = Math.max(1, Math.round(sw));
      let ch = Math.max(1, Math.round(sh));
      const cropMax = Math.max(cw, ch);
      if (cropMax > MAX_CROP_EDGE) {
        const s = MAX_CROP_EDGE / cropMax;
        cw = Math.max(1, Math.round(cw * s));
        ch = Math.max(1, Math.round(ch * s));
      }
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas non disponibile");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("impossibile generare il file");
      extraUrls.current.forEach((u) => URL.revokeObjectURL(u));
      extraUrls.current = [];
      onConfirm(new File([blob], "foto_ritagliata.png", { type: "image/png" }));
    } catch {
      toast.error("Non sono riuscito a ritagliare la foto: allarga un po' la finestra e riprova.");
    } finally {
      setBusy(false);
    }
  };

  const rx = 100 - box.x - box.w;
  const by = 100 - box.y - box.h;
  const cropActive = box.w < 100 || box.h < 100;

  /** Maniglie interamente DENTRO il box (mai a cavallo del bordo → mai tagliate). */
  const handleStyle = (edge: Edge): React.CSSProperties => {
    switch (edge) {
      case "top":
        return {
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.w}%`,
          height: HANDLE_SIZE,
        };
      case "bottom":
        return {
          left: `${box.x}%`,
          top: `calc(${box.y + box.h}% - ${HANDLE_SIZE}px)`,
          width: `${box.w}%`,
          height: HANDLE_SIZE,
        };
      case "left":
        return {
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: HANDLE_SIZE,
          height: `${box.h}%`,
        };
      case "right":
        return {
          left: `calc(${box.x + box.w}% - ${HANDLE_SIZE}px)`,
          top: `${box.y}%`,
          width: HANDLE_SIZE,
          height: `${box.h}%`,
        };
    }
  };

  const cornerStyle = (corner: Corner): React.CSSProperties => {
    switch (corner) {
      case "nw":
        return { top: `${box.y}%`, left: `${box.x}%` };
      case "ne":
        return { top: `${box.y}%`, left: `calc(${box.x + box.w}% - ${CORNER_SIZE}px)` };
      case "sw":
        return { top: `calc(${box.y + box.h}% - ${CORNER_SIZE}px)`, left: `${box.x}%` };
      case "se":
        return {
          top: `calc(${box.y + box.h}% - ${CORNER_SIZE}px)`,
          left: `calc(${box.x + box.w}% - ${CORNER_SIZE}px)`,
        };
    }
  };

  return (
    /* Solo il ritaglio è MODALE: la pagina dietro resta ferma, mentre
       intestazione e foto scorrono; tutti i comandi sono in un unico
       riquadro compatto centrato, separato solo dalla foto.
       Il viewport è quello VISIBILE del blog, non l'altezza dell'iframe. */
    <Dialog
      open={open}
      modal={true}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      {/* (27/10, richiesta utente) l'INTERA finestra (testata inclusa) è beige
           #f8f1e4: prima la testata ereditava bg-card (bianco) e spiccava
           rispetto alla parte centrale. */}
      <DialogContent
        className="lf-crop-dialog flex w-[calc(100%-1rem)] max-w-3xl translate-y-0 flex-col gap-0 overflow-hidden bg-[#f8f1e4] p-0 sm:max-w-3xl"
        aria-describedby={undefined}
        style={{
          top: (cropViewport?.top ?? 0) + 8,
          height: cropViewport ? Math.max(1, cropViewport.height - 16) : "calc(100dvh - 1rem)",
          maxHeight: cropViewport ? Math.max(1, cropViewport.height - 16) : "calc(100dvh - 1rem)",
          visibility: cropViewport ? "visible" : "hidden",
        }}
      >
        <div data-crop-scroll className="lf-crop-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-3 text-center sm:px-12">
          <DialogTitle className="text-xl font-black tracking-tight uppercase text-foreground">
            Ritaglia la foto
          </DialogTitle>
        </DialogHeader>

        {src && (
          <>
            <div className="bg-[#f8f1e4] p-4 sm:p-5">
              <div ref={stageRef} className="flex justify-center">
                <div
                  ref={wrapRef}
                  onLostPointerCapture={(e) => {
                    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
                  }}
                  /* Pan sulle zone esterne alla selezione e sui margini;
                     dentro la selezione si trascina direttamente il crop. */
                  /* (27/10, richiesta utente) sfondo dello specchietto SEMPRE
                     beige #f8f1e4 (stesso beige del corpo della finestra),
                     non più nero; l'oscuramento bg-black/55 attorno al ritaglio
                     resta invariato perché funzionale alla selezione. */
                  className="relative inline-block shrink-0 touch-pan-y select-none overflow-hidden rounded-xl border-2 border-[#d6cec4] bg-[#f8f1e4]"
                >
                  <img
                    src={src}
                    alt="Foto da ritagliare"
                    draggable={false}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      natRef.current = { w: el.naturalWidth, h: el.naturalHeight };
                      computeDisp(el.naturalWidth, el.naturalHeight);
                    }}
                    style={disp ? { width: disp.w, height: disp.h } : undefined}
                    className={
                      disp
                        ? "block max-w-none select-none"
                        : "block max-h-[46dvh] w-auto max-w-full select-none sm:max-h-[58dvh]"
                    }
                  />

                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-0 right-0 bg-black/55" style={{ top: 0, height: `${box.y}%` }} />
                    <div className="absolute left-0 right-0 bg-black/55" style={{ bottom: 0, height: `${by}%` }} />
                    <div
                      className="absolute bg-black/55"
                      style={{ top: `${box.y}%`, height: `${box.h}%`, left: 0, width: `${box.x}%` }}
                    />
                    <div
                      className="absolute bg-black/55"
                      style={{ top: `${box.y}%`, height: `${box.h}%`, right: 0, width: `${rx}%` }}
                    />
                    <div
                      className="absolute border-2 border-dashed border-white/90"
                      style={{ top: `${box.y}%`, left: `${box.x}%`, width: `${box.w}%`, height: `${box.h}%` }}
                    />
                  </div>

                  <div className="absolute inset-0">
                    {cropActive && (
                      <div
                        role="group"
                        aria-label="Sposta la finestra di ritaglio sulla foto"
                        data-crop-selection
                        title="Sposta il ritaglio"
                        tabIndex={0}
                        className="lf-crop-move absolute z-[1] cursor-move select-none outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50"
                        style={{
                          top: `${box.y}%`,
                          left: `${box.x}%`,
                          width: `${box.w}%`,
                          height: `${box.h}%`,
                        }}
                        onPointerDown={(e) =>
                          startDrag(e, { mode: "move", startX: e.clientX, startY: e.clientY, startBox: { ...box } })
                        }
                        onKeyDown={onMoveKeyDown}
                      />
                    )}
                    {(
                      [
                        ["top", "Ridimensiona il lato superiore della finestra di ritaglio", "h-1.5 w-12", "cursor-ns-resize"],
                        ["bottom", "Ridimensiona il lato inferiore della finestra di ritaglio", "h-1.5 w-12", "cursor-ns-resize"],
                        ["left", "Ridimensiona il lato sinistro della finestra di ritaglio", "h-12 w-1.5", "cursor-ew-resize"],
                        ["right", "Ridimensiona il lato destro della finestra di ritaglio", "h-12 w-1.5", "cursor-ew-resize"],
                      ] as const
                    ).map(([edge, label, bar, cursor]) => (
                      <div
                        key={edge}
                        role="slider"
                        aria-label={label}
                        aria-valuemin={MIN_BOX}
                        aria-valuemax={100}
                        aria-valuenow={edge === "left" || edge === "right" ? Math.round(box.w) : Math.round(box.h)}
                        tabIndex={0}
                        onKeyDown={onEdgeKeyDown(edge)}
                        className={`absolute z-[2] flex items-center justify-center touch-none ${cursor}`}
                        style={handleStyle(edge)}
                        onPointerDown={(e) =>
                          startDrag(e, {
                            mode: "resize",
                            edge,
                            start: edge === "top" || edge === "bottom" ? e.clientY : e.clientX,
                            startBox: { ...box },
                          })
                        }
                      >
                        <span className={`${bar} pointer-events-none rounded-full bg-white shadow-md ring-1 ring-black/20`} />
                      </div>
                    ))}
                    {(
                      [
                        ["nw", "Angolo in alto a sinistra", "cursor-nwse-resize"],
                        ["ne", "Angolo in alto a destra", "cursor-nesw-resize"],
                        ["sw", "Angolo in basso a sinistra", "cursor-nesw-resize"],
                        ["se", "Angolo in basso a destra", "cursor-nwse-resize"],
                      ] as const
                    ).map(([corner, label, cursor]) => (
                      <div
                        key={corner}
                        role="slider"
                        aria-label={`Ridimensiona dal ${label.toLowerCase()}`}
                        tabIndex={0}
                        onKeyDown={onCornerKeyDown(corner)}
                        className={`absolute z-[3] flex items-center justify-center touch-none ${cursor}`}
                        style={{ ...cornerStyle(corner), width: CORNER_SIZE, height: CORNER_SIZE }}
                        onPointerDown={(e) =>
                          startDrag(e, {
                            mode: "corner",
                            corner,
                            startX: e.clientX,
                            startY: e.clientY,
                            startBox: { ...box },
                          })
                        }
                      >
                        <span className="pointer-events-none h-3.5 w-3.5 rounded-[3px] bg-white shadow-md ring-1 ring-black/25" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </>
        )}
        </div>
        <div data-crop-footer data-crop-controls role="group" aria-label="Comandi per il ritaglio della foto" className="lf-crop-footer shrink-0 border-t border-border bg-[#f8f1e4]">
              <Button
                type="button"
                onClick={() => void rotate90(-1)}
                disabled={busy || !src}
                aria-label="Ruota la foto di 90 gradi a sinistra"
                className="h-auto min-h-11 gap-1.5 rounded-full border-2 border-[#a85b3c] bg-[#a85b3c] px-3 text-sm font-bold uppercase text-white shadow-sm hover:bg-[#96603f]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Ruota sinistra
              </Button>
              <Button
                type="button"
                onClick={() => void rotate90(1)}
                disabled={busy || !src}
                aria-label="Ruota la foto di 90 gradi a destra"
                className="h-auto min-h-11 gap-1.5 rounded-full border-2 border-[#a85b3c] bg-[#a85b3c] px-3 text-sm font-bold uppercase text-white shadow-sm hover:bg-[#96603f]"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Ruota destra
              </Button>
              <Button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="h-auto min-h-11 rounded-full border-2 border-[#a85b3c] bg-[#a85b3c] px-4 text-sm font-bold uppercase text-white shadow-sm hover:bg-[#96603f]"
              >
                Chiudi
              </Button>
              <Button
                type="button"
                onClick={() => void confirm()}
                disabled={busy}
                className="h-auto min-h-11 gap-1.5 rounded-full border-2 border-[#a85b3c] bg-[#a85b3c] px-4 text-sm font-bold uppercase text-white shadow-sm hover:bg-[#96603f]"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Crop className="h-4 w-4" aria-hidden="true" />}
                {busy ? "Attendi…" : "Ritaglia"}
              </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

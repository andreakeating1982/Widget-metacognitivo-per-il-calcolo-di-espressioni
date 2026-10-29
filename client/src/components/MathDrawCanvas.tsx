import { useCallback, useEffect, useRef, useState } from "react";
import { StrokeRecorder } from "@/lib/strokeRecorder";

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  points: StrokePoint[];
  lineWidth: number;
}

interface MathDrawCanvasProps {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  tool: "write" | "erase" | "select";
  width?: number;
  height?: number;
  className?: string;
  disabled?: boolean;
  hideWatermark?: boolean;
  /* (26/10, anti-scarabocchi): chiamato quando il canvas ha misurato il
     contenitore ed è davvero pronto a ricevere la scrittura */
  onReady?: () => void;
}

const ERASER_RADIUS = 20;

export function MathDrawCanvas({
  strokes,
  onStrokesChange,
  tool,
  width,
  height,
  className = "",
  disabled = false,
  hideWatermark = false,
  onReady,
}: MathDrawCanvasProps) {
  const isEmpty = strokes.length === 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 180 });
  /* (26/10, richiesta utente — anti-scarabocchi): il canvas NON è pronto
     finché non ha misurato il contenitore (ResizeObserver): prima di
     allora le coordinate sono sbagliate (scala 700×180 fissa) e tratti e
     cancellazioni finiscono nel posto sbagliato. Il genitore riceve il
     segnale via onReady quando le misure sono reali. */
  const [pronto, setPronto] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  // (6/10) Il tratto in corso vive nel registratore (fonte di verità, sempre aggiornato), NON solo
  // nello stato: con eventi più veloci del render lo stato invecchia e i punti andavano persi
  // (vedi lib/strokeRecorder.ts). `currentStroke` serve solo a ridisegnare.
  const [recorder] = useState(() => new StrokeRecorder());
  // Elenco dei tratti salvati sempre aggiornato anche fra due render (gomma / tratti ravvicinati).
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [selectRect, setSelectRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* prima misura reale = canvas pronto: si segnala al genitore (una
       sola volta) e il ResizeObserver resta per le misure successive */
    let primo = true;
    const osservato = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = width || entry.contentRect.width;
        const h = height || Math.max(140, entry.contentRect.height);
        setCanvasSize({
          width: Math.floor(w),
          height: Math.floor(h),
        });
        if (primo) {
          primo = false;
          setPronto(true);
          onReady?.();
        }
      }
    });

    osservato.observe(container);
    return () => osservato.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Draw all strokes
  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(176, 95, 60, 0.08)";
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = gridSize; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = gridSize; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw all saved strokes
    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }

    // Draw current stroke
    if (currentStroke && currentStroke.points.length > 0) {
      drawStroke(ctx, currentStroke);
    }

    // Draw eraser indicator
    if (tool === "erase" && eraserPos) {
      ctx.beginPath();
      ctx.arc(eraserPos.x, eraserPos.y, ERASER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw selection rectangle
    if (tool === "select" && selectRect) {
      const { x1, y1, x2, y2 } = selectRect;
      ctx.fillStyle = "rgba(6, 182, 212, 0.1)";
      ctx.fillRect(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1),
        Math.abs(y2 - y1),
      );
      ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1),
        Math.abs(y2 - y1),
      );
      ctx.setLineDash([]);
    }
  }, [strokes, currentStroke, tool, eraserPos, selectRect]);

  useEffect(() => {
    drawAll();
  }, [drawAll]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = "#3d2e1c";
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.arc(p.x, p.y, stroke.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#3d2e1c";
      ctx.fill();
    } else {
      // Use quadratic Bézier curves for smooth lines
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      // Line to the last point
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  };

  const getCanvasCoords = (
    e: React.MouseEvent | React.TouchEvent,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const isNearStroke = (x: number, y: number, stroke: Stroke): boolean => {
    for (const point of stroke.points) {
      const dx = point.x - x;
      const dy = point.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < ERASER_RADIUS) return true;
    }
    return false;
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (tool === "write") {
      setCurrentStroke(recorder.start(coords));
      setIsDrawing(true);
    } else if (tool === "erase") {
      setEraserPos(coords);
      // Erase strokes near the eraser
      const remaining = strokesRef.current.filter((s) => !isNearStroke(coords.x, coords.y, s));
      if (remaining.length !== strokesRef.current.length) {
        strokesRef.current = remaining;
        onStrokesChange(remaining);
      }
    } else if (tool === "select") {
      setSelectRect({
        x1: coords.x,
        y1: coords.y,
        x2: coords.x,
        y2: coords.y,
      });
      setIsDrawing(true);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (tool === "write" && recorder.active) {
      const snapshot = recorder.move(coords);
      if (snapshot) setCurrentStroke(snapshot);
    } else if (tool === "erase") {
      setEraserPos(coords);
      // Continuously erase nearby strokes
      const remaining = strokesRef.current.filter((s) => !isNearStroke(coords.x, coords.y, s));
      if (remaining.length !== strokesRef.current.length) {
        strokesRef.current = remaining;
        onStrokesChange(remaining);
      }
    } else if (tool === "select" && isDrawing && selectRect) {
      setSelectRect({
        ...selectRect,
        x2: coords.x,
        y2: coords.y,
      });
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const coords = getCanvasCoords(e);

    if (tool === "write") {
      const finished = recorder.end();
      if (finished) {
        const next = [...strokesRef.current, finished];
        strokesRef.current = next;
        onStrokesChange(next);
      }
    } else if (tool === "select" && selectRect && coords) {
      // Check if it's a tap (very small selection) - treat it like a click for selection
      const dx = selectRect.x2 - selectRect.x1;
      const dy = selectRect.y2 - selectRect.y1;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        // Tap — select nearby stroke
        const selectedIndex = strokes.findIndex((s) =>
          isNearStroke(coords.x, coords.y, s),
        );
        if (selectedIndex >= 0) {
          // Highlight the selected stroke for correction
          const selectedStroke = strokes[selectedIndex];
          const remaining = strokes.filter((_, i) => i !== selectedIndex);
          onStrokesChange([...remaining, selectedStroke]); // Move to end for visibility
        }
      }
    }

    setCurrentStroke(null);
    setIsDrawing(false);
    setEraserPos(null);
    setSelectRect(null);
  };

  const handlePointerLeave = () => {
    recorder.cancel();
    setCurrentStroke(null);
    setIsDrawing(false);
    setEraserPos(null);
    setSelectRect(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden rounded-xl border-2 border-border bg-card shadow-inner shadow-black/[0.04] ring-1 ring-black/[0.04] group ${className}`}
      style={{ minHeight: height || 140 }}
    >
      {/* Empty state watermark */}
      {!hideWatermark && isEmpty && tool === "write" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
          <div className="text-center opacity-25 transition-opacity duration-300 group-hover:opacity-30">
            <p className="text-base sm:text-lg font-light text-foreground/40 tracking-wide">
              Scrivi qui le espressioni matematiche
            </p>
            <p className="text-sm text-muted-foreground/40 mt-1">
              Usa il mouse, touch o pennino
            </p>
          </div>
        </div>
      )}
      {/* (26/10, anti-scarabocchi): finché le misure non sono reali il canvas
          è coperto da un velo non interattivo — l'utente non può scriverci
          sopra prima che sia pronto */}
      {!pronto && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60">
          <p className="text-sm tracking-widest text-muted-foreground">CARICAMENTO…</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className={`math-grid-pattern block w-full h-full touch-none ${disabled ? "opacity-50" : ""}`}
        style={{
          cursor:
            tool === "erase"
              ? "crosshair"
              : tool === "select"
                ? "crosshair"
                : disabled
                  ? "not-allowed"
                  : "crosshair",
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
    </div>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Barra di accessibilità (stile Cornice Universale, adattata all'app
 * WIDGET MATEMATICO SORGENTE). Aggiunta per l'inclusione (BES/DSA).
 *
 * - FONT: scala la dimensione del testo (A− / A+)
 * - INTERLINEA: cicla l'interlinea del testo
 * - RIGHELLO: mostra una banda di lettura che segue il puntatore
 * - MODALITÀ: attiva l'alto contrasto
 *
 * Le impostazioni sono salvate in localStorage e applicate a tutta l'app
 * (documentElement + variabili CSS), su TUTTE le pagine.
 */

type AccMode = "normale" | "contrasto";

interface AccSettings {
  fontScale: number;
  lineHeight: number;
  ruler: boolean;
  mode: AccMode;
}

interface AccContextValue extends AccSettings {
  setFontScale: (n: number) => void;
  cycleLineHeight: () => void;
  toggleRuler: () => void;
  cycleMode: () => void;
}

const STORAGE_KEY = "wms_access";
const LINE_HEIGHTS = [1.65, 1.9, 2.2, 2.6];
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.6;

const DEFAULTS: AccSettings = {
  fontScale: 1,
  lineHeight: 1.65,
  ruler: false,
  mode: "normale",
};

function load(): AccSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<AccSettings>;
    return {
      fontScale:
        typeof p.fontScale === "number" && p.fontScale >= MIN_SCALE && p.fontScale <= MAX_SCALE
          ? p.fontScale
          : DEFAULTS.fontScale,
      lineHeight: LINE_HEIGHTS.includes(p.lineHeight as number)
        ? (p.lineHeight as number)
        : DEFAULTS.lineHeight,
      ruler: typeof p.ruler === "boolean" ? p.ruler : DEFAULTS.ruler,
      mode: p.mode === "contrasto" ? "contrasto" : "normale",
    };
  } catch {
    return DEFAULTS;
  }
}

const AccessibilityContext = createContext<AccContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccSettings>(load);
  const bandRef = useRef<HTMLDivElement>(null);

  // Applica le impostazioni a tutta l'app
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${16 * settings.fontScale}px`;
    root.style.setProperty("--lf-scale", String(settings.fontScale));
    root.style.setProperty("--lf-lh", String(settings.lineHeight));
    root.classList.toggle("lf-ruler", settings.ruler);
    root.classList.toggle("lf-hc", settings.mode === "contrasto");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage non disponibile: ignoriamo */
    }
  }, [settings]);

  // Righello di lettura: la banda segue il puntatore del mouse
  useEffect(() => {
    if (!settings.ruler) return;
    const onMove = (e: MouseEvent) => {
      const band = bandRef.current;
      if (!band) return;
      const h = band.offsetHeight;
      band.style.top = `${e.clientY - h / 2}px`;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [settings.ruler]);

  const value = useMemo<AccContextValue>(
    () => ({
      ...settings,
      setFontScale: (n: number) =>
        setSettings((p) => ({
          ...p,
          fontScale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(n * 10) / 10)),
        })),
      cycleLineHeight: () =>
        setSettings((p) => {
          const i = LINE_HEIGHTS.indexOf(p.lineHeight);
          return { ...p, lineHeight: LINE_HEIGHTS[(i + 1) % LINE_HEIGHTS.length] };
        }),
      toggleRuler: () => setSettings((p) => ({ ...p, ruler: !p.ruler })),
      cycleMode: () =>
        setSettings((p) => ({ ...p, mode: p.mode === "normale" ? "contrasto" : "normale" })),
    }),
    [settings]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {/* Banda del righello di lettura (segue il mouse) */}
      <div ref={bandRef} id="lf-ruler-band" aria-hidden="true" className="lf-ruler-band" />
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility deve essere usato dentro AccessibilityProvider");
  return ctx;
}

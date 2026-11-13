import { useLayoutEffect, useState } from "react";

export type CropViewport = { top: number; height: number };

/**
 * Il viewport di un iframe auto-alto NON è lo schermo del telefono.
 * IntersectionObserver fornisce il rettangolo visibile anche cross-origin
 * (rootBounds può essere null). Non si accede al DOM del blog e non si
 * richiede di cambiare il codice embed già pubblicato.
 *
 * Lock limitato al ritaglio: alla chiusura ripristina stili e posizione.
 * Radix modal gestisce focus e touch fuori dalla finestra; qui il body
 * fixed copre anche Safari iOS. heightSync sospende i resize durante il lock.
 */
export function useCropDialogViewport(open: boolean): CropViewport | null {
  const [viewport, setViewport] = useState<CropViewport | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setViewport(null);
      return;
    }
    const html = document.documentElement;
    const body = document.body;
    const x = window.scrollX;
    const y = window.scrollY;
    const bodyProperties = [
      "position",
      "top",
      "left",
      "width",
      "overflow",
    ] as const;
    const htmlProperties = [
      "overflow",
      "overscroll-behavior",
      "scroll-behavior",
    ] as const;
    const saved = (element: HTMLElement, names: readonly string[]) =>
      names.map(name => ({
        name,
        value: element.style.getPropertyValue(name),
        priority: element.style.getPropertyPriority(name),
      }));
    const bodyStyles = saved(body, bodyProperties);
    const htmlStyles = saved(html, htmlProperties);
    const oldLock = html.getAttribute("data-lf-crop-open");
    // Prima di cambiare layout, congela la sincronizzazione con la cornice.
    html.setAttribute("data-lf-crop-open", "true");
    html.style.setProperty("overflow", "hidden");
    html.style.setProperty("overscroll-behavior", "none");
    html.style.setProperty("scroll-behavior", "auto");
    // react-remove-scroll di Radix imposta position:relative !important.
    // Il lock iOS deve prevalere, altrimenti il body torna a scorrere.
    body.style.setProperty("position", "fixed", "important");
    body.style.setProperty("top", `${-y}px`);
    body.style.setProperty("left", `${-x}px`);
    body.style.setProperty("width", "100%");
    body.style.setProperty("overflow", "hidden");

    const update = (top: number, height: number) => {
      if (height <= 0) return;
      const next = {
        top: Math.max(0, Math.ceil(top)),
        height: Math.floor(height),
      };
      setViewport(previous =>
        previous &&
        Math.abs(previous.top - next.top) < 1 &&
        Math.abs(previous.height - next.height) < 1
          ? previous
          : next
      );
    };
    const embedded = window.self !== window.top;
    const visual = window.visualViewport;
    const measureStandalone = () =>
      update(visual?.offsetTop ?? 0, visual?.height ?? window.innerHeight);
    let probe: HTMLDivElement | null = null;
    let observer: IntersectionObserver | null = null;
    let stopped = false;
    if (embedded && typeof IntersectionObserver !== "undefined") {
      probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:fixed;inset:0;pointer-events:none;visibility:hidden;";
      body.appendChild(probe);
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!stopped && entry?.isIntersecting) {
            update(entry.intersectionRect.top, entry.intersectionRect.height);
          }
        },
        { threshold: Array.from({ length: 101 }, (_, n) => n / 100) }
      );
      observer.observe(probe);
    } else {
      measureStandalone();
      window.addEventListener("resize", measureStandalone);
      visual?.addEventListener("resize", measureStandalone);
      visual?.addEventListener("scroll", measureStandalone);
    }
    return () => {
      stopped = true;
      observer?.disconnect();
      probe?.remove();
      window.removeEventListener("resize", measureStandalone);
      visual?.removeEventListener("resize", measureStandalone);
      visual?.removeEventListener("scroll", measureStandalone);
      const restore = (element: HTMLElement, entries: typeof bodyStyles) => {
        for (const { name, value, priority } of entries) {
          if (value) element.style.setProperty(name, value, priority);
          else element.style.removeProperty(name);
        }
      };
      restore(body, bodyStyles);
      // Prima del ripristino del smooth scroll, ritorna alla posizione esatta.
      window.scrollTo(x, y);
      restore(html, htmlStyles);
      if (oldLock === null) html.removeAttribute("data-lf-crop-open");
      else html.setAttribute("data-lf-crop-open", oldLock);
      window.dispatchEvent(new Event("lf:crop-closed"));
    };
  }, [open]);

  return viewport;
}

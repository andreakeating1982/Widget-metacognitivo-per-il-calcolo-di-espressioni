/**
 * Sincronizzazione altezza per embed iframe (protocollo `labvisivo:height`).
 *
 * Quando l'app è caricata dentro un iframe (es. cornice dinamica su Blogger
 * o su un sito), invia al parent l'altezza reale del documento così la
 * cornice può adattarsi automaticamente al contenuto (resize automatico).
 *
 * Il parent ascolta messaggi del tipo:
 *   { type: "labvisivo:height", height: <numero> }
 *
 * ─── STABILITÀ ANTI-TREMOLIO (fix «l'app trema nel blog») ───────────────
 * Riprodotto e misurato in laboratorio (test-tremolio.html): l'app
 * rinviava l'altezza a OGNI tick (ResizeObserver + resize + risposta al
 * ping) e le cornici con `transition: height` applicavano subito anche le
 * misure intermedie → ciclo di ricrescita continua (+1…+6 px a manovra) =
 * tremolio costante. Contromisure, in ordine di importanza:
 *
 * 1. ARROTONDAMENTO PER ECCESSO su misura frazionaria (ceil): dopo
 *    l'applicazione il contenuto non sconfinerà MAI dall'iframe → niente
 *    barra di scorrimento → nessun reflow → la rimisura è identica → il
 *    ciclo non riparte.
 * 2. ISTERESI (3 px): variazioni più piccole non vengono inviate
 *    (invisibili all'occhio, ma bastavano a rimettere in moto il ciclo).
 * 3. SILENZIO POST-INVIO (400 ms): per ~0,4 s dopo ogni invio le
 *    rimisurazioni intermedie vengono scartate — copre la durata della
 *    transizione CSS (~250 ms) delle cornici animate. Un cambiamento VERO
 *    (≥ 30 px, es. cambio passo) passa comunque subito.
 * 4. COALESCENZA rAF: le raffiche del ResizeObserver producono al massimo
 *    un invio per frame, poi il trailing settle conferma il valore finale.
 *
 * Il PING della cornice risponde SEMPRE (bypass isteresi e silenzio): è
 * una richiesta esplicita, serve alle cornici (ri)caricate per conoscere
 * l'altezza corrente anche se identica all'ultimo valore inviato.
 */

const ISTERESI_PX = 3;
const SILENZIO_MS = 400;
const SALTO_LIBERO_PX = 30;

let lastSent = 0;
let lastSentAt = 0;
let rafId: number | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function measureHeight(): number {
  const docEl = document.documentElement;
  const body = document.body;
  /* IMPORTANTE: NON usare documentElement.scrollHeight come riferimento
     assoluto. Quando il contenuto è più corto dell'iframe, lo scrollHeight
     del documento resta "gonfiato" all'altezza del viewport dell'iframe
     (mai meno), quindi la cornice dinamica non potrebbe MAI restringersi
     e la prima pagina mostrerebbe un grande vuoto sotto la card. Usiamo
     l'altezza reale del contenuto e aggiungiamo documentElement.scrollHeight
     SOLO quando il contenuto supera davvero il viewport.

     Le altezze via getBoundingClientRect() sono FRAZIONARIE: incluse nel
     massimo così il ceil finale copre anche il contenuto "mezzo pixel più
     alto" (zoom / devicePixelRatio frazionari) che con i soliti interi
     (scrollHeight/offsetHeight arrotondati) sconfinava dall'iframe e
     faceva comparire/sparire la barra di scorrimento (reflow → tremolio). */
  let h = 0;
  if (body) {
    h = Math.max(
      h,
      body.getBoundingClientRect().height,
      body.scrollHeight,
      body.offsetHeight
    );
  }
  if (docEl) {
    h = Math.max(
      h,
      docEl.getBoundingClientRect().height,
      docEl.offsetHeight
    );
  }
  const viewportH = window.innerHeight || (docEl ? docEl.clientHeight : 0);
  if (docEl && docEl.scrollHeight > viewportH) {
    h = Math.max(h, docEl.scrollHeight);
  }
  return Math.ceil(h);
}

function getCorniceToken(): string | null {
  // La cornice v3 "impermeabile" aggiunge ?cornice=<token> all'URL dell'iframe:
  // rispecchiamo il token nei messaggi, così la cornice rifiuta i messaggi
  // di altezza che arrivano da altre istanze (filtro e.source + token).
  try {
    return new URLSearchParams(window.location.search).get("cornice");
  } catch {
    return null;
  }
}

function pushHeight(opts: { force?: boolean } = {}): void {
  // Attivo solo quando siamo dentro un iframe (non come pagina principale)
  if (window.self === window.top) return;
  // Il body fixed del ritaglio NON è la nuova altezza dell'app: finché il
  // modale di ritaglio è aperto (data-lf-crop-open su <html>) non si invia
  // nulla, altrimenti la cornice collasserebbe (SCROLLING-MOBILE.md §5).
  if (document.documentElement.hasAttribute("data-lf-crop-open")) return;
  const height = measureHeight();
  if (height <= 100 || height > 15000) return;
  const ora = Date.now();
  if (!opts.force) {
    // Isteresi: differenze impercettibili non vengono inviate
    if (lastSent > 0 && Math.abs(height - lastSent) < ISTERESI_PX) return;
    // Silenzio post-invio: smorza le misure intermedie (transizioni CSS
    // della cornice, reflow di stabilizzazione). Un salto vero passa.
    if (
      lastSentAt > 0 &&
      ora - lastSentAt < SILENZIO_MS &&
      Math.abs(height - lastSent) < SALTO_LIBERO_PX
    ) {
      return;
    }
  }
  lastSent = height;
  lastSentAt = ora;
  const msg: Record<string, unknown> = { type: "labvisivo:height", height };
  const token = getCorniceToken();
  if (token) msg.cornice = token;
  window.parent.postMessage(msg, "*");
}

function scheduleSend(): void {
  // Coalescenza: al massimo un invio per frame anche se il ResizeObserver
  // scatta a raffica; il trailing settle conferma poi il valore stabile.
  if (rafId === null) {
    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        pushHeight();
      });
    } else {
      pushHeight();
    }
  }
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => pushHeight(), SILENZIO_MS + 60);
}

export function initHeightSync(): void {
  // IMPORTANTE: quando l'app è dentro un iframe a altezza automatica
  // (cornice dinamica), la pagina deve seguire l'altezza del CONTENUTO.
  // Il classico `min-h-screen` (100vh) creerebbe un loop infinito:
  //   iframe = misurato → viewport = iframe → misurato = viewport + barra → …
  // Con la classe `lf-embedded` il CSS disattiva i 100vh (vedi index.css).
  if (window.self !== window.top) {
    document.documentElement.classList.add("lf-embedded");
  }

  // Risponde al "ping" della cornice dinamica (embed Blogger): la cornice
  // può richiedere l'altezza in ogni momento con { type: "labvisivo:ping" }.
  // Risposta SEMPRE forzata: è una richiesta esplicita, non un evento.
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "labvisivo:ping") {
      pushHeight({ force: true });
    }
  });

  // Invia subito (prima del rendering completo) e a caricamento avvenuto
  scheduleSend();
  window.addEventListener("load", () => scheduleSend());
  window.addEventListener("resize", () => scheduleSend());
  // Chiusura del ritaglio: gli stili sono ripristinati, si rimisura in un
  // animation frame (contratto lf:crop-closed di useCropDialogViewport).
  window.addEventListener("lf:crop-closed", () => requestAnimationFrame(() => scheduleSend()));

  // Osserva i cambi di layout (es. caricamento del modello ONNX, dialoghi,
  // cambio passo dell'esercizio…)
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => scheduleSend());
    if (document.documentElement) ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    setTimeout(() => scheduleSend(), 250);
  }

  // Retry: font, modello OCR e contenuti asincroni possono cambiare
  // l'altezza dopo l'evento "load"
  setTimeout(() => scheduleSend(), 500);
  setTimeout(() => scheduleSend(), 1500);
  setTimeout(() => scheduleSend(), 3000);
}

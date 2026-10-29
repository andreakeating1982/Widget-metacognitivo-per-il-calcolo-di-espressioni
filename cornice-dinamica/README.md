# CORNICE DINAMICA — ESPRESSIONI LETTERALI, MONOMI E POLINOMI (embed per Blogger)

Questa cartella contiene la **cornice dinamica** dell'app Espressioni Letterali,
Monomi e Polinomi: un blocco HTML autonomo da incollare su Blogger (o su qualsiasi
sito) che mostra l'app dentro un iframe con **altezza automatica** e **font
OpenDyslexic**. Codice DOCX associato nella raccolta «Cornici dinamiche v4»: **Codice 14**.

## File contenuti

| File | Descrizione |
|---|---|
| `embed-espressioni-dedicata.html` | ⭐ **Versione DEDICATA (~22 KB, v4 impermeabile + anti-loop + anti-tremolio)**: serve **solo** questa app (URL fisso `https://espressioni-monomi-polinomi.easy-peasy.site/`). 🛡️ **IMPERMEABILE**: funziona anche se il blog ha altre cornici simili nella stessa pagina — ogni istanza è un'isola (id univoci con token, scoping DOM, filtro `e.source`, token `?cornice=` rispecchiato dall'app). Pulsanti **Schermo intero** e **Ricarica** sulla stessa riga del titolo, **spinner**, **stato online/errore** con Riprova (timeout 15 s), ping periodico + altezza al resize, **anti-tremolio** (debounce + clamp + conferma salti sospetti + congelamento). Font OpenDyslexic via CORS. **La versione consigliata per questo blog.** |
| `embed-espressioni-lite.html` | **Versione leggera (~7 KB)**: font OpenDyslexic caricati dall'app via CORS. Codice piccolo e leggibile. **Riutilizzabile**: per un'altra app basta cambiare la riga `APP_URL` (o passare `?app=URL` nella pagina). Richiede che l'app sia online. |
| `embed-espressioni-autosufficiente.html` | **Versione autosufficiente (~110 KB)**: font incorporati in base64. Funziona anche se l'app è offline (i font restano) ed è robusta su qualsiasi piattaforma. Rigenerabile con `python3 generate_embed.py`. |
| `embed-universale.html` | **Template universale per altre app**: identico alla versione lite ma con URL segnaposto (`https://LA-TUA-APP.example.com/`). Copia il file, cambia `APP_URL` e `APP_TITLE` e incollalo dove vuoi. |
| `test-dedicata.html` | Pagina di test semplice: simula un post che carica la cornice dedicata. Apri in un browser (servita da un server, non da file://). |
| `test-impermeabile.html` | **Pagina di test dell'impermeabilità**: simula il blog con 2 cornici + una cornice «estranea» che tenta il furto dell'iframe e posta altezze false. Rigenerabile con `python3 generate_test_impermeabile.py`. |
| `fonts/OpenDyslexic-Regular-v2.woff2` | Font OpenDyslexic Regular servito dall'app (URL usato dalle versioni lite/dedicata) |
| `fonts/OpenDyslexic-Bold-v2.woff2` | Font OpenDyslexic Bold servito dall'app (URL usato dalle versioni lite/dedicata) |
| `generate_embed.py` | Rigenera la versione autosufficiente (font in base64) |
| `generate_test_impermeabile.py` | Rigenera `test-impermeabile.html` dalla cornice dedicata |
| `README.md` | Questo file |

## Come si usa

1. Apri il post in Blogger e passa alla **vista HTML**.
2. Incolla l'intero contenuto di `embed-espressioni-dedicata.html` (⭐ consigliata),
   di `embed-espressioni-lite.html` (minima) o di
   `embed-espressioni-autosufficiente.html` (autosufficiente).
3. Pubblica. L'iframe mostra l'app e si adatta da solo all'altezza del contenuto
   (desktop, tablet, cellulare).

## Riutilizzare la cornice per un'altra app

Le versioni **lite** e **universale** sono riutilizzabili: per un'altra app basta
cambiare la riga `APP_URL` nella sezione `⚙️ CONFIGURAZIONE` (e, facoltativamente,
`APP_TITLE`). Tutto il resto — iframe, font OpenDyslexic, altezza dinamica — si
adatta da solo.

**Bonus (zero modifiche):** se l'URL è passato come parametro della pagina, ha la
precedenza su `APP_URL`:

```
https://tuosito.it/post?app=https://mia-altra-app.example.com/&title=LA MIA APP
```

- `app` (o `url`): l'URL dell'app da mostrare nella cornice
- `title`: (facoltativo) il titolo mostrato nella barra della cornice

Nota sui font: la cornice carica gli OpenDyslexic da `APP_URL/fonts/*`. Le app
della famiglia LabVisivo li servono con CORS abilitato; se l'app target non li
serve, si usano i font di riserva (Cambria/Georgia) senza alcun errore bloccante.

## Le versioni a confronto

| Caratteristica | `...-dedicata.html` | `...-lite.html` | `...-autosufficiente.html` |
|---|---|---|---|
| Dimensione | ~22 KB | ~7 KB | ~110 KB |
| Dedicata a questa app | ✅ sì (URL fisso) | riutilizzabile (`?app=`) | riutilizzabile |
| Schermo intero / Ricarica | ✅ sì | solo «Apri ↗» | solo «Apri ↗» |
| Stato online/errore + Riprova | ✅ sì (timeout 15 s) | no | no |
| Spinner di caricamento | ✅ sì (con `prefers-reduced-motion`) | no | no |
| Multi-embed sicuro (impermeabile) | ✅ sì | no (id globali) | no (id globali) |
| Font OpenDyslexic | via `/fonts/*` (CORS) | via `/fonts/*` (CORS) | incorporati in base64 |
| App online richiesta | sì (font + contenuto) | sì (font + contenuto) | solo per il contenuto |
| Vantaggio | completa, dedicata, impermeabile, stato incluso | codice minimo e leggibile | funziona ovunque, zero dipendenze |

## 🛡️ Impermeabilità e anti-tremolio

Ogni cornice dedicata è un'**isola non comunicante**:

1. **Scoping DOM per istanza**: lo script trova il PROPRIO `<div class="lf-cornice">`
   risalendo da `document.currentScript` (non per id globale).
2. **Id univoci con token**: a runtime gli id vengono rinominati con un suffisso
   casuale (`lfIframe-lf5ebjz6da`…): nessun'altra cornice può agganciare i nostri elementi.
3. **Filtro `e.source`**: il listener accetta messaggi **solo** dal PROPRIO iframe.
4. **Token `cornice`**: l'URL dell'iframe porta `?cornice=<token>`; l'app lo
   rispecchia nei messaggi (`client/src/lib/heightSync.ts`) e la cornice rifiuta token altrui.
5. **Anti-tremolio**: nessuna transizione CSS sull'altezza; debounce ~200 ms; clamp
   100–15000 px; conferma dei salti sospetti (crescita > 2×); congelamento di 5 s
   dopo 3 crescite consecutive.

Puoi incollare la stessa cornice in **più post della stessa pagina**: ogni
istanza resta indipendente.

## Come funziona l'altezza dinamica

- L'app (dentro l'iframe) misura la propria altezza reale e la invia al genitore
  con `{ type: "labvisivo:height", height: <numero> }` — codice in
  `../client/src/lib/heightSync.ts` (inizializzato da `../client/src/main.tsx`).
- La cornice ascolta i messaggi e imposta `iframe.style.height`, e invia un ping
  (`{ type: "labvisivo:ping", cornice: <token> }`) dopo il caricamento: l'app
  risponde **rispecchiando il token**.
- Quando l'app è in iframe aggiunge la classe `lf-embedded` a `<html>` e disattiva
  `min-h-screen`/`min-h-dvh` (vedi `../client/src/index.css`): niente crescita infinita.
- `currentHeight()` in `heightSync.ts` NON usa `documentElement.scrollHeight` come
  riferimento assoluto (altrimenti la cornice non può restringersi → vuoto sotto la
  card): usa `Math.max(body.scrollHeight, body.offsetHeight, documentElement.offsetHeight)`
  e aggiunge `documentElement.scrollHeight` SOLO se supera `window.innerHeight`.

## CORS sui font

Per le versioni lite e dedicata il server dell'app risponde a `/fonts/*` con
`Access-Control-Allow-Origin: *` (in `../server/index.ts`). Senza questo header il
browser bloccherebbe il `@font-face` cross-origin quando la cornice è su Blogger.

## Come ricostruire la cornice (per l'IA o a mano)

0. **Nuova app, zero modifiche al codice**: parti da `embed-universale.html`
   (template con URL segnaposto), imposta `APP_URL` (e, facoltativo, `APP_TITLE`)
   nella sezione `⚙️ CONFIGURAZIONE` e incolla il file dove vuoi. In alternativa
   passa `?app=URL&title=NOME` come parametri della pagina senza toccare il file.

1. **Nuova app con la versione DEDICATA (Schermo intero + Ricarica + stato +
   impermeabile)**: parti da `embed-espressioni-dedicata.html` e cambia:
   - la `APP_URL` nella sezione `⚙️ CONFIGURAZIONE` (riga `var APP_URL = ...`);
   - i due URL dei font nel blocco `@font-face` in cima al file
     (`https://espressioni-monomi-polinomi.easy-peasy.site/fonts/...` → l'URL della tua app);
   - il testo del titolo in `<p class="lf-titolo">…</p>` e i commenti di intestazione.
   Tutto il resto (Schermo intero, Ricarica, spinner, stato, impermeabilità) è già pronto.

2. **URL dell'app (file esistenti)**: nei file HTML cerca
   `https://espressioni-monomi-polinomi.easy-peasy.site` e sostituiscilo con l'URL
   di produzione aggiornato.

3. **Font (versione autosufficiente)**: i WOFF2 incorporati provengono dai font in
   `../client/public/fonts/`. Per rigenerarla: `python3 generate_embed.py`
   (aggiorna prima URL/titolo nel TEMPLATE dello script).

4. **Perché base64 (versione autosufficiente)?** Incorporando i font la cornice
   funziona ovunque anche senza CORS o con l'app momentaneamente offline.

⚠️ **Test in sandbox**: il dev server Vite aggiunge `COEP: require-corp` a tutte le
risposte e blocca gli iframe cross-origin (la cornice mostra «app non raggiungibile»
anche se è a punto). Per provare nel browser: servire la pagina di test da un server
senza COEP (es. `python3 -m http.server 8000`) o testare same-origin.

## Accessibilità dell'embed

La cornice preserva l'accessibilità dell'app anche dentro un post: font
**OpenDyslexic** anche nella cornice (via CORS nelle versioni lite/dedicata, in
base64 in quella autosufficiente), **altezza automatica** dell'iframe (protocollo
`labvisivo:height`, nessun contenuto tagliato), **spinner con
`prefers-reduced-motion`**, **pulsanti con `focus-visible`** e `aria-label`
nella versione dedicata, e pagina interna senza `min-h-screen` quando è in embed
(classe `lf-embedded`). Il recap completo delle misure di accessibilità dell'app è
in [`../ACCESSIBILITA.md`](../ACCESSIBILITA.md).

## Note di stile

- La cornice riprende i colori dell'app: sfondo carta `#f8f1e4` **uniforme**
  (la barra di accessibilità interna all'app è bianco caldo `#fdfbf8` con capsule
  crema `#f5f0e6`, bordi `#dedbd6`, testo `#2e2118`), bordo morbido
  `rgba(46,32,24,.15)` + ombra leggera, titolo inchiostro `#2e2018`.
- Il titolo «ESPRESSIONI LETTERALI · MONOMI E POLINOMI» è in **OpenDyslexic Bold**
  (17px, letter-spacing 2px), lo stesso font usato in tutta l'app
  (vedi `../client/src/index.css`).
- Nella versione dedicata, su schermi stretti (mobile) le etichette dei pulsanti
  si nascondono (`.lf-lbl { display: none }`) e restano solo le icone.

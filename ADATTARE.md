# ADATTARE — clonare e costruire nuove app simili

**Baseline funzionale pubblicata:8756.** Distinguere copia identica e nuova variante.
Leggere `REBUILD.md`, `AGENTS.md` e **`FILOSOFIA-DSA.md`** prima di iniziare.
Non riscrivere l’architettura né eliminare accessibilità, input, controlli
esatti o PDF per cambiare argomento. Non modificare l’app sorgente per
costruirne una nuova.

## 1. Clone identico: procedura verificabile

1. Estrarre il pacchetto completo o clonare il repository in una cartella
   NUOVA; nessuna copia di `.env`, `dist`, `env.generated.ts`, database o sessioni.
2. In Easy-Peasy inizializzare una NUOVA app con backend (`web-db-user`)
   se usa le API IA. Un clone Git da solo non cambia il contesto di deploy.
   Su GitHub creare un nuovo repository e non mantenere l’origin della sorgente.
3. Conservare `package.json`, `pnpm-lock.yaml`, `patches/`, asset font,
   ONNX/WASM/Tesseract/PDF e tutte le guide. Il nome npm storico può restare
   per un clone identico; se lo si cambia, aggiornare coerentemente il lockfile.
4. Verificare prima la copia senza segreti: install frozen → check → test
   in `client` → build → hash client della baseline. Vedere `REBUILD.md`.
5. Configurare la PROPRIA chiave server e, se necessaria, la PROPRIA persistenza.
   Non collegare il database dell’app sorgente. La build genera `env.generated.ts`.
6. Soltanto dopo la baseline, applicare le variazioni richieste, testarle e
   aggiornare titolo, guide, `render.yaml`, URL della cornice e rapporto.
7. Preview → test → condivisione → consenso successivo per la produzione.
   Mai pubblicare un’altra app dalla chat di questa sorgente.

## 2. Mappa corrente: cosa cambiare e cosa conservare

| Ambito | File da esaminare | Contratto da preservare |
|---|---|---|
| Titolo e dati iniziali | `WelcomePage.tsx`, `client/index.html` | dati studente e leggibilità |
| Seconda pagina/input | `EspressioniExercises.tsx`, `App.tsx`, `index.css` | toolbar esterna, scroll limitato, `piece-display` |
| Costruzione e verifica dominio | `server/costruisci.ts`, `client/src/lib/espressioni.ts` e verificatori pertinenti | IA propone, motore dispone |
| Terza pagina e PDF corrente | `EsercizioFrazioni.tsx`, tipi dei box | risultati dello studente, svolgimento reale |
| Motore/PDF del percorso storico locale | `espressioni.ts`, `pdf.ts`, `mappaPdf.ts` | non confonderli con il flusso universale attuale |
| Audio, tastiera e foto | `useRecorder.ts`, `keyboardNotation.ts`, `audioNotation.ts`, `server/audio.ts`, `/api/ai/*` | trascrivere senza risolvere |
| Foto/crop | `TRAPIANTO-FOTO.md` e kit completo | modal=true + hook/CSS/heightSync, PNG |
| Accessibilità | `ACCESSIBILITA.md`, provider/toolbar/TTS/font | conservare tutte le misure e ARIA |
| Tema e distribuzione | `index.css`, `cornice-dinamica/`, `render.yaml` | nuova identità/URL senza alterare la sorgente |

Pagine: `client/src/pages/`; hook: `client/src/hooks/`; librerie:
`client/src/lib/`. `server/costruisci.ts` vive fuori da `client`.

## 3. Varianti e limiti reali

### A. Nuovi contenuti o nuova lingua

Cambiare testi, esempi, titoli, prompt del dominio e lingua TTS; adattare
anche PDF e messaggi di validazione. Non limitarsi alla prima pagina.
Separare lingua di input, lingua UI, notazione matematica e voce TTS.
Per inglese/spagnolo/francese mantenere controlli su virgole, punti, frazioni,
radici e parentesi. Non tradurre alla cieca i simboli o le chiavi dei tipi.
La chiave IA e il database non fanno parte del contenuto da copiare.

### B. Nuove tipologie di espressioni

Estendere la logica deterministica pertinente e il contratto dei box in
`server/costruisci.ts` / `EsercizioFrazioni.tsx`; esaminare separatamente il
motore locale `espressioni.ts`. Prima aggiungere casi esatti e limite,
poi verificare UI/PDF: non assumere che qualsiasi nuovo kind sia già renderizzato.
Ogni catena deve conservare il valore, senza suggerimenti che rivelino la risposta.

### C. Equazioni e disequazioni

Leggere `ADATTARE-EQUAZIONI.md` e `ESPORTA-PAGINE-1-2-EQUAZIONI.md` come
**specifiche per sviluppare una variante**, non prova che la sorgente
risolva già qualsiasi forma. La sostituzione `t=x^k` gestisce famiglie
strutturate (per esempio `a*x^(2k)+b*x^k+c=0`), NON tutti i polinomi di
qualunque grado. Non sostituire globalmente cifre 2/4 nel codice.

Progettare e testare parser/classificazione, coefficienti nulli, radici
reali, molteplicità e ritorno da `t` a `x`; per `k` pari gestire `t<0` e ±,
per `k` dispari il segno. Per disequazioni aggiungere studio del segno,
estremi/intervalli e molteplicità. Per forme fratte aggiungere dominio,
denominatori nulli e controllo finale sulle espressioni ORIGINALI.
Rifiutare in modo chiaro forme non supportate, senza risultati inventati.

### D. Quiz o altra famiglia didattica

Questa sorgente NON include dashboard docente/codici classe o un formato
quiz pronto. VERO/FALSO, risposte multiple a 3/4 opzioni e risposte brevi
richiedono uno schema domande, validatori e UI propri; non si ottengono
cambiando il titolo. Usare una sorgente quiz con la skill
`didattica-app-classe`, oppure progettare esplicitamente la nuova attività.
Riutilizzare da qui solo i componenti richiesti e gli invarianti accessibili.

## 4. Trapianto audio/tastiera

Copiare `useRecorder.ts`, `keyboardNotation.ts`, `audioNotation.ts`, i test
pertinenti e `server/audio.ts`; integrare le SOLE rotte necessarie in
`server/index.ts`, senza duplicare il server dell’altra app.
Estrarre il pannello da `EspressioniExercises.tsx` in un componente con
`onConfirm(notazione)`. Se serve, integrare `NumberInputCanvas.tsx`
adattando la validazione del dominio. Preservare auto-stop 20s e anti-duplicati.

Copiare lo script `scripts/sync-env.mjs`, **NON il file generato**
`shared/env.generated.ts`: generarlo nel nuovo ambiente con la propria chiave.
Nella cornice mantenere `allow="microphone"`. Non copiare motore, PDF o
sessioni dell’app se si sta trapiantando soltanto l’input.

## 5. Trapianto foto e layout

Seguire `TRAPIANTO-FOTO.md`: componente `CropDialog` + hook viewport + CSS
+ geometria crop + normalizzazione foto + guardia/evento heightSync e
consumer `onConfirm(File)`. Non copiare solo il JSX e non ripristinare
`modal={false}` dal vecchio pattern. Non toccare `confirm()`/`cropBox.ts`
per cambiare lo scroll.

Layout8756: pagina2 fissa640px e pagina3 adattiva fino a640px, toolbar
esterna allo scroll; wrapper App, CSS e unico heightSync da copiare insieme.
Regione pagina3 `expr-exercise-scroll` con flex-basis:auto, non il nome
storico `expr-exercise-page` che attiva altri font. Conservare `piece-display`
su ogni box KaTeX. Header pagina2 senza titolo/dati studente, INDIETRO
marrone e didascalia corta in grassetto; prima pagina non limitata.
Se trapianti solo pagine1/2, non aggiungere un vincolo alla pagina3 della
nuova app senza averne valutato struttura e accessibilità.

## 6. Checklist finale della variante

- [ ] Nuovo contesto/repository/ambiente, nessun dato o segreto sorgente.
- [ ] Baseline identica ricostruita prima delle modifiche.
- [ ] Filosofia DSA invariata: MAI la soluzione, nemmeno scritta o letta.
- [ ] Casi del dominio ed equivalenza deterministica testati, limiti dichiarati.
- [ ] Input mano/audio/tastiera/foto, parentesi, decimali e frazioni preservati.
- [ ] OpenDyslexic, TTS, ARIA, focus, contrasto, crop e scroll mobile/iframe.
- [ ] PDF dello svolgimento della NUOVA attività, non quello predefinito.
- [ ] `pnpm check`, `(cd client && pnpm exec vitest run)`, `pnpm build` verdi.
- [ ] Titolo, cornice APP_URL, Blueprint, README e guide coerenti.
- [ ] Nuovo ZIP esportato da commit pulito e ricostruito da nuova estrazione.
- [ ] Preview condivisa; produzione solo dopo nuova conferma esplicita.

La precedente guida completa è conservata in
`docs/storico/ADATTARE-prima-riordino-2026-10-29.md`; le sue istruzioni
superate, inclusa la copia di file generati o le promesse di gradi arbitrari,
non prevalgono su questa versione.


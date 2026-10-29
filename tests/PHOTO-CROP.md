# Collaudo del ritaglio 8731

Il componente runtime e il suo hook/CSS sono copiati dal documento allegato.
La route di prova NON fa parte dell'app consegnata. I test non chiamano
servizi IA reali: il flusso finale usa una risposta matematica simulata.

## Suite sulla pagina reale

Richiedono `playwright` e Chromium in un ambiente di collaudo separato.
Il progetto non acquisisce una dipendenza runtime da Playwright.

```sh
CROP_QA_BASE_URL=https://URL-ANTEPRIMA node crop-mobile.e2e.mjs
CROP_DRAG_BASE_URL=https://URL-ANTEPRIMA node crop-drag.e2e.mjs
```

Se gli script sono copiati in un ambiente di collaudo, il package
`playwright` deve essere risolvibile dalla cartella degli script stessi.
`CROP_CASE=mobile-393` seleziona un caso della suite mobile.

I casi iframe simulano un blog cross-origin con cornice auto-alta. La
misura per il freeze viene acquisita DOPO il lock del cropper: i resize
di caricamento precedenti all'apertura non sono errori del dialogo.

## Fixture generica (soltanto per sviluppo/collaudo)

Per rieseguire `photo-crop-portable.mjs` e `crop-small.e2e.mjs`:

1. Copiare `fixtures/photo-crop/PhotoCropBridge.tsx` in
   `client/src/components/PhotoCropBridge.tsx`.
2. Copiare `fixtures/photo-crop/PhotoCropDemo.tsx` in
   `client/src/pages/PhotoCropDemo.tsx`.
3. Importare temporaneamente `PhotoCropDemo` in `App.tsx` e aggiungere
   `<Route path="/photo-crop-test" component={PhotoCropDemo} />`
   prima del fallback.
4. Riavviare Vite se la route servita resta in cache.
5. Eseguire:

```sh
CROP_KIT_URL=https://URL-ANTEPRIMA node photo-crop-portable.mjs
CROP_QA_BASE_URL=https://URL-ANTEPRIMA node crop-small.e2e.mjs
```

6. A fine test rimuovere import, route e le due copie da `client/src`.
   Conservare solo gli originali nella cartella `tests/fixtures`.
7. Eseguire `pnpm check` e `pnpm build`. Il bundle finale non deve
   contenere `photo-crop-test` o «Prova del photo crop».

Il PNG del test è realmente decodificato: tipo MIME, dimensioni,
proporzioni e limite 2200px vengono controllati sul file generato.
Le prove touch usano Chromium emulato, non dispositivi fisici.


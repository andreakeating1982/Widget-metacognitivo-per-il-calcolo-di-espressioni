# Collaudo pulsanti: ritaglio foto e cornice — 7 novembre 2026

> Nota storica: dopo questo collaudo l'utente ha chiesto di ripristinare i
> pulsanti chiari originali della cornice. Colori, dimensioni e aspetto dei
> pulsanti descritti in questo documento fotografano la versione precedente.

## Modifiche collaudate in anteprima

Questa versione è stata successivamente pubblicata nell'app con deploy
**8999** il 7/11/2026: vedere `docs/DEPLOY-8999.md`. Il post Blogger resta
un elemento separato e non è stato aggiornato automaticamente.

**Ritaglio.** Con font al 160% e larghezza 320px i vecchi pulsanti limitati
al 50% facevano uscire le parole e alcune icone dai propri bordi. Il footer
ora tiene conto della dimensione del font: se lo spazio non basta, dispone
i pulsanti su righe centrate. Il testo non viene rimpicciolito. Componente,
rotazione, otto maniglie, drag, PNG, hook viewport e heightSync sono invariati.

**Cornice.** Nel post effettivo Blogger aveva trasformato i path SVG
originali autochiusi in path annidati: alcuni tratti dei simboli non venivano
mostrati. La cornice dedicata usa ora un path completo e chiuso per ogni
icona. I pulsanti hanno icone da 22px, area minima 44×44px, focus ed
etichette accessibili; bianco su marrone ha contrasto misurato circa 8,57:1.
Lo script della cornice, con token, filtro e.source e anti-loop, è invariato.

## Test e limiti

| Verifica | Risultato |
|---|---|
| TypeScript e build | superati |
| Test unitari geometria crop | 10/10 |
| Ritaglio: bordi, parole, icone, font, maniglie, rotazione e conferma | 10/10 scenari, 150 controlli |
| Cornice: icone, contrasto, schermo intero, ricarica e isolamento | 6/6 scenari, 58 controlli |
| Regressione ritaglio mobile, rotazione e iframe | **9/9 scenari** |
| Trascinamento con mouse e touch | **4/4 scenari** |
| Scorrimento della seconda pagina e accessibilità | **7/7 scenari** |

I test del ritaglio caricano un'immagine sintetica, ricevono una risposta OCR
simulata e non accedono al database. Il cropper genera un PNG; il consumer IA
lo normalizza in JPEG per la richiesta, come già avveniva. Display/touch sono
emulati in Chromium: non si tratta di una prova su dispositivi fisici.
La cornice corretta è stata testata nella pagina di prova, non ripubblicata
nell'editor Blogger; il post esistente resta invariato.

## Correzione successiva: stile della foto

Dopo il collaudo storico sopra, i pulsanti della cornice sono stati riportati
allo stile chiaro della fotografia: sfondo avorio, bordo sottile, testo e
icone scuri. Su desktop misurano come gli originali (gruppo 243×32px, icone
16px); le etichette restano visibili anche su telefono. L'area tappabile è
estesa senza modificare il bordo visibile. Sono stati verificati 6/6 scenari
(desktop, mobile, orientamento orizzontale e due cornici) con test di tocco,
focus, schermo intero, ricarica e isolamento. Il cropper non è stato
modificato: la regressione mobile con caratteri al 160% è superata.

## Anteprima e blog

`/anteprima-cornice.html` è generata dal file dedicato e carica l'app dello
stesso ambiente, senza modificare il post. La cornice da usare su Blogger è
`cornice-dinamica/embed-espressioni-dedicata.html`: **il post esistente non
cambia automaticamente**. Dopo l'approvazione, sostituire soltanto questa
cornice nel post; la Cornice Universale del PDF è un elemento distinto e non
va toccata. L'app è stata pubblicata nel deploy 8999; il post non è stato
modificato automaticamente.


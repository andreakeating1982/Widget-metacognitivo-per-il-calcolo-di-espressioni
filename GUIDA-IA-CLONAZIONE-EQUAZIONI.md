# GUIDA IA — CLONAZIONE COMPLETA E ADATTAMENTO A EQUAZIONI

**Documento operativo prioritario per una NUOVA app.** Baseline: Widget
Metacognitivo per il Calcolo di Espressioni, produzione 9213 (13/11/2026; `docs/DEPLOY-9213.md`).
Questo pacchetto contiene l'app di **espressioni** effettivamente pubblicata,
NON un risolutore universale di equazioni già pronto. Un'agente IA può
clonarla integralmente e sviluppare una variante su equazioni del tipo/grado
richiesto; non basta cambiare un titolo o il prompt. Procedi per famiglie,
testando e dichiarando ciò che funziona e ciò che non è ancora supportato.
L'obiettivo è permettere all'IA di sviluppare una nuova app simile per
equazioni di qualunque grado e tipologia, implementando e collaudando le
famiglie progressivamente. La copia non possiede già tali funzioni. Le note
precedenti di `ADATTARE-EQUAZIONI.md` sono storiche e subordinate alla presente
guida; usa qui il contratto corretto di equivalenza e dominio.

## 1. Clonare davvero l'intera app

Dopo aver estratto lo ZIP, entra nella directory contenente `package.json`,
oppure clona il repository GitHub che contiene questi file alla root. In
questa directory lancia:

```sh
# Copia da ZIP estratto (usa il manifest, verifica ogni hash)
python3 scripts/clona-app-equazioni.py --source "$PWD" \
  --output ../widget-equazioni

# Alternativa: da un repository locale pulito o da un URL HTTPS GitHub
python3 scripts/clona-app-equazioni.py \
  --source https://github.com/UTENTE/REPOSITORY.git \
  --output ../widget-equazioni
```

Destinazione NUOVA, mai la sorgente o una sua sottocartella. Lo script non
sovrascrive nulla; copia i file del manifest verificato oppure i file Git
tracciati di un repository pulito. Esclude `.env` reali, credenziali note,
`.git`, `node_modules`, `dist`, DB, sessioni, log e artefatti di runtime.
Lo scanner non è una garanzia assoluta: controlla comunque i file prima di
pubblicare. La copia contiene tutto il codice, gli asset e le guide, non è
un collegamento alla cartella originale. Non duplica né crea dati utente.
Il file `MANIFEST-SHA256.json` del pacchetto descrive *soltanto* il pacchetto
originale, quindi non viene trasferito nel clone in evoluzione.

1. Entra in `../widget-equazioni` e verifica **prima** la copia senza
   modifiche secondo `REBUILD.md` (Node 22, pnpm 10.4.1, lockfile, check,
   test e build). Senza chiave server l'IA restituisce 503; alcuni percorsi
   locali sono disponibili. Non inventare un risultato del test IA live.
2. Crea una nuova storia Git e, se serve, un NUOVO repository remoto.
   Non impostare come `origin` quello dell'app sorgente. Non fare push o
   pubblicazione senza il permesso dell'utente.
3. Usa una nuova app/servizio, un nuovo ambiente e, se necessario, un proprio
   database. Non condividere `DATABASE_URL`, cache, `sid`, tabelle, dati o
   segreti con la sorgente. Non eseguire seed, pulizie, reset o migrazioni
   distruttive su dati reali. `render.yaml` nel clone è un modello della
   sorgente: cambiane nome/identità prima di un eventuale nuovo deploy.
4. Configura solo nell'ambiente server la propria `EASY_PEASY_API_KEY` se
   disponibile e consentita; non copiare `.env`, `shared/env.generated.ts`
   né bundle server compilato. Non esportare la chiave nel client.
5. Solo dopo la baseline, sviluppa la variante; il comando di copia **non**
   converte automaticamente l'app in un solutore di equazioni.

## 2. Componenti da conservare e punti realmente da modificare

| Area | File o contratto attuale | Lavoro per una variante |
|---|---|---|
| Interfaccia, router e titoli | `client/src/App.tsx`, `client/src/pages/WelcomePage.tsx`, `client/index.html`, `client/src/index.css` | Copiare layout/palette e cambiare solo identità/testi necessari |
| Input mano/audio/tastiera/foto | `client/src/pages/EspressioniExercises.tsx`, `MathDrawCanvas.tsx`, `useMathRecognition.ts`, `keyboardNotation.ts`, `audioNotation.ts`, `CropDialog.tsx`, `exprOcr.ts`, `server/index.ts` | Conservare e controllare i due membri e `=`; trascrizione fedele, conferma modificabile; non risolvere durante OCR |
| Parser | `client/src/lib/espressioni.ts`, `keyboardNotation.ts` | Parser relazione NUOVO; la funzione esistente è per espressioni e non va presunta capace di rappresentare equazioni intere |
| Generazione | `server/costruisci.ts`: `costruisciPrompt`, `costruisciEsercizioConIA`, `riparaEsercizio` | Prompt/contratto di equazione e percorso guidato; server conserva solo proposte validate |
| Verifica | `server/costruisci.ts`: `verifica`, `contoGiusto`; `client/src/pages/EsercizioFrazioni.tsx`: `stessaForma`, `boxRisposto`; `criteriDidattici.ts` | **Nuovo verificatore di insiemi soluzione, dominio, trasformazioni e risposte per tipo**. Quello attuale verifica espressioni: riusarlo invariato non basta |
| Box, risposta e soluzione su richiesta | `NumberInputCanvas.tsx`, `soluzioneCalcolatrice.ts`, `EsercizioFrazioni.tsx` | Stesso stile, toggle e `aria-expanded`; estendere il formato/validatori ai nuovi tipi (insiemi, intervalli, impossibile, identità) oppure dichiarare non disponibile, senza inventare testo |
| Sessioni/cache | `server/costruisci.ts`, API `sid` | Isolare ambiente e DB della nuova app; versionare la chiave cache con dominio/tipo/assunzioni/versione solver |
| PDF e feedback | `EsercizioFrazioni.tsx` (`scaricaPdf`, dati, primo colpo) | PDF dei soli passi effettivi della nuova sessione, non un esercizio default o un'altra sessione; preservare il feedback |
| Accessibilità e iframe | `ACCESSIBILITA.md`, font locali, `AccessibilityToolbar.tsx`, `heightSync.ts`, `cornice-dinamica/` | Conservare toolbar, focus, TTS, scroll, tema e altezza; aggiornare l'URL della cornice per la nuova app |

## 3. Contratto matematico: prima di scrivere il prompt

Raccogli il **tipo preciso richiesto** (equazione o, se richiesto, disequazione),
variabile, insieme di riferimento ℝ o ℂ, grado/famiglie, eventuali parametri,
formato delle soluzioni e supporti richiesti. Se manca una scelta decisiva,
chiedila. Se si decide ℝ come default, dichiaralo chiaramente. Conserva
originale, membro sinistro, membro destro, operatore e tutte le condizioni
sull'esistenza, senza trasformare automaticamente l'input fotografato.

Schema consigliato da definire nel NUOVO codice (è una specifica, non un
modulo già implementato):

```ts
type Relazione = '=' | '<' | '<=' | '>' | '>=';
type EquazioneInput = { originale: string; sinistra: string; destra: string;
  relazione: Relazione; variabile: string; insieme: 'R' | 'C';
  condizioni: string[]; versioneSolver: string };
type Risposta = { tipo: 'espressione' | 'equazione' | 'insieme' | 'intervalli' |
  'impossibile' | 'identita' | 'condizione'; testo: string };
type Verdetto = { stato: 'corretto' | 'errato' | 'non_verificabile'; motivo?: string };
```

I campi/formati sono da implementare e validare: non spacciare per tipologie
attuali. Gestisci `=` come **separatore top-level unico**, senza spezzare
parentesi; rifiuta input ambigui o non supportati con messaggio chiaro.
Per disequazioni accetta anche `<=` e `>=` e verifica l'operatore.

**L'IA propone, il motore decide.** Verifica conti esatti quando possibile;
per un passo di equazione accerta la conservazione *dell'insieme delle
soluzioni ammissibili*, non la mera uguaglianza dei due polinomi L−R. Per
esempio, moltiplicare per una costante non nulla cambia L−R ma conserva le
soluzioni; dividere o moltiplicare per una quantità dipendente da x può
invece perdere o introdurre soluzioni. Effettua una prova esatta o una
trasformazione con ipotesi esplicite e rami; se non puoi dimostrarla restituisci
`non_verificabile`, non `corretto`. Una manciata di sostituzioni numeriche
è utile per smentire un'uguaglianza ma **non prova** l'equivalenza generale.
Sostituire le radici trovate nell'originale è necessario, ma da solo NON
prova che l'insieme sia completo. Gestisci anche identità, impossibili e
infinità di soluzioni; non inventare un elenco finito.

## 4. Famiglie: scegliere e implementare gli algoritmi

- **Lineari e degeneri:** coefficienti nulli, equazioni determinate,
  impossibili e identità. I passi di trasporto vanno verificati sui due membri.
- **Quadratiche complete/incomplete:** calcoli esatti; discriminante e radici
  con molteplicità; distinguere ℝ da ℂ; `a=0` passa al caso di grado minore.
- **Grado qualunque (polinomiali):** prima semplifica coefficienti esatti e
  determina il grado effettivo; fattorizzazione certificata dove disponibile;
  isolare radici reali e rappresentarle esattamente anche tramite intervalli
  razionali certificati o numeri algebrici, se il motore li supporta. Nessuna
  formula con radicali generale per tutte le equazioni di grado ≥5: non
  promettere soluzioni simboliche sempre in radicali. Se manca un algoritmo
  verificabile, segnala l'input non supportato invece di inventare radici.
- **Trinomie in `x^(2k)` e `x^k`:** solo se la forma è corretta, usa
  `t=x^k`; per k pari considera il dominio t≥0, zero una sola volta e ± per
  t>0; per k dispari conserva anche t negativi. Questa tecnica NON copre
  tutti i polinomi di quel grado. Verifica l'insieme completo nell'originale.
- **Fratte:** calcola e conserva i denominatori ORIGINALI ≠0 anche dopo
  semplificazioni; distinguere condizioni di esistenza e soluzioni. Elimina
  radici estranee e non perdere eventuali identità definite solo sul dominio.
- **Irrazionali, con valori assoluti o potenze:** introduci condizioni di
  dominio e rami, traccia i passaggi non reversibili (per esempio elevare al
  quadrato) e verifica ogni candidato nell'originale; dimostra completezza.
- **Esponenziali, logaritmiche, trigonometriche, parametriche e altre:**
  richiedono parser, dominio, metodi e rappresentazioni specifici (famiglie
  periodiche, intervalli, casi per parametri, ecc.). Non sono automaticamente
  implementate dalla copia. Chiedi il perimetro, implementa e testa per famiglie.
- **Disequazioni, solo se richieste:** tabella dei segni, molteplicità,
  inversione verso per moltiplicazione/divisione per negativo, estremi aperti
  o chiusi, discontinuità, condizioni e confronto di unioni di intervalli.

### Moduli, dominio e completezza della variante

La 9212 sostituisce `|A|` con `A` SOLO nel ramo con `A ≥ 0`, dichiarato
separatamente dalle C.E.; gli altri casi non vengono svolti (`docs/DEPLOY-9212.md`).
Nel clone per equazioni **non presentare il solo ramo positivo come tutte le
soluzioni**: per A reale, se l'obiettivo è completo costruire e verificare
anche il ramo `A < 0`, in cui `|A| = -A`, applicando sempre le C.E. originali;
fondere le soluzioni ammissibili senza duplicati. Se non puoi farlo, dichiara
il ramo mancante e `non_verificabile`. Per variabili complesse il confronto
`A ≥ 0` non è generalmente definito: serve un modello matematico adatto.
Mai cancellare barrette ovunque incondizionatamente. Le condizioni aggiuntive
non sono una scorciatoia per escludere soluzioni valide senza avviso.

### Piano di copertura per grado e tipologia

Nel nuovo progetto costruisci un registro esplicito delle famiglie, con un
identificatore, tipo di input, dominio, rappresentazione del risultato,
algoritmo, validatore indipendente, casi limite e stato `supportato`,
`parziale` o `non_supportato`. Non usare un unico prompt IA come solutore.
Ordine consigliato: (1) lineari/degeneri, (2) polinomiali in una variabile
con grado effettivo e isolatori certificati, (3) razionali/fratte e dominio,
(4) radicali e moduli con rami, (5) esponenziali/logaritmiche, (6)
trigonometriche e soluzioni periodiche, (7) parametriche, sistemi e ulteriori
famiglie soltanto se richiesti. Ogni stadio richiede parser, solver, test e
UI appropriati, non è attivato automaticamente da questa lista.

Per polinomi in ℝ con coefficienti razionali usa eventualmente un CAS o
algoritmo esatto capace di isolare tutte le radici reali e certificare numero,
intervalli e molteplicità (ad esempio sequenze di Sturm, se implementate).
Per ℂ, coefficienti simbolici o trascendenti servono proprie rappresentazioni
e certificazioni: non pretendere che un algoritmo per razionali in ℝ li
copra. Per trascendenti esistono casi senza formule chiuse o insiemi infiniti:
usa espressioni implicite, famiglie parametrizzate o approssimazioni con
certificato e limiti espliciti solo se il motore e l'interfaccia li supportano.
Un'approssimazione non certificata non dimostra completezza. Non garantire
terminazione o risoluzione esatta universale per input matematici arbitrari.
Se l'obiettivo non è dimostrabile, mostra un messaggio comprensibile e non
presentare una risposta parziale come completa.

Distingui equazioni numeriche e letterali, coefficienti parametrici con casi
degeneri, grado effettivo e grado apparente, una o più variabili, insiemi
finiti, vuoti, infiniti o intervalli esclusi. Chiedi all'utente le preferenze
rilevanti se non specificate; non assumere che un sistema sia un'equazione in
una sola variabile. Accetta formati esatti equivalenti solo dopo verifica.

## 5. Percorso rapido per l'agente IA

1. Avvia dal clone, leggi `README.md`, `AGENTS.md`, `ACCESSIBILITA.md` e
   questa guida. Confronta sorgenti/versioni: non modificare l'app originale.
2. Aggiungi prima un set di test del dominio prescelto (vedi §6). Isola la
   logica in moduli puri. Usa razionali esatti; se introduci un CAS/libreria,
   verifica licenza, supporto effettivo, limiti, lockfile e sicurezza.
3. Implementa parser della relazione e condizioni originali in un modulo
   separato condivisibile da client e server. Non fare replace globale di
   `2`/`4` o modificare il solo prompt. Aggiungi trascrizione e correzione
   anche per `=` e per eventuali operatori richiesti.
4. Implementa classificatore, solver per le famiglie scelte e verificatore
   indipendente; prova trasformazioni valide e controesempi. Aggiungi tipi di
   box e risposte con controllo di insieme (ordine irrilevante, duplicati,
   ±, estremi, esclusioni). Associa un solo micro-obiettivo per box.
5. Adatta generazione IA, validazione lato server, validazione risposte lato
   client, sessione e PDF. Non usare come prova la sola risposta dell'IA.
   `MOSTRA SOLUZIONE` è nascosto all'inizio, indipendente per box e reversibile;
   mostra solo su richiesta, in una riga digitabile, non compila né risolve
   automaticamente. Se il nuovo tipo non è convertibile in modo fedele,
   non fingere una conversione: implementa il formato o segnala il limite.
6. Aggiorna titoli, istruzioni, guida tastiera, accessibility, nuova cornice,
   render.yaml e documenti. Mantieni frazioni impilate nelle formule, puntino
   moltiplicativo, condizioni e caratteri delle variabili. Per il toggle usa
   la notazione lineare prevista dall'app; non aggiungere l'avviso eliminato
   «SCRIVI IL RISULTATO COME FRAZIONE IMPILATA».
7. Esegui `pnpm check`, suite app e nuovi test; collauda input, ogni box,
   risultato e PDF su desktop/telefono simulato, casi reali e limiti. Con
   fixture sintetiche isola rete/DB; un mock non prova la disponibilità IA live.
8. Esegui anteprima e chiedi conferma per eventuale produzione in un turno
   separato, sul nuovo progetto. Esporta un nuovo ZIP e rapporto; non affermare
   che GitHub, Render, blog o sorgente siano stati aggiornati automaticamente.

## 6. Test minimi: oracoli per sviluppare la variante, non test già presenti

Per ℝ, oltre a casi generati e arrotondamenti controllati, aggiungi almeno:

| Input | Insieme o proprietà attesa nel NUOVO motore |
|---|---|
| `2*x+1=5` | `{2}` |
| `0*x=0`, `0*x=1` | rispettivamente ℝ e ∅ |
| `x^2-4=0`, `x^2=0`, `x^2+1=0` | `{−2,2}`, `{0}`, ∅ su ℝ |
| `x^4-5*x^2+4=0` | `{−2,−1,1,2}` |
| `x^5-x=0` | `{−1,0,1}`; non implica copertura generale del quinto grado |
| `(x^2-1)/(x-1)=2` | ∅: il candidato `x=1` è escluso dal denominatore originale |
| `(x-1)/(x-1)=1` | ℝ senza `1`, non ℝ |
| `sqrt(x)=-1` | ∅ su ℝ; elevare al quadrato crea un candidato estraneo |
| `x+1=3` → `2*x+2=6` | trasformazione equivalente nonostante polinomi L−R differenti |
| `x+1=3` → `x*(x+1)=3*x` | non equivalente su ℝ: aggiunge `x=0` |

Per ogni famiglia aggiungi errori di parse, segni, parentesi, radici multiple,
risposte equivalenti e controesempi. Per moduli prova almeno un caso con
soluzione nel ramo `A < 0`, uno su `A = 0`, uno nel ramo `A > 0`, un ramo
incompatibile con le C.E. e un esercizio con più moduli; richiedi completezza
dell'unione o un esplicito stato parziale. Aggiungi controlli metamorfici con
coefficienti diversi, cancellazioni con buchi, coefficienti parametrici nulli,
radici non razionali, soluzioni infinite e formati equivalenti. Testa i
limiti dichiarati senza inventare un oracolo universale. Se si trattano disequazioni, verifica
verso, buchi, estremi e intervalli. I test automatici documentano i casi
implementati, non dimostrano supporto matematico universale.

## 7. Consegna onesta

Indica quali famiglie/gradi e domini sono stati **realmente implementati e
collaudati**, i limiti, eventuali test falliti e se l'IA è stata provata live.
Non dire che tutte le equazioni di ogni tipo e grado sono già risolte solo
perché la nuova app esiste o il build passa.


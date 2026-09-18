# Verifica tecnica — 18 settembre 2026

## Fonte e metodo di ispezione

Pagina pubblica: https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172839

HTML letto via HTTPS; script realmente referenziato: https://unito.prod.up.cineca.it/app/minify/4183d358.up.js

Nel bundle sono stati individuati:

- `var urlBase="/api"`: l'API configurata è sul dominio `unito.prod.up.cineca.it`, non sul dominio apache suggerito come pista.
- `Cliente.cercaPerDominio({dominio:$location.host()})`, GET `/api/Clienti/cercaPerDominio`. La richiesta con `dominio=unito.prod.up.cineca.it` ha restituito `id=5852fd1ab7305612a8354d51`, `codice=UNITO`.
- `LinkCalendario.searchCalendarioPubblico`, POST `/api/LinkCalendario/searchCalendarioPubblico`, con `{linkCalendarioId, filter:{clienteId}}`. Risposta anonima senza Origin: titolo “Triennale Informatica - Terzo Anno” e configurazione del calendario.
- `getImpegniCalendarioPubblico:{isArray:!0,url:urlBase+"/Impegni/getImpegniCalendarioPubblico",method:"POST"}`.
- `getCondizioniImpegniCalendario` costruisce `linkCalendarioId`, `clienteId`, `mostraImpegniAnnullati`, `mostraIndisponibilitaTotali`, intervallo `dataInizio` / `dataFine`; il codice usa anche `limitaRisultati:false` nella vista elenco. Questo parametro è stato poi verificato nel test live dell'MVP.
- Stati dichiarati nel bundle: `B` bozza, `C` confermato, `S` sospeso, `P` pubblicato, `E` da eliminare, `A` annullato, `R` da revocare.

Non è stata registrata una traccia HAR della pagina originale. L'origine dei dati è stata ricostruita dal sorgente pubblico, verificata con richieste HTTP effettive e confrontata con la pagina originale nel browser. Non è stato inventato un percorso API né provata una griglia di endpoint alternativi.

## Richiesta eventi verificata

```http
POST https://unito.prod.up.cineca.it/api/Impegni/getImpegniCalendarioPubblico
Content-Type: application/json
Origin: https://example.github.io
```

```json
{
  "linkCalendarioId": "612617b82db4bb0017172839",
  "clienteId": "5852fd1ab7305612a8354d51",
  "dataInizio": "2025-10-05T22:00:00.000Z",
  "dataFine": "2025-10-12T22:00:00.000Z",
  "mostraImpegniAnnullati": true,
  "mostraIndisponibilitaTotali": false,
  "limitaRisultati": false
}
```

Risposta JSON: array diretto di 38 oggetti, 18 valori `nome` unici. Le settimane 14–20 e 21–27 settembre 2026 hanno restituito `[]`: questo non è un errore di recupero. Non si deduce che l'intero anno 2026 sia privo di eventi.

## CORS: endpoint differenti, risultati differenti

| Richiesta | Risultato effettivo |
| --- | --- |
| OPTIONS eventi, Origin GitHub, metodo POST, header content-type | HTTP 204, Allow-Origin riflette `https://example.github.io`, Allow-Methods include POST, Allow-Headers content-type |
| POST eventi, stessa Origin | HTTP 200, `Access-Control-Allow-Origin: *`, array JSON leggibile |
| POST configurazione calendario, stessa Origin | HTTP 500, `Not allowed by CORS` |
| POST configurazione calendario, nessun Origin | JSON con configurazione pubblica |

È presente anche `Access-Control-Allow-Credentials: true`. Il wildcard è utilizzabile dal client perché la fetch specifica **credentials: omit**. Nessun header Authorization e nessun cookie sono necessari. Il solo successo del preflight non sarebbe stato sufficiente: è stato verificato anche il POST, con una settimana non vuota.

Il dominio apache proposto non è necessario alla soluzione e non è stato validato come alternativa. Non vengono falsificati Origin/Referer nel client, disattivate protezioni del browser o impiegati proxy CORS di terzi.

## Campi realmente osservati

| Informazione | Campo |
| --- | --- |
| Identificativo lezione | `id` |
| Denominazione filtrabile | `nome` |
| Codice attività | `codiceAttivita` |
| Dettagli insegnamento | `evento.dettagliDidattici[]` con `codiceAF`, `nome`, `descrizione`, eventuali partizioni |
| Data e inizio | `dataInizio`, timestamp ISO UTC |
| Fine | `dataFine`, timestamp ISO UTC |
| Aula / edificio | `aule[].descrizione`, `aule[].edificio.descrizione` |
| Docenti | `docenti[].nome`, `docenti[].cognome` |
| Stato | `stato`; campione live tutto `P`; significato `A` ricavato anche dal codice originale |
| Note | `notePubbliche`, quando presente; facoltativo |
| Intera giornata | `interaGiornata`, quando presente; facoltativo |

Esempio ridotto verificato: `nome = Storia - STORIA DELL'INFORMATICA`, `dataInizio = 2025-10-06T07:00:00.000Z`, `dataFine = 2025-10-06T09:00:00.000Z`, Aula C, Daniele GUNETTI. Nella pagina originale: **09:00–11:00** a Roma, stesso docente e aula. `orarioInizio` / `orarioFine` contengono date di riferimento del 1970 e non sono usati per calcolare l'orario della lezione.

Per evitare ambiguità tra fuso del dispositivo e ateneo, l'MVP formatta sempre in Europe/Rome. I limiti di ricerca sono due mezzanotti romane, calcolate separatamente per gestire il cambio ora. La risposta viene filtrata anche localmente sul periodo richiesto. Non è dimostrata una garanzia server di assenza di limiti su periodi arbitrariamente grandi: l'app richiede una sola settimana.

## Test automatici eseguiti

`node --test tests/*.test.mjs`: **6 test, 6 passati**. Normalizzazione, deduplicazione delle materie, filtri tutte/nessuna/singola, stato annullato sintetico, risposte malformate, storage negato/corrotto, orari Roma, settimane di 167/169 ore al cambio ora, richiesta senza credenziali, rimozione eventi al rinnovo, errori HTTP e abort.

`node tests/live.mjs`: **passato**, 18 settembre 2026 alle 20:54 UTC, OPTIONS 204, POST 200, Allow-Origin `*`, 38 eventi e 18 denominazioni. Dati recuperati dalla rete, nessuna fixture statica nell'applicazione. Gli esempi sintetici dei test unitari sono confinati nei test.

## Verifica effettiva nel browser

- Origine locale `http://127.0.0.1:4173`: il browser ha applicato CORS e letto direttamente **38 / 38 eventi** dal servizio HTTPS UniTo. Nessun proxy fra client e servizio.
- Filtro “Nessuna”, poi solo “Storia”: **1 / 38 eventi**. Dopo ricaricamento e ritorno al 6 ottobre 2025: ancora **1 / 38**, titolo corretto. “Tutte” ripristina le lezioni.
- Ricerca “Storia”: una checkbox trovata.
- Navigazione alla settimana 13–19 ottobre e ritorno, aggiornamento manuale, pulsante Oggi alla settimana 14–20 settembre 2026: verificati. Settimana corrente vuota con recupero riuscito.
- Screenshot ispezionati a larghezza desktop 1280, mobile 390 e tablet 768 pixel. A 390 e 768: larghezza del documento uguale al viewport, senza overflow orizzontale; titoli, aule e docenti vanno a capo.
- Nessun errore console osservato nella pagina dell'MVP.

## Limiti della verifica

Non è stato eseguito un deployment GitHub Pages né un test su dispositivi fisici iPhone/iPad o Safari. Le dimensioni responsive sono state verificate nel browser integrato. Non sono state alterate lezioni vere per provocare cambi aula, cancellazioni o nuove pubblicazioni: il rinnovo completo è coperto da test sintetico e il recupero attuale da test live. Il timer di cinque minuti non è stato atteso come prova separata; il percorso di aggiornamento manuale è stato provato. Nessun impegno annullato era presente nel campione: il mapping `A` viene dal bundle e da un test sintetico.

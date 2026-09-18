# Verifica sincronizzazione — 19 settembre 2026

## Analisi e ambito

- `calendar.js`: chiave localStorage esistente `unito:612617b82db4bb0017172839:subjects:v1`; selezione `null` (tutte) o array delle denominazioni `nome.trim()` (vuoto = nessuna). File invariato.
- `app.js`: lettura locale all'avvio, scrittura immediata in `save()`, checkbox in `renderFilters()`. Aggiunti soltanto import, notifica delle modifiche e inizializzazione della sincronizzazione.
- `index.html`: controlli aggiunti nello stesso pannello “Le tue materie”. CSS aggiunto soltanto per il pannello sync.
- Endpoint UniTo/CINECA, parsing, calendario, navigazione e colori non modificati.
- Pubblicazione Pages estesa alla whitelist dei nuovi moduli, senza includere directory Worker o file locali.

## Prove eseguite

- `node --test tests/*.test.mjs`: 18 test, inclusi i 10 precedenti. Worker testato con binding D1 simulato; controllati autenticazione, schema rigoroso, contenuto JSON, limiti anche su stream senza Content-Length, CORS, errori D1 e no-store. Client verificato per serializzazione, manualità, due client, timeout, richieste in corso, revoca codice e storage non disponibile.
- `node tests/live.mjs`: OPTIONS 204, POST 200, 38 eventi e 18 denominazioni per la settimana del 6 ottobre 2025, recuperati dalla fonte reale.
- Wrangler 4.135.0 installato dal registro npm, versione bloccata nel lockfile; verificati help di `d1 create`, `d1 migrations apply`, `secret put`.
- Migration `0001_preferences.sql` applicata con `--local` a D1 emulato. Nessun account, ID o database remoto creato.
- `wrangler deploy --dry-run --config worker/wrangler.jsonc`: bundle riuscito.
- Prova end-to-end con Chrome installato, due contesti browser isolati e Worker/D1 reali locali: checkbox e cache, stato non salvato, PUT manuale, refresh con GET automatico, caricamento stessa selezione nel secondo browser, “Ricarica dal cloud”, fallback con rete Worker bloccata, codice errato e disconnessione locale senza cancellazione cloud. Nessun errore JavaScript.
- Controllo visivo desktop (1280 px) e mobile (390 px), senza overflow orizzontale della pagina. Eventi reali visibili nel calendario desktop.
- `.dev.vars`, `.env*`, `.wrangler` e `node_modules` esclusi da Git. Codice casuale locale usato solo nel file ignorato `.dev.vars`, poi eliminato dopo il collaudo; nessun segreto di produzione ricevuto, scritto o committato.

## Limiti e passaggi ancora necessari

- Cloudflare remoto e GitHub Pages non distribuiti: servono login dell'utente, vero database_id, secret e URL pubblico come descritto nel README.
- La prova dei due dispositivi è stata simulata con storage browser isolati in Chrome. Safari/iPad/iPhone fisici restano da collaudare dopo la pubblicazione.
- `SYNC_API_URL` rimane vuoto nel repository: l'app funziona in locale fino alla configurazione. Durante il collaudo browser il modulo era sostituito nella rete del solo contesto di test, senza modificare il file pubblico.
- Regola conflitti: ultimo PUT completato vince. Il timestamp è informativo, non un blocco concorrente.

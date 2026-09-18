# Il mio calendario UniTo

MVP statico, responsive e senza dipendenze runtime frontend per il calendario pubblico **Triennale Informatica – Terzo Anno**. Gli eventi arrivano direttamente da UniTo ad ogni recupero. Nessun login, cookie personale, proxy, scraping autenticato o copia statica degli eventi.

## Avvio e test

Serve Node.js 20 o successivo, senza installare pacchetti:

```sh
node server.mjs
# Apri http://127.0.0.1:4173
node --test tests/*.test.mjs
node tests/live.mjs
```

In alternativa: `npm start`, `npm test`, `npm run test:live`. Il server locale serve solo i file frontend pubblici; non è un proxy. Non aprire index.html tramite `file://`: i moduli JavaScript richiedono un server HTTP.

Il test live verifica OPTIONS e POST con Origin `https://example.github.io`, formato degli eventi e materie uniche, senza credenziali. Node non applica CORS: il test controlla gli header e si affianca alla prova reale nel browser. È possibile scegliere `TEST_ORIGIN` e `TEST_WEEK` (lunedì in formato YYYY-MM-DD); il test richiede una settimana non vuota. Default: 6 ottobre 2025, dati ottenuti di nuovo dalla fonte, non da fixture.

## Utilizzo

- All'apertura viene mostrata la settimana corrente nel fuso Europe/Rome.
- Frecce, Oggi e selettore data navigano per settimana, dal lunedì alla domenica.
- Checkbox e ricerca filtrano per denominazione `nome`, mantenendo distinti laboratori, canali e corsi in inglese. Le 18 denominazioni del campione non equivalgono necessariamente a 18 insegnamenti amministrativi.
- Il filtro è salvato subito in localStorage. La sincronizzazione cloud opzionale descritta sotto condivide la selezione fra browser e dispositivi solo quando premi “Salva online”. Vengono proposte le materie della settimana e quelle esplicitamente selezionate in precedenza, non un catalogo annuale completo.
- “Tutte” comprende anche nuove materie; con una selezione esplicita le nuove denominazioni richiedono una spunta. “Nessuna” resta memorizzato come scelta vuota.
- Aggiornamento ad apertura, cambio settimana, pulsante, ogni 5 minuti a pagina visibile e al ritorno alla pagina se sono passati oltre 60 secondi dall'ultimo successo. I timer in background su iOS possono essere sospesi.
- Ad ogni successo la settimana è sostituita integralmente: nuovi eventi, modifiche e rimozioni vengono così recepiti. `stato: A` viene mostrato come annullato; `S` come sospeso. Le cancellazioni effettive nella fonte non sono state provocate durante il test.
- Se un aggiornamento fallisce, gli eventuali dati precedenti della stessa settimana sono segnalati come non aggiornati. Al cambio settimana si svuota la vista per non mostrare dati del periodo sbagliato. Nessun calendario viene salvato offline.

## GitHub Pages

Copia **il contenuto di questa cartella** nella radice di un repository GitHub (inclusa `.github`), con branch `main`. In Settings → Pages seleziona **GitHub Actions**. Il workflow incluso esegue i test e pubblica esclusivamente `index.html`, `app.js`, `calendar.js`, `preferences.js`, `sync.js`, `sync-ui.js`, `sync-config.js`, `style.css`, `favicon.svg`; funziona anche sotto `/nome-repository/` grazie ai percorsi relativi.


## Dati e manutenzione

Endpoint, metodo e parametri derivano dal JavaScript pubblico CINECA. L'ID dell'ateneo e del calendario sono configurazione pubblica verificata, non dati di lezioni. Vedere [verifica tecnica](docs/VERIFICA.md) per fonti, campi, prove CORS e limiti.

La configurazione `LinkCalendario/searchCalendarioPubblico` rifiuta l'origine GitHub testata, mentre l'endpoint eventi la consente. Il client non richiede la configurazione a runtime: non serve quindi un proxy. Se in futuro CINECA modifica questa policy, bisognerà rivalutare la fattibilità; non sono inclusi aggiramenti o proxy pubblici di terzi.

Il servizio pubblico non offre qui una garanzia di stabilità: modifiche di schema, disponibilità o policy possono richiedere manutenzione. I dati della fonte sono mostrati come testo, senza interpretarli come HTML. Nessun tracker o risorsa esterna di presentazione.


## Sincronizzazione personale opzionale

GitHub Pages continua a ospitare tutti i file frontend e il browser continua a chiamare direttamente UniTo. Worker e D1 non ricevono eventi, aule o docenti. `calendar.js`, il parsing, i colori e la vista settimanale restano invariati.

Le materie sono identificate dall'esatto `nome` UniTo già usato dal filtro, senza inventare ID amministrativi. La API scambia `{ "mode": "selected", "selectedSubjects": ["nome materia"] }`; `mode: "all"` con array vuoto conserva la scelta “Tutte” incluse materie future, mentre `mode: "selected"` con array vuoto significa “Nessuna”. D1 contiene una sola riga con id fisso 1, JSON delle preferenze e data UTC assegnata dal server. Nessun codice personale viene salvato in D1.

All'apertura localStorage funziona subito e il caricamento UniTo procede indipendentemente. Se è memorizzato un codice, parte un GET autenticato: la configurazione cloud sostituisce quella locale. Se il cloud è vuoto, la selezione locale resta invariata fino al primo salvataggio. Errori o timeout (10 secondi) preservano la selezione locale.

Checkbox, “Tutte” e “Nessuna” aggiornano immediatamente calendario e localStorage, senza scritture cloud. “Salva online” invia una fotografia della selezione corrente; eventuali modifiche fatte durante il salvataggio restano non salvate. “Ricarica dal cloud” scarta le modifiche locali soltanto dopo una risposta valida. Vince l'ultimo PUT completato: non c'è fusione o blocco delle modifiche di altri dispositivi. Le altre sessioni aperte ricevono le nuove preferenze al refresh o con “Ricarica dal cloud”.

Il codice è inviato tramite header Authorization, mai nell'URL. Dopo una verifica riuscita viene conservato nel localStorage del browser per l'origine del Worker configurato; chi ha accesso ai dati di quel browser può quindi leggerlo. “Disconnetti sincronizzazione” rimuove questa copia locale senza cancellare selezione o dati cloud. Se il server rifiuta un codice dopo una rotazione, il client lo dimentica e chiede quello nuovo. Non c'è registrazione utenti.

### Configurazione Cloudflare (una sola volta)

Serve Node **22 o successivo** per Wrangler (frontend e test base richiedono Node 20). Dalla radice del repository, con npm disponibile:

```sh
npm ci
npx wrangler --version
npx wrangler login
npx wrangler d1 create unito-calendar-preferences --config worker/wrangler.jsonc
```

Il lockfile fissa Wrangler **4.135.0**, verificato con `--version` e help dei comandi. Il comando di creazione restituisce il vero `database_id`: inseriscilo nell'oggetto `d1_databases[0]` di `worker/wrangler.jsonc`, mantenendo `binding: "DB"`, `database_name` e `migrations_dir`. Se Wrangler propone di aggiornare automaticamente il file, controlla che ci sia **un solo binding DB**. Nessun ID remoto è già incluso o inventato. L'ID del database e l'URL Worker sono configurazione pubblica, non segreti.

```sh
npx wrangler d1 migrations apply DB --remote --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
npx wrangler secret put SYNC_CODE --config worker/wrangler.jsonc
```

Inserisci il codice nel prompt nascosto di `secret put`, non come argomento del comando. Usa un codice casuale lungo, per esempio 48 caratteri esadecimali generati con `openssl rand -hex 24`, e conservalo nel tuo gestore password. Sono ammessi 16–256 caratteri ASCII senza spazi. Fino alla configurazione del secret il Worker risponde 503 senza consentire accesso ai dati. Non scrivere il codice in Git, nel frontend, nel file Wrangler o in D1.

Copia l'origine HTTPS pubblica restituita da `deploy` (disponibile anche in Workers & Pages → Worker → Settings → Domains & Routes) in `SYNC_API_URL` dentro `sync-config.js`, **senza** `/preferences`, query o frammenti. Pubblica quindi il frontend con il normale workflow GitHub Pages. L'URL vuoto lascia l'app in “Solo locale”. Il workflow pubblica soltanto i file frontend, mai Worker, database, `.dev.vars` o dipendenze.

CORS in produzione permette `https://samulattanzio.github.io`: un'origin non contiene il percorso `/unito-calendar-filter/`. L'autenticazione è comunque obbligatoria per GET/PUT anche senza header Origin; CORS non sostituisce il codice. La configurazione locale separata permette solo `http://127.0.0.1:4173` e `http://localhost:4173`. Non distribuire `wrangler.local.jsonc` in produzione.

### Test completo locale

Non serve un account Cloudflare per Worker/D1 locali:

```sh
npm ci
npx wrangler d1 migrations apply DB --local --config worker/wrangler.local.jsonc
```

Crea `worker/.dev.vars` (ignorato da Git) e inserisci `SYNC_CODE=` seguito da un codice di test casuale, mai dal codice reale di produzione. Generazione locale senza stampare il valore o inserirlo nella cronologia shell:

```sh
node -e "require('fs').writeFileSync('worker/.dev.vars','SYNC_CODE='+require('crypto').randomBytes(24).toString('hex')+'\n',{mode:0o600,flag:'wx'})"
```

Leggi il valore dal file con il tuo editor per inserirlo nel browser. Il comando rifiuta di sovrascrivere un file già presente.

```sh
npx wrangler dev --config worker/wrangler.local.jsonc --port 8787
# In un secondo terminale:
npm start
```

Imposta temporaneamente `SYNC_API_URL = 'http://127.0.0.1:8787'` in `sync-config.js` e apri `http://127.0.0.1:4173`. Ripristina l'URL di produzione prima di pubblicare. Il database locale resta in `worker/.wrangler/`, escluso da Git. Arresta Wrangler per verificare il fallback; il frontend e UniTo devono continuare a funzionare.

```sh
npm test
npm run test:live
```

I test automatici verificano schema/serializzazione, autenticazione, CORS, limiti del payload, GET/PUT con binding D1 simulato, salvataggio manuale, refresh, secondo client, fallback, codice errato, disconnessione e richieste concorrenti. Il test live interroga davvero UniTo. Per il collaudo di questa modifica sono stati usati anche Wrangler/D1 reali in locale e due contesti browser separati; vedere `docs/SYNC-VERIFICA.md`.

### Prova su due browser e rotazione codice

1. Nel browser A inserisci il codice, scegli le materie e verifica “Modifiche non salvate”. Premi “Salva online”.
2. Nel browser B apri il sito e inserisci lo stesso codice una volta: devono comparire le scelte di A.
3. Cambia una checkbox in A senza salvare: un refresh di B deve mostrare ancora il vecchio cloud.
4. Salva da A e ricarica B. Prova anche “Tutte”, “Nessuna” e “Ricarica dal cloud”.
5. Disconnetti A: le sue scelte restano e B continua a leggere il cloud.

Per cambiare codice esegui di nuovo `npx wrangler secret put SYNC_CODE --config worker/wrangler.jsonc`, senza modificare repository o database. Inserisci poi il nuovo codice nei browser; le preferenze cloud rimangono intatte. Non usare questa semplice API con un PIN breve: non è incluso un rate limiter applicativo.

Il server accetta soltanto lo schema previsto: massimo 300 denominazioni uniche di 500 caratteri ciascuna e corpo UTF-8 di 64 KiB, controllato anche durante la lettura dello stream. Rifiuta campi aggiuntivi, controlli, stringhe vuote o non trimmate; data e id sono scelti dal server. Tutte le risposte hanno `Cache-Control: no-store`; confronto dei digest SHA-256 del codice su lunghezza fissa, SQL parametrizzato e nessun log applicativo di credenziali.

Riferimenti verificati: [comandi D1](https://developers.cloudflare.com/d1/wrangler-commands/), [configurazione Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/), [segreti Worker](https://developers.cloudflare.com/workers/configuration/secrets/).

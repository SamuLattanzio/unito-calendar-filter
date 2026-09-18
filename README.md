# Il mio calendario UniTo

MVP statico, responsive e senza dipendenze per il calendario pubblico **Triennale Informatica – Terzo Anno**. Gli eventi arrivano direttamente da UniTo ad ogni recupero. Nessun login, cookie personale, proxy, scraping autenticato o copia statica degli eventi.

## Avvio e test

Serve Node.js 20 o successivo, senza installare pacchetti:

```sh
node server.mjs
# Apri http://127.0.0.1:4173
node --test tests/*.test.mjs
node tests/live.mjs
```

In alternativa: `npm start`, `npm test`, `npm run test:live`. Il server locale serve solo i cinque file pubblici; non è un proxy. Non aprire index.html tramite `file://`: i moduli JavaScript richiedono un server HTTP.

Il test live verifica OPTIONS e POST con Origin `https://example.github.io`, formato degli eventi e materie uniche, senza credenziali. Node non applica CORS: il test controlla gli header e si affianca alla prova reale nel browser. È possibile scegliere `TEST_ORIGIN` e `TEST_WEEK` (lunedì in formato YYYY-MM-DD); il test richiede una settimana non vuota. Default: 6 ottobre 2025, dati ottenuti di nuovo dalla fonte, non da fixture.

## Utilizzo

- All'apertura viene mostrata la settimana corrente nel fuso Europe/Rome.
- Frecce, Oggi e selettore data navigano per settimana, dal lunedì alla domenica.
- Checkbox e ricerca filtrano per denominazione `nome`, mantenendo distinti laboratori, canali e corsi in inglese. Le 18 denominazioni del campione non equivalgono necessariamente a 18 insegnamenti amministrativi.
- Il filtro è salvato in localStorage sul singolo browser/dispositivo; non si sincronizza tra Mac, iPhone e iPad. Vengono proposte le materie della settimana e quelle esplicitamente selezionate in precedenza, non un catalogo annuale completo.
- “Tutte” comprende anche nuove materie; con una selezione esplicita le nuove denominazioni richiedono una spunta. “Nessuna” resta memorizzato come scelta vuota.
- Aggiornamento ad apertura, cambio settimana, pulsante, ogni 5 minuti a pagina visibile e al ritorno alla pagina se sono passati oltre 60 secondi dall'ultimo successo. I timer in background su iOS possono essere sospesi.
- Ad ogni successo la settimana è sostituita integralmente: nuovi eventi, modifiche e rimozioni vengono così recepiti. `stato: A` viene mostrato come annullato; `S` come sospeso. Le cancellazioni effettive nella fonte non sono state provocate durante il test.
- Se un aggiornamento fallisce, gli eventuali dati precedenti della stessa settimana sono segnalati come non aggiornati. Al cambio settimana si svuota la vista per non mostrare dati del periodo sbagliato. Nessun calendario viene salvato offline.

## GitHub Pages

Copia **il contenuto di questa cartella** nella radice di un repository GitHub (inclusa `.github`), con branch `main`. In Settings → Pages seleziona **GitHub Actions**. Il workflow incluso esegue i test e pubblica esclusivamente `index.html`, `app.js`, `calendar.js`, `style.css`, `favicon.svg`; funziona anche sotto `/nome-repository/` grazie ai percorsi relativi.

Non è stato creato o pubblicato un repository in questo lavoro: non era indicata una destinazione GitHub. La compatibilità è supportata dalle prove CORS e dal caricamento diretto nel browser locale; un deployment sull'origine GitHub effettiva resta da verificare dopo la pubblicazione.

## Dati e manutenzione

Endpoint, metodo e parametri derivano dal JavaScript pubblico CINECA. L'ID dell'ateneo e del calendario sono configurazione pubblica verificata, non dati di lezioni. Vedere [verifica tecnica](docs/VERIFICA.md) per fonti, campi, prove CORS e limiti.

La configurazione `LinkCalendario/searchCalendarioPubblico` rifiuta l'origine GitHub testata, mentre l'endpoint eventi la consente. Il client non richiede la configurazione a runtime: non serve quindi un proxy. Se in futuro CINECA modifica questa policy, bisognerà rivalutare la fattibilità; non sono inclusi aggiramenti o proxy pubblici di terzi.

Il servizio pubblico non offre qui una garanzia di stabilità: modifiche di schema, disponibilità o policy possono richiedere manutenzione. I dati della fonte sono mostrati come testo, senza interpretarli come HTML. Nessun tracker o risorsa esterna di presentazione.

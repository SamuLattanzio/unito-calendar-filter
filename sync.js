import {fromSelection, toSelection, fingerprint} from './preferences.js';
export const CODE_KEY = 'unito:sync-code:v1:';

export function createSync({url, storage, getSelection, applySelection, onChange = () => {}, fetcher = fetch, timeoutMs = 10000}) {
  const endpoint = url.replace(/\/$/, '');
  if (endpoint) {
    const parsed = new URL(endpoint);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' ||
        (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname)))) throw new Error('URL sincronizzazione non valido.');
  }
  const key = CODE_KEY + endpoint;
  let code = '', baseline, updatedAt = null, busy = false, error = '', notice = '', generation = 0, controller;
  try {code = storage.getItem(key) || '';} catch {}
  function state() {
    let dirty = false;
    try {dirty = !!code && (baseline === undefined || fingerprint(fromSelection(getSelection())) !== baseline);} catch {dirty = !!code;}
    return {configured: !!endpoint, connected: !!code, busy, dirty, updatedAt, error, notice,
      status: busy ? 'Caricamento…' : error ? 'Errore di sincronizzazione' : !code ? 'Solo locale' : dirty ? 'Modifiche non salvate' : 'Salvato online'};
  }
  const notify = () => onChange(state());
  function forget() {code = ''; try {storage.removeItem(key);} catch {notice = 'Impossibile eliminare il codice: cancella i dati del sito nelle impostazioni del browser.';}}
  async function request(method, candidate = code) {
    if (busy || !endpoint || !candidate) return false;
    const id = ++generation;
    controller = new AbortController(); const active = controller;
    busy = true; error = ''; notice = ''; notify();
    const timeout = setTimeout(() => active.abort(), timeoutMs);
    try {
      if (!/^[\x21-\x7e]{16,256}$/.test(candidate)) throw new Error('Usa un codice di 16–256 caratteri ASCII senza spazi.');
      const snapshot = method === 'PUT' ? fromSelection(getSelection()) : undefined;
      const response = await fetcher(endpoint + '/preferences', {
        method, headers: {Authorization: 'Bearer ' + candidate, ...(snapshot ? {'Content-Type': 'application/json'} : {})},
        ...(snapshot ? {body: JSON.stringify(snapshot)} : {}), credentials: 'omit', cache: 'no-store', redirect: 'error', signal: active.signal
      });
      if (id !== generation) return false;
      if (response.status === 401) {forget(); baseline = undefined; updatedAt = null; throw new Error('Codice personale errato. Inseriscilo nuovamente.');}
      if (!response.ok) throw new Error('Cloud non disponibile. La selezione locale resta disponibile.');
      const result = await response.json();
      if (id !== generation) return false;
      if (!result || (result.preferences === null ? result.updatedAt !== null || method === 'PUT' :
          typeof result.updatedAt !== 'string' || !Number.isFinite(Date.parse(result.updatedAt)))) throw new Error('Risposta cloud non valida.');
      const selection = result.preferences === null ? undefined : toSelection(result.preferences);
      code = candidate;
      try {storage.setItem(key, code);} catch {notice = 'Codice verificato, ma non memorizzabile: resterà attivo solo in questa pagina.';}
      updatedAt = result.updatedAt;
      baseline = result.preferences === null ? undefined : fingerprint(result.preferences);
      if (method === 'GET' && selection !== undefined) applySelection(selection);
      if (result.preferences === null) notice = 'Nessuna configurazione online. Premi Salva online per crearla.';
      return true;
    } catch (cause) {
      if (id !== generation) return false;
      error = cause.name === 'AbortError' ? 'Tempo scaduto. Uso della selezione locale.' : cause.message;
      return false;
    } finally {clearTimeout(timeout); if (id === generation) {busy = false; notify();}}
  }
  return {
    state, changed: notify, connect: candidate => request('GET', candidate),
    load: () => request('GET'), save: () => request('PUT'),
    disconnect() {generation++; controller?.abort(); busy = false; error = ''; notice = ''; forget(); baseline = undefined; updatedAt = null; notify();},
    start() {notify(); return code && endpoint ? request('GET') : Promise.resolve(false);}
  };
}

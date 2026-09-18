import {createSync} from './sync.js';
import {SYNC_API_URL} from './sync-config.js';
export function setupSync({getSelection, applySelection}) {
  const $ = id => document.getElementById(id);
  let storage;
  try {storage = localStorage;} catch {storage = {getItem() {}, setItem() {throw new Error();}, removeItem() {}};}
  const sync = createSync({url: SYNC_API_URL, storage, getSelection, applySelection, onChange(state) {
    $('sync-status').textContent = state.status;
    $('sync-message').textContent = !state.configured ? 'Sincronizzazione online non ancora configurata.' : state.error || state.notice;
    $('sync-time').textContent = state.updatedAt ? 'Ultimo salvataggio: ' + new Date(state.updatedAt).toLocaleString('it-IT', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '';
    $('sync-connect').hidden = !state.configured || state.connected;
    $('sync-disconnect').hidden = !state.connected;
    $('sync-save').disabled = $('sync-load').disabled = !state.configured || !state.connected || state.busy;
    $('sync-submit').disabled = $('sync-code').disabled = state.busy;
  }});
  $('sync-connect').onsubmit = async event => {event.preventDefault(); const code = $('sync-code').value; $('sync-code').value = ''; await sync.connect(code);};
  $('sync-save').onclick = () => sync.save();
  $('sync-load').onclick = () => sync.load();
  $('sync-disconnect').onclick = () => { $('sync-code').value = ''; sync.disconnect(); };
  void sync.start();
  return sync;
}

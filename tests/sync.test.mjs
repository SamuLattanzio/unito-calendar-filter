import test from 'node:test';
import assert from 'node:assert/strict';
import {fromSelection, toSelection, validatePreferences, MAX_BODY_BYTES} from '../preferences.js';
import {createSync, CODE_KEY} from '../sync.js';
import worker from '../worker/src/index.js';
const origin = 'https://samulattanzio.github.io';
const code = 'test-only-not-a-production-secret';
const selected = names => ({mode: 'selected', selectedSubjects: names});
function database() {
  let row = null;
  return {prepare(sql) {return {async first() {return row;}, bind(preferences, updated_at) {return {async run() {row = {preferences, updated_at};}};}};}};
}
function environment() {return {SYNC_CODE: code, DB: database(), ALLOWED_ORIGINS: origin};}
function req(method = 'GET', body, token = code, extra = {}) {
  return new Request('https://sync.example/preferences', {method, headers: {Origin: origin, Authorization: 'Bearer ' + token, ...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...extra}, ...(body !== undefined ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {})});
}
test('serialization preserves all, none, exact names and validates strict schema', () => {
  for (const selection of [null, [], ['Analisi', 'Lab A']]) assert.deepEqual(toSelection(fromSelection(selection)), selection);
  for (const bad of [null, [], {}, selected([1]), selected([' ']), selected([' A']), selected(['A','A']), selected(['A\nB']), selected(['a'.repeat(501)]), selected(Array.from({length:301},(_,i)=>''+i)), {...selected([]),events:[]}, {mode:'all',selectedSubjects:['A']}]) assert.throws(()=>validatePreferences(bad));
});
test('Worker authenticates reads/writes, persists one profile and rejects invalid input', async () => {
  const env = environment();
  assert.equal((await worker.fetch(req('GET',undefined,'wrong'),env)).status,401);
  assert.equal((await worker.fetch(req('PUT',selected(['A']),'wrong'),env)).status,401);
  assert.deepEqual(await (await worker.fetch(req(),env)).json(),{preferences:null,updatedAt:null});
  const result = await worker.fetch(req('PUT',selected(['A'])),env);
  assert.equal(result.status,200); const saved = await result.json(); assert.ok(Date.parse(saved.updatedAt));
  assert.deepEqual(await (await worker.fetch(req(),env)).json(),saved);
  for (const body of ['{',[],{selectedSubjects:['A']},selected(['A','A']),{...selected([]),updatedAt:'forged'}]) assert.equal((await worker.fetch(req('PUT',body),env)).status,400);
  assert.equal((await worker.fetch(req('PUT','a'.repeat(MAX_BODY_BYTES+1)),env)).status,413);
  assert.equal((await worker.fetch(req('PUT',selected([]),code,{'Content-Type':'text/plain'}),env)).status,415);
  assert.deepEqual(await (await worker.fetch(req(),env)).json(),saved);
});
test('Worker CORS, cache, methods, missing config, and database failure', async () => {
  const env=environment();
  const response=await worker.fetch(req(),env);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal((await worker.fetch(req('OPTIONS',undefined,'',{'Access-Control-Request-Method':'PUT'}),env)).status,204);
  assert.equal((await worker.fetch(req('GET',undefined,code,{Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await worker.fetch(req('POST'),env)).status,405);
  assert.equal((await worker.fetch(req(),{DB:env.DB})).status,503);
  env.DB={prepare(){throw Error('private database info');}};
  const error=await worker.fetch(req(),env);assert.equal(error.status,503);assert.ok(!(await error.text()).includes('private'));
});
function client(env, initial = ['Local'], storage = new Map(), fetcher) {
  let selection = initial;
  const options = {url:'https://sync.example',storage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},getSelection:()=>selection,applySelection:value=>{selection=value;},fetcher:fetcher || ((url,init)=>worker.fetch(new Request(url,init),env))};
  const sync=createSync(options);
  return {sync,storage,options,get selection(){return selection;},change(value){selection=value;sync.changed();}};
}
test('manual save, dirty state, refresh/second browser, reload, disconnect and all/none',async()=>{
  const env=environment(), a=client(env);
  await a.sync.connect(code);assert.equal(a.sync.state().status,'Modifiche non salvate');
  await a.sync.save();assert.equal(a.sync.state().status,'Salvato online');
  a.change(['Other']);assert.equal(a.sync.state().status,'Modifiche non salvate');
  const b=client(env,[],a.storage);await b.sync.start();assert.deepEqual(b.selection,['Local']);
  const c=client(env);await c.sync.connect(code);assert.deepEqual(c.selection,['Local']);
  await a.sync.load();assert.deepEqual(a.selection,['Local']);
  a.change(null);await a.sync.save();await c.sync.load();assert.equal(c.selection,null);
  a.change([]);await a.sync.save();await c.sync.load();assert.deepEqual(c.selection,[]);
  a.sync.disconnect();assert.equal(a.sync.state().status,'Solo locale');assert.equal(a.storage.size,0);
  await c.sync.load();assert.deepEqual(c.selection,[]);
});
test('offline and invalid code keep local selection; rejected code is forgotten',async()=>{
  const env=environment(), storage=new Map([[CODE_KEY+'https://sync.example',code]]);
  const a=client(env,['Cached'],storage,async()=>{throw Error('offline');});
  await a.sync.start();assert.deepEqual(a.selection,['Cached']);assert.equal(a.sync.state().status,'Errore di sincronizzazione');
  const b=client(env,['Cached']);await b.sync.connect('incorrect-but-long-enough');assert.equal(b.storage.size,0);assert.deepEqual(b.selection,['Cached']);
  env.SYNC_CODE='changed-server-code-value';
  const c=client(env,['Cached'],storage);await c.sync.start();assert.equal(storage.size,0);assert.equal(c.sync.state().connected,false);
});
test('edits during save stay dirty; disconnect ignores late responses and never stores code',async()=>{
  const env=environment(), a=client(env);await a.sync.connect(code);await a.sync.save();
  let release;
  const delayed=(url,init)=>new Promise(resolve=>{release=async()=>resolve(await worker.fetch(new Request(url,init),env));});
  const sync=createSync({...a.options,fetcher:delayed});
  const load=sync.start();sync.disconnect();await release();await load;assert.equal(a.storage.size,0);assert.equal(sync.state().connected,false);
  await a.sync.connect(code);
  const s=createSync({...a.options,fetcher:delayed});const saving=s.save();a.change(['During save']);await release();await saving;assert.equal(s.state().dirty,true);
});
test('malformed cloud response and denied storage do not crash or overwrite local data',async()=>{
  const env=environment(), a=client(env,['Keep'],new Map(),async()=>Response.json({preferences:selected([1]),updatedAt:new Date().toISOString()}));
  await a.sync.connect(code);assert.deepEqual(a.selection,['Keep']);assert.equal(a.storage.size,0);
  const b=client(env);const sync=createSync({...b.options,storage:{getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}}});
  await sync.connect(code);assert.equal(sync.state().connected,true);assert.match(sync.state().notice,/Nessuna configurazione/);sync.disconnect();assert.match(sync.state().notice,/cancella i dati/);
});
test('timeout retains cached selection and streaming limit works without Content-Length',async()=>{
  const a=client(environment(),['Cached']);
  const sync=createSync({...a.options,timeoutMs:5,fetcher:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))});
  await sync.connect(code);assert.deepEqual(a.selection,['Cached']);assert.match(sync.state().error,/Tempo scaduto/);
  let sent=0;
  const body=new ReadableStream({pull(c){if(sent++<5)c.enqueue(new Uint8Array(16384));else c.close();}});
  const response=await worker.fetch(new Request('https://sync.example/preferences',{method:'PUT',duplex:'half',headers:{Authorization:'Bearer '+code,'Content-Type':'application/json'},body}),environment());
  assert.equal(response.status,413);
});

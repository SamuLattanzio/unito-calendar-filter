import {validatePreferences, MAX_BODY_BYTES} from '../../preferences.js';

async function authorized(request, secret) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ') || header.length > 263) return false;
  const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [actual, expected] = await Promise.all([digest(header.slice(7)), digest(secret)]);
  const a = new Uint8Array(actual), b = new Uint8Array(expected);
  let difference = 0;
  for (let i = 0; i < 32; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
async function readBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw new Error('media');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('payload');
  const chunks = []; let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {await reader.cancel(); throw new Error('size');}
    chunks.push(value);
  }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) {body.set(chunk, offset); offset += chunk.byteLength;}
  return validatePreferences(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(body)));
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || 'https://samulattanzio.github.io').split(',').map(s => s.trim());
    const headers = {'Cache-Control': 'no-store', 'Vary': 'Origin', 'Content-Type': 'application/json; charset=utf-8'};
    const reply = (status, value) => new Response(value === null ? null : JSON.stringify(value), {status, headers});
    if (origin && !allowed.includes(origin)) return reply(403, {error: 'Origine non consentita.'});
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (new URL(request.url).pathname !== '/preferences') return reply(404, {error: 'Non trovato.'});
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'GET, PUT';
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
      headers['Access-Control-Max-Age'] = '600';
      return reply(204, null);
    }
    if (!['GET', 'PUT'].includes(request.method)) {headers.Allow = 'GET, PUT, OPTIONS'; return reply(405, {error: 'Metodo non consentito.'});}
    if (typeof env.SYNC_CODE !== 'string' || !/^[\x21-\x7e]{16,256}$/.test(env.SYNC_CODE) || !env.DB) return reply(503, {error: 'Sincronizzazione non configurata.'});
    if (!await authorized(request, env.SYNC_CODE)) return reply(401, {error: 'Codice personale non valido.'});
    try {
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT preferences, updated_at FROM preferences WHERE id = 1').first();
        return reply(200, row ? {preferences: validatePreferences(JSON.parse(row.preferences)), updatedAt: row.updated_at} : {preferences: null, updatedAt: null});
      }
      let preferences;
      try {preferences = await readBody(request);} catch (error) {
        return reply(error.message === 'size' ? 413 : error.message === 'media' ? 415 : 400, {error: 'Preferenze non valide o richiesta troppo grande.'});
      }
      const updatedAt = new Date().toISOString();
      await env.DB.prepare('INSERT INTO preferences (id, preferences, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET preferences = excluded.preferences, updated_at = excluded.updated_at').bind(JSON.stringify(preferences), updatedAt).run();
      return reply(200, {preferences, updatedAt});
    } catch {return reply(503, {error: 'Sincronizzazione temporaneamente non disponibile.'});}
  }
};

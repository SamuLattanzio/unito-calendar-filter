export const ENDPOINT = 'https://unito.prod.up.cineca.it/api/Impegni/getImpegniCalendarioPubblico';
export const SOURCE = 'https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172839';
export const STORAGE_KEY = 'unito:612617b82db4bb0017172839:subjects:v1';
const zone = 'Europe/Rome';
export function romeDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function shiftDay(day, n) {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+n);
  return date.toISOString().slice(0,10);
}
export function monday(day) {
  return shiftDay(day, -((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
}
export function romeMidnight(day) {
  const noon = new Date(day+'T12:00:00Z');
  const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(noon));
  return new Date(Date.parse(day+'T00:00:00Z')-(hour-12)*3600000).toISOString();
}
export function payload(day) {
  return {linkCalendarioId:'612617b82db4bb0017172839',clienteId:'5852fd1ab7305612a8354d51',dataInizio:romeMidnight(day),dataFine:romeMidnight(shiftDay(day,7)),mostraImpegniAnnullati:true,mostraIndisponibilitaTotali:false,limitaRisultati:false};
}
export function normalize(raw) {
  if (!Array.isArray(raw)) throw new Error('Formato della risposta CINECA non riconosciuto.');
  return raw.map(e => {
    if (!e.id || typeof e.nome !== 'string' || !e.nome.trim() || !Number.isFinite(Date.parse(e.dataInizio)) || !Number.isFinite(Date.parse(e.dataFine))) throw new Error('Un evento contiene campi mancanti o non validi.');
    return {id:e.id,subject:e.nome.trim(),start:e.dataInizio,end:e.dataFine,allDay:!!e.interaGiornata,state:e.stato,cancelled:e.stato==='A',
      rooms:(e.aule||[]).map(a=>[a.descrizione,a.edificio?.descrizione].filter(Boolean).join(' · ')),
      teachers:(e.docenti||[]).map(d=>[d.nome,d.cognome].filter(Boolean).join(' ')),notes:e.notePubbliche||''};
  }).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.subject.localeCompare(b.subject,'it'));
}
export function subjects(events) { return [...new Set(events.map(e=>e.subject))].sort((a,b)=>a.localeCompare(b,'it')); }
export function filterEvents(events, selected) {return selected===null ? events : events.filter(e=>selected.includes(e.subject));}
export function readSelection(storage) {
  try { const s=JSON.parse(storage.getItem(STORAGE_KEY)); return s===null || (Array.isArray(s)&&s.every(x=>typeof x==='string')) ? s : null; } catch { return null; }
}
export async function fetchEvents(day, {signal, fetcher=fetch}={}) {
  const response=await fetcher(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(day)),credentials:'omit',cache:'no-store',signal});
  if(!response.ok) throw new Error(`Il calendario UniTo ha risposto con errore ${response.status}.`);
  const events=normalize(await response.json());
  const start=Date.parse(romeMidnight(day)), end=Date.parse(romeMidnight(shiftDay(day,7)));
  return events.filter(e=>Date.parse(e.start)<end&&Date.parse(e.end)>start);
}
export function time(iso) {return new Intl.DateTimeFormat('it-IT',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}
export function dayLabel(day, options={day:'numeric',month:'long'}) {return new Intl.DateTimeFormat('it-IT',{timeZone:zone,...options}).format(new Date(day+'T12:00:00Z'));}

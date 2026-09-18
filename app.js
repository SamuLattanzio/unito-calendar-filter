import {SOURCE,STORAGE_KEY,romeDay,monday,shiftDay,fetchEvents,subjects,filterEvents,readSelection,time,dayLabel} from './calendar.js';

export const HOUR_HEIGHT = 52;
const minutes = iso => { const [h,m] = time(iso).split(':').map(Number); return h*60+m; };
const label = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;

// Identity depends only on the subject, never on the visible week or selection.
export function subjectColor(subject) {
  // Fixed seed verified against the current course catalogue; no per-week assignment.
  let hash = 2166136368;
  for (const char of subject.normalize('NFC').trim()) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  const slot = hash % 24;
  const hue = Math.round((slot * 137.508) % 360);
  return {background:`hsl(${hue} 48% 92%)`, border:`hsl(${hue} 38% 46%)`, text:`hsl(${hue} 42% 24%)`};
}

export function weekLayout(events, week) {
  const days = Array.from({length:5}, (_,i) => {
    const day = shiftDay(week,i);
    const items = events.flatMap(event => {
      const first = romeDay(new Date(event.start)), last = romeDay(new Date(Date.parse(event.end)-1));
      if (first > day || last < day || Date.parse(event.end)<=Date.parse(event.start)) return [];
      return [{event, start:first < day ? 0 : minutes(event.start), end:last > day ? 1440 : (romeDay(new Date(event.end)) > day ? 1440 : minutes(event.end))}];
    });
    return {day, timed:items.filter(x=>!x.event.allDay), allDay:items.filter(x=>x.event.allDay)};
  });
  const timed = days.flatMap(d=>d.timed);
  return {days, start:Math.floor(Math.min(480,...timed.map(x=>x.start))/60)*60, end:Math.ceil(Math.max(1200,...timed.map(x=>x.end))/60)*60};
}

// Connected overlap groups share a width; touching endpoints do not overlap.
export function overlapLayout(items) {
  const sorted = items.map(x=>({...x})).sort((a,b)=>a.start-b.start || b.end-a.end || String(a.event.id).localeCompare(String(b.event.id)));
  let group=[], end=-1;
  const finish = () => {
    const lanes=[];
    for (const item of group) {
      let lane=lanes.findIndex(until=>until<=item.start);
      if(lane<0)lane=lanes.length;
      lanes[lane]=item.end;item.lane=lane;
    }
    for(const item of group)item.columns=lanes.length;
  };
  for(const item of sorted) {
    if(item.start>=end){finish();group=[];end=-1;}
    group.push(item);end=Math.max(end,item.end);
  }
  finish();return sorted;
}

function el(tag,text,cls) {
  const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;
}
function details(event) {
  const dialog=el('dialog',undefined,'lesson-details');
  const heading=el('h2',event.subject);heading.id='lesson-title';dialog.setAttribute('aria-labelledby',heading.id);
  dialog.append(heading,el('p',`${dayLabel(romeDay(new Date(event.start)))} · ${event.allDay?'Tutto il giorno':`${time(event.start)}–${time(event.end)}`}`));
  if(event.cancelled)dialog.append(el('p','Annullata','badge'));
  if(event.state==='S')dialog.append(el('p','Sospesa','badge'));
  dialog.append(el('p',event.rooms.join(' / ')||'Aula non indicata'));
  if(event.teachers.length)dialog.append(el('p',event.teachers.join(', ')));
  if(event.notes)dialog.append(el('p',event.notes,'notes'));
  const close=el('button','Chiudi');close.onclick=()=>dialog.close();dialog.append(close);
  dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
function card(event) {
  const node=el('button',undefined,'lesson'+(event.cancelled?' cancelled':''));node.type='button';
  const color=subjectColor(event.subject);
  node.style.setProperty('--subject-bg',color.background);node.style.setProperty('--subject-border',color.border);node.style.setProperty('--subject-text',color.text);
  const when=event.allDay?'Tutto il giorno':`${time(event.start)}–${time(event.end)}`;
  const status=event.cancelled?' · Annullata':event.state==='S'?' · Sospesa':'';
  const description=[event.subject,when+status,event.rooms.join(' / ')||'Aula non indicata',event.teachers.join(', '),event.notes].filter(Boolean).join('\n');
  node.title=description;node.setAttribute('aria-label',description);node.onclick=()=>details(event);
  node.append(el('strong',event.subject,'lesson-name'),el('span',when+status,'lesson-time'));
  if(event.rooms.length)node.append(el('span',event.rooms.join(' / '),'lesson-room'));
  if(event.teachers.length)node.append(el('span',event.teachers.join(', '),'lesson-teacher'));
  return node;
}
export function renderWeek(container,events,shown,week) {
  const scrollLeft=container.querySelector('.calendar-scroll')?.scrollLeft||0;
  const scrollTop=container.querySelector('.calendar-scroll')?.scrollTop||0;
  const layout=weekLayout(events,week), visible=new Set(shown);
  const scroll=el('div',undefined,'calendar-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Calendario da lunedì a venerdì. Scorri per esplorare gli orari e i giorni.');
  const grid=el('div',undefined,'week-grid');grid.style.setProperty('--hour-height',`${HOUR_HEIGHT}px`);
  grid.append(el('div','Orario','calendar-corner'));
  for(const {day} of layout.days) {
    const heading=el('div',undefined,'calendar-heading'+(day===romeDay()?' is-today':''));
    heading.append(el('strong',dayLabel(day,{weekday:'long'})),el('span',dayLabel(day)));
    if(day===romeDay())heading.append(el('small','Oggi'));
    grid.append(heading);
  }
  if(layout.days.some(d=>d.allDay.length)) {
    grid.append(el('div','Tutto il giorno','all-day-label'));
    for(const day of layout.days){const cell=el('div',undefined,'all-day-cell');for(const {event} of day.allDay)if(visible.has(event))cell.append(card(event));grid.append(cell);}
  }
  const height=(layout.end-layout.start)/60*HOUR_HEIGHT;
  const axis=el('div',undefined,'time-axis');axis.style.height=`${height}px`;
  for(let minute=layout.start;minute<=layout.end;minute+=60){const tick=el('span',label(minute),'time-tick');tick.style.top=`${(minute-layout.start)/60*HOUR_HEIGHT}px`;axis.append(tick);}
  grid.append(axis);
  for(const day of layout.days) {
    const column=el('div',undefined,'calendar-day'+(day.day===romeDay()?' is-today':''));column.style.height=`${height}px`;
    column.setAttribute('aria-label',dayLabel(day.day,{weekday:'long',day:'numeric',month:'long'}));
    for(const item of overlapLayout(day.timed.filter(x=>visible.has(x.event)))) {
      const node=card(item.event);
      if(item.end-item.start<=60)node.classList.add('compact');
      node.style.top=`${(item.start-layout.start)/60*HOUR_HEIGHT}px`;
      node.style.height=`${(item.end-item.start)/60*HOUR_HEIGHT}px`;
      node.style.left=`calc(${item.lane/item.columns*100}% + 2px)`;
      node.style.width=`calc(${100/item.columns}% - 4px)`;
      column.append(node);
    }
    grid.append(column);
  }
  scroll.append(grid);container.replaceChildren(scroll);scroll.scrollLeft=scrollLeft;scroll.scrollTop=scrollTop;
  if(!layout.days.some(d=>[...d.timed,...d.allDay].some(x=>visible.has(x.event))))container.append(el('p',events.length?'Nessuna lezione visibile da lunedì a venerdì per le materie selezionate.':'Nessun evento in questa settimana. Puoi cambiare data o consultare il calendario originale.','calendar-empty'));
}

// Browser entry point; the layout helpers above can also be tested in Node.
if (typeof document !== 'undefined') {
const $=id=>document.getElementById(id);
let week=monday(romeDay()),events=[],selected=null,controller,requestId=0,lastSuccess=0;
try {selected=readSelection(localStorage);} catch {}
$('source').href=SOURCE;
function el(tag,text,className) {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function save() {try {localStorage.setItem(STORAGE_KEY,JSON.stringify(selected));} catch {$('storage-note').textContent='Il browser non consente di salvare la selezione. Resterà attiva in questa pagina.';}}
function renderFilters() {
  const names=[...new Set([...subjects(events),...(selected||[])])].sort((a,b)=>a.localeCompare(b,'it'));
  $('subject-count').textContent=names.length;
  $('subjects').replaceChildren();
  for(const name of names.filter(n=>n.toLocaleLowerCase('it').includes($('search').value.toLocaleLowerCase('it')))) {
    const label=el('label',undefined,'subject'), input=document.createElement('input');input.type='checkbox';input.checked=selected===null||selected.includes(name);
    input.addEventListener('change',()=>{if(selected===null)selected=[...names];selected=input.checked?[...new Set([...selected,name])]:selected.filter(n=>n!==name);save();render();});
    label.append(input,el('span',name));$('subjects').append(label);
  }
  if(!names.length)$('subjects').append(el('p','Nessuna materia disponibile in questa settimana.','hint'));
}
function render() {
  $('week-title').textContent=`${dayLabel(week)} – ${dayLabel(shiftDay(week,6))}`;
  $('week-year').textContent=`LA TUA SETTIMANA · ${week.slice(0,4)}`;$('date').value=week;
  renderFilters();const shown=filterEvents(events,selected);$('total').textContent=`${shown.length} / ${events.length} eventi`;
  renderWeek($('agenda'),events,shown,week);
}
async function load(clear=false) {
  controller?.abort();controller=new AbortController();const activeController=controller;const id=++requestId;
  if(clear){events=[];lastSuccess=0;render();}
  $('agenda').setAttribute('aria-busy','true');$('status').textContent='Aggiornamento da UniTo…';$('error').hidden=true;
  const timeout=setTimeout(()=>activeController.abort(),25000);
  try {const result=await fetchEvents(week,{signal:activeController.signal});if(id!==requestId)return;events=result;lastSuccess=Date.now();render();$('status').textContent=`Aggiornato alle ${time(new Date().toISOString())}`;}
  catch(error){if(id!==requestId)return;$('error').hidden=false;$('error').textContent='Recupero non riuscito. Controlla la connessione e riprova con Aggiorna. '+(error.name==='AbortError'?'Tempo di attesa scaduto.':error.message);$('status').textContent=lastSuccess?`Dati non aggiornati · ultimo recupero ${time(new Date(lastSuccess).toISOString())}`:'Dati non disponibili';}
  finally {clearTimeout(timeout);if(id===requestId)$('agenda').setAttribute('aria-busy','false');}
}
function go(day){week=monday(day);load(true);}
$('prev').onclick=()=>go(shiftDay(week,-7));$('next').onclick=()=>go(shiftDay(week,7));$('today').onclick=()=>go(romeDay());$('date').onchange=()=>{if(/^\d{4}-\d{2}-\d{2}$/.test($('date').value)&&!isNaN(Date.parse($('date').value)))go($('date').value);};$('refresh').onclick=()=>load();
$('search').oninput=renderFilters;$('all').onclick=()=>{selected=null;save();render();};$('none').onclick=()=>{selected=[];save();render();};
setInterval(()=>{if(!document.hidden)load();},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastSuccess>60000)load();});
render();load();
}

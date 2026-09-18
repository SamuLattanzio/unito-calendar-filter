import {SOURCE,STORAGE_KEY,romeDay,monday,shiftDay,fetchEvents,subjects,filterEvents,readSelection,time,dayLabel} from './calendar.js';
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
  $('agenda').replaceChildren();
  if(!shown.length){$('agenda').append(el('div',events.length?'Nessuna lezione per le materie selezionate. Modifica i filtri per mostrarle.':'Nessun evento in questa settimana. Puoi cambiare data o consultare il calendario originale.','empty'));return;}
  for(let i=0;i<7;i++) {
    const day=shiftDay(week,i),list=shown.filter(e=>romeDay(new Date(e.start))===day||(romeDay(new Date(e.start))<day&&romeDay(new Date(Date.parse(e.end)-1))>=day));
    const section=el('section',undefined,'day'),heading=el('div',undefined,'day-heading');
    heading.append(el('h3',dayLabel(day,{weekday:'long'})),el('span',dayLabel(day,{day:'2-digit',month:'short'})));if(day===romeDay())heading.append(el('span','Oggi','pill'));section.append(heading);
    if(!list.length)section.append(el('p','Nessuna lezione','free'));
    for(const e of list) {
      const card=el('article',undefined,'event'+(e.cancelled?' cancelled':'')),when=el('div',undefined,'event-time');when.append(el('strong',e.allDay?'Tutto il giorno':time(e.start)),el('span',e.allDay?'':time(e.end)));
      const body=el('div',undefined,'event-body');body.append(el('h4',e.subject));if(e.cancelled)body.append(el('span','Annullata','badge'));
      if(e.state==='S')body.append(el('span','Sospesa','badge'));
      body.append(el('p',e.rooms.join(' / ')||'Aula non indicata','room'));if(e.teachers.length)body.append(el('p',e.teachers.join(', '),'teacher'));if(e.notes)body.append(el('p',e.notes,'notes'));card.append(when,body);section.append(card);
    }
    $('agenda').append(section);
  }
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

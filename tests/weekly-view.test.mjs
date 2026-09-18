import test from 'node:test';
import assert from 'node:assert/strict';
import {weekLayout,overlapLayout,subjectColor} from '../app.js';
const e=(id,day,start,end,allDay=false)=>({id,subject:id,start:`2026-09-${day}T${start}:00+02:00`,end:`2026-09-${day}T${end}:00+02:00`,allDay});
test('five weekdays, real minutes and shared range independent of selection',()=>{
 const events=[e('a',14,'09:00','11:00'),e('b',15,'07:30','20:30'),e('weekend',19,'06:00','23:00')];
 const layout=weekLayout(events,'2026-09-14');assert.equal(layout.days.length,5);assert.equal(layout.start,420);assert.equal(layout.end,1260);
 assert.equal(layout.days[0].timed[0].start,540);assert.equal(layout.days[0].timed[0].end,660);
 assert.deepEqual(weekLayout([],'2026-09-14').days.map(d=>d.timed.length),[0,0,0,0,0]);
});
test('overlaps, chained groups, endpoint adjacency and independent groups',()=>{
 const items=[[540,660],[600,720],[660,780],[800,900]].map(([start,end],id)=>({event:{id},start,end}));
 const result=overlapLayout(items);assert.deepEqual(result.map(x=>[x.lane,x.columns]),[[0,2],[1,2],[0,2],[0,1]]);
 const triple=overlapLayout([0,1,2].map(id=>({event:{id},start:540,end:660})));assert.deepEqual(triple.map(x=>x.lane),[0,1,2]);assert.ok(triple.every(x=>x.columns===3));
});
test('all-day events do not force a 24-hour scale; midnight clipping',()=>{
 const all={...e('all',14,'00:00','00:00',true),end:'2026-09-16T00:00:00+02:00'};
 const layout=weekLayout([all],'2026-09-14');assert.equal(layout.start,480);assert.equal(layout.end,1200);assert.deepEqual(layout.days.map(d=>d.allDay.length),[1,1,0,0,0]);
});
test('colors are stable across ordering, reloads and Unicode equivalents',()=>{
 const color=subjectColor('Analisi');subjectColor('Programmazione');assert.deepEqual(subjectColor('Analisi'),color);assert.notDeepEqual(subjectColor('Programmazione'),color);assert.deepEqual(subjectColor('Probabilità'),subjectColor('Probabilita\u0300'));
});

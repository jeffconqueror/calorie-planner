const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function strengthLift('),html.indexOf('function renderStrengthHistory('));
const context={};vm.createContext(context);vm.runInContext(source,context);
const set=(weightKg,reps,extra={})=>({weightKg,reps,done:true,warmup:false,...extra});
const workout=(date,sets,name='Bench',key='bench')=>({date,exercises:[{name,key,sets}]});
const groups=context.strengthHistory([
 workout('2026-11-02',[set(90,6),set(200,1,{warmup:true}),set(300,1,{done:false}),set(null,8)]),
 workout('2026-10-22',[set(80,6),set(80,5)]),
 workout('2026-11-02',[set(90,5)]),
 workout('2026-11-01',[set(80,15)],'Machine bench','machine'),
 workout('2026-11-01',[set(0,12),set(10,6)],'Pull-up','pull')
],{'2026-10-31':75,'2026-11-02':74});
assert.equal(groups.length,3,'only three tracked lifts');
const bench=groups.find(g=>g.id==='bench');assert.equal(bench.days.length,3);
assert.equal(bench.days[0].date,'2026-10-22');assert.equal(bench.days[1].sets.length,1);
assert.equal(bench.days[1].estimate,108);assert.equal(bench.days[0].estimate,96);
assert.equal(groups.find(g=>g.id==='pull').days[0].volume,75*12+85*6,'uses historical, not future weight');
assert.equal(groups.find(g=>g.id==='pull').days[0].reps,12);
assert.equal(context.strengthHistory([workout('2026-11-01',[set(100,1)])])[0].days[0].estimate,100);
assert.equal(context.strengthHistory([]).every(g=>!g.days.length),true);
const order={id:'order',date:'2026-11-01',exercises:[{key:'row',name:'Row',sets:[set(50,10)]},{key:'bench',name:'Bench',sets:[set(100,5)]},{key:'squat',name:'Squat',sets:[set(100,10)]}]};
let ordered=context.strengthHistory([order]);assert.equal(ordered[0].days[0].weighted,400);assert.ok(Math.abs(ordered[1].days[0].weighted-640)<1e-9);
order.exercises.reverse();ordered=context.strengthHistory([order]);assert.equal(ordered[1].days[0].weighted,1000);
assert.equal(context.strengthHistory([workout('2026-11-01',[set(0,10)],'Pull-up','pull')])[2].days[0].volume,null);
console.log('Strength history: chronological daily aggregation, set filtering, estimates and exercise separation passed');

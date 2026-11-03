const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function strengthHistory('),html.indexOf('function renderStrengthHistory('));
const context={};vm.createContext(context);vm.runInContext(source,context);
const set=(weightKg,reps,extra={})=>({weightKg,reps,done:true,warmup:false,...extra});
const workout=(date,sets,name='Bench',key='bench')=>({date,exercises:[{name,key,sets}]});
const groups=context.strengthHistory([
 workout('2026-11-02',[set(90,6),set(200,1,{warmup:true}),set(300,1,{done:false}),set(null,8)]),
 workout('2026-10-22',[set(80,6),set(80,5)]),
 workout('2026-11-02',[set(90,5)]),
 workout('2026-11-01',[set(80,15)],'Machine bench'),
 workout('2026-11-01',[set(0,12),set(10,6)],'Pull-up','pull')
]);
assert.equal(groups.length,4,'renamed exercises and zero-load sets stay separate');
const bench=groups.find(g=>g.name==='Bench');assert.equal(bench.days.length,2);
assert.equal(bench.days[0].date,'2026-10-22');assert.equal(bench.days[1].sets.length,2);
assert.equal(bench.days[1].estimate,108);assert.equal(bench.days[0].estimate,96);
assert.equal(groups.find(g=>g.name==='Machine bench').days[0].estimate,null);
assert.equal(groups.find(g=>g.body).days[0].reps,12);
assert.equal(context.strengthHistory([workout('2026-11-01',[set(100,1)])])[0].days[0].estimate,100);
assert.equal(context.strengthHistory([]).length,0);
console.log('Strength history: chronological daily aggregation, set filtering, estimates and exercise separation passed');

const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync('index.html','utf8');
const sandbox = {
  parseISO:s=>new Date(s+'T00:00:00'),
  iso:d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
};
vm.runInNewContext(html.slice(html.indexOf('function journalDate('),html.indexOf('function importState(')),sandbox);
const set = {weightKg:60,reps:8,rir:0,warmup:false,done:true};
const workout = {id:'a',date:'2026-10-12',name:'Upper',exercises:[{name:'Bench',sets:[set,{...set,weightKg:20,warmup:true},{...set,done:false}]}]};
const clean = sandbox.cleanWorkout(workout,false);
assert.equal(clean.exercises[0].sets.length,2);
assert.equal(clean.exercises[0].sets[0].rir,0);
assert.equal(sandbox.workoutStats(clean).volume,480);
assert.equal(sandbox.workoutStats(clean).sets,1);
assert.equal(sandbox.cleanWorkout({...workout,date:'2026-02-30'},false),null);
assert.equal(sandbox.cleanWorkout({...workout,exercises:[{name:'Bench',sets:[{...set,weightKg:null}]}]},false),null);
assert.equal(sandbox.cleanWorkout({...workout,exercises:[{name:'Pull-up',sets:[{...set,weightKg:0}]}]},false).exercises[0].sets[0].weightKg,0);
assert.equal(sandbox.cleanWorkout({...workout,exercises:[]},true).exercises.length,0);
const week=sandbox.journalWeek([clean,{...clean,id:'b'},{...clean,id:'c',date:'2026-10-11'},{...clean,id:'d',date:'2026-10-19'}],'2026-10-18');
assert.equal(week.first,'2026-10-12');assert.equal(week.last,'2026-10-18');assert.equal(week.days,1);assert.equal(week.sets,2);
const backup={unit:'lb',customEx:[{id:'bench',n:'My bench'}],workouts:[{id:'one',d:'2026-10-12',name:'A',start:0,end:3600000,entries:[{id:'bench',sets:[{w:132.277357308,r:8,rir:0,done:true},{w:44,r:10,phase:'warmup',done:true},{w:90,r:8,done:false},{min:10,speed:5,done:true},{w:50,r:8,sides:{},done:true}]}]},{id:'two',d:'2026-10-12',entries:[{id:'unknown',sets:[{w:0,r:5,done:true}]}]}]};
const parsed=sandbox.parseOpenGym(JSON.stringify(backup));
assert.equal(parsed.rows.length,2,'same-day sessions are distinct');assert.equal(parsed.skippedSets,2);assert.equal(parsed.unnamed,1);
const bench=parsed.rows.find(w=>w.name==='A');assert.equal(bench.minutes,60);assert.equal(bench.exercises[0].name,'My bench');assert.ok(Math.abs(bench.exercises[0].sets[0].weightKg-60)<1e-6);
const merged=sandbox.mergeWorkoutImport([clean],parsed.rows);assert.equal(merged.added,2);assert.equal(merged.rows.length,3);
const again=sandbox.mergeWorkoutImport(merged.rows,parsed.rows);assert.equal(again.added,0);assert.equal(again.duplicates,2);
assert.throws(()=>sandbox.parseOpenGym('{"workouts":[]}'));
assert.throws(()=>sandbox.parseOpenGym('null'));
assert.equal(sandbox.parseOpenGym(JSON.stringify({unit:'kg',workouts:[null,{d:'bad'}]})).skippedSessions,2);
assert.equal(sandbox.cleanWorkouts(JSON.parse(JSON.stringify(merged.rows))).length,3);
console.log('Workout validation, warm-up exclusion, weekly boundaries, kg/lb imports, duplicate protection and backup round-trip passed');

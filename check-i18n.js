/* Verify every t('key') resolves and that EN/ZH stay in step. */
const fs = require('fs');
const src = fs.readFileSync('/tmp/load-app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function isolate(name){
  const start = src.indexOf('var ' + name + ' = {');
  if(start < 0) return null;
  const end = src.indexOf('\n};', start);
  return end < 0 ? null : src.slice(start, end + 3);
}
const enSrc = isolate('EN'), zhSrc = isolate('ZH');
if(!enSrc || !zhSrc){ console.error('could not isolate dictionaries'); process.exit(1); }
// `var EN = {...}` collides with the outer declaration, so evaluate each
// dictionary as an expression instead of a statement.
const asExpr = (t) => eval('(' + t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1) + ')');
const EN = asExpr(enSrc), ZH = asExpr(zhSrc);

const ek = new Set(Object.keys(EN)), zk = new Set(Object.keys(ZH));
const onlyEN = [...ek].filter(k => !zk.has(k));
const onlyZH = [...zk].filter(k => !ek.has(k));

const used = new Set();
for(const m of src.matchAll(/\bt\(\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*[,)]/g)) used.add(m[1]);
for(const m of html.matchAll(/data-i18n(?:-html|-ph|-aria)?="([A-Za-z_][A-Za-z0-9_]*)"/g)) used.add(m[1]);
// keys built by concatenation, checked as their concrete members
['m1','m2','m3','pw'].forEach(k => used.add('meal_' + k));
['High','Medium','Low'].forEach(k => used.add('mealCycle' + k));
['fullA','fullB','fullC','push','pull','legs','push2','pull2','legs2',
 'upA','loA','upB','loB','easy'].forEach(k => used.add('ses_' + k));
['nokey','badkey','blocked','timeout','none','http'].forEach(k => used.add('afErr_' + k));
['liftSquat','liftHinge','liftBench','liftRow','liftPull','liftOhp',
 'gLegs','gHinge','gChest','gBack','gLat','gDelts',
 'phP1','phP2','phP3','splitFull','splitUL','splitHybrid','splitPPL','splitPPL7',
 'catGrain','catProtein','catDairy','catVeg','catFruit','catFat','catCustom'].forEach(k => used.add(k));

const missing = [...used].filter(k => !ek.has(k)).sort();
if(missing.length || onlyEN.length || onlyZH.length){
  if(missing.length) console.error('MISSING from dictionaries:', missing);
  if(onlyEN.length)  console.error('EN only:', onlyEN);
  if(onlyZH.length)  console.error('ZH only:', onlyZH);
  process.exit(1);
}
console.log('i18n: ' + used.size + ' keys resolve, EN/ZH in parity (' + ek.size + ' defined)');

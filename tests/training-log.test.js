const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
function slice(from, to) {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  assert(a >= 0 && b > a, 'source boundaries found');
  return html.slice(a, b);
}
const source = slice('function cleanTrainingLog(rows){', 'function importState(text){');
const sandbox = {
  parseISO(s) { const d = new Date(s + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; },
  iso(d) { return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); }
};
vm.runInNewContext(source, sandbox);
const entry = (date, lift, weightKg, sets, mode='bodyweight') => ({date,lift,weightKg,sets,mode});
const rows = sandbox.cleanTrainingLog([
  entry('2026-10-13','bench',83,4),
  entry('2026-10-06','bench',80,4),
  entry('2026-10-13','bench',85,4),
  entry('2026-10-13','pull',0,3),
  entry('2026-10-20','pull',10,3,'weighted'),
  entry('2026-10-21','squat',100,0),
  entry('2026-02-30','squat',100,3),
  entry('2026-10-13','row',80,3)
]);
assert.deepStrictEqual(Array.from(rows, x => x.date+'|'+x.lift), [
  '2026-10-06|bench','2026-10-13|bench','2026-10-13|pull','2026-10-20|pull'
]);
assert.strictEqual(rows[1].weightKg,85, 'same-day correction replaces the old value');
assert.strictEqual(rows[2].mode,'bodyweight');
assert.strictEqual(rows[3].mode,'weighted');
assert.deepStrictEqual(Array.from(sandbox.cleanTrainingLog(null)), []);
console.log('training log validation, chronology, and same-day edits passed');

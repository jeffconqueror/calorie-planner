/* Check that the food planner's three targets follow calories and dates. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const cut = script.indexOf('/* ══ render');
assert(cut > 0, 'model source found');
const context = { navigator: { language: 'zh-CN' } };
vm.runInNewContext(script.slice(0, cut) + `
  globalThis.model = {
    set(values){ Object.assign(S, values); today = parseISO('2026-10-13'); },
    compute, mealCycleTargets
  };
})();`, context);

context.model.set({
  startDate:'2026-08-18', endDate:'2026-12-09', startKg:80.8,
  targetKg:71, weightKg:77.5, age:24, bf:19.8,
  gymDays:6, gymMin:60, gymStyle:'hyper', exp:'advanced',
  cardioDays:5, cardioMin:20, cardioType:'walk',
  kcalOverride:1950, proteinPerKg:2,
  foodDate:null, foodCycleDay:'medium'
});

const current = context.model.compute();
const plan = current.mealCycle;
assert.strictEqual(plan.base, 1950);
assert(plan.high.kcal > plan.medium.kcal && plan.medium.kcal > plan.low.kcal);
assert(Math.abs((2*plan.high.kcal + 4*plan.medium.kcal + plan.low.kcal)/7 - 1950) < 1e-6);
assert(Math.abs((2*plan.high.f + 4*plan.medium.f + plan.low.f)/7 - current.fatG) < 1e-6);
for (const day of ['high','medium','low']) {
  const target = plan[day];
  assert(Math.abs(target.p*4 + target.c*4 + target.f*9 - target.kcal) < 1e-6);
  assert(target.kcal >= current.minIntake);
}
assert.strictEqual(current.dayTarget.kcal, plan.medium.kcal);

context.model.set({foodDate:'2026-11-13'});
const future = context.model.compute();
assert(future.mealCycle.base < plan.base, 'future diet target falls with projected weight');
assert.strictEqual(future.dayTarget.kcal, future.mealCycle.medium.kcal);

context.model.set({foodDate:null, kcalOverride:2050, foodCycleDay:'high'});
const edited = context.model.compute();
assert.strictEqual(edited.mealCycle.base, 2050);
assert.strictEqual(edited.dayTarget.kcal, edited.mealCycle.high.kcal);

console.log('meal cycling targets, date changes, and calorie edits passed');

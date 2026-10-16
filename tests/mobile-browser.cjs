const {chromium}=require('@playwright/test');
const assert=require('assert'),fs=require('fs'),http=require('http');
(async()=>{
 const server=http.createServer((req,res)=>{const file=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].includes(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(500);
  assert.equal(await page.locator('#appHome').isVisible(),true);
  await page.locator('#appSettings').click();await page.locator('#langZh').click();
  if(process.argv[2]){await page.locator('#backupToggle').click();await page.locator('#backupText').fill(fs.readFileSync(process.argv[2],'utf8'));await page.locator('#backupLoad').click();}
  fs.mkdirSync('artifacts',{recursive:true});
  await page.locator('#appNav [data-app-screen="home"]').click();await page.screenshot({path:'artifacts/mobile-home.png',fullPage:true});
  assert.ok(!(await page.locator('#appHome').textContent()).includes('undefined'));
  if(process.argv[2]){assert.ok((await page.locator('#appHome').textContent()).includes('1950'));assert.ok((await page.locator('#appHome').textContent()).includes('77.2'));}
  await page.locator('#appNav [data-app-screen="plan"]').click();
  const counts=await page.locator('.routine-day').evaluateAll(nodes=>nodes.map(n=>Array.from(n.querySelectorAll('input')).reduce((a,x)=>a+Number(x.value),0)));
  assert.deepEqual(counts,[11,30,19,16,18,24]);
  await page.screenshot({path:'artifacts/mobile-plan.png',fullPage:true});
  const tuesday=page.locator('.routine-day').filter({has:page.locator('[data-routine-start="2"]')});
  await tuesday.locator('summary').click();await tuesday.locator('[data-routine-count="2-squat"]').fill('5');await tuesday.locator('[data-routine-count="2-squat"]').dispatchEvent('change');
  if(!(await tuesday.getAttribute('open')))await tuesday.locator('summary').click();
  await tuesday.locator('[data-routine-start="2"]').click();
  assert.equal(await page.locator('.journal-exercise.is-active [data-j-set="done"]').count(),5);
  assert.equal(await page.locator('.journal-exercise:visible').count(),1);
  const first=page.locator('.journal-exercise.is-active [data-j-set="weightKg"]').first();await first.fill('100');
  await page.locator('.journal-exercise.is-active [data-j-set="reps"]').first().fill('6');
  await page.locator('.journal-exercise.is-active [data-j-set="done"]').first().check();
  await page.locator('[data-app-ex="1"]').click();assert.ok((await page.locator('.app-ex-hero').textContent()).includes('倒蹬'));
  await page.locator('[data-app-ex="-1"]').click();assert.equal(Number(await first.inputValue()),100);
  await page.locator('[data-step="1"][data-field="weightKg"][data-ex="0"][data-set="0"]').click();assert.equal(Number(await first.inputValue()),102.5);
  await page.locator('[data-rest="90"]').click();assert.ok((await page.locator('#appRestClock').textContent()).startsWith('1:'));
  await page.screenshot({path:'artifacts/mobile-workout.png',fullPage:true});
  await page.reload();await page.waitForTimeout(500);await page.locator('#appHome [data-app-screen="workout"]').click();assert.equal(Number(await first.inputValue()),102.5);
  assert.equal(await page.locator('[data-app-finish]').textContent(),'✓');await page.locator('[data-app-finish]').click();
  await page.locator('#appNav [data-app-screen="stats"]').click();assert.equal(await page.locator('#journalHistory details').count(),1);assert.ok((await page.locator('#appStats').textContent()).includes('615'));
  await page.screenshot({path:'artifacts/mobile-stats.png',fullPage:true});
  await page.locator('#appNav [data-app-screen="nutrition"]').click();assert.equal(await page.locator('#heroKcal').isVisible(),true);if(process.argv[2])assert.equal(await page.locator('#heroKcal').inputValue(),'1950');
  await page.locator('#appSettings').click();await page.locator('#backupToggle').click();const backed=JSON.parse(await page.locator('#backupText').inputValue());assert.equal(backed.routineSets['2-squat'],5);assert.equal(backed.workouts[0].exercises[0].sets[0].weightKg,102.5);
  for(const width of [360,390,430,700]){await page.setViewportSize({width,height:844});for(const screen of ['home','plan','workout','stats','nutrition']){await page.locator('#appNav [data-app-screen="'+screen+'"]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow at '+width+' '+screen);}}
  assert.deepEqual(errors,[]);console.log('Mobile: six exact routines, editable saved counts, focus navigation, step controls, timer, draft recovery, completed stats, nutrition and 360–700px layouts passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

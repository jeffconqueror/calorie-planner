// Run after npm install, using installed Chrome: npm run test:browser
const {chromium}=require('@playwright/test');
const assert=require('assert'),fs=require('fs'),http=require('http'),path=require('path');
(async()=>{
 const server=http.createServer((req,res)=>{const name=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(fs.readFileSync(name));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(600);
 await page.locator('#langZh').click();await page.locator('#journalStart').click();
 await page.locator('[data-j-action="add-ex"]').click();
 await page.locator('[data-j-name="0"]').fill('卧推 <script>');
 await page.locator('[data-j-set="weightKg"]').fill('60');await page.locator('[data-j-set="reps"]').fill('8');await page.locator('[data-j-set="rir"]').fill('0');await page.locator('[data-j-set="done"]').check();
 await page.reload();await page.waitForTimeout(600);assert.equal(Number(await page.locator('[data-j-set="weightKg"]').inputValue()),60);
 await page.locator('#uImperial').click();assert.ok(Math.abs(Number(await page.locator('[data-j-set="weightKg"]').inputValue())-132.28)<.02);await page.locator('#uMetric').click();
 await page.locator('[data-j-action="finish"]').click();assert.equal(await page.locator('#journalHistory details').count(),1);
 assert.equal(await page.locator('#journalHistory script').count(),0);
 await page.locator('#journalHistory summary').click();await page.locator('[data-j-action="repeat"]').click();assert.equal(Number(await page.locator('[data-j-set="weightKg"]').inputValue()),60);assert.equal(await page.locator('[data-j-set="done"]').isChecked(),false);
 await page.locator('[data-j-action="discard"]').click();
 await page.locator('#journalHistory summary').click();await page.locator('[data-j-action="edit"]').click();await page.locator('[data-j-set="weightKg"]').fill('65');await page.locator('[data-j-action="finish"]').click();assert.equal(await page.locator('#journalHistory details').count(),1);
 const firstProfile=await page.locator('#profileSel').inputValue();await page.locator('#profileSel').selectOption('__new');assert.equal(await page.locator('#journalHistory details').count(),0);assert.equal(await page.locator('#journalEditor').isVisible(),false);
 await page.locator('#profileSel').selectOption(firstProfile);assert.equal(await page.locator('#journalHistory details').count(),1);
 const json={unit:'lb',customEx:[{id:'x',n:'Imported row'}],workouts:[{id:'import1',d:'2026-10-14',entries:[{id:'x',sets:[{w:100,r:10,done:true}]}]}]};
 await page.locator('summary[data-i18n="jImport"]').click();await page.locator('#journalImportFile').setInputFiles({name:'opengym.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await page.locator('#journalImportApply').click();assert.equal(await page.locator('#journalHistory details').count(),2);
 await page.locator('#journalImportFile').setInputFiles({name:'opengym.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});await page.waitForTimeout(150);assert.equal(await page.locator('#journalImportApply').isVisible(),false);
 await page.locator('#backupToggle').click();const state=await page.locator('#backupText').inputValue();assert.equal(JSON.parse(state).workouts.length,2);await page.locator('#backupText').fill(state);await page.locator('#backupLoad').click();assert.equal(await page.locator('#journalHistory details').count(),2);
 await page.locator('#journalStart').click();await page.locator('[data-j-action="add-ex"]').click();
 await page.setViewportSize({width:390,height:844});await page.locator('#workoutJournal').scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no mobile page overflow');
 assert.ok(!(await page.locator('#journalSummary').textContent()).includes('undefined'));
 assert.ok(!(await page.locator('#journalImportMessage').textContent()).includes('undefined'));
 await page.addStyleTag({content:'.masthead{position:static!important}'});
 fs.mkdirSync('artifacts',{recursive:true});await page.locator('#workoutJournal').screenshot({path:'artifacts/workout-journal-mobile.png'});
 await page.setViewportSize({width:1280,height:900});await page.locator('#workoutJournal').screenshot({path:'artifacts/workout-journal-desktop.png'});
 await page.locator('#langEn').click();assert.ok((await page.locator('#workoutJournal h2[data-i18n="jTitle"]').textContent()).includes('Workout'));
 if(process.argv[2]){
   const original=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
   await page.locator('#backupToggle').click();await page.locator('#backupText').fill(JSON.stringify(original));await page.locator('#backupLoad').click();
   await page.locator('#backupToggle').click();const restored=JSON.parse(await page.locator('#backupText').inputValue());
   for(const k of Object.keys(original))assert.deepEqual(restored[k],original[k],'original backup field '+k+' preserved');
   assert.deepEqual(restored.workouts,[]);assert.equal(restored.workoutDraft,null);
   console.log('Personal backup: all original fields preserved, '+Object.keys(original.log.entries).length+' weigh-ins, '+original.custom.length+' custom foods, no invented workouts');
 }
 assert.deepEqual(errors,[]);console.log('Browser: create, draft reload, kg/lb, repeat, edit, profile isolation, import, backup, EN/ZH and mobile layout passed');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

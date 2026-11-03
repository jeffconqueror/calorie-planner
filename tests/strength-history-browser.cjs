const {chromium,expect}=require('@playwright/test');
const fs=require('fs'),http=require('http'),assert=require('assert');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync('index.html'));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port);
  if(width===390)await page.locator('#appSettings').click();await page.locator('#backupToggle').click();
  const workouts=[6,8].map((reps,i)=>({id:'test-'+i,date:'2026-10-'+(20+i),name:'Test',exercises:[{key:'bench',name:'Bench',sets:[{weightKg:80,reps,done:true,warmup:false}]}]}));
  await page.locator('#backupText').fill(JSON.stringify({lang:'en',trainingUnit:'kg',workouts}));await page.locator('#backupLoad').click();
  if(width===390)await page.locator('#appNav [data-app-screen="stats"]').click();
  await expect(page.locator('#strengthHistorySection')).toBeVisible();assert.equal(await page.locator('#trainingForm').count(),0);
  assert.equal(await page.locator('#strengthExercise option').count(),3);await page.locator('#strengthMetric').selectOption('estimate');
  await expect(page.locator('#strengthHistoryChart')).toContainText('101.3 kg');
  await page.locator('#strengthMetric').selectOption('reps');await expect(page.locator('#strengthHistoryChart')).toContainText('+2 reps');
  await page.locator('#strengthMetric').selectOption('load');await expect(page.locator('#strengthHistoryChart')).toContainText('80 kg');
  if(width===390)await page.locator('#appNav [data-app-screen="workout"]').click();
  await page.locator('#journalUnit').selectOption('lb');if(width===390)await page.locator('#appNav [data-app-screen="stats"]').click();
  await expect(page.locator('#strengthHistoryChart')).toContainText('176.4 lb');
  assert.equal(await page.locator('.strength-session').count(),2);assert.deepEqual(errors,[]);
  if(width===390)await page.locator('#appNav [data-app-screen="workout"]').click();
  await page.locator('#journalTemplate').selectOption('routine:3');await page.locator('#journalStart').click();
  await page.locator('.journal-order summary').click();
  await expect(page.locator('.journal-order-row').first()).toContainText('Flat bench');
  await page.locator('[data-j-action="move-down"][data-ex="0"]').click();
  await expect(page.locator('.journal-order-row').nth(1)).toContainText('Flat bench');
  await expect(page.locator('.journal-order-row').nth(1)).toContainText('0.8');
  await page.reload();if(width===390)await page.locator('#appNav [data-app-screen="workout"]').click();
  await expect(page.locator('.journal-order-row').nth(1)).toContainText('Flat bench');
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/strength-workout-'+width+'.png',fullPage:true});
  await page.locator('#journalEditor [data-j-set]').evaluateAll(inputs=>inputs.forEach(el=>{
   if(el.dataset.jSet==='weightKg')el.value='100';else if(el.dataset.jSet==='reps')el.value='5';else if(el.dataset.jSet==='done')el.checked=true;else return;
   el.dispatchEvent(new Event('input',{bubbles:true}));
  }));
  await page.locator('#journalEditor [data-j-action="finish"]').click();
  if(width===390)await page.locator('#appNav [data-app-screen="stats"]').click();
  await expect(page.locator('.strength-session').first()).toContainText('#2');
  await expect(page.locator('.strength-session').first()).toContainText('1600');
  await page.locator('#strengthHistorySection').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/strength-stats-'+width+'.png'});
  assert.deepEqual(errors,[]);
  await page.close();
 }console.log('Strength history UI: desktop/mobile, metric controls, kg/lb and archived form passed');}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

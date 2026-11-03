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
  await expect(page.locator('#strengthHistorySection')).toBeVisible();await expect(page.locator('#legacyStrengthArchive')).toBeHidden();
  await expect(page.locator('#strengthHistoryChart')).toContainText('101.3 kg');
  await page.locator('#strengthMetric').selectOption('reps');await expect(page.locator('#strengthHistoryChart')).toContainText('+2 reps');
  await page.locator('#strengthMetric').selectOption('load');await expect(page.locator('#strengthHistoryChart')).toContainText('80 kg');
  if(width===390)await page.locator('#appNav [data-app-screen="workout"]').click();
  await page.locator('#journalUnit').selectOption('lb');if(width===390)await page.locator('#appNav [data-app-screen="stats"]').click();
  await expect(page.locator('#strengthHistoryChart')).toContainText('176.4 lb');
  assert.equal(await page.locator('#strengthHistoryChart tbody tr').count(),2);assert.deepEqual(errors,[]);
  await page.close();
 }console.log('Strength history UI: desktop/mobile, metric controls, kg/lb and archived form passed');}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

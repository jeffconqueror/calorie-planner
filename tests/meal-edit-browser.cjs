const {chromium}=require('@playwright/test');
const fs=require('fs'),http=require('http'),assert=require('assert');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync('index.html'));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);
 if(width===390)await page.locator('#appSettings').click();await page.locator('#backupToggle').click();
 await page.locator('#backupText').fill(JSON.stringify({lang:'en',mealMode:'day',meals:[{key:'m1',share:100,items:[{id:'oats',g:100,lock:true},{id:'chbr_r',g:200,lock:true}]},{key:'m2',share:0,items:[]},{key:'m3',share:0,items:[]},{key:'pw',share:0,items:[]}]}));await page.locator('#backupLoad').click();
 if(width===390)await page.locator('#appNav [data-app-screen="nutrition"]').click();
 const a=page.locator('[data-mi="m1:0"]'),b=page.locator('[data-mi="m1:1"]');
 await a.scrollIntoViewIfNeeded();const original=await a.elementHandle();await a.click();
 assert.ok(await original.evaluate(el=>el.isConnected),'clicking amount must preserve the original input');
 await a.fill('137');await b.click();assert.ok(await b.evaluate(el=>document.activeElement===el),'next field receives focus on first click');
 await b.fill('245');await b.press('Tab');await page.waitForTimeout(1600);
 assert.equal(await a.inputValue(),'137');assert.equal(await b.inputValue(),'245');
 await page.locator('[data-mstep="+"][data-mi2="m1:0"]').click();assert.equal(await a.inputValue(),'147');
 await page.close();
 }console.log('Meal edits: input identity, field switching, pinned grams and step controls passed on mobile/desktop');}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

// Two isolated browser stores against a deterministic Supabase-shaped transport.
// Real Postgres RLS/CAS are exercised separately by cloud-database.cjs.
const {chromium,expect}=require('@playwright/test');
const fs=require('fs'),http=require('http'),assert=require('assert');
(async()=>{
 const server=http.createServer((req,res)=>{const f=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].includes(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(fs.readFileSync(f));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 const documents=new Map();let requests=0,rejectOnce=false,holdRead=null,readReached=null;
 const uid='11111111-1111-4111-8111-111111111111';
 async function context(mobile){
  const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
  await c.route('https://*.supabase.co/**',async route=>{
   if(new URL(route.request().url()).hostname!=='sync-test.supabase.co')throw new Error('Unexpected live cloud request in mock test');
   requests++;const req=route.request(),url=new URL(req.url()),data=req.postDataJSON(),token=req.headers().authorization;
   const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname==='/auth/v1/otp')return send({});
   if(url.pathname==='/auth/v1/verify'||url.pathname==='/auth/v1/token')return send({access_token:'test-user-token',refresh_token:'test-refresh-token',expires_in:3600,user:{id:uid,email:'test@example.com'}});
   if(url.pathname==='/auth/v1/user'&&token==='Bearer wrong-email')return send({id:uid,email:'another@example.com',email_confirmed_at:new Date().toISOString()});
   if(url.pathname==='/auth/v1/user')return token==='Bearer link-token'?send({id:uid,email:'test@example.com',email_confirmed_at:new Date().toISOString()}):send({error:'invalid-token'},401);
   if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
   if(token!=='Bearer test-user-token'&&token!=='Bearer link-token')return send({error:'unauthorized'},401);
   if(url.pathname==='/rest/v1/load_sync_documents'){
    if(holdRead){const wait=holdRead;holdRead=null;if(readReached)readReached();await wait;}
    return send(documents.has(uid)?[documents.get(uid)]:[]);
   }
   if(url.pathname==='/rest/v1/rpc/load_sync_commit'){
    const current=documents.get(uid)||{revision:0,document:{version:1,records:{}}};
    if(rejectOnce){rejectOnce=false;current.revision++;current.document.records['weight/2026-01-01']={value:80};documents.set(uid,current);return send({accepted:false,...current});}
    if(data.p_revision!==current.revision)return send({accepted:false,...current});
    const updated={revision:current.revision+1,document:data.p_document};documents.set(uid,updated);return send({accepted:true,...updated});
   }
   return send({error:'not-found'},404);
  });
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(origin);await p.waitForTimeout(500);if(mobile)await p.locator('#appSettings').click();
  return {c,p,mobile};
 }
 async function backup(d,state){if(await d.p.locator('#backupBox').isHidden())await d.p.locator('#backupToggle').click();await d.p.locator('#backupText').fill(JSON.stringify(state));await d.p.locator('#backupLoad').click();}
 async function exportState(d){if(await d.p.locator('#backupBox').isVisible())await d.p.locator('#backupToggle').click();await d.p.locator('#backupToggle').click();return JSON.parse(await d.p.locator('#backupText').inputValue());}
 async function login(d,link=false){let p=d.p;if(await p.locator('#cloudUrl').isHidden())await p.locator('#cloudSetup summary').click();await p.locator('#cloudUrl').fill('https://sync-test.supabase.co');await p.locator('#cloudKey').fill('sb_publishable_test');await p.locator('#cloudConfigSave').click();await p.locator('#cloudEmail').fill('test@example.com');await p.locator('#cloudSend').click();await expect(p.locator('#cloudStatus')).toContainText('Email sent');if(link){p=await d.c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());d.p=p;await p.goto(origin+'/#access_token=link-token&refresh_token=test-refresh-token&expires_in=3600&type=signup');await expect(p.locator('#cloudStatus')).toContainText('Signed in');assert.equal(new URL(p.url()).hash,'','callback clears tokens from address bar');}else{await p.locator('#cloudCode').fill('123456');await p.locator('#cloudVerify').click();await expect(p.locator('#cloudStatus')).toContainText('Signed in');}}
 async function sync(d,enable=false){await d.p.locator(enable?'#cloudEnable':'#cloudNow').click();await expect(d.p.locator('#cloudStatus')).toContainText('Cloud sync complete');}
 try{
 const invalid=await context(true);
 await invalid.p.goto(origin+'/#error=access_denied&error_code=otp_expired');
 await expect(invalid.p.locator('#cloudStatus')).toContainText('Login link is invalid');assert.equal(new URL(invalid.p.url()).hash,'');
 await invalid.p.goto(origin+'/#access_token=link-token&refresh_token=unrequested');
 await expect(invalid.p.locator('#cloudStatus')).toContainText('Login link is invalid');assert.equal(await invalid.p.locator('#cloudConnected').isVisible(),false);await invalid.c.close();
 const linkPhone=await context(true);await login(linkPhone,true);assert.equal(documents.size,0,'mobile link login alone does not sync');await linkPhone.p.locator('#cloudLogout').click();
 await linkPhone.p.locator('#cloudEmail').fill('test@example.com');await linkPhone.p.locator('#cloudSend').click();await expect(linkPhone.p.locator('#cloudStatus')).toContainText('Email sent');
 await linkPhone.p.goto(origin+'/#access_token=wrong-email&refresh_token=wrong-refresh');await expect(linkPhone.p.locator('#cloudStatus')).toContainText('Login link is invalid');assert.equal(await linkPhone.p.locator('#cloudConnected').isVisible(),false,'different verified email is rejected');await linkPhone.c.close();requests=0;
 const pc=await context(false),phone=await context(true);
 const date=await pc.p.evaluate(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
 await backup(pc,{lang:'en',kcalOverride:1950,log:{started:date,entries:{[date]:77.2}},usdaKey:'local-private-key'});
 await backup(phone,{lang:'en',workouts:[{id:'phone-workout',date,name:'Phone workout',exercises:[{key:'',name:'Bench',sets:[{weightKg:60,reps:8,done:true,warmup:false,rir:2}]}]}]});
 assert.equal(requests,0,'app does not contact cloud before login even with preset configuration');
 await login(pc,true);assert.equal(documents.size,0,'login alone does not upload health records');await sync(pc,true);
 await login(phone);await sync(phone,true);let ps=await exportState(phone);assert.equal(ps.log.entries[date],77.2);assert.equal(ps.workouts.length,1);assert.equal(ps.kcalOverride,1950);
 await sync(pc);let cs=await exportState(pc);assert.equal(cs.workouts.length,1);assert.equal(cs.usdaKey,'local-private-key');assert.ok(!JSON.stringify(documents.get(uid)).includes('local-private-key'));
 // Offline, independent edits: a new weigh-in and an edited workout merge.
 await pc.c.setOffline(true);await phone.c.setOffline(true);
 await pc.p.locator('[data-weigh="'+date+'"]').fill('77.1');await pc.p.locator('[data-weigh="'+date+'"]').dispatchEvent('change');
 await phone.p.locator('#appNav [data-app-screen="stats"]').click();await phone.p.locator('#journalHistory summary').click();await phone.p.locator('#journalHistory [data-j-action="edit"]').click();
 await phone.p.locator('[data-j-set="weightKg"]').fill('65');await phone.p.locator('[data-app-finish]').click();await phone.p.locator('#appSettings').click();
 await pc.c.setOffline(false);await phone.c.setOffline(false);await sync(pc);rejectOnce=true;await sync(phone);await sync(pc);
 cs=await exportState(pc);assert.equal(cs.log.entries[date],77.1);assert.equal(cs.workouts[0].exercises[0].sets[0].weightKg,65);assert.equal(cs.log.entries['2026-01-01'],80,'CAS retry keeps concurrent record');
 // Simultaneous edits to one date stop and require a decision.
 await sync(phone);await pc.c.setOffline(true);await phone.c.setOffline(true);
 for(const [d,value] of [[pc,'77.0'],[phone,'76.9']]){await d.p.locator('[data-weigh="'+date+'"]').fill(value);await d.p.locator('[data-weigh="'+date+'"]').dispatchEvent('change');}
 await pc.c.setOffline(false);await sync(pc);await phone.c.setOffline(false);await phone.p.locator('#cloudNow').click();await expect(phone.p.locator('#cloudConflicts')).toBeVisible();
 for(const select of await phone.p.locator('[data-cloud-conflict]').all())await select.selectOption('local');
 await phone.p.locator('#cloudResolve').click();await expect(phone.p.locator('#cloudStatus')).toContainText('Cloud sync complete');await sync(pc);assert.equal((await exportState(pc)).log.entries[date],76.9);
 // A remote deletion is retained on the offline/unchanged device.
 await phone.c.setOffline(true);await pc.p.locator('#journalHistory summary').click();await pc.p.locator('#journalHistory [data-j-action="delete"]').click();await sync(pc);await phone.c.setOffline(false);await sync(phone);assert.equal((await exportState(phone)).workouts.length,0);
 // A late response after switching profiles must not import someone else's data.
 let release;holdRead=new Promise(r=>release=r);const reached=new Promise(r=>readReached=r);
 await pc.p.locator('#cloudNow').click();await reached;await pc.p.locator('#profileSel').selectOption('__new');release();await pc.p.waitForTimeout(150);
 assert.equal((await exportState(pc)).workouts.length,0);assert.equal((await exportState(pc)).log.entries[date],undefined);assert.equal(await pc.p.locator('#cloudConnected').isVisible(),false);
 // Restore pauses sync; no reset/restore silently propagates deletions.
 await backup(phone,{lang:'en',log:{started:null,entries:{}},workouts:[]});await expect(phone.p.locator('#cloudStatus')).toContainText('paused');await expect(phone.p.locator('#cloudEnable')).toBeVisible();
 fs.mkdirSync('artifacts',{recursive:true});await phone.p.locator('#cloudPanel').screenshot({path:'artifacts/cloud-sync-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Two-device browser sync: explicit opt-in, private fields, first merge, offline edits, CAS retry, conflict resolution, deletion propagation, profile race and restore pause passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});

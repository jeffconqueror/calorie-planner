const {PGlite}=require('@electric-sql/pglite');const fs=require('fs'),assert=require('assert');
(async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
 await db.exec('set role anon');await assert.rejects(()=>db.query('select * from public.load_sync_documents'));await assert.rejects(()=>db.query("select public.load_sync_commit(0,'{\"version\":1,\"records\":{}}')"));
 await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)");
 const doc={version:1,records:{'weight/2026-10-16':{value:77.2}}};
 const commit=async(rev,data)=>(await db.query('select public.load_sync_commit($1,$2::jsonb) as result',[rev,JSON.stringify(data)])).rows[0].result;
 let r=await commit(0,doc);assert.equal(r.accepted,true);assert.equal(r.revision,1);
 r=await commit(0,{version:1,records:{}});assert.equal(r.accepted,false);assert.deepEqual(r.document,doc,'stale revision cannot overwrite');
 await assert.rejects(()=>db.query('update public.load_sync_documents set revision=9'));
 await assert.rejects(()=>db.query('delete from public.load_sync_documents'));
 await assert.rejects(()=>commit(1,{version:7,records:{}}));
 await assert.rejects(()=>commit(1,{version:1,records:{bad:42}}));
 await db.exec("select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)");
 assert.equal((await db.query('select * from public.load_sync_documents')).rows.length,0,'account B cannot read A');
 r=await commit(0,{version:1,records:{'workout/b':{value:{id:'b'}}}});assert.equal(r.accepted,true);assert.equal((await db.query('select * from public.load_sync_documents')).rows.length,1);
 await db.exec("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>commit(0,doc));
 await db.exec("reset role");assert.equal((await db.query('select * from public.load_sync_documents')).rows.length,2);
 console.log('Postgres: migration rerun, owner-only reads/writes, anonymous denial, direct-write denial, stale revision rejection and payload validation passed');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exit(1);});

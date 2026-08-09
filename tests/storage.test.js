/* Exercise the durability layer lifted out of index.html against a mock
   IndexedDB. Headless Chrome never settles indexedDB.open() under virtual
   time, so this is where that code actually gets verified. */
const fs = require('fs'), vm = require('vm');
const R = []; const ck = (n,c,x)=>R.push((c?'PASS':'FAIL')+' | '+n+(x!=null?'  ['+x+']':''));

const html = fs.readFileSync('index.html','utf8');
function slice(from, to){
  const a = html.indexOf(from), b = html.indexOf(to, a);
  if(a < 0 || b < 0) throw new Error('could not locate ' + from);
  return html.slice(a, b);
}
const storageSrc = slice('var IDB = null;', 'function requestPersistence');
const weightSrc  = slice('function stateWeight(o){', '\nfunction load()');

/* ── mock IndexedDB ── */
let store = {}; let failOpen = false, failTx = false;
function mkReq(){ return {onsuccess:null,onerror:null,onupgradeneeded:null,result:null}; }
const indexedDB = {
  open(){
    const req = mkReq();
    setTimeout(()=>{
      if(failOpen){ req.onerror && req.onerror(); return; }
      req.result = {
        objectStoreNames:{ contains:()=>true },
        createObjectStore(){},
        transaction(){
          const tx = {onerror:null};
          tx.objectStore = () => ({
            put(v,k){ if(failTx){ setTimeout(()=>tx.onerror&&tx.onerror(),0); return; } store[k]=v; },
            get(k){ const r=mkReq(); setTimeout(()=>{ r.result=store[k]; r.onsuccess&&r.onsuccess(); },0); return r; }
          });
          return tx;
        }
      };
      req.onupgradeneeded && req.onupgradeneeded();
      req.onsuccess && req.onsuccess();
    },0);
    return req;
  }
};
/* the helpers now key by the active profile, so the registry must exist */
const sandbox = { window:{indexedDB}, indexedDB, setTimeout, clearTimeout, console,
                  IDB_OK:null, P:{list:[{id:'p1',name:''}], active:'p1'} };
vm.createContext(sandbox);
vm.runInContext(storageSrc + '\n' + weightSrc, sandbox);

const wait = (ms=20)=>new Promise(r=>setTimeout(r,ms));
(async () => {
  /* ── stateWeight decides which copy wins ── */
  const sw = sandbox.stateWeight;
  ck('an empty state weighs least', sw({}) < sw({name:'x'}), sw({}) + ' < ' + sw({name:'x'}));
  ck('weigh-ins count most',
     sw({log:{entries:{a:1,b:2}}}) > sw({custom:[1,1,1]}),
     sw({log:{entries:{a:1,b:2}}}) + ' > ' + sw({custom:[1,1,1]}));
  ck('more weigh-ins outweigh fewer',
     sw({log:{entries:{a:1,b:1,c:1}}}) > sw({log:{entries:{a:1}}}));
  ck('a rubbish value scores below everything', sw(null) < sw({}), sw(null));
  ck('meals contribute',
     sw({meals:[{items:[1,2]}]}) > sw({meals:[{items:[]}]}));

  /* ── round trip ── */
  sandbox.idbPut('{"targetKg":72}');
  await wait();
  ck('a write reaches the database', store.p1 === '{"targetKg":72}', store.p1);
  ck('the database is marked usable', sandbox.IDB_OK === true, String(sandbox.IDB_OK));

  let got = null;
  sandbox.idbGet(v => { got = v; });
  await wait();
  ck('a read returns what was written', got === '{"targetKg":72}', got);

  /* two people must not share a slot */
  sandbox.P.list.push({id:'p2',name:'friend'});
  sandbox.P.active = 'p2';
  sandbox.idbPut('{"targetKg":90}');
  await wait();
  ck('a second person writes to their own slot', store.p2 === '{"targetKg":90}', store.p2);
  ck('and the first person is untouched', store.p1 === '{"targetKg":72}', store.p1);
  sandbox.P.active = 'p1';
  let mine = null; sandbox.idbGet(v => { mine = v; }); await wait();
  ck('switching back reads the right person', mine === '{"targetKg":72}', mine);
  sandbox.P.active = 'p1';

  /* ── failure must be reported, never silent ── */
  sandbox.IDB = null; sandbox.IDB_OK = null; failOpen = true;
  let got2 = 'untouched';
  sandbox.idbGet(v => { got2 = v; });
  await wait();
  ck('a database that will not open reports null', got2 === null, String(got2));
  ck('and is marked unusable rather than assumed fine', sandbox.IDB_OK === false, String(sandbox.IDB_OK));

  /* ── no database at all (private mode, old browser) ── */
  sandbox.IDB = null; sandbox.IDB_OK = null; failOpen = false;
  sandbox.window.indexedDB = null; sandbox.indexedDB = null;
  let got3 = 'untouched';
  sandbox.idbGet(v => { got3 = v; });
  await wait();
  ck('no IndexedDB at all degrades quietly', got3 === null && sandbox.IDB_OK === false,
     String(sandbox.IDB_OK));

  const f = R.filter(x => x.startsWith('FAIL'));
  console.log(R.join('\n'));
  console.log('---\n' + (R.length - f.length) + '/' + R.length + ' passed');
  process.exit(f.length ? 1 : 0);
})();

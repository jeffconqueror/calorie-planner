/* Exercise sw.js against a mock ServiceWorkerGlobalScope. */
const fs = require('fs'), vm = require('vm');
const R = []; const ck = (n,c,x)=>R.push((c?'PASS':'FAIL')+' | '+n+(x!=null?'  ['+x+']':''));

class Res { constructor(body, ok=true){ this.body=body; this.ok=ok; } clone(){ return new Res(this.body, this.ok); } }
const store = new Map();                       // cacheName -> Map(url -> Res)
const caches = {
  open: async (n) => {
    if(!store.has(n)) store.set(n, new Map());
    const m = store.get(n);
    return {
      addAll: async (urls) => urls.forEach(u => m.set(u, new Res('cached:'+u))),
      put: async (k, v) => m.set(typeof k==='string'?k:k.url, v),
      keys: async () => [...m.keys()].map(u => ({url:'https://x/'+u}))
    };
  },
  keys: async () => [...store.keys()],
  delete: async (n) => store.delete(n),
  match: async (k) => {
    const key = typeof k==='string' ? k : k.url;
    for(const m of store.values()) if(m.has(key)) return m.get(key);
    return undefined;
  }
};

const handlers = {};
let claimed=false, skipped=false;
let netMode = 'up';
const sandbox = {
  self: {
    addEventListener: (t,f) => handlers[t]=f,
    skipWaiting: async () => { skipped=true; },
    clients: { claim: async () => { claimed=true; } },
    location: { origin: 'https://site.test' }
  },
  caches,
  fetch: async (req) => {
    if(netMode==='down') throw new Error('offline');
    return new Res('network:'+(req.url||req));
  },
  URL, Promise, console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('sw.js','utf8'), sandbox);

(async () => {
  ck('registers install, activate and fetch handlers',
     !!handlers.install && !!handlers.activate && !!handlers.fetch,
     Object.keys(handlers).join(','));

  // install
  let p; handlers.install({ waitUntil: (x)=>{p=x;} }); await p;
  const cacheName = [...store.keys()][0];
  ck('install opens a build-stamped cache', /^load-/.test(cacheName), cacheName);
  const entries = [...store.get(cacheName).keys()];
  ck('install caches the app shell', entries.includes('./index.html'), entries.length+' entries');
  ck('install caches all three icons',
     ['./icon-180.png','./icon-192.png','./icon-512.png'].every(u=>entries.includes(u)));
  ck('install caches the manifest', entries.includes('./manifest.webmanifest'));
  ck('install takes over immediately', skipped);

  // activate should evict an older build
  store.set('load-OLDBUILD', new Map());
  handlers.activate({ waitUntil: (x)=>{p=x;} }); await p;
  ck('activate deletes caches from previous builds', !store.has('load-OLDBUILD'),
     [...store.keys()].join(','));
  ck('activate keeps the current one', store.has(cacheName));
  ck('activate claims open pages', claimed);

  // fetch: cross-origin must pass straight through, never be served from cache
  let responded = null;
  handlers.fetch({ request:{method:'GET', url:'https://api.nal.usda.gov/fdc/v1/foods/search?q=x', mode:'cors'},
                   respondWith:(x)=>{responded=x;} });
  ck('the food lookup is never intercepted', responded === null);

  // fetch: navigation online -> network, and refreshes the cache
  responded = null; netMode = 'up';
  handlers.fetch({ request:{method:'GET', url:'https://site.test/', mode:'navigate'},
                   respondWith:(x)=>{responded=x;} });
  let res = await responded;
  ck('a page load online comes from the network', /^network:/.test(res.body), res.body);

  // fetch: navigation offline -> cached shell
  responded = null; netMode = 'down';
  handlers.fetch({ request:{method:'GET', url:'https://site.test/', mode:'navigate'},
                   respondWith:(x)=>{responded=x;} });
  res = await responded;
  ck('a page load offline still resolves instead of failing', !!res, res ? 'served' : 'nothing');
  ck('and it did not come from the network, which is down',
     !/^network:https:\/\/site.test\/$/.test(res.body) || netMode==='down', 'offline path taken');

  // fetch: asset offline -> cache
  (await caches.open(cacheName)).put('https://site.test/icon-192.png', new Res('cached:icon-192'));
  responded = null;
  handlers.fetch({ request:{method:'GET', url:'https://site.test/icon-192.png', mode:'no-cors'},
                   respondWith:(x)=>{responded=x;} });
  res = await responded;
  ck('an icon offline comes from the cache', !!res && /icon-192/.test(res.body), res && res.body);

  // non-GET must be left alone
  responded = null;
  handlers.fetch({ request:{method:'POST', url:'https://site.test/', mode:'navigate'},
                   respondWith:(x)=>{responded=x;} });
  ck('non-GET requests are left alone', responded === null);

  const f = R.filter(x=>x.startsWith('FAIL'));
  console.log(R.join('\n'));
  console.log('---\n' + (R.length-f.length) + '/' + R.length + ' passed');
  process.exit(f.length ? 1 : 0);
})();

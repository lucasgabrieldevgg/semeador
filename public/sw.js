/* Semeador SW — capítulos baixados ficam no aparelho (lê offline) */
const CACHE='semeador-v1';
const TEXTO=u=>u.indexOf('/texto/')>=0;
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  if(TEXTO(u.pathname)){ // texto bíblico: cache-first (uma vez baixado, é seu)
    e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(n=>{c.put(e.request,n.clone());return n}))));
  }else if(e.request.mode==='navigate'){ // app shell: rede primeiro, cache de socorro
    e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match('/'))));
  }
});

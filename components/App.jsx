import React,{useState,useEffect,useRef,useCallback} from 'react';
import CORE from '../lib/core.js';
import REG from '../lib/trads.json';

const LIVROS=REG.livros, TRADS=REG.trads;
const RAW='https://raw.githubusercontent.com/FordhamRamFan/public-domain-bible-translations/main/';
const ST={
  getJ(k,d){try{const v=localStorage.getItem('sem_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  setJ(k,v){try{localStorage.setItem('sem_'+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem('sem_'+k)}catch(e){}}
};
const CACHE='semeador-v1';
async function cAbre(){return ('caches' in window)?caches.open(CACHE):null}

async function carregaCap(tr,ab,nn){
  const arq=nn+'-'+ab+'.json';
  const c=await cAbre();
  if(tr.fonte==='local'){
    const local='/texto/'+tr.id+'/'+arq;
    if(c){const r=await c.match(local);if(r)return (await r.json())}
    const r=await fetch(local);const j=await r.json();
    if(c)try{c.put(local,new Response(JSON.stringify(j)))}catch(e){}
    return j;
  }
  const chave='/texto/remota/'+tr.id+'/'+arq;
  if(c){const r=await c.match(chave);if(r)return (await r.json())}
  const r=await fetch(RAW+tr.caminho+'/'+arq);
  if(!r.ok)throw new Error('capítulo indisponível');
  const j=await r.json();
  if(c)try{c.put(chave,new Response(JSON.stringify(j)))}catch(e){}
  return j;
}
async function baixaTraducao(tr,progresso){
  const c=await cAbre();
  let feitas=0;
  for(const l of LIVROS){
    const arq=l.nn+'-'+l.ab+'.json';
    const chave=tr.fonte==='local'?('/texto/'+tr.id+'/'+arq):('/texto/remota/'+tr.id+'/'+arq);
    if(c){const r=await c.match(chave);if(r){feitas++;progresso(feitas);continue}}
    const url=tr.fonte==='local'?('/texto/'+tr.id+'/'+arq):(RAW+tr.caminho+'/'+arq);
    const r=await fetch(url);if(!r.ok)throw new Error('falhou em '+arq);
    if(c)try{c.put(chave,new Response(JSON.stringify(await r.json())))}catch(e){}
    feitas++;progresso(feitas);
  }
  return feitas;
}
async function temCap(tr,ab,nn){
  const c=await cAbre();if(!c)return false;
  const arq=nn+'-'+ab+'.json';
  const chave=tr.fonte==='local'?('/texto/'+tr.id+'/'+arq):('/texto/remota/'+tr.id+'/'+arq);
  return !!(await c.match(chave));
}

export default function App(){
  const [vista,setVista]=useState('ler');
  const [trId,setTrId]=useState(()=>ST.getJ('trad','almeida'));
  const [ref,setRef]=useState(()=>({ab:'John',cap:3,vers:null}));
  const [texto,setTexto]=useState(null);
  const [erroCap,setErroCap]=useState('');
  const [log,setLog]=useState(()=>ST.getJ('log',{}));
  const [meta,setMeta]=useState(()=>ST.getJ('meta',{tipo:'cap',quant:1}));
  const [xpState,setXp]=useState(()=>ST.getJ('xp',{modo:false,total:0,temas:[],ativo:'alvor'}));
  const [letra,setLetra]=useState(()=>ST.getJ('letra',19));
  const [lemb,setLemb]=useState(()=>ST.getJ('lemb',{hora:'07:00',ligado:false}));
  const [toast,setToast]=useState('');
  const [busca,setBusca]=useState({q:'',res:null,buscando:false,baixando:0});
  const tr=TRADS.find(t=>t.id===trId)||TRADS[0];
  const tema=CORE.temaPorId(xpState.ativo);
  const hoje=CORE.hojeISO();
  const dia=log[hoje]||{};
  const st=CORE.streak(log,meta,hoje);
  const xpHoje=CORE.xpDoDia(dia);

  function fala(m){setToast(m);clearTimeout(fala._h);fala._h=setTimeout(()=>setToast(''),3200)}
  function guardaLog(novo){setLog(novo);ST.setJ('log',novo)}
  function guardaXp(novo){setXp(novo);ST.setJ('xp',novo);document.cookie='sema_tema='+novo.ativo+';path=/;max-age=31536000'}

  /* URL: /{ab}/{cap}/{vers} */
  const vaiPara=(ab,cap,vers,push)=>{
    setRef({ab,cap,vers:vers||null});
    if(push)try{history.pushState({},'','/'+ab+'/'+cap+(vers?'/'+vers:''))}catch(e){}
  };
  useEffect(()=>{
    const p=location.pathname.split('/').filter(Boolean);
    if(p.length){const r=CORE.parseRef('/'+p.join('/'),LIVROS);if(r)setRef(r)}
    try{document.cookie='sema_tema='+ST.getJ('xp',{ativo:'alvor'}).ativo+';path=/;max-age=31536000'}catch(e){}
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    const _p=history.pushState.bind(history);
    // lembrete: checa a cada 30s enquanto o app estiver aberto
    const iv=setInterval(()=>{checaLembrete()},30000);
    return ()=>clearInterval(iv);
  },[]);
  useEffect(()=>{
    const l=LIVROS.find(x=>x.ab===ref.ab);
    document.title=(l?l.nome+' '+ref.cap:'Semeador')+' · Bíblia todo dia';
    setErroCap('');setTexto(null);
    let vivo=true;
    carregaCap(tr,ref.ab,l?l.nn:'01').then(j=>{if(vivo)setTexto(j)}).catch(e=>{if(vivo){setErroCap('não consegui baixar esse capítulo ('+e.message+')');setTexto(null)}});
    return ()=>{vivo=false};
  },[trId,ref.ab,ref.cap]);

  function checaLembrete(){
    const L=ST.getJ('lemb',{hora:'07:00',ligado:false});
    if(!L.ligado||!('Notification' in window)||Notification.permission!=='granted')return;
    const agora=new Date();const hh=String(agora.getHours()).padStart(2,'0')+':'+String(agora.getMinutes()).padStart(2,'0');
    if(hh!==L.hora)return;
    const aviso='sem_aviso_'+CORE.hojeISO();
    if(localStorage.getItem(aviso))return;
    localStorage.setItem(aviso,'1');
    if(CORE.metaCumprida(ST.getJ('log',{})[CORE.hojeISO()],ST.getJ('meta',{tipo:'cap',quant:1})))return;
    new Notification('🌱 Semeador',{body:'Hora da leitura de hoje — teu dia ainda tá sem semente 📖'});
  }
  async function pedeLembrete(ligado){
    if(ligado&&'Notification' in window){
      const p=await Notification.requestPermission();
      if(p!=='granted'){fala('o navegador não liberou notificações 🙈');return false}
    }
    const novo={...lemb,ligado};setLemb(novo);ST.setJ('lemb',novo);return true;
  }

  /* marca leitura + XP */
  function marca(tipo,chave){
    const r=CORE.marca(log[hoje],tipo,chave);
    guardaLog({...log,[hoje]:r.dia});
    if(xpState.modo&&r.ganhou)fala('+'+r.xp+' XP ⚡'+(CORE.xpDoDia(r.dia)>=CORE.TETO_DIA?' (teto do dia atingido)':''));
    else if(!xpState.modo&&tipo==='meta')fala('meta do dia cumprida! 🌱');
    return r;
  }
  function desmarca(tipo,chave){ // honesto: desmarcar não devolve XP
    const d=JSON.parse(JSON.stringify(log[hoje]||{caps:{},vers:{},xp:{}}));
    if(tipo==='vers')delete d.vers[chave];else if(tipo==='cap')delete d.caps[chave];
    guardaLog({...log,[hoje]:d});
  }
  const toggleVerso=(ab,cap,v)=>{
    const chave=ab+' '+cap+'.'+v;
    if(dia.vers&&dia.vers[chave])desmarca('vers',chave);
    else{const r=marca('vers',chave);if(!r.ganhou&&xpState.modo)fala('lido ✓ (XP do dia já no teto)')}
  };
  const concluiCap=()=>{
    const chave=ref.ab+' '+ref.cap;
    if(!(dia.caps&&dia.caps[chave]))marca('cap',chave);
    else fala('esse capítulo já tá contado hoje 😉');
  };

  /* busca */
  async function buscar(){
    const q=CORE.semAcento(busca.q.trim());
    if(q.length<3)return fala('escreve pelo menos 3 letras');
    setBusca(b=>({...b,buscando:true,res:null}));
    const res=[];
    for(const l of LIVROS){
      if(!(await temCap(tr,l.ab,l.nn)))continue;
      let j;try{j=await carregaCap(tr,l.ab,l.nn)}catch(e){continue}
      for(const ch of j.chapters)for(const v of ch.verses){
        if(CORE.semAcento(v.text).includes(q))res.push({ab:l.ab,nome:j.book,cap:ch.chapter,v:v.verse,t:v.text});
        if(res.length>=40)break;
        if(res.length>=40)break;
      }
      if(res.length>=40)break;
    }
    setBusca(b=>({...b,buscando:false,res}));
    if(!res.length)fala('nada encontrado nos livros baixados — baixa a tradução completa ali embaixo 👇');
  }
  async function baixaTudo(){
    setBusca(b=>({...b,baixando:0}));
    try{await baixaTraducao(tr,n=>setBusca(b=>({...b,baixando:n})));fala('📖 tradução completa no aparelho — lê offline e busca em tudo')}catch(e){fala('algo falhou no meio — tenta de novo');setBusca(b=>({...b,baixando:0}))}
  }

  /* loja */
  function compraTema(id){
    const r=CORE.comprar(xpState.total,xpState.temas,id);
    if(!r.ok)return fala(r.motivo);
    guardaXp({...xpState,total:r.xp,temas:r.temas,ativo:id});
    fala('tema desbloqueado! 🎨 (o ícone do atalho atualiza ao reinstalar o app)');
  }

  const pct=CORE.metaPct(dia,meta);
  const capAtivo=texto&&texto.chapters[ref.cap-1];
  const l=LIVROS.find(x=>x.ab===ref.ab)||LIVROS[0];
  const idxL=LIVROS.findIndex(x=>x.ab===ref.ab);
  const cssVars={ '--bg':tema.bg,'--bg2':tema.bg2,'--tx':tema.tx,'--mut':tema.mut,'--capa1':tema.capa[0],'--capa2':tema.capa[1],'--letra':letra+'px' };

  return <div className="app" style={cssVars}>
    <style>{CSS}</style>
    <header className="topo">
      <button className={'aba'+(vista==='ler'?' on':'')} onClick={()=>{setVista('ler');setRef(r=>({...r}))}}>📖 Ler</button>
      <button className={'aba'+(vista==='hoje'?' on':'')} onClick={()=>setVista('hoje')}>🌱 Hoje{st>0&&<b className="fogo">🔥{st}</b>}</button>
      <button className={'aba'+(vista==='busca'?' on':'')} onClick={()=>setVista('busca')}>🔎 Buscar</button>
      {xpState.modo&&<button className={'aba'+(vista==='loja'?' on':'')} onClick={()=>setVista('loja')}>🛍️ Loja</button>}
      <button className={'aba'+(vista==='config'?' on':'')} onClick={()=>setVista('config')}>⚙️</button>
      <span className="xpbolha" title="XP total">{xpState.modo?('⚡'+xpState.total):''}</span>
    </header>

    {vista==='ler'&&<main>
      <div className="capa">
        <h1>{l.nome} <span>{ref.cap}</span></h1>
        <p>{tr.nome}{tr.ano?(' · '+tr.ano):''} · {tr.lingua}</p>
      </div>
      <div className="linhaSel">
        <select value={trId} onChange={e=>{setTrId(e.target.value);ST.setJ('trad',e.target.value)}}>
          {TRADS.map(t=><option key={t.id} value={t.id}>{t.lingua} — {t.nome}{t.fonte==='remota'?' (baixa on-line)':''}</option>)}
        </select>
        <button onClick={()=>{const p=LIVROS[idxL-1]||LIVROS[LIVROS.length-1];vaiPara(p.ab,1)}}>← {LIVROS[(idxL-1+LIVROS.length)%LIVROS.length].nome}</button>
        <button onClick={()=>{const p=LIVROS[(idxL+1)%LIVROS.length];vaiPara(p.ab,1)}}>{LIVROS[(idxL+1)%LIVROS.length].nome} →</button>
      </div>
      <div className="capitulos">
        {texto&&texto.chapters.map(ch=><button key={ch.chapter} className={'cap'+(ch.chapter===ref.cap?' on':'')} onClick={()=>vaiPara(ref.ab,ch.chapter)}>{ch.chapter}</button>)}
        {!texto&&!erroCap&&<p className="mudo">carregando capítulo…</p>}
        {erroCap&&<p className="erro">{erroCap}</p>}
      </div>
      {capAtivo&&<div className="texto" style={{fontSize:'var(--letra)'}}>
        {capAtivo.heading&&<h3 className="cab">{capAtivo.heading}</h3>}
        <p className="versos">
          {capAtivo.verses.map(v=>
            <span key={v.verse} className={'verso'+(dia.vers&&dia.vers[ref.ab+' '+ref.cap+'.'+v.verse]?' lido':'')+(ref.vers===v.verse?' foco':'')} onClick={()=>{toggleVerso(ref.ab,ref.cap,v.verse);if(ref.vers!==v.verse)vaiPara(ref.ab,ref.cap,v.verse,false)}}>
              <sup>{v.verse}</sup> {v.text}{' '}
            </span>)}
        </p>
        <p className="dica">toque num versículo pra marcá-lo como lido ✓</p>
        <div className="rodapeCap">
          <button className="grande" onClick={concluiCap}>{dia.caps&&dia.caps[ref.ab+' '+ref.cap]?'✓ contado hoje':'✅ terminei este capítulo'}</button>
          <div className="navCap">
            <button onClick={()=>{if(ref.cap>1)vaiPara(ref.ab,ref.cap-1);else if(LIVROS[idxL-1])vaiPara(LIVROS[idxL-1].ab,9999)}}>← anterior</button>
            <button onClick={()=>{const tem=texto&&texto.chapters.length>ref.cap;if(tem)vaiPara(ref.ab,ref.cap+1);else if(LIVROS[idxL+1])vaiPara(LIVROS[idxL+1].ab,1)}}>próximo →</button>
          </div>
        </div>
      </div>}
    </main>}

    {vista==='hoje'&&<main>
      <div className="capa">
        <h1>Hoje</h1><p>{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p>
      </div>
      <div className="card">
        <h3>Tua meta</h3>
        <div className="barra"><i style={{width:pct+'%'}}/></div>
        <p className="mudo">{meta.tipo==='vers'?(CORE.nVers(dia)+' de '+meta.quant+' versículos'):(CORE.nCaps(dia)+' de '+meta.quant+' capítulo(s)')} · {pct}%</p>
        {CORE.metaCumprida(dia,meta)?<p className="verde">🌱 meta cumprida — a semente de hoje já foi plantada!</p>:<p className="mudo">toque nos versículos no 📖 Ler ou usa “terminei este capítulo”</p>}
      </div>
      <div className="grade">
        <div className="card m"><b>🔥 {st}</b><span>dias seguidos</span></div>
        <div className="card m"><b>⚡ {xpHoje}</b><span>XP hoje</span></div>
        <div className="card m"><b>📖 {CORE.nCaps(dia)}</b><span>caps hoje</span></div>
        <div className="card m"><b>✝️ {CORE.nVers(dia)}</b><span>versos hoje</span></div>
      </div>
      <div className="card">
        <h3>⏰ Lembrete diário</h3>
        <div className="linha">
          <label className="switch"><input type="checkbox" checked={lemb.ligado} onChange={e=>pedeLembrete(e.target.checked)}/><i/></label>
          <input type="time" value={lemb.hora} onChange={e=>{const n={...lemb,hora:e.target.value};setLemb(n);ST.setJ('lemb',n)}}/>
          <button className="mini" onClick={async()=>{if(await pedeLembrete(true))try{new Notification('🌱 Semeador',{body:'Tá funcionando! Te vejo na hora marcada 📖'})}catch(e){}}}>testar</button>
        </div>
        <p className="mudo">o lembrete toca enquanto o app estiver aberto (no celular, instala na tela inicial — menu do navegador → “Adicionar à tela inicial”). Notificação 100% push vem depois.</p>
      </div>
      {!xpState.modo&&<div className="card">
        <h3>⚡ Modo XP (opcional)</h3>
        <p className="mudo">Ler gera XP, XP compra temas na loja. Pode deixar desligado — a leitura vale igual.</p>
        <button className="grande" onClick={()=>{const n={...xpState,modo:true};guardaXp(n);setVista('loja')}}>Ligar Modo XP</button>
      </div>}
    </main>}

    {vista==='busca'&&<main>
      <div className="capa"><h1>Buscar</h1><p>em {tr.nome}{tr.lingua!=='Português'?' ('+tr.lingua+')':''}</p></div>
      <div className="linha">
        <input placeholder="ex: amou o mundo" value={busca.q} onChange={e=>setBusca(b=>({...b,q:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')buscar()}}/>
        <button onClick={buscar}>🔎</button>
      </div>
      {busca.buscando&&<p className="mudo">procurando…</p>}
      {busca.res&&<div className="resultados">{busca.res.map((r,i)=>
        <div key={i} className="res" onClick={()=>{vaiPara(r.ab,r.cap,r.v,true);setVista('ler')}}>
          <b>{r.nome} {r.cap}:{r.v}</b><p>{r.t}</p></div>)}
        {!busca.res.length&&!busca.buscando&&<p className="mudo">resultados aparecem aqui</p>}
      </div>}
      <div className="card">
        <h3>📥 Tradução completa no aparelho</h3>
        {busca.baixando>0?<p className="mudo">baixando… {busca.baixando}/66 livros</p>:<p className="mudo">baixa os 66 livros ({tr.fonte==='local'?'~6 MB':'~6 MB on-line'}) pra buscar em tudo e ler offline</p>}
        <button className="grande" onClick={baixaTudo} disabled={busca.baixando>0}>📥 Baixar {tr.nome}</button>
      </div>
    </main>}

    {vista==='loja'&&xpState.modo&&<main>
      <div className="capa"><h1>Loja</h1><p>⚡ {xpState.total} XP disponíveis</p></div>
      <div className="grade">
        {CORE.TEMAS.map(t=>{
          const meu=xpState.temas.includes(t.id)||t.custo===0;
          const ativo=xpState.ativo===t.id;
          return <div key={t.id} className={'card tema'+(ativo?' on':'')}>
            <div className="amostra" style={{background:'linear-gradient(135deg,'+t.capa[0]+','+t.capa[1]+')'}}>
              <img src={'/icones/'+t.id+'-192.png'} alt="ícone do tema" width="48" height="48"/>
            </div>
            <b>{t.nome}</b>
            <span className="mudo">{t.custo===0?'grátis':t.custo+' XP'}</span>
            {ativo?<span className="verde">em uso ✓</span>:
              meu?<button className="mini" onClick={()=>{guardaXp({...xpState,ativo:t.id});document.cookie='sema_tema='+t.id+';path=/;max-age=31536000';fala('tema aplicado 🎨')}}>usar</button>:
              <button className="mini" onClick={()=>compraTema(t.id)} disabled={xpState.total<t.custo}>{xpState.total<t.custo?'falta '+(t.custo-xpState.total)+' XP':'comprar ⚡'}</button>}
          </div>})}
      </div>
      <p className="mudo">a capa muda o visual do app; o ícone do atalho atualiza quando você reinstala o app na tela inicial (Android). Ler ~1 meta/dia por uns dias já dá tema novo.</p>
    </main>}

    {vista==='config'&&<main>
      <div className="capa"><h1>Ajustes</h1></div>
      <div className="card">
        <h3>🎯 Meta de leitura</h3>
        <div className="linha">
          <select value={meta.tipo} onChange={e=>{const n={...meta,tipo:e.target.value};setMeta(n);ST.setJ('meta',n)}}>
            <option value="cap">capítulos por dia</option>
            <option value="vers">versículos por dia</option>
          </select>
          <select value={meta.quant} onChange={e=>{const n={...meta,quant:+e.target.value};setMeta(n);ST.setJ('meta',n)}}>
            {(meta.tipo==='cap'?[1,2,3,5]:[1,3,5,10]).map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="card">
        <h3>⚡ Modo XP</h3>
        <label className="switch"><input type="checkbox" checked={xpState.modo} onChange={e=>guardaXp({...xpState,modo:e.target.checked})}/><i/></label>
        <span className="mudo"> XP={xpState.total} · desligar não apaga teu XP</span>
      </div>
      <div className="card">
        <h3>🔤 Tamanho da letra</h3>
        <input type="range" min="14" max="28" value={letra} onChange={e=>{setLetra(+e.target.value);ST.setJ('letra',+e.target.value)}}/>
      </div>
      <div className="card">
        <h3>📚 Sobre as traduções</h3>
        <p className="mudo">Todas em <b>domínio público</b>: Almeida, KJV 1769, Reina-Valera 1909 e mais {TRADS.length-3} idiomas. Fonte: coleção pública em JSON (GitHub). Nada de versão de editora — tudo legal pra ler, baixar e compartilhar.</p>
      </div>
      <div className="card perigo">
        <h3>🚮 Apagar tudo</h3>
        <button className="mini vermelho" onClick={()=>{if(confirm('Apagar leituras, XP, temas e ajustes? Não tem volta.')){['log','xp','meta','letra','lemb','trad'].forEach(k=>ST.del(k));location.href='/'}}}>apagar meus dados</button>
      </div>
      <p className="mudo cent">🌱 Semeador · feito pra semear todo dia</p>
    </main>}

    <div className={'toast'+(toast?' on':'')}>{toast}</div>
  </div>;
}

const CSS=`
.app{min-height:100vh;background:var(--bg);color:var(--tx);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding-bottom:40px}
button{font:inherit;cursor:pointer;border:0;color:inherit;background:none}
.topo{position:sticky;top:0;z-index:9;display:flex;gap:4px;align-items:center;padding:10px 10px;background:var(--bg2);border-bottom:1px solid rgba(255,255,255,.08)}
.aba{padding:8px 12px;border-radius:10px;font-weight:700;font-size:13.5px;color:var(--mut)}
.aba.on{background:rgba(255,255,255,.10);color:var(--tx)}
.fogo{margin-left:5px;font-size:12px}
.xpbolha{margin-left:auto;font-weight:800;font-size:13px;color:var(--mut)}
main{max-width:720px;margin:0 auto;padding:18px 14px 60px}
.capa{background:linear-gradient(135deg,var(--capa1),var(--capa2));border-radius:18px;padding:20px 22px;margin-bottom:14px}
.capa h1{margin:0;font-size:24px;letter-spacing:-.02em}
.capa p{margin:4px 0 0;opacity:.85;font-size:13px}
.card{background:var(--bg2);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;margin-bottom:12px}
.card h3{margin:0 0 8px;font-size:15px}
.linha{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.linhaSel{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.linhaSel select,.linha input,.linha select{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:var(--tx);border-radius:10px;padding:9px 10px;outline:none}
.linhaSel button,.linha button,.mini{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 12px;font-weight:700;font-size:13px}
.capitulos{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.cap{width:38px;height:36px;border-radius:9px;background:rgba(255,255,255,.06);font-weight:700;font-size:13px;border:1px solid rgba(255,255,255,.08)}
.cap.on{background:linear-gradient(135deg,var(--capa1),var(--capa2));color:#fff}
.texto{background:var(--bg2);border-radius:16px;padding:18px 18px 14px;border:1px solid rgba(255,255,255,.08);line-height:1.75}
.versos{margin:0}
.verso{cursor:pointer;border-radius:6px;transition:background .15s}
.verso:hover{background:rgba(255,255,255,.06)}
.verso.lido{color:var(--mut)}
.verso.lido sup{color:#4ade80}
.verso sup{font-weight:800;color:var(--capa2);margin-right:2px}
.verso.foco{background:rgba(255,255,255,.10)}
.dica{color:var(--mut);font-size:11.5px;margin:10px 0 0}
.cab{font-weight:800;margin:0 0 6px}
.rodapeCap{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:16px;flex-wrap:wrap}
.grande{background:linear-gradient(135deg,var(--capa1),var(--capa2));color:#fff;font-weight:800;border-radius:12px;padding:12px 18px}
.navCap{display:flex;gap:6px}
.navCap button{background:rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;font-size:13px;font-weight:700}
.barra{height:10px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin:8px 0}
.barra i{display:block;height:100%;background:linear-gradient(90deg,var(--capa1),var(--capa2));border-radius:99px;transition:width .4s}
.verde{color:#4ade80;font-weight:700;font-size:13.5px}
.mudo{color:var(--mut);font-size:12.5px}
.erro{color:#f87171}
.cent{text-align:center;margin-top:20px}
.grade{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.card.m{text-align:center;padding:12px 6px}
.card.m b{display:block;font-size:20px}
.card.m span{color:var(--mut);font-size:11px}
.switch{position:relative;display:inline-block;width:44px;height:26px}
.switch input{opacity:0;width:0;height:0}
.switch i{position:absolute;inset:0;background:rgba(255,255,255,.15);border-radius:99px;transition:.2s}
.switch i::before{content:'';position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:99px;transition:.2s}
.switch input:checked+i{background:var(--capa2)}
.switch input:checked+i::before{transform:translateX(18px)}
.tema{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center}
.tema.on{border-color:var(--capa2)}
.amostra{border-radius:12px;width:100%;display:flex;justify-content:center;padding:10px 0}
.resultados .res{background:var(--bg2);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 12px;margin-bottom:8px;cursor:pointer}
.resultados .res b{font-size:12.5px;color:var(--capa2)}
.resultados .res p{margin:3px 0 0;font-size:14px}
.mini{padding:8px 12px}
.mini:disabled{opacity:.45;cursor:not-allowed}
.vermelho{color:#f87171;border-color:rgba(248,113,113,.4)}
input[type=range]{width:100%;accent-color:var(--capa2)}
input[type=time]{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:var(--tx);border-radius:10px;padding:8px}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--bg2);border:1px solid rgba(255,255,255,.15);padding:11px 16px;border-radius:12px;font-size:13.5px;opacity:0;pointer-events:none;transition:opacity .25s;z-index:99;max-width:92vw;text-align:center;color:var(--tx)}
.toast.on{opacity:1}
@media(max-width:600px){.grade{grid-template-columns:repeat(2,1fr)}.capa h1{font-size:21px}}
`;

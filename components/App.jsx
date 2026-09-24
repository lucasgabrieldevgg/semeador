import React,{useState,useEffect} from 'react';
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

const PROXY='https://soulchat-proxy.vercel.app/api/proxy';
const MODELOS=['google/gemma-4-26b-a4b-it:free','nvidia/nemotron-3-super-120b-a12b:free','google/gemma-4-31b-it:free'];
async function callAI(msgs){
  const erros=[];
  for(const m of MODELOS){
    try{
      const r=await fetch(PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'openrouter',model:m,messages:msgs}),signal:AbortSignal.timeout(90000)});
      if(!r.ok){erros.push(m.split(':')[0].split('/')[1]+' '+r.status);continue}
      const d=await r.json();
      const txt=d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
      if(txt&&/rate.?limit|quota|budget|credits|insufficient/i.test(txt)&&txt.length<400){erros.push(m.split(':')[0].split('/')[1]+' limite');continue}
      if(txt)return txt;
      erros.push('vazia');
    }catch(e){erros.push('falhou')}
  }
  throw new Error('IA ocupada agora ('+erros.join(' · ')+') — tenta daqui a pouco');
}
const CAPAS=[
  {id:'grafite',nome:'Grafite',custo:0,acc:'#4b5563',ico:'alvor'},
  {id:'oliva',nome:'Oliva',custo:150,acc:'#65a30d',ico:'oliva'},
  {id:'terra',nome:'Terra',custo:300,acc:'#b45309',ico:'deserto'},
  {id:'jardin',nome:'Jardim',custo:500,acc:'#15803d',ico:'alvor'},
  {id:'mar',nome:'Mar',custo:800,acc:'#0e7490',ico:'manancial'}];

export default function App(){
  const [vista,setVista]=useState('ler');
  const [painel,setPainel]=useState(''); // '' | 'livros' | 'trads'
  const [mod,setMod]=useState(()=>ST.getJ('mod','escuro'));
  const [trId,setTrId]=useState(()=>ST.getJ('trad','almeida'));
  const [ref,setRef]=useState(()=>({ab:'John',cap:3,vers:null}));
  const [texto,setTexto]=useState(null);
  const [erroCap,setErroCap]=useState('');
  const [log,setLog]=useState(()=>ST.getJ('log',{}));
  const [meta,setMeta]=useState(()=>ST.getJ('meta',{tipo:'cap',quant:1}));
  const [xpState,setXp]=useState(()=>ST.getJ('xp',{modo:false,total:0,temas:[],ativo:'grafite'}));
  const [letra,setLetra]=useState(()=>ST.getJ('letra',19));
  const [serifa,setSerifa]=useState(()=>ST.getJ('serifa',true));
  const [lemb,setLemb]=useState(()=>ST.getJ('lemb',{hora:'07:00',ligado:false}));
  const [toast,setToast]=useState('');
  const [busca,setBusca]=useState({q:'',res:null,buscando:false,baixando:0});
  const [nomesLivros,setNomesLivros]=useState({});
  const [coment,setComent]=useState({chave:'',txt:'',carregando:false,erro:''});
  const tr=TRADS.find(t=>t.id===trId)||TRADS[0];
  const capa=CAPAS.find(c=>c.id===xpState.ativo)||CAPAS[0];
  const hoje=CORE.hojeISO();
  const dia=log[hoje]||{};
  const st=CORE.streak(log,meta,hoje);
  const xpHoje=CORE.xpDoDia(dia);

  function fala(m){setToast(m);clearTimeout(fala._h);fala._h=setTimeout(()=>setToast(''),3200)}
  function guardaLog(novo){setLog(novo);ST.setJ('log',novo)}
  function guardaXp(novo){setXp(novo);ST.setJ('xp',novo);document.cookie='sema_tema='+novo.ativo+';path=/;max-age=31536000'}
  function mudaMod(m){setMod(m);ST.setJ('mod',m)}

  const vaiPara=(ab,cap,vers,push)=>{
    setRef({ab,cap,vers:vers||null});setPainel('');
    if(push)try{history.pushState({},'','/'+ab+'/'+cap+(vers?'/'+vers:''))}catch(e){}
  };
  useEffect(()=>{
    const p=location.pathname.split('/').filter(Boolean);
    if(p.length){const r=CORE.parseRef('/'+p.join('/'),LIVROS);if(r)setRef(r)}
    try{document.cookie='sema_tema='+ST.getJ('xp',{ativo:'grafite'}).ativo+';path=/;max-age=31536000'}catch(e){}
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    const iv=setInterval(checaLembrete,30000);
    return ()=>clearInterval(iv);
  },[]);
  useEffect(()=>{
    const l=LIVROS.find(x=>x.ab===ref.ab);
    document.title=(l?((nomesLivros[l.ab])||l.nome)+' '+ref.cap:'Semeador')+' · Bíblia todo dia';
    setErroCap('');setTexto(null);
    let vivo=true;
    carregaCap(tr,ref.ab,l?l.nn:'01').then(j=>{if(vivo){setTexto(j);if(j.book)setNomesLivros(n=>({...n,[ref.ab]:j.book}))}}).catch(e=>{if(vivo){setErroCap('não consegui baixar esse capítulo ('+e.message+')');setTexto(null)}});
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

  function marca(tipo,chave){
    const r=CORE.marca(log[hoje],tipo,chave);
    guardaLog({...log,[hoje]:r.dia});
    if(xpState.modo&&r.ganhou){
      guardaXp({...xpState,total:xpState.total+r.xp}); // ⬅ o bug do XP zero: a carteira nunca era creditada
      fala('+'+r.xp+' XP ⚡ total: '+(xpState.total+r.xp)+(CORE.xpDoDia(r.dia)>=CORE.TETO_DIA?' (teto do dia)':''));
    }else if(!xpState.modo&&tipo==='meta')fala('meta do dia cumprida! 🌱');
    return r;
  }
  function desmarca(tipo,chave){
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

  async function buscar(){
    const q=CORE.semAcento(busca.q.trim());
    if(q.length<3)return fala('escreve pelo menos 3 letras');
    setBusca(b=>({...b,buscando:true,res:null}));
    const res=[];
    for(const l of LIVROS){
      if(!(await temCap(tr,l.ab,l.nn)))continue;
      let j;try{j=await carregaCap(tr,l.ab,l.nn)}catch(e){continue}
      externo:for(const ch of j.chapters)for(const v of ch.verses){
        if(CORE.semAcento(v.text).includes(q))res.push({ab:l.ab,nome:j.book,cap:ch.chapter,v:v.verse,t:v.text});
        if(res.length>=40)break externo;
      }
      if(res.length>=40)break;
    }
    setBusca(b=>({...b,buscando:false,res}));
    if(!res.length)fala('nada encontrado — baixa a tradução completa ali embaixo 👇');
  }
  async function baixaTudo(){
    setBusca(b=>({...b,baixando:0}));
    try{await baixaTraducao(tr,n=>setBusca(b=>({...b,baixando:n})));fala('📖 tradução completa no aparelho — lê offline e busca em tudo')}catch(e){fala('algo falhou no meio — tenta de novo');setBusca(b=>({...b,baixando:0}))}
  }
  function compraCapa(id){
    const t=CAPAS.find(c=>c.id===id);
    if(!t.custo||xpState.temas.includes(id)){guardaXp({...xpState,ativo:id});document.cookie='sema_tema='+id+';path=/;max-age=31536000';return fala('capa aplicada 🎨')}
    if(xpState.total<t.custo)return fala('falta '+(t.custo-xpState.total)+' XP');
    guardaXp({...xpState,total:xpState.total-t.custo,temas:xpState.temas.concat(id),ativo:id});
    document.cookie='sema_tema='+id+';path=/;max-age=31536000';
    fala('capa desbloqueada! 🎨 (ícone do atalho atualiza ao reinstalar o app)');
  }

  async function explicar(){
    const chave=trId+'|'+ref.ab+'|'+ref.cap;
    const cacheK='com_'+trId+'_'+ref.ab+'_'+ref.cap;
    const salvo=ST.getJ(cacheK,null);
    if(salvo){setComent({chave,txt:salvo,carregando:false,erro:''});return}
    if(textoCap.length<40)return fala('o capítulo ainda não carregou');
    const uso=ST.getJ('uso',{dia:'',n:0});
    const hojeI=CORE.hojeISO();
    if(uso.dia===hojeI&&uso.n>=40)return fala('limite de explicações de hoje atingido (40) — amanhã tem mais 💛');
    ST.setJ('uso',{dia:hojeI,n:uso.dia===hojeI?uso.n+1:1});
    setComent({chave,txt:'',carregando:true,erro:''});
    try{
      const recorte=textoCap.slice(0,6000);
      const txt=await callAI([
        {role:'system',content:'Você explica trechos da Bíblia de forma CLARA, em português do Brasil. ESTILO: linguagem de gente, frases curtas, direto ao ponto (como explicar pra um amigo no portão da igreja). ESTRUTURA: 1-2 frases de contexto (quem escreve, pra quem, quando aproximado), o que o trecho quer dizer no fundo, e 1 aplicação prática. NUNCA invente versículo nem cite referência que não está no trecho. Sem sermão, sem dogma de igreja específica, sem teologia polêmica. Texto simbólico? Diz que é simbólico e dá a leitura mais comum. Não sabe? Admite. MÁXIMO 180 palavras.'},
        {role:'user',content:'LIVRO: '+nomeAtual+' '+ref.cap+' (tradução: '+tr.nome+')\n\nTEXTO:\n'+recorte+'\n\nExplique de forma clara.'}
      ]);
      const limpo=txt.trim();
      ST.setJ(cacheK,limpo);
      setComent({chave,txt:limpo,carregando:false,erro:''});
    }catch(e){setComent({chave,txt:'',carregando:false,erro:e.message})}
  }

  const pct=CORE.metaPct(dia,meta);
  const capAtivo=texto&&texto.chapters[ref.cap-1];
  const textoCap=capAtivo?capAtivo.verses.map(v=>v.verse+' '+v.text).join('\n'):'';
  const l=LIVROS.find(x=>x.ab===ref.ab)||LIVROS[0];
  const idxL=LIVROS.findIndex(x=>x.ab===ref.ab);
  const nomeAtual=nomesLivros[l.ab]||l.nome;
  const trsPorLingua={};
  TRADS.forEach(t=>{(trsPorLingua[t.lingua]=trsPorLingua[t.lingua]||[]).push(t)});
  const linguas=Object.keys(trsPorLingua).sort((a,b)=>{const pa=a==='Português'?-2:(a==='English'?-1:0),pb=b==='Português'?-2:(b==='English'?-1:0);return pa-pb||a.localeCompare(b)});
  const AT=LIVROS.slice(0,39),NT=LIVROS.slice(39);

  return <div className={'app '+mod} style={{'--acc':capa.acc,'--letra':letra+'px'}}>
        <header className="topo">
      <span className="marca">🌱 Semeador</span>
      <nav>
        <button className={'aba'+(vista==='ler'?' on':'')} onClick={()=>setVista('ler')}>Ler</button>
        <button className={'aba'+(vista==='hoje'?' on':'')} onClick={()=>setVista('hoje')}>Hoje{st>0&&<b> 🔥{st}</b>}</button>
        <button className={'aba'+(vista==='busca'?' on':'')} onClick={()=>setVista('busca')}>Buscar</button>
        {xpState.modo&&<button className={'aba'+(vista==='loja'?' on':'')} onClick={()=>setVista('loja')}>Loja</button>}
        <button className={'aba'+(vista==='config'?' on':'')} onClick={()=>setVista('config')}>Ajustes</button>
      </nav>
      {xpState.modo&&<span className="xp">⚡{xpState.total}</span>}
    </header>

    {vista==='ler'&&<main className="leitura">
      <div className="cabecalhoLivro">
        <div>
          <button className="escolha" onClick={()=>setPainel(painel==='livros'?'':'livros')}>{nomeAtual} {ref.cap} ▾</button>
          <button className="escolha tr" onClick={()=>setPainel(painel==='trads'?'':'trads')}>{tr.nome}{tr.lingua!=='Português'?' · '+tr.lingua:''} ▾</button>
        </div>
      </div>

      {painel==='livros'&&<div className="painel">
        <div className="linhaPainel"><b>Antigo Testamento</b><button className="fechar" onClick={()=>setPainel('')}>fechar ✕</button></div>
        <div className="livros">{AT.map(x=><button key={x.ab} className={'lv'+(x.ab===ref.ab?' on':'')} onClick={()=>vaiPara(x.ab,1,true)}>{nomesLivros[x.ab]||x.nome}</button>)}</div>
        <div className="linhaPainel"><b>Novo Testamento</b></div>
        <div className="livros">{NT.map(x=><button key={x.ab} className={'lv'+(x.ab===ref.ab?' on':'')} onClick={()=>vaiPara(x.ab,1,true)}>{nomesLivros[x.ab]||x.nome}</button>)}</div>
      </div>}

      {painel==='trads'&&<div className="painel">
        <div className="linhaPainel"><b>Idiomas e versões</b><button className="fechar" onClick={()=>setPainel('')}>fechar ✕</button></div>
        {linguas.map(ling=><div key={ling}>
          <p className="lingua">{ling} <span>({trsPorLingua[ling].length})</span></p>
          <div className="trads">{trsPorLingua[ling].map(t=>
            <button key={t.id} className={'td'+(t.id===trId?' on':'')} onClick={()=>{setTrId(t.id);ST.setJ('trad',t.id);setPainel('')}}>
              <span className="tdn">{t.nome} {t.ano&&<i>· {t.ano}</i>}</span>
              <span className="tdf">{t.fonte==='local'?'no aparelho':'baixa on-line'}</span>
            </button>)}
          </div>
        </div>)}
      </div>}

      <div className="capitulos">
        {texto&&texto.chapters.map(ch=><button key={ch.chapter} className={'cap'+(ch.chapter===ref.cap?' on':'')} onClick={()=>vaiPara(ref.ab,ch.chapter)}>{ch.chapter}</button>)}
        {!texto&&!erroCap&&<p className="mudo">carregando capítulo…</p>}
        {erroCap&&<p className="erro">{erroCap}</p>}
      </div>

      {capAtivo&&<article className="pagina" style={{fontFamily:serifa?'Georgia,\'Times New Roman\',serif':'inherit'}}>
        {capAtivo.heading&&<h3 className="cab">{capAtivo.heading}</h3>}
        <p className="versos">
          {capAtivo.verses.map(v=>
            <span key={v.verse} className={'verso'+(dia.vers&&dia.vers[ref.ab+' '+ref.cap+'.'+v.verse]?' lido':'')+(ref.vers===v.verse?' foco':'')} onClick={()=>{toggleVerso(ref.ab,ref.cap,v.verse);if(ref.vers!==v.verse)vaiPara(ref.ab,ref.cap,v.verse,false)}}>
              <sup>{v.verse}</sup> {v.text}{' '}
            </span>)}
        </p>
        <p className="dica">toque num versículo pra marcar como lido ✓</p>
        <div className="rodapeCap">
          <button className="principal" onClick={concluiCap}>{dia.caps&&dia.caps[ref.ab+' '+ref.cap]?'✓ contado hoje':'Terminei este capítulo'}</button>
          <div className="navCap">
            <button onClick={()=>{if(ref.cap>1)vaiPara(ref.ab,ref.cap-1,true);else if(LIVROS[idxL-1])vaiPara(LIVROS[idxL-1].ab,9999,true)}}>←</button>
            <button onClick={()=>{const tem=texto&&texto.chapters.length>ref.cap;if(tem)vaiPara(ref.ab,ref.cap+1,true);else if(LIVROS[idxL+1])vaiPara(LIVROS[idxL+1].ab,1,true)}}>→</button>
          </div>
        </div>
        {(coment.txt||coment.carregando||coment.erro)&&<div className="comentario">
          {coment.carregando&&<p className="mudo">✨ explicando…</p>}
          {coment.erro&&<p className="erro">✨ {coment.erro}</p>}
          {coment.txt&&<><h4>✨ Explicação clara</h4><p style={{whiteSpace:'pre-wrap'}}>{coment.txt}</p><p className="mudo">IA pode errar — leia sempre com a Bíblia aberta. Este capítulo agora explica offline (ficou salvo).</p></>}
        </div>}
        {!coment.carregando&&<div className="linhaExp"><button className="explicar" onClick={explicar}>{coment.txt?'✨ explicar de novo':'✨ Explicar este capítulo (IA)'}</button><span className="mudo">contexto + sentido, em linguagem de gente</span></div>}
      </article>}
    </main>}

    {vista==='hoje'&&<main className="w">
      <h2>Hoje</h2>
      <p className="sub">{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p>
      <div className="cartao">
        <h3>Tua meta</h3>
        <div className="barra"><i style={{width:pct+'%'}}/></div>
        <p className="mudo">{meta.tipo==='vers'?(CORE.nVers(dia)+' de '+meta.quant+' versículos'):(CORE.nCaps(dia)+' de '+meta.quant+' capítulo(s)')} · {pct}%</p>
        {CORE.metaCumprida(dia,meta)?<p className="destaque">🌱 meta cumprida — a semente de hoje já foi plantada</p>:<p className="mudo">toque nos versículos no Ler ou usa “Terminei este capítulo”</p>}
      </div>
      <div className="grade">
        <div className="cartao m"><b>🔥{st}</b><span>dias seguidos</span></div>
        <div className="cartao m"><b>⚡{xpHoje}</b><span>XP hoje</span></div>
        <div className="cartao m"><b>{CORE.nCaps(dia)}</b><span>caps hoje</span></div>
        <div className="cartao m"><b>{CORE.nVers(dia)}</b><span>versos hoje</span></div>
      </div>
      <div className="cartao">
        <h3>Lembrete diário</h3>
        <div className="linha">
          <label className="chave"><input type="checkbox" checked={lemb.ligado} onChange={e=>pedeLembrete(e.target.checked)}/><i/></label>
          <input type="time" value={lemb.hora} onChange={e=>{const n={...lemb,hora:e.target.value};setLemb(n);ST.setJ('lemb',n)}}/>
          <button className="mini" onClick={async()=>{if(await pedeLembrete(true))try{new Notification('🌱 Semeador',{body:'Tá funcionando! Te vejo na hora marcada 📖'})}catch(e){}}}>testar</button>
        </div>
        <p className="mudo">toca enquanto o app estiver aberto (instala na tela inicial pro celular). Notificação mesmo fechado vem depois.</p>
      </div>
      {!xpState.modo&&<div className="cartao">
        <h3>Modo XP (opcional)</h3>
        <p className="mudo">Ler gera XP, XP compra capas na loja. Pode deixar desligado — a leitura vale igual.</p>
        <button className="principal" onClick={()=>{guardaXp({...xpState,modo:true});setVista('loja')}}>Ligar Modo XP</button>
      </div>}
    </main>}

    {vista==='busca'&&<main className="w">
      <h2>Buscar</h2>
      <p className="sub">em {tr.nome}{tr.lingua!=='Português'?' ('+tr.lingua+')':''}</p>
      <div className="linha">
        <input placeholder="ex: amou o mundo" value={busca.q} onChange={e=>setBusca(b=>({...b,q:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')buscar()}}/>
        <button className="principal" onClick={buscar}>Buscar</button>
      </div>
      {busca.buscando&&<p className="mudo">procurando…</p>}
      {busca.res&&<div className="resultados">{busca.res.map((r,i)=>
        <div key={i} className="res" onClick={()=>{vaiPara(r.ab,r.cap,r.v,true);setVista('ler')}}>
          <b>{r.nome} {r.cap}:{r.v}</b><p>{r.t}</p></div>)}
        {!busca.res.length&&!busca.buscando&&<p className="mudo">resultados aparecem aqui</p>}
      </div>}
      <div className="cartao">
        <h3>Tradução completa no aparelho</h3>
        {busca.baixando>0?<p className="mudo">baixando… {busca.baixando}/66 livros</p>:<p className="mudo">baixa os 66 livros (~6 MB) pra buscar em tudo e ler offline</p>}
        <button className="principal" onClick={baixaTudo} disabled={busca.baixando>0}>Baixar {tr.nome}</button>
      </div>
    </main>}

    {vista==='loja'&&xpState.modo&&<main className="w">
      <h2>Loja</h2>
      <p className="sub">⚡ {xpState.total} XP · capas mudam a cor de destaque e o ícone do app</p>
      <div className="capas">
        {CAPAS.map(c=>{
          const meu=c.custo===0||xpState.temas.includes(c.id);
          const ativo=xpState.ativo===c.id;
          return <div key={c.id} className={'cartao capa'+(ativo?' on':'')}>
            <span className="bola" style={{background:c.acc}}/>
            <b>{c.nome}</b>
            <span className="mudo">{c.custo===0?'grátis':c.custo+' XP'}</span>
            {ativo?<span className="destaque">em uso</span>:meu?<button className="mini" onClick={()=>compraCapa(c.id)}>usar</button>:<button className="mini" onClick={()=>compraCapa(c.id)} disabled={xpState.total<c.custo}>{xpState.total<c.custo?'falta '+(c.custo-xpState.total):'comprar'}</button>}
          </div>})}
      </div>
    </main>}

    {vista==='config'&&<main className="w">
      <h2>Ajustes</h2>
      <div className="cartao">
        <h3>Aparência</h3>
        <div className="linha">
          <button className={'escolhe'+(mod==='claro'?' on':'')} onClick={()=>mudaMod('claro')}>☀️ Branco</button>
          <button className={'escolhe'+(mod==='escuro'?' on':'')} onClick={()=>mudaMod('escuro')}>🌙 Preto</button>
        </div>
      </div>
      <div className="cartao">
        <h3>Meta de leitura</h3>
        <div className="linha">
          <select className="nat" value={meta.tipo} onChange={e=>{const n={...meta,tipo:e.target.value};setMeta(n);ST.setJ('meta',n)}}>
            <option value="cap">capítulos por dia</option>
            <option value="vers">versículos por dia</option>
          </select>
          <select className="nat" value={meta.quant} onChange={e=>{const n={...meta,quant:+e.target.value};setMeta(n);ST.setJ('meta',n)}}>
            {(meta.tipo==='cap'?[1,2,3,5]:[1,3,5,10]).map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="cartao">
        <h3>Modo XP</h3>
        <div className="linha">
          <label className="chave"><input type="checkbox" checked={xpState.modo} onChange={e=>guardaXp({...xpState,modo:e.target.checked})}/><i/></label>
          <span className="mudo">XP atual: {xpState.total} · desligar não apaga teu XP</span>
        </div>
      </div>
      <div className="cartao">
        <h3>Leitura</h3>
        <label className="linha">
          <span>Tamanho da letra</span>
          <input type="range" min="14" max="28" value={letra} onChange={e=>{setLetra(+e.target.value);ST.setJ('letra',+e.target.value)}}/>
        </label>
        <label className="linha">
          <span>Letra de livro (serifada)</span>
          <label className="chave"><input type="checkbox" checked={serifa} onChange={e=>{setSerifa(e.target.checked);ST.setJ('serifa',e.target.checked)}}/><i/></label>
        </label>
      </div>
      <div className="cartao">
        <h3>Sobre as traduções</h3>
        <p className="mudo">Todas em <b>domínio público</b>: Almeida, KJV 1769, Reina-Valera 1909 e mais {TRADS.length-3} idiomas. Fonte: coleção pública (GitHub). Nada de versão de editora — tudo legal pra ler, baixar e compartilhar.</p>
      </div>
      <div className="cartao">
        <h3>Apagar tudo</h3>
        <button className="mini perigo" onClick={()=>{if(confirm('Apagar leituras, XP, capas e ajustes? Não tem volta.')){['log','xp','meta','letra','lemb','trad','mod','serifa'].forEach(k=>ST.del(k));location.href='/'}}}>apagar meus dados</button>
      </div>
      <p className="mudo cent">🌱 Semeador · feito pra semear todo dia</p>
    </main>}

    <div className={'toast'+(toast?' on':'')}>{toast}</div>
  </div>;
}


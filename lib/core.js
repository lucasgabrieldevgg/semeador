/* Semeador — núcleo puro (testado em node). Nada de React aqui. */
const C=(function(){
 const hojeISO=()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
 const isoMenos=n=>{const x=new Date(Date.now()-n*864e5);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
 const semAcento=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'');
 /* ── meta ── */
 function metaAlvo(meta){return meta?(meta.tipo==='vers'?meta.quant:meta.quant):1}
 /* progresso do dia: dia={caps:{'John 3':true},vers:{'John 3.16':true},xp:{}}
    capLidos → nº de capítulos marcados; verLidos → nº de versículos marcados */
 function nCaps(dia){if(!dia)return 0;let n=0;for(const k in dia.caps)if(dia.caps[k])n++;return n}
 function nVers(dia){if(!dia)return 0;let n=0;for(const k in dia.vers)if(dia.vers[k])n++;return n}
 function metaPct(dia,meta){const alvo=metaAlvo(meta);const feito=meta&&meta.tipo==='vers'?nVers(dia):nCaps(dia);return Math.min(100,Math.round(feito/alvo*100))}
 function metaCumprida(dia,meta){return metaPct(dia,meta)>=100}
 /* ── ofensiva: dia conta se a meta foi cumprida; hoje pendente não quebra ── */
 function streak(log,meta,hoje){hoje=hoje||hojeISO();
  let s=metaCumprida(log[hoje],meta)?1:0;
  for(let n=1;n<400;n++){if(metaCumprida(log[isoMenos(n)],meta))s++;else break}
  return s;
 }
 /* ── XP anti-farm: cada (dia,cap|vers|meta) paga UMA vez; teto diário; desmarcar não devolve ──
   XP: capítulo=+2 · versículo=+1 · meta do dia=+10 · teto 30/dia */
 const TETO_DIA=30;
 function xpDoDia(dia){if(!dia||!dia.xp)return 0;let n=0;for(const k in dia.xp)n+=dia.xp[k];return n}
 function marca(dia,tipo,chave){ // → {dia, ganhou, xp}
  dia=dia||{caps:{},vers:{},xp:{}};
  dia.caps=dia.caps||{};dia.vers=dia.vers||{};dia.xp=dia.xp||{};
  const alvo=tipo==='cap'?dia.caps:dia.vers;
  if(tipo==='meta'){if(dia.xp['meta'])return {dia,ganhou:false,xp:0};
   const v=Math.min(10,TETO_DIA-xpDoDia(dia));if(v<=0)return {dia,ganhou:false,xp:0};
   dia.xp['meta']=v;return {dia,ganhou:true,xp:v}}
  if(alvo[chave])return {dia,ganhou:false,xp:0};
  alvo[chave]=true;
  const preco=tipo==='cap'?2:1;
  if(xpDoDia(dia)>=TETO_DIA)return {dia,ganhou:false,xp:0};
  const v=Math.min(preco,TETO_DIA-xpDoDia(dia));
  dia.xp[tipo+':'+chave]=v;
  return {dia,ganhou:v>0,xp:v};
 }
 /* ── loja ── */
 const TEMAS=[
  {id:'alvor',nome:'Alvor',custo:0, bg:'#14532d',bg2:'#166534',tx:'#f0fdf4',mut:'#bbf7d0',capa:['#166534','#4ade80'],ico:'#166534'},
  {id:'noite',nome:'Noite Serena',custo:150,bg:'#0b1026',bg2:'#151b36',tx:'#e7eaff',mut:'#9aa3d0',capa:['#1e1b4b','#6366f1'],ico:'#1e1b4b'},
  {id:'oliva',nome:'Oliva',custo:300,bg:'#1a1f10',bg2:'#252d18',tx:'#f7fee7',mut:'#d3e4a3',capa:['#3f6212','#a3e635'],ico:'#3f6212'},
  {id:'deserto',nome:'Deserto',custo:500,bg:'#241a10',bg2:'#332516',tx:'#fef3c7',mut:'#e2c286',capa:['#92400e','#fbbf24'],ico:'#92400e'},
  {id:'manancial',nome:'Manancial',custo:800,bg:'#062a30',bg2:'#0b3a42',tx:'#ecfeff',mut:'#a5f3fc',capa:['#155e75','#22d3ee'],ico:'#155e75'}];
 function temaPorId(id){return TEMAS.find(t=>t.id===id)||TEMAS[0]}
 function podeComprar(xp,id){const t=temaPorId(id);return xp>=(t.custo||0)}
 function comprar(xp,temas,id){const t=temaPorId(id);
  if(!t.custo)return {ok:true,xp,temas};
  if(temas.includes(id))return {ok:true,xp,temas};
  if(xp<t.custo)return {ok:false,xp,temas,motivo:'XP insuficiente'};
  return {ok:true,xp:xp-t.custo,temas:temas.concat(id)};
 }
 /* ── referências: '/john/3/16', 'jo 3', '3 joão 1' ── */
 function parseRef(slug,livros){
  const parts=(slug||'').split('/').filter(Boolean);
  if(!parts.length)return null;
  const busca=semAcento(decodeURIComponent(parts[0]));
  const livro=livros.find(l=>semAcento(l.ab)===busca||semAcento(l.nome)===busca);
  if(!livro)return null;
  return {ab:livro.ab,cap:Math.max(1,parseInt(parts[1],10)||1),vers:parts[2]?Math.max(1,parseInt(parts[2],10)||1):null};
 }
 return {hojeISO,isoMenos,semAcento,metaAlvo,nCaps,nVers,metaPct,metaCumprida,streak,TETO_DIA,xpDoDia,marca,TEMAS,temaPorId,podeComprar,comprar,parseRef};
})();
if(typeof module!=='undefined')module.exports=C;

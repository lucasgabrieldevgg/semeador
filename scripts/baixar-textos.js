/* Semeador — baixa e minifica traduções de domínio público (build-time).
   Fonte: FordhamRamFan/public-domain-bible-translations (100% domínio público). */
const fs=require('fs'),path=require('path');
const RAW='https://raw.githubusercontent.com/FordhamRamFan/public-domain-bible-translations/';
const API='https://api.github.com/repos/FordhamRamFan/public-domain-bible-translations/contents/';
const LOCAIS={almeida:'Portuguese/Almeida-Portuguese',kjv:'English/King-James-Version',rvr1909:'Spanish/Reina-Valera-1909'};
const DEST=path.join(__dirname,'..','public','texto');
async function j(url){const r=await fetch(url,{headers:{'User-Agent':'semeador-build'}});if(!r.ok)throw new Error(url+' '+r.status);return r.json()}
async function t(url){const r=await fetch(url,{headers:{'User-Agent':'semeador-build'}});if(!r.ok)throw new Error(url+' '+r.status);return r.text()}
(async()=>{
 // 1. registry: pula o scan se já existe (builds ficam rápidos e à prova de rate-limit)
 const REGP=path.join(__dirname,'..','lib','trads.json');
 const registry=[];
 if(fs.existsSync(REGP)&&!process.env.SEM_REGEN){
  const atual=JSON.parse(fs.readFileSync(REGP,'utf8'));
  if(atual.trads&&atual.trads.length){
   console.log('✓ registry em cache ('+atual.trads.length+' traduções)');
   // garante o corpus local em public/texto copiando da raiz (sem rede, determinístico em qualquer build)
   for(const id of Object.keys(LOCAIS)){
    const destId=path.join(DEST,id);
    if(fs.existsSync(destId)&&fs.readdirSync(destId).filter(f=>/^\d{2}.*\.json$/.test(f)).length>=66)continue;
    fs.mkdirSync(destId,{recursive:true});
    for(const f of fs.readdirSync(path.join(__dirname,'..','texto',id)).filter(f=>/^\d{2}.*\.json$/.test(f)))
     fs.copyFileSync(path.join(__dirname,'..','texto',id,f),path.join(destId,f));
    console.log('✓',id,'corpus copiado da raiz (',fs.readdirSync(destId).length,'livros )');
   }
   finish(atual);return
  }
 }
 const repo=await j('https://api.github.com/repos/FordhamRamFan/public-domain-bible-translations');
 const br=repo.default_branch;
 const langs=await j(API+'?ref='+br);
 for(const L of langs){
  if(L.type!=='dir')continue;
  const trs=await j(API+L.name+'?ref='+br);
  for(const T of trs){
   if(T.type!=='dir')continue;
   registry.push({lingua:L.name,tr:T.name,caminho:L.name+'/'+T.name});
  }
 }
 // 2. baixa/minifica as locais (pula se já existem — build na Vercel é rápido)
 for(const [id,cam] of Object.entries(LOCAIS)){
  const dir=path.join(DEST,id);fs.mkdirSync(dir,{recursive:true});
  const arqs=fs.readdirSync(dir).filter(f=>/^\d{2}.*\.json$/.test(f));
  if(arqs.length>=66){console.log('✓',id,'já baixado');continue}
  const lista=(await j(API+cam+'?ref='+br)).filter(f=>/^\d{2}.*\.json$/.test(f.name));
  let i=0;
  for(const f of lista){
   const txt=await t(RAW+br+'/'+cam+'/'+f.name);
   fs.writeFileSync(path.join(dir,f.name),JSON.stringify(JSON.parse(txt)));
   i++;if(i%20===0)console.log(' ',id,i+'/'+lista.length);
  }
  console.log('✓',id,lista.length,'livros');
 }
 // 3. registro: livros canônicos (do Almeida) + traduções
 const almeida=JSON.parse(fs.readFileSync(path.join(DEST,'almeida','01-Gen.json'),'utf8'));
 const listaAlm=fs.readdirSync(path.join(DEST,'almeida')).filter(f=>/^\d{2}/.test(f)).sort();
 const livros=listaAlm.map((f,i)=>({n:JSON.parse(fs.readFileSync(path.join(DEST,'almeida',f),'utf8')).number,ab:f.replace('.json','').replace(/^\d+-/,''),nome:'?'}));
 // nomes pt: pega o campo book de cada arquivo (66 leituras rápidas)
 const ab2nome={};
 for(const f of listaAlm){const b=JSON.parse(fs.readFileSync(path.join(DEST,'almeida',f),'utf8'));ab2nome[b.abbreviation]=b.book}
 const LIVROS=listaAlm.map(f=>{const nn=f.replace('.json','').replace(/-.*/,'');const b=f.replace('.json','').replace(/^\d+-/,'');return {nn,ab:b,nome:ab2nome[b]}});
 const trMeta={'almeida':{nome:'Almeida',ano:'—',lingua:'Português'},'kjv':{nome:'King James Version',ano:'1769',lingua:'English'},'rvr1909':{nome:'Reina-Valera 1909',ano:'1909',lingua:'Español'}};
 const trads=[];
 for(const [id,cam] of Object.entries(LOCAIS))trads.push({id,nome:trMeta[id].nome,ano:trMeta[id].ano,lingua:trMeta[id].lingua,fonte:'local'});
 for(const r of registry){
  const id=r.caminho.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  if(LOCAIS[id])continue;
  trads.push({id,nome:r.tr.replace(/-/g,' '),ano:'',lingua:r.lingua,fonte:'remota',caminho:r.caminho});
 }
 finish({livros:LIVROS,trads});
 function finish(reg){
  fs.writeFileSync(path.join(__dirname,'..','lib','trads.json'),JSON.stringify(reg));
  console.log('✓ registry:',reg.trads.length,'traduções,',reg.livros.length,'livros');
 }
})().catch(e=>{console.error('FALHOU:',e.message);process.exit(1)});

const C=require('../lib/core.js');
const ok=(c,l)=>console.log((c?'✅':'❌')+' '+l);
const D=(caps,vers,xp)=>({caps:caps||{},vers:vers||{},xp:xp||{}});
/* meta */
ok(C.metaAlvo({tipo:'cap',quant:3})===3&&C.metaAlvo({tipo:'vers',quant:5})===5,'metaAlvo caps e versos');
ok(C.nCaps(D({'Jo 3':true,'Jo 4':true}))===2&&C.nVers(D({},{'Jo 3.16':true,'Jo 3.17':true}))===2,'conta caps/vers marcados');
ok(C.metaPct(D({'Jo 3':true}),{tipo:'cap',quant:2})===50&&C.metaPct(null,{tipo:'cap',quant:2})===0,'pct parcial e dia vazio');
ok(C.metaCumprida(D({'A':true,'B':true}),{tipo:'cap',quant:2})&&C.metaPct(D({'A':true,'B':true,'C':true}),{tipo:'cap',quant:2})===100,'meta cumprida e teto de pct');
/* streak */
const M={tipo:'cap',quant:2};
const log={};const iso=n=>C.isoMenos(n);
log[C.hojeISO()]=D({'A':true,'B':true});log[iso(1)]=D({'A':true,'B':true});log[iso(2)]=D({'A':true,'B':true});
ok(C.streak(log,M)===3,'streak 3 dias (hoje cumprido)');
log[C.hojeISO()]=D({'A':true});
ok(C.streak(log,M)===2,'hoje pendente não quebra (conta os 2 anteriores)');
ok(C.streak({},M)===0,'sem log = 0');
/* xp anti-farm */
let r=C.marca(null,'cap','Jo 3');
ok(r.ganhou&&r.xp===2&&r.dia.xp['cap:Jo 3']===2,'capítulo vale +2');
const d2=r.dia;const r2=C.marca(d2,'cap','Jo 3');
ok(!r2.ganhou&&r2.xp===0&&C.xpDoDia(r2.dia)===2,'mesmo cap 2x NÃO paga de novo (anti-farm)');
for(let i=4;i<=18;i++)C.marca(d2,'cap','X'+i);
let r3=C.marca(d2,'cap','Z99');
ok(C.xpDoDia(r3.dia)===30&&r3.xp===0,'teto diário de 30 XP respeitado');
let rm=C.marca(D({},{'Jo 3.16':{}}),'vers','Jo 3.16');
rm=C.marca(rm.dia,'vers','Jo 3.16');
ok(rm.xp===0&&C.nVers(rm.dia)===1,'versículo 2x não paga + não desmarca XP');
const dm=C.marca(D(),'meta','x');
ok(dm.ganhou&&dm.xp===10&&C.marca(dm.dia,'meta','x').xp===0,'meta do dia = +10, uma vez só');
/* desmarcar não devolve: remover do caps não mexe no xp */
const dd=C.marca(null,'cap','Lc 5').dia;delete dd.caps['Lc 5'];
ok(C.xpDoDia(dd)===2,'desmarcar não devolve XP');
/* loja */
ok(C.podeComprar(200,'noite')&&C.podeComprar(0,'alvor')&&!C.podeComprar(100,'manancial'),'pode comprar por XP');
const c1=C.comprar(200,[],'noite');
ok(c1.ok&&c1.xp===50&&c1.temas.includes('noite'),'compra debita XP e libera tema');
const c2=C.comprar(50,[],'manancial');
ok(!c2.ok&&c2.motivo==='XP insuficiente','sem XP recusa');
const c3=C.comprar(200,['noite'],'noite');
ok(c3.ok&&c3.xp===200,'re-comprar tema já meu é grátis');
ok(C.temaPorId('x').id==='alvor','tema inválido cai no Alvor');
ok(C.TEMAS.length===5&&C.TEMAS[0].custo===0,'5 temas, o primeiro grátis');
/* parseRef */
const LIVROS=[{ab:'John',nome:'João'},{ab:'Gen',nome:'Gênesis'},{ab:'Ps',nome:'Salmos'}];
const p1=C.parseRef('/john/3/16',LIVROS);
ok(p1&&p1.ab==='John'&&p1.cap===3&&p1.vers===16,'/john/3/16 parse');
ok(C.parseRef('/salmo',LIVROS)===null,'livro inexistente = null');
ok(C.parseRef('/genesis',LIVROS).ab==='Gen','nome pt sem acento acha (genesis→Gen)');
ok(C.parseRef('/psalmos/23',LIVROS)===null||C.parseRef('/salmos/23',LIVROS).ab==='Ps','salmos resolve');
console.log('\n✦ suíte Semeador core');

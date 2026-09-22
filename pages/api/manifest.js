/* manifest dinâmico: tema comprado na loja muda nome visual e cores do atalho */
const TEMAS={alvor:{nome:'Semeador',bg:'#14532d',ico:'/icones/alvor'},noite:{nome:'Semeador · Noite',bg:'#1e1b4b',ico:'/icones/noite'},oliva:{nome:'Semeador · Oliva',bg:'#3f6212',ico:'/icones/oliva'},deserto:{nome:'Semeador · Deserto',bg:'#92400e',ico:'/icones/deserto'},manancial:{nome:'Semeador · Manancial',bg:'#155e75',ico:'/icones/manancial'}};
export default function handler(req,res){
  const t=TEMAS[(req.cookies.sema_tema||'alvor')]||TEMAS.alvor;
  res.setHeader('Content-Type','application/manifest+json');
  res.status(200).json({name:t.nome,short_name:'Semeador',start_url:'/',display:'standalone',background_color:t.bg,theme_color:t.bg,icons:[{src:t.ico+'-192.png',sizes:'192x192',type:'image/png'},{src:t.ico+'-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]});
}

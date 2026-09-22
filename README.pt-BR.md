# 🌱 Semeador

**Leia a Bíblia todo dia.** Várias traduções em domínio público, meta de leitura personalizada, ofensiva, XP opcional com loja de temas, e funciona offline. Instala no celular (PWA — sem baixar APK: o site vira o app na sua tela inicial).

## Destaques
- 📖 **Leitor**: livro → capítulo → versículo, toque no versículo pra marcar como lido, URLs bonitas (`/john/3/16`)
- 🌍 **31 traduções** em domínio público: Almeida (pt), KJV, Reina-Valera 1909 inclusas + 28 idiomas baixados sob demanda (árabe, chinês, francês, alemão, latim, grego, hebraico…)
- 🎯 **Meta diária**: capítulos ou versículos por dia · 🔥 ofensiva · ⏰ lembrete diário
- ⚡ **Modo XP opcional**: ler gera XP (uma vez por dia — sem farmar), gasta na **loja** desbloqueando **temas/capas** (com cores de ícone)
- 🔎 **Busca**: baixa a tradução inteira (~6 MB) e busca em tudo, offline
- 📴 **Offline**: capítulos baixados ficam no aparelho

Todos os textos são de domínio público (fonte: [public-domain-bible-translations](https://github.com/FordhamRamFan/public-domain-bible-translations)). Nada de tradução de editora.

## Dev
```bash
npm install
npm run build && npm start   # textos baixados/minificados no build
npm test                     # lógica do núcleo (meta, ofensiva, XP anti-farm, loja)
```

Feito por [lucasgabrieldevgg](https://github.com/lucasgabrieldevgg) 💜

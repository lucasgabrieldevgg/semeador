# 🌱 Semeador

**Read the Bible every day.** Multiple public-domain translations, personalized reading goal, streak, optional XP with a theme shop, and works offline. Install it on your phone (PWA — no APK download needed, the site itself becomes the app).

## Highlights
- 📖 **Reader**: book → chapter → verse, tap a verse to mark it as read, pretty URLs (`/john/3/16`)
- 🌍 **31 translations** in the public domain: Almeida (pt), KJV, Reina-Valera 1909 built-in + 28 more languages downloaded on demand (Arabic, Chinese, French, German, Latin, Greek, Hebrew…)
- 🎯 **Daily goal**: chapters or verses per day · 🔥 streak · ⏰ daily reminder
- ⚡ **Optional XP mode**: reading generates XP (once a day — no farming), spend it in the **shop** unlocking **themes/covers** (with icon colors)
- 🔎 **Search**: download the whole translation (~6 MB) and search everything, offline
- 📴 **Offline**: downloaded chapters stay on your device

All texts are public domain (source: [public-domain-bible-translations](https://github.com/FordhamRamFan/public-domain-bible-translations)). No copyrighted translations.

## Dev
```bash
npm install
npm run build && npm start   # texts are downloaded/minified at build
npm test                     # core logic (meta, streak, XP anti-farm, shop)
```

Made by [lucasgabrieldevgg](https://github.com/lucasgabrieldevgg) 💜

# 🔥 Exodus Quest (Êxodo Quest)

> Duolingo-style gamified app to study **Exodus chapters 1–20**: per-chapter quizzes, TTS narration, AI-simplified interpretation, a hidden admin panel and two-way integration with the **Zapia Max** WhatsApp agent.

**Live demo:** https://exodo-quest.vercel.app

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL)

[Leia em Portugues](README.pt-BR.md)

---

## 📂 Folder structure

```
exodo-quest/
├── supabase/
│   └── schema.sql                  # Full schema (tables + RLS + queries)
├── src/
│   ├── app/
│   │   ├── page.tsx                # Onboarding (name) + 🔑 admin backdoor
│   │   ├── trilha/page.tsx         # Linear trail Cap 1→20 (zig-zag map)
│   │   ├── capitulo/[id]/page.tsx  # Story / Summary / Quiz
│   │   ├── admin-dashboard/page.tsx# Hidden admin panel
│   │   ├── layout.tsx / globals.css
│   │   └── api/
│   │       ├── usuarios/route.ts             # POST onboarding (detects backdoor)
│   │       ├── quiz/responder/route.ts       # POST saves answer + renews session
│   │       ├── sessao/flush/route.ts         # POST ends session → Zapia webhook
│   │       ├── cron/verifica-sessoes/route.ts# GET cron (10-min safety net)
│   │       ├── consulta-status/route.ts      # GET  Zapia → Site (student history)
│   │       ├── envia-mensagem-zapia/route.ts # POST Zapia → Site (tutor message)
│   │       ├── mensagens/route.ts            # GET/PATCH messages in the app
│   │       ├── admin/metricas/route.ts       # GET panel metrics
│   │       ├── admin/mensagem/route.ts       # POST message from the panel
│   │       └── ia/interpretacao/route.ts     # POST generates AI interpretation
│   ├── components/   # ThemeToggle, HelpButton, ProgressBar, TTSButton, MensagensBanner
│   ├── lib/
│   │   ├── supabaseAdmin.ts        # Service-role client (server only)
│   │   ├── zapia.ts                # Session consolidation + webhook + API key auth
│   │   ├── ia.ts                   # ChatAnywhere client (OpenAI protocol)
│   │   └── useSessao.ts            # Client hook: 10-min timer + sendBeacon
│   └── data/
│       └── capitulos.ts            # ⬇️ PASTE YOUR PDF CONTENT HERE
├── vercel.json                     # Cron every 5 min
└── .env.local.example              # Environment variable template
```

---

## 🚀 Setup in 4 steps

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run the entire contents of `supabase/schema.sql`.
3. In **Project Settings → API**, copy the `URL` and the `service_role key`.

### 2. Environment variables
```bash
cp .env.local.example .env.local
```
Fill in:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access (server only — RLS blocks the rest) |
| `ZAPIA_WEBHOOK_URL` | URL where Zapia Max receives the session report |
| `ZAPIA_API_KEY` | Secret key Zapia sends in the `x-api-key` header |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | AI for the Simplified Interpretation (ChatAnywhere, OpenAI protocol) |
| `CRON_SECRET` | (optional, Vercel) protects the cron route |

> ⚠️ **Security:** never commit `.env.local`. If your ChatAnywhere key has ever appeared anywhere public, revoke it and generate a new one.

### 3. Run
```bash
npm install
npm run dev      # http://localhost:3000
```

### 4. PDF content
Open `src/data/capitulos.ts` and paste, for each chapter:
- `textoOriginal` (ARC), `resumo`, and the `quiz` array:

```ts
{ id: "cap3-q1", pergunta: "...", opcoes: ["A","B","C","D"], correta: 1, explicacao: "..." }
```

Chapter 1 ships filled in as an example. If `interpretacao` is left `""`, the app generates it automatically via AI (with caching).

---

## 🚪 Admin backdoor

On the home screen, type **`adalberto`** or **`batalha2026`** → redirects to `/admin-dashboard` (overall metrics + direct/broadcast messages stored in `mensagens_admin`).

---

## 🔁 Zapia Max integration

### A) Site ➡️ Zapia — Session report (10-min timeout)

A **3-layer** mechanism:

1. **Client timer** (`src/lib/useSessao.ts`): every quiz answer renews a 10-minute timer; when it expires it calls `POST /api/sessao/flush`.
2. **App close**: the `pagehide` event fires `navigator.sendBeacon` with reason `"fechamento"` (immediate, guaranteed delivery).
3. **Safety-net cron** (`/api/cron/verifica-sessoes`, every 5 min via `vercel.json`): picks up orphan sessions with 10+ minutes of inactivity (phone died, etc.). Idempotent — each session sends the report **exactly once** (`relatorio_enviado`).

POST payload sent to `ZAPIA_WEBHOOK_URL`:
```json
{
  "usuario": "Lucas",
  "resumo_sessao": "Missed 2 and got 1 right in Cap 3, got all 3 right in Cap 4",
  "detalhes": [ { "capitulo": 3, "pergunta_id": "cap3-q1", "resultado": false } ]
}
```

### B) Zapia ➡️ Site — Custom Actions (protected by `x-api-key`)

**1. Check a student's status**
```
GET /api/consulta-status?nome=Lucas&capitulo=3
Header: x-api-key: <ZAPIA_API_KEY>
```
The response includes a `resumo_humanizado` ready for the AI to answer the admin:
```json
{
  "usuario": "Lucas", "capitulo": 3,
  "total_respostas": 5, "acertos": 3, "erros": 2, "taxa_acerto": "60%",
  "resumo_humanizado": "Lucas answered 5 question(s) in Cap 3: 3 right and 2 wrong (60%).",
  "historico": [...]
}
```
Omitting `capitulo` returns overall performance + `desempenho_por_capitulo`.

**2. Send a message to the student's app**
```
POST /api/envia-mensagem-zapia
Header: x-api-key: <ZAPIA_API_KEY>
Body: { "nome": "Lucas", "mensagem": "Review Cap 3 before continuing! 💪" }
```
`"nome": "todos"` (or omitted) = broadcast. The message appears as a **yellow Tutor banner** in the app (polling every 60s).

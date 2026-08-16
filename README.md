# 🔥 Êxodo Quest

App gamificado (estilo Duolingo) para estudar os **capítulos 1–20 de Êxodo**, com quiz por capítulo, narração TTS, interpretação simplificada por IA, painel de admin oculto e integração bidirecional com o agente de WhatsApp **Zapia Max**.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL)

---

## 📂 Estrutura de pastas

```
exodo-quest/
├── supabase/
│   └── schema.sql                  # Schema completo (tabelas + RLS + queries)
├── src/
│   ├── app/
│   │   ├── page.tsx                # Onboarding (nome) + 🔑 backdoor de admin
│   │   ├── trilha/page.tsx         # Trilha linear Cap 1→20 (mapa zigue-zague)
│   │   ├── capitulo/[id]/page.tsx  # História / Resumo / Quiz
│   │   ├── admin-dashboard/page.tsx# Painel oculto do Adalberto
│   │   ├── layout.tsx / globals.css
│   │   └── api/
│   │       ├── usuarios/route.ts             # POST onboarding (detecta backdoor)
│   │       ├── quiz/responder/route.ts       # POST grava resposta + renova sessão
│   │       ├── sessao/flush/route.ts         # POST encerra sessão → webhook Zapia
│   │       ├── cron/verifica-sessoes/route.ts# GET cron (rede de segurança 10 min)
│   │       ├── consulta-status/route.ts      # GET  Zapia → Site (histórico aluno)
│   │       ├── envia-mensagem-zapia/route.ts # POST Zapia → Site (mensagem tutor)
│   │       ├── mensagens/route.ts            # GET/PATCH mensagens no app
│   │       ├── admin/metricas/route.ts       # GET métricas do painel
│   │       ├── admin/mensagem/route.ts       # POST mensagem pelo painel
│   │       └── ia/interpretacao/route.ts     # POST gera interpretação via IA
│   ├── components/   # ThemeToggle, HelpButton, ProgressBar, TTSButton, MensagensBanner
│   ├── lib/
│   │   ├── supabaseAdmin.ts        # Cliente service-role (só servidor)
│   │   ├── zapia.ts                # Consolidação de sessão + webhook + auth API key
│   │   ├── ia.ts                   # Cliente ChatAnywhere (protocolo OpenAI)
│   │   └── useSessao.ts            # Hook client: timer 10 min + sendBeacon
│   └── data/
│       └── capitulos.ts            # ⬅️ COLE AQUI o conteúdo do seu PDF
├── vercel.json                     # Cron a cada 5 min
└── .env.local.example              # Modelo de variáveis de ambiente
```

---

## 🚀 Setup em 4 passos

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** e execute todo o conteúdo de `supabase/schema.sql`.
3. Em **Project Settings → API**, copie a `URL` e a `service_role key`.

### 2. Variáveis de ambiente
```bash
cp .env.local.example .env.local
```
Preencha:

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso ao banco (somente servidor — RLS bloqueia o resto) |
| `ZAPIA_WEBHOOK_URL` | URL onde a Zapia Max recebe o relatório de sessão |
| `ZAPIA_API_KEY` | Chave secreta que a Zapia envia no header `x-api-key` |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | IA da Interpretação Simplificada (ChatAnywhere, protocolo OpenAI) |
| `CRON_SECRET` | (opcional, Vercel) protege a rota do cron |

> ⚠️ **Segurança:** nunca faça commit do `.env.local`. Se a sua chave da ChatAnywhere já apareceu em algum lugar público, revogue e gere outra.

### 3. Rodar
```bash
npm install
npm run dev      # http://localhost:3000
```

### 4. Conteúdo do PDF
Abra `src/data/capitulos.ts` e cole, para cada capítulo:
- `textoOriginal` (ARC), `resumo`, e o array `quiz`:

```ts
{ id: "cap3-q1", pergunta: "...", opcoes: ["A","B","C","D"], correta: 1, explicacao: "..." }
```

O Capítulo 1 já vem preenchido como exemplo. Se `interpretacao` ficar `""`, o app gera automaticamente via IA (com cache).

---

## 🚪 Backdoor de Admin

Na tela inicial, digite **`adalberto`** ou **`batalha2026`** → redireciona para `/admin-dashboard` (métricas gerais + envio de mensagens diretas/broadcast gravadas em `mensagens_admin`).

---

## 🔁 Integração Zapia Max

### A) Site ➡️ Zapia — Relatório de sessão (timeout 10 min)

Mecanismo em **3 camadas**:

1. **Timer no client** (`src/lib/useSessao.ts`): cada resposta de quiz renova um timer de 10 min; ao estourar, chama `POST /api/sessao/flush`.
2. **Fechamento do app**: evento `pagehide` dispara `navigator.sendBeacon` com motivo `"fechamento"` (envio imediato e garantido).
3. **Cron de segurança** (`/api/cron/verifica-sessoes`, a cada 5 min via `vercel.json`): pega sessões órfãs com 10+ min de inatividade (celular desligou, etc.). Idempotente — cada sessão envia o relatório **uma única vez** (`relatorio_enviado`).

Payload POST enviado para `ZAPIA_WEBHOOK_URL`:
```json
{
  "usuario": "Lucas",
  "resumo_sessao": "Errou 2 e acertou 1 perguntas no Cap 3, acertou todas as 3 perguntas no Cap 4",
  "detalhes": [ { "capitulo": 3, "pergunta_id": "cap3-q1", "resultado": false }, ... ]
}
```

### B) Zapia ➡️ Site — Custom Actions (protegidas por `x-api-key`)

**1. Consultar status de um aluno**
```
GET /api/consulta-status?nome=Lucas&capitulo=3
Header: x-api-key: <ZAPIA_API_KEY>
```
Resposta inclui `resumo_humanizado` pronto para a IA responder ao Adalberto:
```json
{
  "usuario": "Lucas", "capitulo": 3,
  "total_respostas": 5, "acertos": 3, "erros": 2, "taxa_acerto": "60%",
  "resumo_humanizado": "Lucas respondeu 5 pergunta(s) no Cap 3: 3 acerto(s) e 2 erro(s) (60% de acerto).",
  "historico": [...]
}
```
Omitindo `capitulo`, retorna o desempenho geral + `desempenho_por_capitulo`.

**2. Enviar mensagem para o app do aluno**
```
POST /api/envia-mensagem-zapia
Header: x-api-key: <ZAPIA_API_KEY>
Body: { "nome": "Lucas", "mensagem": "Revise o Cap 3 antes de continuar! 💪" }
```
`"nome": "todos"` (ou omitido) = broadcast. A mensagem aparece como **banner amarelo do Tutor** no app (polling a cada 60s).

**Teste rápido com curl:**
```bash
curl -H "x-api-key: SUA_CHAVE" "https://seu-app.vercel.app/api/consulta-status?nome=Lucas&capitulo=3"

curl -X POST -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \
  -d '{"nome":"Lucas","mensagem":"Parabéns pelo Cap 4!"}' \
  https://seu-app.vercel.app/api/envia-mensagem-zapia
```

---

## 🎨 UI/UX

- **Estilo Duolingo**: botões 3D arredondados (`border-b-4` + efeito de "afundar"), feedback verde/vermelho imediato, barras de progresso animadas, trilha em zigue-zague com cadeados/estrelas.
- **Dark Mode**: classe `dark` no `<html>`, persistido em `localStorage`, sem flash no carregamento.
- **Modo Ajuda**: botão flutuante azul `?` em todas as telas, com texto contextual.
- **TTS**: Web Speech API nativa (pt-BR, gratuita) nos modos História e Resumo.

## 🔐 Segurança

- Tabelas com **RLS habilitado e sem policies** → a anon key não acessa nada; todo acesso passa pelas rotas de API com a service-role key (servidor).
- Endpoints da Zapia exigem `x-api-key` (ou `Authorization: Bearer`).
- Cron protegido por `CRON_SECRET`.
- Todas as chaves em variáveis de ambiente.

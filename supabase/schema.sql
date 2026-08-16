-- ============================================================
-- ÊXODO QUEST - Schema do Banco de Dados (Supabase/PostgreSQL)
-- Execute este script no SQL Editor do painel do Supabase.
-- ============================================================

-- Extensão para UUIDs (geralmente já habilitada no Supabase)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) USUÁRIOS
-- ------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  criado_em   timestamptz not null default now()
);

create index if not exists idx_usuarios_nome_lower on public.usuarios (lower(nome));

-- ------------------------------------------------------------
-- 2) LOGS DE DESEMPENHO (cada resposta do quiz)
-- ------------------------------------------------------------
create table if not exists public.logs_desempenho (
  id           bigint generated always as identity primary key,
  usuario_id   uuid not null references public.usuarios(id) on delete cascade,
  capitulo     int  not null check (capitulo between 1 and 20),
  pergunta_id  text not null,
  resultado    boolean not null,        -- true = acertou / false = errou
  "timestamp"  timestamptz not null default now()
);

create index if not exists idx_logs_usuario   on public.logs_desempenho (usuario_id);
create index if not exists idx_logs_capitulo  on public.logs_desempenho (usuario_id, capitulo);
create index if not exists idx_logs_timestamp on public.logs_desempenho ("timestamp" desc);

-- ------------------------------------------------------------
-- 3) MENSAGENS DO ADMIN (Adalberto -> aluno, via app ou Zapia)
-- ------------------------------------------------------------
create table if not exists public.mensagens_admin (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references public.usuarios(id) on delete cascade, -- NULL = broadcast (todos)
  mensagem    text not null,
  lida        boolean not null default false,
  criado_em   timestamptz not null default now()
);

create index if not exists idx_msgs_usuario on public.mensagens_admin (usuario_id, lida);

-- ------------------------------------------------------------
-- 4) SESSÕES DE QUIZ (controle do timeout de 10 minutos)
--    Garante idempotência: o relatório só é enviado 1x por sessão.
-- ------------------------------------------------------------
create table if not exists public.sessoes_quiz (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.usuarios(id) on delete cascade,
  iniciada_em      timestamptz not null default now(),
  ultima_atividade timestamptz not null default now(),
  relatorio_enviado boolean not null default false,
  enviado_em       timestamptz
);

create index if not exists idx_sessoes_pendentes
  on public.sessoes_quiz (relatorio_enviado, ultima_atividade);

-- ------------------------------------------------------------
-- 5) RLS (Row Level Security)
--    O app acessa o banco SOMENTE pelas rotas de API do Next.js
--    usando a SERVICE_ROLE_KEY (que ignora RLS). Bloqueamos todo
--    acesso anônimo direto por segurança.
-- ------------------------------------------------------------
alter table public.usuarios         enable row level security;
alter table public.logs_desempenho  enable row level security;
alter table public.mensagens_admin  enable row level security;
alter table public.sessoes_quiz     enable row level security;
-- (sem policies = nenhum acesso via anon key; somente service_role acessa)

-- ------------------------------------------------------------
-- QUERIES ÚTEIS (referência para o painel admin / Zapia)
-- ------------------------------------------------------------

-- Histórico de um usuário em um capítulo:
-- select l.capitulo, l.pergunta_id, l.resultado, l."timestamp"
--   from logs_desempenho l
--   join usuarios u on u.id = l.usuario_id
--  where lower(u.nome) = lower('Lucas') and l.capitulo = 3
--  order by l."timestamp" desc;

-- Resumo de acertos/erros por capítulo:
-- select capitulo,
--        count(*) filter (where resultado)     as acertos,
--        count(*) filter (where not resultado) as erros
--   from logs_desempenho
--  where usuario_id = '...'
--  group by capitulo order by capitulo;

-- Métricas gerais (admin):
-- select (select count(*) from usuarios)                          as total_usuarios,
--        (select count(*) from logs_desempenho)                   as total_respostas,
--        (select round(100.0 * count(*) filter (where resultado) / nullif(count(*),0), 1)
--           from logs_desempenho)                                 as taxa_acerto_pct;

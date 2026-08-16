-- ============================================================
-- ATUALIZAÇÃO: Comunidade, Chat, Desafios e Presença Online
-- Execute TODO este script no SQL Editor do Supabase (RUN).
-- ============================================================

-- 1) Presença online (coluna nova em usuarios)
alter table public.usuarios
  add column if not exists ultima_presenca timestamptz;

-- 2) Chat entre usuários
create table if not exists public.mensagens_chat (
  id          bigint generated always as identity primary key,
  de_usuario  uuid not null references public.usuarios(id) on delete cascade,
  para_usuario uuid not null references public.usuarios(id) on delete cascade,
  mensagem    text not null,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_chat_conversa
  on public.mensagens_chat (de_usuario, para_usuario, criado_em desc);

-- 3) Desafios (duelos de quiz)
create table if not exists public.desafios (
  id                 uuid primary key default gen_random_uuid(),
  desafiante_id      uuid not null references public.usuarios(id) on delete cascade,
  desafiado_id       uuid not null references public.usuarios(id) on delete cascade,
  capitulo           int  not null check (capitulo between 1 and 20),
  status             text not null default 'pendente', -- pendente | aceito | recusado | finalizado
  total_perguntas    int  not null default 10,
  pontos_desafiante  int  not null default 0,
  pontos_desafiado   int  not null default 0,
  prog_desafiante    int  not null default 0,
  prog_desafiado     int  not null default 0,
  vencedor_id        uuid references public.usuarios(id),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index if not exists idx_desafios_usuarios
  on public.desafios (desafiado_id, status, criado_em desc);
create index if not exists idx_desafios_desafiante
  on public.desafios (desafiante_id, status, criado_em desc);

-- 4) Segurança (RLS) + permissões do backend
alter table public.mensagens_chat enable row level security;
alter table public.desafios       enable row level security;

grant all privileges on table public.mensagens_chat to service_role;
grant all privileges on table public.desafios       to service_role;
grant usage, select on all sequences in schema public to service_role;

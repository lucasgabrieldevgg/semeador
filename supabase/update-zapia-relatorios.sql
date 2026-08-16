-- ============================================================
-- ATUALIZAÇÃO: notificação de duelos via polling da Zapia
-- Execute no SQL Editor do Supabase (RUN). 5 segundos.
-- ============================================================

alter table public.desafios
  add column if not exists notificado boolean not null default false;

-- marca como já notificados os duelos antigos (não repetir histórico)
update public.desafios set notificado = true where status = 'finalizado';

-- ============================================================
-- CORREÇÃO DE PERMISSÕES — Êxodo Quest
-- Execute este script no SQL Editor do Supabase (RUN).
-- Ele dá ao backend (service_role) acesso às tabelas criadas.
-- ============================================================

grant usage on schema public to service_role;

grant all privileges on table public.usuarios         to service_role;
grant all privileges on table public.logs_desempenho  to service_role;
grant all privileges on table public.mensagens_admin  to service_role;
grant all privileges on table public.sessoes_quiz     to service_role;

-- Sequências (necessário para os IDs auto-incrementais)
grant usage, select on all sequences in schema public to service_role;

-- Garante que futuras tabelas também tenham permissão
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- ============================================================
-- ATUALIZAÇÃO: registrar QUAL alternativa o aluno marcou
-- Execute no SQL Editor do Supabase (RUN). Leva 2 segundos.
-- ============================================================

alter table public.logs_desempenho
  add column if not exists resposta_marcada int; -- 0=A, 1=B, 2=C, 3=D (null em respostas antigas)

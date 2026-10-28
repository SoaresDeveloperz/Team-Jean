-- =============================================================================
-- Team Jean — "Tenho pouco tempo" (versão curta do treino)
-- =============================================================================
-- Como usar:
--   1. Supabase → SQL Editor → cole este arquivo → Run.
--   2. Pode ser rodado mais de uma vez (é idempotente), em qualquer ordem com
--      os outros arquivos de supabase/.
--
-- O que ele cria:
--   - workout_sessions.short_mode: sim/não, "o aluno fez a versão curta hoje".
--     Só isso (LGPD): nada de motivo, dor ou saúde. O treinador vê o selo
--     "Versão curta" no histórico do aluno; não gera aviso nem push.
--
-- Permissões: as mesmas de workout_sessions (supabase/policies.sql): o aluno
-- grava só nas próprias sessões; o treinador lê todas.
--
-- Até este arquivo ser rodado, o app funciona como antes: o treino curto é
-- salvo sem a marca (o app tenta de novo sem a coluna, nunca perde o treino).
-- =============================================================================

alter table public.workout_sessions add column if not exists short_mode boolean not null default false;

comment on column public.workout_sessions.short_mode is
  'O aluno fez a versão curta do treino ("Tenho pouco tempo"). Só sim/não.';

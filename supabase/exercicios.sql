-- =============================================================================
-- Team Jean — GIFs dos exercícios (biblioteca de exercícios)
-- =============================================================================
-- Como usar:
--   1. Supabase → SQL Editor → cole este arquivo → Run.
--   2. Pode ser rodado mais de uma vez (é idempotente), em qualquer ordem com
--      os outros arquivos de supabase/.
--   3. Depois, se quiser ligar os GIFs aos exercícios que já existem, rode o
--      supabase/exercicios-casamento.sql (específico do banco do Team Jean).
--
-- O que ele cria:
--   - exercises.media_id: nome do arquivo do GIF do exercício na biblioteca
--     (ex.: "0025-EIeI8Vf"). Só o nome, nunca um endereço: o app monta o link
--     com a base configurada (src/lib/exercises/media.ts). Vazio = sem GIF.
--
-- Permissões: as mesmas da tabela exercises (supabase/policies.sql): todos os
-- logados leem; só o treinador cria, edita e apaga.
--
-- Até este arquivo ser rodado, o app funciona como antes (sem GIF) e a
-- biblioteca do treinador mostra um aviso pedindo para rodá-lo.
-- =============================================================================

alter table public.exercises add column if not exists media_id text;

-- "not valid": vale para o que for gravado daqui em diante (não trava o script
-- se o banco já tiver dados antigos nessa coluna).
alter table public.exercises drop constraint if exists exercises_media_id_check;
alter table public.exercises add constraint exercises_media_id_check
  check (media_id is null or media_id ~ '^[A-Za-z0-9_-]{1,64}$') not valid;

comment on column public.exercises.media_id is
  'Arquivo do GIF na biblioteca de exercícios (sem extensão e sem endereço). © Gym visual — https://gymvisual.com/';

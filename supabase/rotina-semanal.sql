-- =============================================================================
-- Team Jean — Rotina da semana: dia de cada treino e ordem escolhida pelo treinador
-- =============================================================================
-- Como usar:
--   1. Supabase → SQL Editor → cole este arquivo → Run.
--   2. Pode ser rodado mais de uma vez (é idempotente), em qualquer ordem com
--      os outros arquivos de supabase/.
--
-- O que ele cria (em assigned_workouts, os treinos de cada aluno):
--   - weekday: dia da semana do treino (0 = domingo ... 6 = sábado, igual ao
--     getDay do JavaScript); vazio = sem dia fixo. Com dia marcado, a tela Hoje do
--     aluno mostra o treino do dia; em dia sem treino, mostra descanso.
--   - position: ordem do treino na rotina (menor vem primeiro); vazio = ordem do
--     nome (Treino A, B, C...).
--
-- A semana começa na segunda e o "já fez nesta semana" zera na virada: quem não
-- fez o último treino volta ao primeiro. Isso vale mesmo antes deste SQL.
--
-- Permissões: as mesmas de assigned_workouts (supabase/policies.sql): o aluno lê
-- os seus treinos; só o treinador grava dia e ordem.
--
-- Até este arquivo ser rodado, o app funciona como antes (com o reinício semanal
-- pela ordem do nome); o construtor do treinador só não mostra "Dia" e "Subir/Descer".
-- =============================================================================

alter table public.assigned_workouts add column if not exists weekday smallint;
alter table public.assigned_workouts add column if not exists position smallint;

-- "not valid": vale para o que for gravado daqui em diante.
alter table public.assigned_workouts drop constraint if exists assigned_workouts_weekday_check;
alter table public.assigned_workouts add constraint assigned_workouts_weekday_check
  check (weekday is null or weekday between 0 and 6) not valid;
alter table public.assigned_workouts drop constraint if exists assigned_workouts_position_check;
alter table public.assigned_workouts add constraint assigned_workouts_position_check
  check (position is null or position between 0 and 99) not valid;

comment on column public.assigned_workouts.weekday is
  'Dia da semana do treino (0 = domingo ... 6 = sábado); vazio = sem dia fixo.';
comment on column public.assigned_workouts."position" is
  'Ordem do treino na rotina do aluno (menor primeiro); vazio = ordem do nome.';

-- -----------------------------------------------------------------------------
-- Descanso rotativo: com rotate_days ligado, os dias marcados andam um dia a cada
-- semana (a folga "gira" pela semana). O treinador liga por aluno (vale para todos
-- os treinos dele). Só o treinador grava.
-- -----------------------------------------------------------------------------
alter table public.assigned_workouts add column if not exists rotate_days boolean not null default false;

comment on column public.assigned_workouts.rotate_days is
  'Descanso rotativo: os dias marcados andam um dia a cada semana.';

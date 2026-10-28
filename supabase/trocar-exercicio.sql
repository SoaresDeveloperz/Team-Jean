-- =============================================================================
-- Team Jean — "Trocar exercício" e a marca "Essencial" do treinador
-- =============================================================================
-- Como usar:
--   1. Supabase → SQL Editor → cole este arquivo → Run.
--   2. Pode ser rodado mais de uma vez (é idempotente), em qualquer ordem com
--      os outros arquivos de supabase/.
--
-- O que ele cria:
--   - assigned_workout_exercises.essential e workout_template_exercises.essential:
--     o treinador marca o exercício como essencial. Ele nunca sai da versão curta
--     do treino ("Tenho pouco tempo") e só troca por uma alternativa que o
--     treinador escolheu.
--   - assigned_workout_exercises.alternatives e workout_template_exercises.alternatives:
--     até 5 exercícios (ids da biblioteca) que o treinador aceita no lugar deste.
--     Sem alternativas, o app sugere exercícios do mesmo grupo muscular (menos
--     para os essenciais).
--   - workout_sessions.swaps: quantos exercícios o aluno trocou naquele treino
--     (só o número; o treinador vê "N trocas" no histórico, sem aviso nem push).
--
-- Permissões: as mesmas das tabelas de origem (supabase/policies.sql): o aluno
-- lê os seus treinos e grava só as suas sessões; só o treinador muda a
-- prescrição.
--
-- Até este arquivo ser rodado, o app funciona como antes: o treinador vê um
-- aviso no construtor e o aluno troca exercício normalmente, só que o treino é
-- salvo sem o número de trocas (o app tenta de novo sem a coluna).
-- =============================================================================

alter table public.assigned_workout_exercises add column if not exists essential boolean not null default false;
alter table public.assigned_workout_exercises add column if not exists alternatives uuid[] not null default '{}';
alter table public.workout_template_exercises add column if not exists essential boolean not null default false;
alter table public.workout_template_exercises add column if not exists alternatives uuid[] not null default '{}';
alter table public.workout_sessions add column if not exists swaps smallint not null default 0;

-- "not valid": vale para o que for gravado daqui em diante (não trava o script
-- se o banco já tiver dados antigos).
alter table public.assigned_workout_exercises drop constraint if exists assigned_workout_exercises_alternatives_check;
alter table public.assigned_workout_exercises add constraint assigned_workout_exercises_alternatives_check
  check (cardinality(alternatives) <= 5) not valid;
alter table public.workout_template_exercises drop constraint if exists workout_template_exercises_alternatives_check;
alter table public.workout_template_exercises add constraint workout_template_exercises_alternatives_check
  check (cardinality(alternatives) <= 5) not valid;
alter table public.workout_sessions drop constraint if exists workout_sessions_swaps_check;
alter table public.workout_sessions add constraint workout_sessions_swaps_check
  check (swaps between 0 and 50) not valid;

comment on column public.assigned_workout_exercises.essential is
  'Exercício essencial: fica na versão curta e só troca por alternativa do treinador.';
comment on column public.assigned_workout_exercises.alternatives is
  'Até 5 exercícios (ids da biblioteca) aceitos no lugar deste.';
comment on column public.workout_template_exercises.essential is
  'Exercício essencial: fica na versão curta e só troca por alternativa do treinador.';
comment on column public.workout_template_exercises.alternatives is
  'Até 5 exercícios (ids da biblioteca) aceitos no lugar deste.';
comment on column public.workout_sessions.swaps is
  'Quantos exercícios o aluno trocou neste treino (só o número).';

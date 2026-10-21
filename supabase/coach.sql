-- =============================================================================
-- Team Jean — Ferramentas do treinador: notas privadas e desafios da equipe
-- =============================================================================
-- Como usar:
--   1. Rode antes o supabase/policies.sql (este arquivo usa public.is_admin()).
--   2. Supabase → SQL Editor → cole este arquivo → Run.
--   3. Pode ser rodado mais de uma vez (é idempotente), em qualquer ordem com
--      o community.sql e o profile.sql.
--
-- O que ele cria:
--   - coach_notes: anotações do treinador sobre cada aluno (lesões,
--     preferências, combinados). Só o treinador lê e escreve.
--   - challenges: desafios da equipe com período e meta (treinos, volume em
--     kg ou dias ativos). Todos leem; só o treinador cria, edita e apaga.
--   - challenge_standings(): placar do desafio calculado a partir dos treinos
--     concluídos no período. Devolve só nome, foto e progresso.
-- =============================================================================

-- A foto aparece no placar (mesma coluna do profile.sql).
alter table public.profiles add column if not exists avatar_path text;

-- -----------------------------------------------------------------------------
-- Notas do treinador
-- -----------------------------------------------------------------------------
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists coach_notes_student_idx
  on public.coach_notes (student_id, pinned desc, created_at desc);

alter table public.coach_notes enable row level security;

drop policy if exists "coach_notes: treinador lê" on public.coach_notes;
create policy "coach_notes: treinador lê" on public.coach_notes
  for select to authenticated
  using (public.is_admin());

drop policy if exists "coach_notes: treinador escreve" on public.coach_notes;
create policy "coach_notes: treinador escreve" on public.coach_notes
  for insert to authenticated
  with check (public.is_admin() and author_id = (select auth.uid()));

drop policy if exists "coach_notes: treinador edita" on public.coach_notes;
create policy "coach_notes: treinador edita" on public.coach_notes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "coach_notes: treinador apaga" on public.coach_notes;
create policy "coach_notes: treinador apaga" on public.coach_notes
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Desafios da equipe
-- -----------------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 60),
  description text check (description is null or char_length(description) <= 280),
  -- workouts = treinos concluídos; volume = kg × repetições; active_days = dias com treino
  metric text not null check (metric in ('workouts', 'volume', 'active_days')),
  goal numeric(12, 2) not null check (goal > 0 and goal <= 10000000),
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint challenges_period check (ends_on >= starts_on and ends_on <= starts_on + 180)
);

create index if not exists challenges_period_idx on public.challenges (ends_on desc, starts_on desc);

alter table public.challenges enable row level security;

drop policy if exists "challenges: logados leem" on public.challenges;
create policy "challenges: logados leem" on public.challenges
  for select to authenticated
  using (true);

drop policy if exists "challenges: treinador cria" on public.challenges;
create policy "challenges: treinador cria" on public.challenges
  for insert to authenticated
  with check (public.is_admin() and created_by = (select auth.uid()));

drop policy if exists "challenges: treinador edita" on public.challenges;
create policy "challenges: treinador edita" on public.challenges
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "challenges: treinador apaga" on public.challenges;
create policy "challenges: treinador apaga" on public.challenges
  for delete to authenticated
  using (public.is_admin());

-- Placar: progresso de cada aluno no período do desafio (horário de Brasília).
-- security definer para somar os treinos de todos, mas devolve só o necessário.
drop function if exists public.challenge_standings(uuid);
create function public.challenge_standings(p_challenge uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_path text,
  progress numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with challenge as (
    select
      c.metric,
      (c.starts_on::timestamp at time zone 'America/Sao_Paulo') as start_at,
      ((c.ends_on + 1)::timestamp at time zone 'America/Sao_Paulo') as end_at
    from public.challenges c
    where c.id = p_challenge
      and auth.uid() is not null
  ),
  sessions as (
    select s.id, s.student_id, s.completed_at
    from public.workout_sessions s
    cross join challenge c
    where s.status = 'completed'
      and s.completed_at >= c.start_at
      and s.completed_at < c.end_at
  ),
  volume as (
    select ss.session_id, sum(coalesce(ss.weight_kg, 0) * coalesce(ss.reps, 0)) as kg
    from public.session_sets ss
    join sessions s on s.id = ss.session_id
    where coalesce(ss.completed, true)
    group by ss.session_id
  )
  select
    p.id,
    coalesce(nullif(btrim(p.full_name), ''), 'Atleta'),
    p.avatar_path,
    case c.metric
      when 'workouts' then count(s.id)::numeric
      when 'active_days' then count(distinct (s.completed_at at time zone 'America/Sao_Paulo')::date)::numeric
      else coalesce(sum(v.kg), 0)::numeric
    end
  from public.profiles p
  cross join challenge c
  left join sessions s on s.student_id = p.id
  left join volume v on v.session_id = s.id
  where lower(btrim(p.role::text)) = 'student'
  group by p.id, p.full_name, p.avatar_path, c.metric
  order by 4 desc, 2;
$$;

revoke all on function public.challenge_standings(uuid) from public, anon;
grant execute on function public.challenge_standings(uuid) to authenticated;

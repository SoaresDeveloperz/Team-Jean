-- =============================================================================
-- Team Jean — segurança do banco (RLS)
-- =============================================================================
-- O app lê e grava direto no Supabase a partir do navegador. Quem garante que um
-- aluno não lê/edita dados de outro aluno (nem as telas de admin) é o RLS.
--
-- Como usar:
--   1. Supabase → SQL Editor → cole este arquivo → revise → Run.
--   2. O script pode ser rodado mais de uma vez (é idempotente).
--   3. Políticas permissivas se SOMAM (OR). Se o projeto já tiver políticas
--      amplas (ex.: "Enable read access for all users"), apague-as em
--      Authentication → Policies, senão estas não terão efeito.
--   4. Para promover um treinador:
--        update public.profiles set role = 'admin' where email = 'jean@...';
--
-- Recomendado também: Authentication → Sign In / Providers → desligar
-- "Allow new users to sign up". Os alunos são criados pelo painel do treinador
-- (Server Action com service_role), então o cadastro público não é necessário.
-- =============================================================================

-- O usuário atual é admin? (security definer evita recursão no RLS de profiles)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(trim(role::text)) = 'admin'
  );
$$;

-- Todo perfil novo nasce como aluno, mesmo que alguém envie role = 'admin' no
-- user_metadata do cadastro (o trigger de signup costuma copiar esse campo).
create or replace function public.force_student_role_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.role := 'student';
  return new;
end;
$$;

drop trigger if exists force_student_role_on_insert on public.profiles;
create trigger force_student_role_on_insert
  before insert on public.profiles
  for each row execute function public.force_student_role_on_insert();

-- Só admin muda papel. Requisições sem usuário (SQL Editor, service_role)
-- continuam podendo promover treinadores.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Somente administradores podem alterar o papel de um usuário';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles: ler o próprio ou admin" on public.profiles;
create policy "profiles: ler o próprio ou admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "profiles: editar o próprio ou admin" on public.profiles;
create policy "profiles: editar o próprio ou admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

drop policy if exists "profiles: admin cria e apaga" on public.profiles;
create policy "profiles: admin cria e apaga" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- exercises (biblioteca): todos leem, só admin altera
-- -----------------------------------------------------------------------------
alter table public.exercises enable row level security;

drop policy if exists "exercises: logados leem" on public.exercises;
create policy "exercises: logados leem" on public.exercises
  for select to authenticated
  using (true);

drop policy if exists "exercises: admin altera" on public.exercises;
create policy "exercises: admin altera" on public.exercises
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- assigned_workouts / assigned_workout_exercises: aluno lê os seus, admin tudo
-- -----------------------------------------------------------------------------
alter table public.assigned_workouts enable row level security;

drop policy if exists "assigned_workouts: aluno lê os seus" on public.assigned_workouts;
create policy "assigned_workouts: aluno lê os seus" on public.assigned_workouts
  for select to authenticated
  using (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "assigned_workouts: admin altera" on public.assigned_workouts;
create policy "assigned_workouts: admin altera" on public.assigned_workouts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.assigned_workout_exercises enable row level security;

drop policy if exists "assigned_workout_exercises: aluno lê os seus" on public.assigned_workout_exercises;
create policy "assigned_workout_exercises: aluno lê os seus" on public.assigned_workout_exercises
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.assigned_workouts w
      where w.id = assigned_workout_id and w.student_id = (select auth.uid())
    )
  );

drop policy if exists "assigned_workout_exercises: admin altera" on public.assigned_workout_exercises;
create policy "assigned_workout_exercises: admin altera" on public.assigned_workout_exercises
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- workout_templates / workout_template_exercises: só admin
-- -----------------------------------------------------------------------------
alter table public.workout_templates enable row level security;

drop policy if exists "workout_templates: só admin" on public.workout_templates;
create policy "workout_templates: só admin" on public.workout_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.workout_template_exercises enable row level security;

drop policy if exists "workout_template_exercises: só admin" on public.workout_template_exercises;
create policy "workout_template_exercises: só admin" on public.workout_template_exercises
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- workout_sessions: aluno cria/lê/atualiza as próprias sessões
-- -----------------------------------------------------------------------------
alter table public.workout_sessions enable row level security;

drop policy if exists "workout_sessions: aluno lê as suas" on public.workout_sessions;
create policy "workout_sessions: aluno lê as suas" on public.workout_sessions
  for select to authenticated
  using (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "workout_sessions: aluno cria as suas" on public.workout_sessions;
create policy "workout_sessions: aluno cria as suas" on public.workout_sessions
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.assigned_workouts w
      where w.id = assigned_workout_id and w.student_id = (select auth.uid())
    )
  );

drop policy if exists "workout_sessions: aluno atualiza as suas" on public.workout_sessions;
create policy "workout_sessions: aluno atualiza as suas" on public.workout_sessions
  for update to authenticated
  using (student_id = (select auth.uid()) or public.is_admin())
  with check (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "workout_sessions: admin apaga" on public.workout_sessions;
create policy "workout_sessions: admin apaga" on public.workout_sessions
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- session_sets: séries das sessões do próprio aluno
-- -----------------------------------------------------------------------------
alter table public.session_sets enable row level security;

drop policy if exists "session_sets: aluno gerencia as suas" on public.session_sets;
create policy "session_sets: aluno gerencia as suas" on public.session_sets
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.student_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.student_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- notifications: aluno lê os próprios avisos, admin envia
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "notifications: aluno lê os seus" on public.notifications;
create policy "notifications: aluno lê os seus" on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()) or public.is_admin());

drop policy if exists "notifications: admin envia" on public.notifications;
create policy "notifications: admin envia" on public.notifications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

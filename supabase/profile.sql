-- =============================================================================
-- Team Jean — Perfil (foto, capa, bio, objetivo) e medidas corporais
-- =============================================================================
-- Como usar:
--   1. Rode antes o supabase/policies.sql (este arquivo usa public.is_admin()).
--   2. Supabase → SQL Editor → cole este arquivo → Run.
--   3. Pode ser rodado mais de uma vez (é idempotente), antes ou depois do
--      supabase/community.sql.
--
-- O que ele cria:
--   - Colunas novas em profiles: avatar_path, cover_path, bio, goal, instagram.
--     O aluno já pode editar o próprio perfil (policies.sql); as restrições
--     abaixo garantem que foto e capa apontem só para a pasta dele.
--   - Bucket público "avatars" (foto e capa): cada um envia só na própria pasta.
--   - Tabela body_measurements (peso, % de gordura, cintura, perímetros,
--     dobras cutâneas e fotos de evolução). Só o aluno e o treinador veem; o
--     treinador também registra.
--   - Bucket privado "progress" para as fotos de evolução (aluno e treinador).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists cover_path text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists goal text;
alter table public.profiles add column if not exists instagram text;

alter table public.profiles drop constraint if exists profiles_avatar_path_check;
alter table public.profiles add constraint profiles_avatar_path_check
  check (avatar_path is null or avatar_path like (id::text || '/%'));

alter table public.profiles drop constraint if exists profiles_cover_path_check;
alter table public.profiles add constraint profiles_cover_path_check
  check (cover_path is null or cover_path like (id::text || '/%'));

alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check
  check (bio is null or char_length(bio) <= 160);

alter table public.profiles drop constraint if exists profiles_goal_check;
alter table public.profiles add constraint profiles_goal_check
  check (goal is null or goal in ('hipertrofia', 'emagrecimento', 'forca', 'condicionamento', 'saude'));

alter table public.profiles drop constraint if exists profiles_instagram_check;
alter table public.profiles add constraint profiles_instagram_check
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- -----------------------------------------------------------------------------
-- Foto e capa: bucket público "avatars", uma pasta por usuário ({user_id}/...)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: dono vê os seus" on storage.objects;
create policy "avatars: dono vê os seus" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: dono envia" on storage.objects;
create policy "avatars: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: dono atualiza" on storage.objects;
create policy "avatars: dono atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: dono apaga" on storage.objects;
create policy "avatars: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- Medidas corporais
-- -----------------------------------------------------------------------------
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 20 and 400),
  body_fat numeric(4, 1) check (body_fat is null or body_fat between 2 and 70),
  waist_cm numeric(5, 1) check (waist_cm is null or waist_cm between 30 and 250),
  -- Caminhos no bucket "progress" (fotos de evolução, no máximo 3).
  photos text[] not null default '{}' check (cardinality(photos) <= 3),
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  constraint body_measurements_has_data check (
    weight_kg is not null or body_fat is not null or waist_cm is not null or cardinality(photos) > 0
  )
);

create index if not exists body_measurements_user_idx
  on public.body_measurements (user_id, measured_on desc, created_at desc);

-- Avaliação física completa: perímetros, dobras cutâneas e protocolo do %
-- de gordura (mesma definição do gestao.sql, para rodarem em qualquer ordem).
alter table public.body_measurements add column if not exists perimeters jsonb;
alter table public.body_measurements add column if not exists skinfolds jsonb;
alter table public.body_measurements add column if not exists protocol text;

alter table public.body_measurements drop constraint if exists body_measurements_perimeters_check;
alter table public.body_measurements add constraint body_measurements_perimeters_check
  check (perimeters is null or (jsonb_typeof(perimeters) = 'object' and octet_length(perimeters::text) <= 2000));
alter table public.body_measurements drop constraint if exists body_measurements_skinfolds_check;
alter table public.body_measurements add constraint body_measurements_skinfolds_check
  check (skinfolds is null or (jsonb_typeof(skinfolds) = 'object' and octet_length(skinfolds::text) <= 1000));
alter table public.body_measurements drop constraint if exists body_measurements_protocol_check;
alter table public.body_measurements add constraint body_measurements_protocol_check
  check (protocol is null or protocol in ('pollock3', 'pollock7'));

alter table public.body_measurements drop constraint if exists body_measurements_has_data;
alter table public.body_measurements add constraint body_measurements_has_data check (
  weight_kg is not null or body_fat is not null or waist_cm is not null or cardinality(photos) > 0
  or perimeters is not null or skinfolds is not null
);

alter table public.body_measurements enable row level security;

drop policy if exists "body_measurements: aluno e treinador leem" on public.body_measurements;
create policy "body_measurements: aluno e treinador leem" on public.body_measurements
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "body_measurements: aluno e treinador registram" on public.body_measurements;
create policy "body_measurements: aluno e treinador registram" on public.body_measurements
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "body_measurements: aluno e treinador corrigem" on public.body_measurements;
create policy "body_measurements: aluno e treinador corrigem" on public.body_measurements
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "body_measurements: aluno e treinador apagam" on public.body_measurements;
create policy "body_measurements: aluno e treinador apagam" on public.body_measurements
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- Fotos de evolução: bucket privado "progress" ({user_id}/...), aluno e treinador
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress', 'progress', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "progress: aluno e treinador veem" on storage.objects;
create policy "progress: aluno e treinador veem" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

drop policy if exists "progress: aluno e treinador enviam" on storage.objects;
create policy "progress: aluno e treinador enviam" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

drop policy if exists "progress: aluno e treinador apagam" on storage.objects;
create policy "progress: aluno e treinador apagam" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

-- -----------------------------------------------------------------------------
-- Ranking da comunidade com a foto de perfil (mesma definição do
-- community.sql, para os dois arquivos poderem rodar em qualquer ordem)
-- -----------------------------------------------------------------------------
drop function if exists public.community_members();
create function public.community_members()
returns table (
  id uuid,
  full_name text,
  role text,
  avatar_path text,
  total_workouts bigint,
  week_workouts bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), 'Atleta'),
    lower(trim(p.role::text)),
    p.avatar_path,
    count(s.id) filter (where s.status = 'completed'),
    count(s.id) filter (
      where s.status = 'completed'
        and s.completed_at >= (date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
    )
  from public.profiles p
  left join public.workout_sessions s on s.student_id = p.id
  where auth.uid() is not null
  group by p.id, p.full_name, p.role, p.avatar_path;
$$;

revoke all on function public.community_members() from public, anon;
grant execute on function public.community_members() to authenticated;

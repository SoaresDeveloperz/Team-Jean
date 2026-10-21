-- Partes do Supabase que os scripts usam (auth, storage, papéis e tabelas do app).
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated, anon;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant usage on schema storage to authenticated, anon;
grant all on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

alter default privileges in schema public grant all on tables to authenticated, anon;
grant usage on schema public to authenticated, anon;
create table public.profiles (id uuid primary key, role text, full_name text, email text, readiness_score int, created_at timestamptz default now());
create table public.exercises (id uuid primary key default gen_random_uuid(), name text, muscle_group text, video_url text);
create table public.assigned_workouts (id uuid primary key default gen_random_uuid(), student_id uuid references public.profiles (id), name text, is_current boolean default true, created_at timestamptz default now());
create table public.assigned_workout_exercises (id uuid primary key default gen_random_uuid(), assigned_workout_id uuid references public.assigned_workouts (id), exercise_id uuid, "order" int, sets_count int, target_reps text, planned_sets jsonb, notes text);
create table public.workout_templates (id uuid primary key default gen_random_uuid(), name text);
create table public.workout_template_exercises (id uuid primary key default gen_random_uuid(), template_id uuid, exercise_id uuid, "order" int, sets_count int, target_reps text, planned_sets jsonb, notes text);
create table public.workout_sessions (id uuid primary key default gen_random_uuid(), assigned_workout_id uuid, student_id uuid references public.profiles (id), status text, completed_at timestamptz, session_rpe int);
create table public.session_sets (id uuid primary key default gen_random_uuid(), session_id uuid, exercise_id uuid, assigned_exercise_id uuid, set_number int, weight_kg numeric, reps int, rir int, set_type text, completed boolean);
-- Sem created_at: o banco real pode não ter a coluna (o gestao.sql cria).
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid, type text, title text, message text);
-- Aviso que já existia antes do gestao.sql (não pode virar push).
insert into public.notifications (recipient_id, type, title, message) values (gen_random_uuid(), 'announcement', 'Aviso antigo', 'antes do push');

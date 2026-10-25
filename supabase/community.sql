-- =============================================================================
-- Team Jean — Comunidade (posts com fotos, fogo, comentários e ranking)
-- =============================================================================
-- Como usar:
--   1. Rode antes o supabase/policies.sql (este arquivo usa public.is_admin()).
--   2. Supabase → SQL Editor → cole este arquivo → Run.
--   3. Pode ser rodado mais de uma vez (é idempotente).
--
-- O que ele cria:
--   - community_posts, community_likes e community_comments, com RLS:
--     todo usuário logado (alunos e treinador) lê; cada um publica, curte e
--     comenta como ele mesmo; o autor apaga o que é dele; o treinador apaga
--     qualquer coisa e fixa posts no topo.
--   - Bucket privado "community" para as fotos (cada um envia só na própria
--     pasta; o app mostra as fotos com links temporários). Cada post só aponta
--     para fotos da pasta do próprio autor.
--   - community_members(): nomes e contagem de treinos para o ranking da
--     semana e os níveis, sem expor e-mails nem dados de treino detalhados.
--   - Aviso no sino do aluno quando alguém comenta no post dele.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- Preenchidos pelo trigger a partir de profiles (o cliente não escolhe).
  author_name text,
  author_role text,
  -- post: texto/fotos; workout: treino concluído; achievement: conquista.
  kind text not null default 'post' check (kind in ('post', 'workout', 'achievement')),
  body text check (body is null or char_length(body) <= 2000),
  -- Caminhos no bucket "community" (no máximo 4 fotos).
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  -- Resumo do treino ou da conquista compartilhada.
  meta jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists community_posts_feed_idx
  on public.community_posts (pinned desc, created_at desc);

-- -----------------------------------------------------------------------------
-- Fotos só da pasta do dono: cada caminho em photos começa com "<id do dono>/"
-- (mesma definição no community.sql e no profile.sql, para rodarem em qualquer
-- ordem). As restrições usam "not valid": linhas antigas não travam o script,
-- só o que for gravado daqui em diante é conferido.
-- -----------------------------------------------------------------------------
create or replace function public.paths_in_folder(paths text[], folder uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(
    starts_with(p, folder::text || '/')
    and char_length(p) > char_length(folder::text) + 1
    and position('..' in p) = 0
  ), true)
  from unnest(coalesce(paths, '{}'::text[])) as p;
$$;

revoke all on function public.paths_in_folder(text[], uuid) from public, anon;
grant execute on function public.paths_in_folder(text[], uuid) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.paths_in_folder(text[], uuid) to service_role;
  end if;
end $$;

-- O autor é sempre quem está logado (gatilho abaixo), então as fotos do post
-- só podem ser da pasta dele no bucket "community".
alter table public.community_posts drop constraint if exists community_posts_photos_folder_check;
alter table public.community_posts add constraint community_posts_photos_folder_check
  check (public.paths_in_folder(photos, author_id)) not valid;

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text,
  author_role text,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at);

-- -----------------------------------------------------------------------------
-- Autor sempre é quem está logado; nome e papel vêm de profiles
-- -----------------------------------------------------------------------------
create or replace function public.community_set_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;
  select coalesce(nullif(trim(full_name), ''), 'Atleta'), lower(trim(role::text))
    into new.author_name, new.author_role
    from public.profiles
   where id = new.author_id;
  return new;
end;
$$;

-- Funções de gatilho disparam sem o EXECUTE de quem grava; tirar o EXECUTE só
-- impede chamá-las pela API (/rest/v1/rpc).
revoke execute on function public.community_set_author() from public, anon, authenticated;

drop trigger if exists community_posts_set_author on public.community_posts;
create trigger community_posts_set_author
  before insert on public.community_posts
  for each row execute function public.community_set_author();

drop trigger if exists community_comments_set_author on public.community_comments;
create trigger community_comments_set_author
  before insert on public.community_comments
  for each row execute function public.community_set_author();

-- Aviso no sino quando alguém comenta no post de outra pessoa. Se o aviso
-- falhar (ex.: restrição em notifications.type), o comentário vale do mesmo jeito.
create or replace function public.community_notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.community_posts where id = new.post_id;
  if post_author is not null and post_author <> new.author_id then
    begin
      insert into public.notifications (recipient_id, type, title, message)
      values (
        post_author,
        'community',
        'Novo comentário 💬',
        coalesce(new.author_name, 'Alguém') || ': ' || left(new.body, 140)
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

revoke execute on function public.community_notify_comment() from public, anon, authenticated;

drop trigger if exists community_comments_notify on public.community_comments;
create trigger community_comments_notify
  after insert on public.community_comments
  for each row execute function public.community_notify_comment();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;

-- Posts
drop policy if exists "community_posts: membros leem" on public.community_posts;
create policy "community_posts: membros leem" on public.community_posts
  for select to authenticated
  using (true);

drop policy if exists "community_posts: membro publica" on public.community_posts;
create policy "community_posts: membro publica" on public.community_posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and (pinned = false or public.is_admin()));

drop policy if exists "community_posts: treinador fixa" on public.community_posts;
create policy "community_posts: treinador fixa" on public.community_posts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "community_posts: autor ou treinador apaga" on public.community_posts;
create policy "community_posts: autor ou treinador apaga" on public.community_posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- Fogo (curtidas)
drop policy if exists "community_likes: membros leem" on public.community_likes;
create policy "community_likes: membros leem" on public.community_likes
  for select to authenticated
  using (true);

drop policy if exists "community_likes: membro curte" on public.community_likes;
create policy "community_likes: membro curte" on public.community_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "community_likes: membro descurte" on public.community_likes;
create policy "community_likes: membro descurte" on public.community_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Comentários
drop policy if exists "community_comments: membros leem" on public.community_comments;
create policy "community_comments: membros leem" on public.community_comments
  for select to authenticated
  using (true);

drop policy if exists "community_comments: membro comenta" on public.community_comments;
create policy "community_comments: membro comenta" on public.community_comments
  for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "community_comments: autor ou treinador apaga" on public.community_comments;
create policy "community_comments: autor ou treinador apaga" on public.community_comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- Fotos: bucket privado "community", uma pasta por usuário ({user_id}/arquivo)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community: membros veem fotos" on storage.objects;
create policy "community: membros veem fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'community');

drop policy if exists "community: membro envia na própria pasta" on storage.objects;
create policy "community: membro envia na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "community: dono ou treinador apaga foto" on storage.objects;
create policy "community: dono ou treinador apaga foto" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

-- -----------------------------------------------------------------------------
-- Membros para o ranking e os níveis: só nome, papel, foto e contagem de treinos
-- (mesma definição do profile.sql, para os dois rodarem em qualquer ordem)
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_path text;

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

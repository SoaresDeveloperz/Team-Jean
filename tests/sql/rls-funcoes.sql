\set QUIET on
-- Permissões das funções (avisos de segurança do Supabase): gatilhos não são
-- chamados pela API, is_admin só para quem está logado, search_path fixo. E os
-- gatilhos continuam disparando para aluno e treinador sem o EXECUTE.
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', 'Carlos Lima', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- ------------------------------------------------------------------ permissões
do $$
declare fn text; r record; n int;
begin
  foreach fn in array array[
    'public.anamneses_notify()', 'public.anamneses_prepare()', 'public.touch_updated_at()',
    'public.notify_workout_feedback()', 'public.protect_coach_reply()',
    'public.community_notify_comment()', 'public.community_set_author()',
    'public.force_student_role_on_insert()', 'public.protect_profile_role()',
    'public.handle_new_user()', 'public.rls_auto_enable()'
  ] loop
    if not has_function_privilege('anon', fn, 'execute') and not has_function_privilege('authenticated', fn, 'execute')
      then raise notice 'OK  % não é chamada pela API (anon e authenticated)', fn;
      else raise notice 'FALHOU: % executável (anon %, authenticated %)', fn,
        has_function_privilege('anon', fn, 'execute'), has_function_privilege('authenticated', fn, 'execute'); end if;
  end loop;

  if has_function_privilege('authenticated', 'public.is_admin()', 'execute') and not has_function_privilege('anon', 'public.is_admin()', 'execute')
    then raise notice 'OK  is_admin: authenticated executa, anon não';
    else raise notice 'FALHOU: is_admin (authenticated %, anon %)',
      has_function_privilege('authenticated', 'public.is_admin()', 'execute'), has_function_privilege('anon', 'public.is_admin()', 'execute'); end if;

  foreach fn in array array['public.challenge_standings(uuid)', 'public.community_members()'] loop
    if has_function_privilege('authenticated', fn, 'execute') and not has_function_privilege('anon', fn, 'execute')
      then raise notice 'OK  % continua: authenticated executa, anon não', fn;
      else raise notice 'FALHOU: % (authenticated %, anon %)', fn,
        has_function_privilege('authenticated', fn, 'execute'), has_function_privilege('anon', fn, 'execute'); end if;
  end loop;

  -- Trava para o futuro: nenhuma função do app (fora as de extensões) sem
  -- search_path fixo, nenhum gatilho executável pela API e nada para anon.
  for r in
    select p.oid::regprocedure as sig, p.prorettype::regtype::text as rettype, p.proconfig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    if not exists (select 1 from unnest(coalesce(r.proconfig, '{}')) c where c like 'search_path=%') then
      raise notice 'FALHOU: % sem search_path fixo', r.sig;
    end if;
    if r.rettype in ('trigger', 'event_trigger') and (has_function_privilege('anon', r.sig, 'execute') or has_function_privilege('authenticated', r.sig, 'execute')) then
      raise notice 'FALHOU: gatilho % executável pela API', r.sig;
    end if;
    if has_function_privilege('anon', r.sig, 'execute') then
      raise notice 'FALHOU: anon executa %', r.sig;
    end if;
  end loop;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e');
  raise notice 'OK  % funções do app conferidas (search_path, gatilhos, anon)', n;

  if (select 'search_path=public' = any (proconfig) from pg_proc where oid = 'public.handle_new_user()'::regprocedure)
     and (select 'search_path=public' = any (proconfig) from pg_proc where oid = 'public.touch_updated_at()'::regprocedure)
     and (select 'search_path=public' = any (proconfig) from pg_proc where oid = 'public.anamneses_prepare()'::regprocedure)
    then raise notice 'OK  handle_new_user, touch_updated_at e anamneses_prepare com search_path = public';
    else raise notice 'FALHOU: search_path das funções do aviso'; end if;
end $$;

-- ------------------------------------------------------------------ cadastro
-- O gatilho do painel (handle_new_user) continua criando o perfil, sempre aluno.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000003', 'novo@x', '{"full_name": "Ana Nova", "role": "admin"}');
do $$
declare v record;
begin
  select * into v from public.profiles where id = '00000000-0000-0000-0000-000000000003';
  if v.full_name = 'Ana Nova' and v.role = 'student' then raise notice 'OK  cadastro cria o perfil como aluno (handle_new_user)';
  else raise notice 'FALHOU: cadastro criou % / %', v.full_name, v.role; end if;
end $$;

-- O cadastro de verdade é gravado pelo GoTrue (supabase_auth_admin): não é
-- superusuário e não tem EXECUTE nos gatilhos. O perfil tem que nascer igual.
set role supabase_auth_admin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000004', 'bia@x', '{"full_name": "Bia Nova", "role": "admin"}'),
  ('00000000-0000-0000-0000-000000000005', 'sem-dados@x', '{}');
reset role;
do $$
declare v record;
begin
  if not has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'execute')
     and not has_function_privilege('supabase_auth_admin', 'public.force_student_role_on_insert()', 'execute')
     and not (select rolsuper from pg_roles where rolname = 'supabase_auth_admin')
    then raise notice 'OK  o papel do cadastro não é superusuário e não executa os gatilhos';
    else raise notice 'FALHOU: o papel do cadastro tem privilégios demais para provar algo'; end if;
  select * into v from public.profiles where id = '00000000-0000-0000-0000-000000000004';
  if v.full_name = 'Bia Nova' and v.role = 'student' then raise notice 'OK  cadastro sem privilégios cria o perfil como aluno';
  else raise notice 'FALHOU: cadastro sem privilégios criou % / %', v.full_name, v.role; end if;
  select * into v from public.profiles where id = '00000000-0000-0000-0000-000000000005';
  if v.id is not null and v.role = 'student' then raise notice 'OK  cadastro sem dados extras também cria o perfil';
  else raise notice 'FALHOU: cadastro sem dados extras não criou o perfil (%)', v.role; end if;
end $$;

-- ------------------------------------------------------------------ aluna
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare v record; n int;
begin
  begin
    perform public.touch_updated_at();
    raise notice 'FALHOU: aluna chamou gatilho direto';
  exception when insufficient_privilege then raise notice 'OK  aluna não chama gatilho direto (%)', sqlerrm;
  end;
  if not public.is_admin() then raise notice 'OK  aluna chama is_admin (falso)'; else raise notice 'FALHOU: aluna é admin'; end if;

  -- protect_profile_role dispara
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
    raise notice 'FALHOU: aluna virou admin';
  exception when others then raise notice 'OK  gatilho de papel dispara para a aluna (%)', sqlerrm;
  end;
  -- community_set_author dispara
  insert into public.community_posts (author_id, author_name, body) values ('00000000-0000-0000-0000-000000000002', 'Hacker', 'oi equipe') returning * into v;
  if v.author_id = '00000000-0000-0000-0000-000000000001' and v.author_name = 'Maria Souza'
    then raise notice 'OK  gatilho de autor dispara para a aluna';
    else raise notice 'FALHOU: autor % / %', v.author_id, v.author_name; end if;
  -- anamneses_prepare e anamneses_notify disparam
  insert into public.anamneses (student_id, answers, parq_positive, updated_at)
  values ('00000000-0000-0000-0000-000000000001', '{"parq": {"heart": true}}', false, '2000-01-01')
  returning * into v;
  if v.parq_positive and v.updated_at > now() - interval '1 minute'
    then raise notice 'OK  gatilho da ficha de saúde dispara para a aluna';
    else raise notice 'FALHOU: ficha (parq %, updated_at %)', v.parq_positive, v.updated_at; end if;
end $$;

-- ------------------------------------------------------------ outro aluno comenta
-- Comentário no post da Maria ("oi equipe", criado acima): o autor vem do login
-- (community_set_author) e a autora do post é avisada (community_notify_comment).
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare v record; n int;
begin
  insert into public.community_comments (post_id, author_id, author_name, body)
  select id, '00000000-0000-0000-0000-000000000001'::uuid, 'Hacker', 'Mandou bem!' from public.community_posts where body = 'oi equipe'
  returning * into v;
  if v.author_id = '00000000-0000-0000-0000-000000000002' and v.author_name = 'Carlos Lima'
    then raise notice 'OK  gatilho de autor dispara no comentário do aluno';
    else raise notice 'FALHOU: autor do comentário % / %', v.author_id, v.author_name; end if;
  select count(*) into n from public.notifications;
  if n = 0 then raise notice 'OK  quem comenta não vê o aviso da autora'; else raise notice 'FALHOU: aluno viu % avisos alheios', n; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int;
begin
  select count(*) into n from public.notifications
   where recipient_id = '00000000-0000-0000-0000-000000000001' and type = 'community'
     and title like 'Novo comentário%' and message = 'Carlos Lima: Mandou bem!';
  if n = 1 then raise notice 'OK  gatilho do aviso de comentário dispara: a autora do post é avisada';
  else raise notice 'FALHOU: avisos do comentário = %', n; end if;
  -- comentar no próprio post não avisa ninguém
  insert into public.community_comments (post_id, body) select id, 'Valeu, Carlos!' from public.community_posts where body = 'oi equipe';
  select count(*) into n from public.notifications where recipient_id = '00000000-0000-0000-0000-000000000001' and type = 'community';
  if n = 1 then raise notice 'OK  comentar no próprio post não gera aviso'; else raise notice 'FALHOU: avisos depois do próprio comentário = %', n; end if;
end $$;

-- ------------------------------------------------------------------ treinador
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare v record; n int;
begin
  if public.is_admin() then raise notice 'OK  treinador chama is_admin (verdadeiro)'; else raise notice 'FALHOU: treinador não é admin'; end if;
  select count(*) into n from public.notifications where recipient_id = '00000000-0000-0000-0000-00000000000a';
  if n >= 1 then raise notice 'OK  aviso da ficha chegou ao treinador'; else raise notice 'FALHOU: sem aviso da ficha'; end if;
  -- touch_updated_at dispara (no update)
  insert into public.student_billing (student_id, monthly_fee, due_day, updated_at)
  values ('00000000-0000-0000-0000-000000000001', 150, 10, '2000-01-01');
  update public.student_billing set monthly_fee = 160 where student_id = '00000000-0000-0000-0000-000000000001' returning * into v;
  if v.updated_at > now() - interval '1 minute' then raise notice 'OK  gatilho de updated_at dispara para o treinador';
  else raise notice 'FALHOU: updated_at %', v.updated_at; end if;
end $$;

-- ------------------------------------------------------------------ anon
reset role;
set role anon;
do $$
begin
  perform public.is_admin();
  raise notice 'FALHOU: anônimo chamou is_admin';
exception when insufficient_privilege then raise notice 'OK  anônimo não chama is_admin';
end $$;
do $$
begin
  perform public.handle_new_user();
  raise notice 'FALHOU: anônimo chamou handle_new_user';
exception when insufficient_privilege then raise notice 'OK  anônimo não chama handle_new_user';
end $$;
reset role;

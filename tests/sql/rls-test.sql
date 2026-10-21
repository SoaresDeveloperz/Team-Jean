\set QUIET on
-- Seed (superusuário): o trigger força 'student' no insert; promovemos o treinador depois.
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', '  ', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into public.workout_sessions (student_id, status, completed_at) values
  ('00000000-0000-0000-0000-000000000001', 'completed', now()),
  ('00000000-0000-0000-0000-000000000001', 'completed', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-000000000001', 'completed', now() - interval '9 days'),
  ('00000000-0000-0000-0000-000000000001', 'in_progress', null);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare v record; n int;
begin
  -- aluno não fixa post
  begin
    insert into public.community_posts (body, pinned) values ('quero fixar', true);
    raise notice 'FALHOU: aluno fixou post';
  exception when others then raise notice 'OK  aluno não consegue fixar (%)', sqlerrm;
  end;
  -- autor forjado vira o próprio usuário
  insert into public.community_posts (author_id, author_name, body) values ('00000000-0000-0000-0000-000000000002', 'Hacker', 'post da Maria') returning * into v;
  if v.author_id = '00000000-0000-0000-0000-000000000001' and v.author_name = 'Maria Souza' and v.author_role = 'student'
    then raise notice 'OK  autor e nome vêm do login/perfil (%/%)', v.author_name, v.author_role;
    else raise notice 'FALHOU: autor % nome %', v.author_id, v.author_name; end if;
  -- limites
  begin insert into public.community_posts (body) values (repeat('x', 2001)); raise notice 'FALHOU: texto > 2000';
  exception when others then raise notice 'OK  texto acima de 2000 recusado'; end;
  begin insert into public.community_posts (photos) values (array['a','b','c','d','e']); raise notice 'FALHOU: 5 fotos';
  exception when others then raise notice 'OK  mais de 4 fotos recusado'; end;
  begin insert into public.community_posts (kind) values ('spam'); raise notice 'FALHOU: tipo inválido';
  exception when others then raise notice 'OK  tipo inválido recusado'; end;
  insert into public.community_posts (body) values ('vou apagar');
  -- fotos: só na própria pasta
  insert into storage.objects (bucket_id, name) values ('community', '00000000-0000-0000-0000-000000000001/foto.jpg');
  raise notice 'OK  envia foto na própria pasta';
  begin
    insert into storage.objects (bucket_id, name) values ('community', '00000000-0000-0000-0000-000000000002/foto.jpg');
    raise notice 'FALHOU: enviou foto na pasta de outro';
  exception when others then raise notice 'OK  não envia na pasta de outro (%)', sqlerrm;
  end;
  -- ranking
  select * into v from public.community_members() where id = '00000000-0000-0000-0000-000000000001';
  if v.total_workouts = 3 and v.week_workouts = 2 then raise notice 'OK  ranking: Maria 3 treinos, 2 na semana';
  else raise notice 'FALHOU ranking: % / %', v.total_workouts, v.week_workouts; end if;
  select count(*) into n from public.community_members();
  raise notice 'OK  community_members devolve % membros', n;
  select * into v from public.community_members() where id = '00000000-0000-0000-0000-000000000002';
  raise notice '    nome vazio vira: "%"', v.full_name;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int; post uuid; c uuid;
begin
  select id into post from public.community_posts where body = 'post da Maria';
  -- outro aluno não fixa nem apaga post alheio
  update public.community_posts set pinned = true where id = post;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  outro aluno não fixa post alheio'; else raise notice 'FALHOU: aluno fixou post alheio'; end if;
  delete from public.community_posts where id = post;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  outro aluno não apaga post alheio'; else raise notice 'FALHOU: apagou post alheio'; end if;
  -- curtir como ele mesmo; não como outro
  insert into public.community_likes (post_id, user_id) values (post, '00000000-0000-0000-0000-000000000002');
  raise notice 'OK  curte como ele mesmo';
  begin
    insert into public.community_likes (post_id, user_id) values (post, '00000000-0000-0000-0000-000000000001');
    raise notice 'FALHOU: curtiu em nome de outro';
  exception when others then raise notice 'OK  não curte em nome de outro';
  end;
  begin
    insert into public.community_likes (post_id, user_id) values (post, '00000000-0000-0000-0000-000000000002');
    raise notice 'FALHOU: curtiu duas vezes';
  exception when others then raise notice 'OK  não curte duas vezes';
  end;
  -- comentar gera aviso para a autora
  insert into public.community_comments (post_id, body) values (post, 'Mandou bem!') returning id into c;
  raise notice 'OK  comentou (autor Atleta por nome vazio)';
  begin insert into public.community_comments (post_id, body) values (post, '   '); raise notice 'FALHOU: comentário vazio';
  exception when others then raise notice 'OK  comentário vazio recusado'; end;
  -- apagar foto de outro
  delete from storage.objects where name like '00000000-0000-0000-0000-000000000001/%';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  não apaga foto de outro'; else raise notice 'FALHOU: apagou foto de outro'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; post uuid;
begin
  select id into post from public.community_posts where body = 'post da Maria';
  -- comentar no próprio post não gera aviso
  insert into public.community_comments (post_id, body) values (post, 'Valeu!');
  -- aluno apaga o próprio post
  delete from public.community_posts where body = 'vou apagar';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  autora apaga o próprio post'; else raise notice 'FALHOU: não apagou o próprio'; end if;
  -- não apaga comentário de outro
  delete from public.community_comments where body = 'Mandou bem!';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  não apaga comentário de outro'; else raise notice 'FALHOU: apagou comentário de outro'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  update public.community_posts set pinned = true where body = 'post da Maria';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  treinador fixa post'; else raise notice 'FALHOU: treinador não fixou'; end if;
  insert into public.community_posts (body, pinned) values ('aviso fixado', true);
  raise notice 'OK  treinador publica já fixado';
  delete from public.community_comments where body = 'Mandou bem!';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  treinador apaga comentário'; else raise notice 'FALHOU: treinador não apagou comentário'; end if;
  delete from storage.objects where bucket_id = 'community';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  treinador apaga foto'; else raise notice 'FALHOU: treinador apagou % fotos', n; end if;
end $$;

-- visitante sem login
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  perform * from public.community_members();
  raise notice 'FALHOU: anon executou community_members';
exception when others then raise notice 'OK  anon não executa community_members (%)', sqlerrm;
end $$;
reset role;

\echo '--- avisos gerados (superusuário) ---'
select recipient_id, type, title, message from public.notifications;
\echo '--- autores ---'
select author_name, author_role, pinned, body from public.community_posts order by created_at;

\set QUIET on
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', 'Carlos Lima', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; v record;
begin
  update public.profiles set avatar_path = '00000000-0000-0000-0000-000000000001/avatar-1.jpg', bio = 'Foco total', goal = 'hipertrofia', instagram = 'maria.fit'
   where id = '00000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  aluna salva foto, bio, objetivo e Instagram'; else raise notice 'FALHOU: não salvou perfil'; end if;
  begin update public.profiles set avatar_path = '00000000-0000-0000-0000-000000000002/avatar.jpg' where id = '00000000-0000-0000-0000-000000000001';
    raise notice 'FALHOU: foto apontando para pasta de outro';
  exception when others then raise notice 'OK  foto só da própria pasta (%)', sqlerrm; end;
  begin update public.profiles set goal = 'ficar monstro' where id = '00000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: objetivo inválido';
  exception when others then raise notice 'OK  objetivo inválido recusado'; end;
  begin update public.profiles set instagram = 'https://instagram.com/x' where id = '00000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: instagram inválido';
  exception when others then raise notice 'OK  Instagram só com o @usuário'; end;
  begin update public.profiles set bio = repeat('x', 161) where id = '00000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: bio longa';
  exception when others then raise notice 'OK  bio acima de 160 recusada'; end;
  update public.profiles set bio = 'invadido' where id = '00000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  não edita perfil de outro aluno'; else raise notice 'FALHOU: editou perfil alheio'; end if;
  begin update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: virou admin';
  exception when others then raise notice 'OK  continua sem poder virar admin'; end;

  -- bucket avatars
  insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000001/avatar-1.jpg');
  raise notice 'OK  envia foto de perfil na própria pasta';
  begin insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000002/avatar.jpg'); raise notice 'FALHOU: enviou avatar na pasta de outro';
  exception when others then raise notice 'OK  não envia avatar na pasta de outro'; end;

  -- medidas
  insert into public.body_measurements (user_id, weight_kg, body_fat, waist_cm, photos)
  values ('00000000-0000-0000-0000-000000000001', 72.4, 24.5, 78, array['00000000-0000-0000-0000-000000000001/p1.jpg']);
  insert into public.body_measurements (user_id, weight_kg, measured_on) values ('00000000-0000-0000-0000-000000000001', 74.1, current_date - 30);
  raise notice 'OK  aluna registra medidas';
  begin insert into public.body_measurements (user_id, weight_kg) values ('00000000-0000-0000-0000-000000000002', 90); raise notice 'FALHOU: registrou medida de outro';
  exception when others then raise notice 'OK  não registra medida de outro aluno'; end;
  begin insert into public.body_measurements (user_id) values ('00000000-0000-0000-0000-000000000001'); raise notice 'FALHOU: medida vazia';
  exception when others then raise notice 'OK  medida vazia recusada'; end;
  begin insert into public.body_measurements (user_id, weight_kg) values ('00000000-0000-0000-0000-000000000001', 5); raise notice 'FALHOU: peso impossível';
  exception when others then raise notice 'OK  peso fora da faixa recusado'; end;
  -- fotos de evolução
  insert into storage.objects (bucket_id, name) values ('progress', '00000000-0000-0000-0000-000000000001/p1.jpg');
  raise notice 'OK  envia foto de evolução na própria pasta';
  begin insert into storage.objects (bucket_id, name) values ('progress', '00000000-0000-0000-0000-000000000002/p.jpg'); raise notice 'FALHOU: foto de evolução na pasta de outro';
  exception when others then raise notice 'OK  não envia evolução na pasta de outro'; end;
  -- ranking com foto
  select * into v from public.community_members() where id = '00000000-0000-0000-0000-000000000001';
  if v.avatar_path like '%/avatar-1.jpg' then raise notice 'OK  ranking devolve a foto de perfil'; else raise notice 'FALHOU: ranking sem foto'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  select count(*) into n from public.body_measurements;
  if n = 0 then raise notice 'OK  outro aluno não vê medidas da Maria'; else raise notice 'FALHOU: viu % medidas alheias', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'progress';
  if n = 0 then raise notice 'OK  outro aluno não vê fotos de evolução da Maria'; else raise notice 'FALHOU: viu fotos de evolução alheias'; end if;
  delete from public.body_measurements;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  outro aluno não apaga medidas'; else raise notice 'FALHOU: apagou medidas alheias'; end if;
  delete from storage.objects where bucket_id = 'avatars';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  outro aluno não apaga a foto de perfil da Maria'; else raise notice 'FALHOU: apagou avatar alheio'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  select count(*) into n from public.body_measurements;
  if n = 2 then raise notice 'OK  treinador vê as medidas da aluna'; else raise notice 'FALHOU: treinador viu %', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'progress';
  if n = 1 then raise notice 'OK  treinador vê as fotos de evolução'; else raise notice 'FALHOU: treinador viu % fotos', n; end if;
  insert into public.body_measurements (user_id, weight_kg, note) values ('00000000-0000-0000-0000-000000000002', 88.2, 'Avaliação presencial');
  insert into storage.objects (bucket_id, name) values ('progress', '00000000-0000-0000-0000-000000000002/avaliacao.jpg');
  raise notice 'OK  treinador registra avaliação e foto para o aluno';
end $$;

reset role;
\echo '--- medidas (superusuário) ---'
select user_id, weight_kg, body_fat, waist_cm, cardinality(photos) as fotos, note from public.body_measurements order by user_id, measured_on;

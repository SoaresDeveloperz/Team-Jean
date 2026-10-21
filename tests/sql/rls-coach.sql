\set QUIET on
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', 'Carlos Lima', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- Treinos: Maria 2 no período (dias diferentes) + 1 antes; Carlos 1 no período.
-- Um treino às 23h de 19/10 em Brasília (02h UTC de 20/10) não entra num desafio que começa em 20/10.
insert into public.workout_sessions (id, student_id, status, completed_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'completed', '2026-10-21 12:00-03'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'completed', '2026-10-22 18:00-03'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'completed', '2026-10-20 02:00+00'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'completed', '2026-10-21 07:00-03'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'in_progress', '2026-10-21 08:00-03');
insert into public.session_sets (session_id, weight_kg, reps, completed) values
  ('10000000-0000-0000-0000-000000000001', 60, 10, true),
  ('10000000-0000-0000-0000-000000000001', 70, 6, true),
  ('10000000-0000-0000-0000-000000000001', 200, 1, false),
  ('10000000-0000-0000-0000-000000000002', 50, 12, true),
  ('10000000-0000-0000-0000-000000000003', 100, 10, true),
  ('10000000-0000-0000-0000-000000000004', 80, 5, true);

set role authenticated;

-- ------------------------------------------------------------ treinador
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int; challenge uuid; v record;
begin
  insert into public.coach_notes (student_id, body) values ('00000000-0000-0000-0000-000000000001', 'Dor leve no ombro esquerdo: evitar desenvolvimento pesado.');
  raise notice 'OK  treinador cria nota';
  begin insert into public.coach_notes (student_id, author_id, body) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'x');
    raise notice 'FALHOU: nota em nome de outro';
  exception when others then raise notice 'OK  nota só em nome próprio'; end;
  begin insert into public.coach_notes (student_id, body) values ('00000000-0000-0000-0000-000000000001', '   '); raise notice 'FALHOU: nota vazia';
  exception when others then raise notice 'OK  nota vazia recusada'; end;
  begin insert into public.coach_notes (student_id, body) values ('00000000-0000-0000-0000-000000000001', repeat('x', 1001)); raise notice 'FALHOU: nota longa';
  exception when others then raise notice 'OK  nota acima de 1000 recusada'; end;
  update public.coach_notes set pinned = true where student_id = '00000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  treinador fixa nota'; else raise notice 'FALHOU: não fixou'; end if;

  insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Outubro sem falta', 'workouts', 12, '2026-10-20', '2026-10-31') returning id into challenge;
  raise notice 'OK  treinador cria desafio';
  perform set_config('test.challenge', challenge::text, false);
  insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Tonelada', 'volume', 5000, '2026-10-20', '2026-10-31') returning id into challenge;
  perform set_config('test.volume', challenge::text, false);
  insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Dias ativos', 'active_days', 10, '2026-10-20', '2026-10-31') returning id into challenge;
  perform set_config('test.days', challenge::text, false);
  begin insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Xx', 'workouts', 3, '2026-10-20', '2026-10-31'); raise notice 'FALHOU: título curto';
  exception when others then raise notice 'OK  título curto recusado'; end;
  begin insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Corrida', 'km', 3, '2026-10-20', '2026-10-31'); raise notice 'FALHOU: métrica inválida';
  exception when others then raise notice 'OK  métrica inválida recusada'; end;
  begin insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Ao contrário', 'workouts', 3, '2026-10-20', '2026-10-01'); raise notice 'FALHOU: período invertido';
  exception when others then raise notice 'OK  período invertido recusado'; end;
  begin insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Ano todo', 'workouts', 3, '2026-01-01', '2026-12-31'); raise notice 'FALHOU: período longo';
  exception when others then raise notice 'OK  período acima de 180 dias recusado'; end;
  begin insert into public.challenges (title, metric, goal, starts_on, ends_on) values ('Meta zero', 'workouts', 0, '2026-10-20', '2026-10-31'); raise notice 'FALHOU: meta zero';
  exception when others then raise notice 'OK  meta zero recusada'; end;
end $$;

-- ----------------------------------------------------------------- aluna
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; v record; maria numeric; carlos numeric; admin_rows int;
begin
  select count(*) into n from public.coach_notes;
  if n = 0 then raise notice 'OK  aluna não vê notas do treinador'; else raise notice 'FALHOU: aluna leu nota'; end if;
  begin insert into public.coach_notes (student_id, author_id, body) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'oi');
    raise notice 'FALHOU: aluna criou nota';
  exception when others then raise notice 'OK  aluna não cria nota'; end;
  select count(*) into n from public.challenges;
  if n = 3 then raise notice 'OK  aluna vê os desafios'; else raise notice 'FALHOU: aluna vê % desafios', n; end if;
  begin insert into public.challenges (title, metric, goal, starts_on, ends_on, created_by) values ('Meu desafio', 'workouts', 3, '2026-10-20', '2026-10-31', '00000000-0000-0000-0000-000000000001');
    raise notice 'FALHOU: aluna criou desafio';
  exception when others then raise notice 'OK  aluna não cria desafio'; end;
  update public.challenges set goal = 1;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  aluna não edita desafio'; else raise notice 'FALHOU: aluna editou desafio'; end if;

  select progress into maria from public.challenge_standings(current_setting('test.challenge')::uuid) where user_id = '00000000-0000-0000-0000-000000000001';
  select progress into carlos from public.challenge_standings(current_setting('test.challenge')::uuid) where user_id = '00000000-0000-0000-0000-000000000002';
  select count(*) into admin_rows from public.challenge_standings(current_setting('test.challenge')::uuid) where user_id = '00000000-0000-0000-0000-00000000000a';
  if maria = 2 and carlos = 1 then raise notice 'OK  placar de treinos (fuso de Brasília e só concluídos): Maria 2, Carlos 1';
  else raise notice 'FALHOU: placar de treinos Maria %, Carlos %', maria, carlos; end if;
  if admin_rows = 0 then raise notice 'OK  treinador fora do placar'; else raise notice 'FALHOU: treinador no placar'; end if;
  select progress into maria from public.challenge_standings(current_setting('test.volume')::uuid) where user_id = '00000000-0000-0000-0000-000000000001';
  if maria = 1620 then raise notice 'OK  placar de volume ignora série não concluída (1620 kg)'; else raise notice 'FALHOU: volume %', maria; end if;
  select progress into maria from public.challenge_standings(current_setting('test.days')::uuid) where user_id = '00000000-0000-0000-0000-000000000001';
  if maria = 2 then raise notice 'OK  placar de dias ativos'; else raise notice 'FALHOU: dias %', maria; end if;
  select * into v from public.challenge_standings(current_setting('test.challenge')::uuid) limit 1;
  if v.full_name = 'Maria Souza' then raise notice 'OK  placar ordenado pelo progresso'; else raise notice 'FALHOU: ordem %', v.full_name; end if;
end $$;

-- ------------------------------------------------------------------ anon
reset role;
set role anon;
do $$
begin
  perform * from public.challenge_standings(current_setting('test.challenge')::uuid);
  raise notice 'FALHOU: anônimo chamou o placar';
exception when others then raise notice 'OK  anônimo não chama o placar';
end $$;
reset role;

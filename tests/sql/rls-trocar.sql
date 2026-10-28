-- "Trocar exercício" (supabase/trocar-exercicio.sql): colunas essential,
-- alternatives e swaps, valores padrão, limites e quem lê e quem grava.
\set QUIET on
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', 'Carlos Lima', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into public.assigned_workouts (id, student_id, name) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Treino A'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Treino C');
insert into public.exercises (id, name, muscle_group) values
  ('e0000000-0000-0000-0000-000000000001', 'Supino Reto', 'Peito'),
  ('e0000000-0000-0000-0000-000000000002', 'Supino Inclinado', 'Peito');
insert into public.assigned_workout_exercises (id, assigned_workout_id, exercise_id, "order") values
  ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1),
  ('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 1);

do $$
declare t text; d text;
begin
  select data_type, column_default into t, d from information_schema.columns
  where table_schema = 'public' and table_name = 'assigned_workout_exercises' and column_name = 'essential';
  if t = 'boolean' and d = 'false' then raise notice 'OK  assigned_workout_exercises.essential é boolean, padrão false';
  else raise notice 'FALHOU: essential (% / %)', t, d; end if;
  select data_type into t from information_schema.columns
  where table_schema = 'public' and table_name = 'workout_template_exercises' and column_name = 'alternatives';
  if t = 'ARRAY' then raise notice 'OK  workout_template_exercises.alternatives existe (lista)';
  else raise notice 'FALHOU: sem alternatives no modelo (%)', t; end if;
  select data_type into t from information_schema.columns
  where table_schema = 'public' and table_name = 'workout_sessions' and column_name = 'swaps';
  if t = 'smallint' then raise notice 'OK  workout_sessions.swaps existe (smallint)';
  else raise notice 'FALHOU: sem swaps (%)', t; end if;
  if (select not essential and alternatives = '{}' from public.assigned_workout_exercises where id = 'a0000000-0000-0000-0000-000000000001')
  then raise notice 'OK  exercício antigo continua sem essencial e sem alternativas';
  else raise notice 'FALHOU: padrão do exercício antigo'; end if;
end $$;

set role authenticated;

-- ------------------------------------------------------------------ Jean (treinador)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  update public.assigned_workout_exercises
     set essential = true, alternatives = array['e0000000-0000-0000-0000-000000000002']::uuid[]
   where id = 'a0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  o treinador marca essencial e alternativas';
  else raise notice 'FALHOU: o treinador não conseguiu marcar'; end if;
  begin
    update public.assigned_workout_exercises
       set alternatives = array(select gen_random_uuid() from generate_series(1, 6))
     where id = 'a0000000-0000-0000-0000-000000000001';
    raise notice 'FALHOU: aceitou 6 alternativas';
  exception when check_violation then
    raise notice 'OK  mais de 5 alternativas é recusado';
  end;
end $$;

-- ------------------------------------------------------------------ Maria
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; e boolean;
begin
  select essential into e from public.assigned_workout_exercises where id = 'a0000000-0000-0000-0000-000000000001';
  if e then raise notice 'OK  a aluna lê o essencial e as alternativas do próprio treino';
  else raise notice 'FALHOU: a aluna não leu a marca'; end if;
  update public.assigned_workout_exercises set essential = false, alternatives = '{}' where id = 'a0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  a aluna não muda a prescrição';
  else raise notice 'FALHOU: a aluna alterou a prescrição'; end if;

  insert into public.workout_sessions (id, assigned_workout_id, student_id, status)
  values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'in_progress');
  if (select swaps from public.workout_sessions where id = '30000000-0000-0000-0000-000000000001') = 0
  then raise notice 'OK  sessão nova começa com swaps = 0';
  else raise notice 'FALHOU: swaps da sessão nova'; end if;
  update public.workout_sessions set status = 'completed', completed_at = now(), session_rpe = 7, swaps = 2
   where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  a aluna finaliza o treino gravando swaps = 2';
  else raise notice 'FALHOU: a aluna não gravou swaps'; end if;
  begin
    update public.workout_sessions set swaps = 51 where id = '30000000-0000-0000-0000-000000000001';
    raise notice 'FALHOU: aceitou swaps = 51';
  exception when check_violation then
    raise notice 'OK  swaps acima de 50 é recusado';
  end;
  select count(*) into n from public.notifications;
  if n = 0 then raise notice 'OK  trocar exercício não gera aviso nem recado';
  else raise notice 'FALHOU: gerou % notificações', n; end if;
end $$;

-- ------------------------------------------------------------------ Carlos
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  select count(*) into n from public.assigned_workout_exercises where essential;
  if n = 0 then raise notice 'OK  Carlos não vê a prescrição da Maria';
  else raise notice 'FALHOU: Carlos vê % exercícios da Maria', n; end if;
  select count(*) into n from public.workout_sessions where swaps > 0;
  if n = 0 then raise notice 'OK  Carlos não vê as trocas da Maria';
  else raise notice 'FALHOU: Carlos vê % sessões da Maria', n; end if;
end $$;

-- ------------------------------------------------------------------ Jean
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  select count(*) into n from public.workout_sessions where swaps = 2;
  if n = 1 then raise notice 'OK  o treinador vê quantas trocas a aluna fez';
  else raise notice 'FALHOU: o treinador vê % sessões com trocas', n; end if;
end $$;

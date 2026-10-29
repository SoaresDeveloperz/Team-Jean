-- Rotina da semana (supabase/rotina-semanal.sql): colunas weekday e position em
-- assigned_workouts, limites e quem lê e quem grava.
\set QUIET on
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', 'Carlos Lima', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into public.assigned_workouts (id, student_id, name) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Treino A'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Treino C');

do $$
declare t text;
begin
  select data_type into t from information_schema.columns where table_schema = 'public' and table_name = 'assigned_workouts' and column_name = 'weekday';
  if t = 'smallint' then raise notice 'OK  assigned_workouts.weekday existe (smallint)';
  else raise notice 'FALHOU: sem weekday (%)', t; end if;
  select data_type into t from information_schema.columns where table_schema = 'public' and table_name = 'assigned_workouts' and column_name = 'position';
  if t = 'smallint' then raise notice 'OK  assigned_workouts.position existe (smallint)';
  else raise notice 'FALHOU: sem position (%)', t; end if;
  if (select weekday is null and position is null from public.assigned_workouts where id = '20000000-0000-0000-0000-000000000001')
  then raise notice 'OK  treino antigo continua sem dia e sem ordem (vazios)';
  else raise notice 'FALHOU: padrão do treino antigo'; end if;
end $$;

set role authenticated;

-- ------------------------------------------------------------------ Jean (treinador)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  update public.assigned_workouts set weekday = 3, position = 1 where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  o treinador marca dia e ordem';
  else raise notice 'FALHOU: o treinador não conseguiu marcar'; end if;
  begin
    update public.assigned_workouts set weekday = 7 where id = '20000000-0000-0000-0000-000000000001';
    raise notice 'FALHOU: aceitou weekday = 7';
  exception when check_violation then
    raise notice 'OK  weekday fora de 0 a 6 é recusado';
  end;
  begin
    update public.assigned_workouts set position = 100 where id = '20000000-0000-0000-0000-000000000001';
    raise notice 'FALHOU: aceitou position = 100';
  exception when check_violation then
    raise notice 'OK  position fora de 0 a 99 é recusado';
  end;
  update public.assigned_workouts set weekday = null where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  o treinador volta para "sem dia fixo"';
  else raise notice 'FALHOU: não limpou o dia'; end if;
  update public.assigned_workouts set weekday = 3 where id = '20000000-0000-0000-0000-000000000001';
end $$;

-- ------------------------------------------------------------------ Maria
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; d int;
begin
  select weekday into d from public.assigned_workouts where id = '20000000-0000-0000-0000-000000000001';
  if d = 3 then raise notice 'OK  a aluna lê o dia do próprio treino';
  else raise notice 'FALHOU: a aluna não leu o dia (%)', d; end if;
  update public.assigned_workouts set weekday = 5, position = 9 where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  a aluna não muda dia nem ordem';
  else raise notice 'FALHOU: a aluna alterou o dia ou a ordem'; end if;
end $$;

-- ------------------------------------------------------------------ Carlos
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  select count(*) into n from public.assigned_workouts where weekday = 3;
  if n = 0 then raise notice 'OK  Carlos não vê o treino da Maria';
  else raise notice 'FALHOU: Carlos vê % treinos da Maria', n; end if;
end $$;

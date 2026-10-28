-- "Tenho pouco tempo" (supabase/treino-curto.sql): a coluna short_mode, o valor
-- padrão, quem grava e quem lê, e que a marca não dispara aviso nenhum.
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
declare t text; d text;
begin
  select data_type, column_default into t, d from information_schema.columns
  where table_schema = 'public' and table_name = 'workout_sessions' and column_name = 'short_mode';
  if t = 'boolean' then raise notice 'OK  workout_sessions.short_mode existe (boolean)';
  else raise notice 'FALHOU: sem a coluna short_mode (%)', t; end if;
  if d = 'false' then raise notice 'OK  padrão é false (sessões antigas não são "curtas")';
  else raise notice 'FALHOU: padrão %', d; end if;
end $$;

set role authenticated;

-- ------------------------------------------------------------------ Maria
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; v boolean;
begin
  insert into public.workout_sessions (id, assigned_workout_id, student_id, status)
  values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'in_progress');
  select short_mode into v from public.workout_sessions where id = '30000000-0000-0000-0000-000000000001';
  if v = false then raise notice 'OK  sessão nova começa com short_mode = false';
  else raise notice 'FALHOU: short_mode da sessão nova = %', v; end if;

  update public.workout_sessions
     set status = 'completed', completed_at = now(), session_rpe = 7, short_mode = true
   where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  a aluna finaliza o treino marcando short_mode = true';
  else raise notice 'FALHOU: a aluna não conseguiu gravar short_mode'; end if;
  select count(*) into n from public.notifications;
  if n = 0 then raise notice 'OK  a versão curta não gera aviso nem recado (nenhuma notificação)';
  else raise notice 'FALHOU: a versão curta gerou % notificações', n; end if;
end $$;

-- ------------------------------------------------------------------ Carlos
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  select count(*) into n from public.workout_sessions where short_mode;
  if n = 0 then raise notice 'OK  Carlos não vê a sessão curta da Maria';
  else raise notice 'FALHOU: Carlos vê % sessões da Maria', n; end if;
  update public.workout_sessions set short_mode = false where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  Carlos não altera o short_mode da Maria';
  else raise notice 'FALHOU: Carlos alterou a sessão da Maria'; end if;
end $$;

-- ------------------------------------------------------------------ Jean
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  select count(*) into n from public.workout_sessions where short_mode;
  if n = 1 then raise notice 'OK  o treinador vê o selo da versão curta';
  else raise notice 'FALHOU: o treinador vê % sessões curtas', n; end if;
end $$;

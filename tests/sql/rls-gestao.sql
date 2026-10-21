\set QUIET on
-- supabase/gestao.sql: push, recado do treino, anamnese, avaliação e financeiro.
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', 'Carlos Lima', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into public.assigned_workouts (id, student_id, name) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Treino A');
-- Aparelhos inscritos são gravados pelo servidor (service_role, aqui o superusuário).
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-000000000001', 'https://fcm.googleapis.com/fcm/send/maria', repeat('p', 87), repeat('a', 22)),
  ('00000000-0000-0000-0000-000000000002', 'https://fcm.googleapis.com/fcm/send/carlos', repeat('p', 87), repeat('a', 22));

do $$
declare n int;
begin
  select count(*) into n from public.notifications where title = 'Aviso antigo' and pushed_at is not null and created_at is null;
  if n = 1 then raise notice 'OK  aviso antigo fica como já enviado e sem data';
  else raise notice 'FALHOU: aviso antigo (pushed_at/created_at)'; end if;
end $$;

set role authenticated;

-- ------------------------------------------------------------------ aluna
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; v record; session_id uuid := '30000000-0000-0000-0000-000000000001';
begin
  -- push
  select count(*) into n from public.push_subscriptions;
  if n = 1 then raise notice 'OK  aluna vê só o próprio aparelho'; else raise notice 'FALHOU: aluna vê % aparelhos', n; end if;
  begin
    insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/x', repeat('p', 87), repeat('a', 22));
    raise notice 'FALHOU: aluna gravou aparelho direto';
  exception when others then raise notice 'OK  aparelho só é gravado pelo servidor';
  end;
  delete from public.push_subscriptions where endpoint like '%carlos';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  não apaga aparelho de outro'; else raise notice 'FALHOU: apagou aparelho alheio'; end if;

  -- treino com recado (id gerado no aparelho, como no modo offline)
  insert into public.workout_sessions (id, assigned_workout_id, student_id, status)
  values (session_id, '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'in_progress');
  raise notice 'OK  aluna cria sessão com id gerado no aparelho';
  begin
    update public.workout_sessions set feedback = repeat('x', 501) where id = session_id;
    raise notice 'FALHOU: recado acima de 500';
  exception when others then raise notice 'OK  recado acima de 500 recusado';
  end;
  update public.workout_sessions
     set status = 'completed', completed_at = now(), session_rpe = 9, feedback = 'Senti o ombro no supino', feedback_tags = array['Senti dor', 'Pesado demais']
   where id = session_id;
  begin
    update public.workout_sessions set coach_reply = 'Forjado' where id = session_id;
    raise notice 'FALHOU: aluna escreveu a resposta do treinador';
  exception when others then raise notice 'OK  aluna não escreve a resposta do treinador';
  end;
  -- Finalizar de novo (reenvio da fila offline) não duplica o aviso.
  update public.workout_sessions set status = 'completed', feedback = 'Senti o ombro no supino', feedback_tags = array['Senti dor', 'Pesado demais'] where id = session_id;

  -- anamnese: o alerta do PAR-Q vem das respostas, não do que o app manda
  insert into public.anamneses (student_id, answers, parq_positive)
  values ('00000000-0000-0000-0000-000000000001', '{"parq": {"heart": false, "chest_pain": true}, "injuries": "ombro"}', false)
  returning * into v;
  if v.parq_positive then raise notice 'OK  PAR-Q positivo calculado pelo banco'; else raise notice 'FALHOU: PAR-Q não calculado'; end if;
  begin
    insert into public.anamneses (student_id, answers) values ('00000000-0000-0000-0000-000000000002', '{}');
    raise notice 'FALHOU: aluna preencheu anamnese de outro';
  exception when others then raise notice 'OK  anamnese só a própria';
  end;
  begin
    update public.anamneses set answers = '[1, 2]' where student_id = '00000000-0000-0000-0000-000000000001';
    raise notice 'FALHOU: respostas fora do formato';
  exception when others then raise notice 'OK  respostas precisam ser um objeto';
  end;
  update public.anamneses set answers = '{"parq": {"heart": false, "chest_pain": false}}' where student_id = '00000000-0000-0000-0000-000000000001'
  returning * into v;
  if not v.parq_positive then raise notice 'OK  PAR-Q volta a negativo ao corrigir'; else raise notice 'FALHOU: PAR-Q não recalculou'; end if;
  delete from public.anamneses;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  aluna não apaga a anamnese'; else raise notice 'FALHOU: aluna apagou a anamnese'; end if;

  -- perfil e avaliação
  update public.profiles set sex = 'F', birth_date = '1995-04-12', height_cm = 165.5 where id = '00000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  aluna salva sexo, nascimento e altura'; else raise notice 'FALHOU: perfil físico'; end if;
  begin update public.profiles set sex = 'X' where id = '00000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: sexo inválido';
  exception when others then raise notice 'OK  sexo inválido recusado'; end;
  begin update public.profiles set height_cm = 300 where id = '00000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: altura inválida';
  exception when others then raise notice 'OK  altura fora da faixa recusada'; end;
  insert into public.body_measurements (user_id, perimeters, skinfolds, protocol)
  values ('00000000-0000-0000-0000-000000000001', '{"arm_right": 31.5, "hip": 98}', '{"triceps": 18, "suprailiac": 16, "thigh": 24}', 'pollock3');
  raise notice 'OK  avaliação só com perímetros e dobras';
  begin
    insert into public.body_measurements (user_id, perimeters, protocol) values ('00000000-0000-0000-0000-000000000001', '{"hip": 98}', 'jackson');
    raise notice 'FALHOU: protocolo inválido';
  exception when others then raise notice 'OK  protocolo inválido recusado';
  end;
  begin
    insert into public.body_measurements (user_id, perimeters) values ('00000000-0000-0000-0000-000000000001', '[98]');
    raise notice 'FALHOU: perímetros fora do formato';
  exception when others then raise notice 'OK  perímetros precisam ser um objeto';
  end;
  begin
    insert into public.body_measurements (user_id) values ('00000000-0000-0000-0000-000000000001');
    raise notice 'FALHOU: medida vazia';
  exception when others then raise notice 'OK  medida vazia continua recusada';
  end;
end $$;

-- -------------------------------------------------------------- treinador
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int; v record;
begin
  select count(*) into n from public.notifications
   where recipient_id = '00000000-0000-0000-0000-00000000000a' and type = 'feedback' and title = 'Recado de Maria Souza'
     and message like 'Treino A · RPE 9%Senti dor · Pesado demais%Senti o ombro no supino%' and pushed_at is null and created_at is not null;
  if n = 1 then raise notice 'OK  treinador recebe um aviso do recado (pendente de push)';
  else raise notice 'FALHOU: avisos do recado = %', n; end if;
  update public.workout_sessions set coach_reply = 'Tira o supino e faz crucifixo nesta semana.', coach_reply_at = now()
   where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  treinador responde o recado'; else raise notice 'FALHOU: resposta do treinador'; end if;
  select count(*) into n from public.push_subscriptions;
  if n = 0 then raise notice 'OK  treinador não vê aparelhos dos alunos'; else raise notice 'FALHOU: treinador vê % aparelhos', n; end if;

  select * into v from public.anamneses where student_id = '00000000-0000-0000-0000-000000000001';
  if v.student_id is not null then raise notice 'OK  treinador lê a anamnese'; else raise notice 'FALHOU: treinador não leu a anamnese'; end if;
  update public.anamneses set answers = '{"parq": {"heart": true}}' where student_id = '00000000-0000-0000-0000-000000000001' returning * into v;
  if v.parq_positive and v.updated_by = '00000000-0000-0000-0000-00000000000a' then raise notice 'OK  treinador atualiza a anamnese (autor registrado)';
  else raise notice 'FALHOU: atualização da anamnese pelo treinador'; end if;
  select count(*) into n from public.notifications where recipient_id = '00000000-0000-0000-0000-00000000000a' and type = 'health';
  if n = 1 then raise notice 'OK  treinador avisado quando o aluno preenche a ficha (e não pela própria edição)';
  else raise notice 'FALHOU: avisos da ficha de saúde = %', n; end if;

  -- financeiro
  insert into public.student_billing (student_id, monthly_fee, due_day) values ('00000000-0000-0000-0000-000000000001', 150, 10);
  insert into public.student_billing (student_id, monthly_fee, due_day) values ('00000000-0000-0000-0000-000000000002', 120, 31);
  raise notice 'OK  treinador cadastra mensalidades';
  begin insert into public.student_billing (student_id, monthly_fee) values ('00000000-0000-0000-0000-00000000000a', 0); raise notice 'FALHOU: mensalidade zero';
  exception when others then raise notice 'OK  mensalidade zero recusada'; end;
  begin update public.student_billing set due_day = 0 where student_id = '00000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: vencimento 0';
  exception when others then raise notice 'OK  dia de vencimento inválido recusado'; end;
  insert into public.payments (student_id, reference_month, amount, method) values ('00000000-0000-0000-0000-000000000001', '2026-10-01', 150, 'pix');
  raise notice 'OK  treinador registra pagamento';
  begin insert into public.payments (student_id, reference_month, amount) values ('00000000-0000-0000-0000-000000000001', '2026-10-01', 150); raise notice 'FALHOU: pagamento duplicado';
  exception when others then raise notice 'OK  um pagamento por mês'; end;
  begin insert into public.payments (student_id, reference_month, amount) values ('00000000-0000-0000-0000-000000000002', '2026-10-15', 120); raise notice 'FALHOU: mês fora do dia 1';
  exception when others then raise notice 'OK  mês de referência sempre no dia 1'; end;
  begin insert into public.payments (student_id, reference_month, amount, method) values ('00000000-0000-0000-0000-000000000002', '2026-10-01', 120, 'bitcoin'); raise notice 'FALHOU: forma de pagamento inválida';
  exception when others then raise notice 'OK  forma de pagamento inválida recusada'; end;
  insert into public.coach_settings (id, pix_key, pix_name, pix_city) values (1, 'jean@pix.com', 'Jean Treinador', 'Sao Paulo')
  on conflict (id) do update set pix_key = excluded.pix_key;
  insert into public.coach_settings (id, pix_key, pix_name, pix_city) values (1, 'jean@pix.com.br', 'Jean Treinador', 'Sao Paulo')
  on conflict (id) do update set pix_key = excluded.pix_key;
  select * into v from public.coach_settings;
  if v.pix_key = 'jean@pix.com.br' then raise notice 'OK  treinador salva a chave PIX'; else raise notice 'FALHOU: chave PIX'; end if;
  begin insert into public.coach_settings (id) values (2); raise notice 'FALHOU: segunda configuração';
  exception when others then raise notice 'OK  só existe uma configuração'; end;
  begin update public.coach_settings set pix_city = 'Cidade com nome grande demais'; raise notice 'FALHOU: cidade longa';
  exception when others then raise notice 'OK  cidade do PIX limitada a 15 letras'; end;
end $$;

-- ------------------------------------------------------- aluna (de novo)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; v record;
begin
  select count(*) into n from public.student_billing;
  if n = 1 then raise notice 'OK  aluna vê só a própria mensalidade'; else raise notice 'FALHOU: aluna vê % mensalidades', n; end if;
  update public.student_billing set monthly_fee = 1;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  aluna não muda a mensalidade'; else raise notice 'FALHOU: aluna mudou a mensalidade'; end if;
  begin
    insert into public.payments (student_id, reference_month, amount) values ('00000000-0000-0000-0000-000000000001', '2026-11-01', 1);
    raise notice 'FALHOU: aluna registrou pagamento';
  exception when others then raise notice 'OK  aluna não registra pagamento';
  end;
  select count(*) into n from public.payments;
  if n = 1 then raise notice 'OK  aluna vê os próprios pagamentos'; else raise notice 'FALHOU: aluna vê % pagamentos', n; end if;
  select * into v from public.coach_settings;
  if v.pix_key = 'jean@pix.com.br' then raise notice 'OK  aluna lê a chave PIX'; else raise notice 'FALHOU: aluna sem chave PIX'; end if;
  update public.coach_settings set pix_key = 'golpe@pix.com';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  aluna não muda a chave PIX'; else raise notice 'FALHOU: aluna mudou a chave PIX'; end if;
  select coach_reply into v from public.workout_sessions where id = '30000000-0000-0000-0000-000000000001';
  if v.coach_reply like 'Tira o supino%' then raise notice 'OK  aluna lê a resposta do treinador'; else raise notice 'FALHOU: resposta não chegou'; end if;
end $$;

-- ------------------------------------------------------------------ Carlos
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  select count(*) into n from public.anamneses;
  if n = 0 then raise notice 'OK  aluno não lê anamnese de outro'; else raise notice 'FALHOU: leu anamnese alheia'; end if;
  select count(*) into n from public.payments;
  if n = 0 then raise notice 'OK  aluno não vê pagamento de outro'; else raise notice 'FALHOU: viu pagamento alheio'; end if;
end $$;

-- ------------------------------------------------------------------ anon
reset role;
set role anon;
do $$
declare n int;
begin
  select count(*) into n from public.coach_settings;
  if n = 0 then raise notice 'OK  anônimo não lê a chave PIX'; else raise notice 'FALHOU: anônimo leu a chave PIX'; end if;
exception when others then raise notice 'OK  anônimo não lê a chave PIX';
end $$;
reset role;

-- --------------------------------------- aviso bloqueado não impede o treino
alter table public.notifications add constraint only_known_types check (type in ('announcement', 'workout_updated', 'community')) not valid;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.workout_sessions (id, assigned_workout_id, student_id, status, completed_at, feedback)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'completed', now(), 'Treino leve hoje');
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.notifications where type = 'announcement' and title = 'Recado de Maria Souza';
  if n = 1 then raise notice 'OK  recado vira aviso comum quando o tipo é recusado'; else raise notice 'FALHOU: recado com tipo recusado (%)', n; end if;
end $$;
alter table public.notifications drop constraint only_known_types;
alter table public.notifications add constraint no_inserts check (false) not valid;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.workout_sessions (id, assigned_workout_id, student_id, status, completed_at, feedback)
values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'completed', now(), 'Outro recado');
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.workout_sessions where id = '30000000-0000-0000-0000-000000000003' and status = 'completed';
  if n = 1 then raise notice 'OK  treino salvo mesmo sem conseguir avisar'; else raise notice 'FALHOU: treino perdido sem aviso'; end if;
end $$;
alter table public.notifications drop constraint no_inserts;

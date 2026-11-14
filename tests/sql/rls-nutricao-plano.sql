-- Plano alimentar (supabase/nutricao-plano.sql): cada aluno lê só o plano dele, só o treinador
-- grava, limites das colunas, alimento em uso, "atualizado em" e exclusão em cascata.
\set QUIET on
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x'),
  ('00000000-0000-0000-0000-000000000002', 'student', 'Carlos Lima', 'carlos@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into public.foods (id, name, kcal, protein_g, fat_g, carb_g) values
  ('f0000000-0000-0000-0000-000000000001', 'Whey do Jean', 400, 80, 6, 8),
  ('f0000000-0000-0000-0000-000000000002', 'Marmita sem uso', 150, 8, 4, 20);

set role authenticated;

-- ------------------------------------------------------------------ Jean (treinador)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int; a timestamptz; b timestamptz; rice uuid; plan uuid; meal uuid;
begin
  select id into rice from public.foods where name = 'Arroz, tipo 1, cozido';
  insert into public.nutrition_plans (id, student_id, responsible_name, responsible_crn, kcal_target, protein_target_g)
    values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Jean Souza', 'CRN-3 12345', 2000, 120);
  raise notice 'OK  o treinador cria o plano da Maria';
  plan := 'a0000000-0000-0000-0000-000000000001';

  begin
    insert into public.nutrition_plans (student_id, responsible_name, responsible_crn) values ('00000000-0000-0000-0000-000000000002', 'Jean Souza', 'CRN-3 12345');
    insert into public.nutrition_plans (student_id, responsible_name, responsible_crn) values ('00000000-0000-0000-0000-000000000002', 'Jean Souza', 'CRN-3 12345');
    raise notice 'FALHOU: criou dois planos para o mesmo aluno';
  exception when unique_violation then
    raise notice 'OK  só um plano por aluno';
  end;
  delete from public.nutrition_plans where student_id = '00000000-0000-0000-0000-000000000002';
  begin insert into public.nutrition_plans (student_id, responsible_name) values ('00000000-0000-0000-0000-000000000002', 'Jean Souza'); raise notice 'FALHOU: criou plano sem CRN';
  exception when not_null_violation then raise notice 'OK  plano sem CRN do responsável é recusado'; end;
  begin insert into public.nutrition_plans (student_id, responsible_name, responsible_crn) values ('00000000-0000-0000-0000-000000000002', 'Jean Souza', '12'); raise notice 'FALHOU: aceitou CRN de 2 letras';
  exception when check_violation then raise notice 'OK  CRN curto demais é recusado'; end;
  begin insert into public.nutrition_plans (student_id, responsible_name, responsible_crn, kcal_target) values ('00000000-0000-0000-0000-000000000002', 'Jean Souza', 'CRN-3 12345', 300); raise notice 'FALHOU: aceitou meta de 300 kcal';
  exception when check_violation then raise notice 'OK  meta abaixo de 800 kcal é recusada'; end;

  insert into public.nutrition_meals (id, plan_id, name, meal_time, position) values ('b0000000-0000-0000-0000-000000000001', plan, 'Almoço', '12:30', 1);
  meal := 'b0000000-0000-0000-0000-000000000001';
  begin insert into public.nutrition_meals (plan_id, name, meal_time) values (plan, 'Ceia', '25:99'); raise notice 'FALHOU: aceitou horário 25:99';
  exception when check_violation then raise notice 'OK  horário inválido é recusado'; end;
  begin insert into public.nutrition_meals (plan_id, name) values (plan, '   '); raise notice 'FALHOU: aceitou refeição sem nome';
  exception when check_violation then raise notice 'OK  refeição sem nome é recusada'; end;

  select updated_at into a from public.nutrition_plans where id = plan;
  perform pg_sleep(0.05);
  insert into public.nutrition_meal_items (meal_id, food_id, grams, portion_text) values (meal, rice, 150, '4 colheres de servir');
  select updated_at into b from public.nutrition_plans where id = plan;
  if b > a then raise notice 'OK  mexer num item atualiza o "atualizado em" do plano';
  else raise notice 'FALHOU: updated_at não mudou'; end if;
  begin insert into public.nutrition_meal_items (meal_id, food_id, grams) values (meal, rice, 0); raise notice 'FALHOU: aceitou 0 g';
  exception when check_violation then raise notice 'OK  0 g é recusado'; end;
  begin insert into public.nutrition_meal_items (meal_id, food_id, grams) values (meal, rice, 6000); raise notice 'FALHOU: aceitou 6 kg';
  exception when check_violation then raise notice 'OK  mais de 5000 g é recusado'; end;
  begin insert into public.nutrition_meal_items (meal_id, food_id, grams) values (meal, gen_random_uuid(), 100); raise notice 'FALHOU: aceitou alimento que não existe';
  exception when foreign_key_violation then raise notice 'OK  alimento que não existe é recusado'; end;

  -- alimento próprio em uso
  insert into public.nutrition_meal_items (meal_id, food_id, grams) values (meal, 'f0000000-0000-0000-0000-000000000001', 30);
  begin update public.foods set kcal = 1 where id = 'f0000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: mudou os valores de um alimento em uso';
  exception when check_violation then raise notice 'OK  alimento próprio em uso não muda de valores'; end;
  update public.foods set name = 'Whey do Jean (baunilha)' where id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  alimento em uso pode ser renomeado'; else raise notice 'FALHOU: não renomeou'; end if;
  begin delete from public.foods where id = 'f0000000-0000-0000-0000-000000000001'; raise notice 'FALHOU: apagou alimento em uso';
  exception when foreign_key_violation then raise notice 'OK  alimento em uso não pode ser apagado'; end;
  update public.foods set kcal = 160 where id = 'f0000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  alimento sem uso continua editável'; else raise notice 'FALHOU: não editou o sem uso'; end if;
end $$;

-- ------------------------------------------------------------------ Maria (aluna)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int;
begin
  select count(*) into n from public.nutrition_plans;
  if n = 1 then raise notice 'OK  a aluna lê o próprio plano (e só ele)'; else raise notice 'FALHOU: a aluna lê % planos', n; end if;
  select count(*) into n from public.nutrition_meals;
  if n = 1 then raise notice 'OK  a aluna lê as refeições do plano'; else raise notice 'FALHOU: % refeições', n; end if;
  select count(*) into n from public.nutrition_meal_items;
  if n = 2 then raise notice 'OK  a aluna lê os itens do plano'; else raise notice 'FALHOU: % itens', n; end if;
  begin insert into public.nutrition_plans (student_id, responsible_name, responsible_crn) values ('00000000-0000-0000-0000-000000000002', 'Eu', 'CRN-1 0000'); raise notice 'FALHOU: a aluna criou plano';
  exception when insufficient_privilege then raise notice 'OK  a aluna não cria plano'; end;
  update public.nutrition_plans set kcal_target = 5000;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  a aluna não muda a meta'; else raise notice 'FALHOU: a aluna mudou o plano'; end if;
  begin insert into public.nutrition_meals (plan_id, name) values ('a0000000-0000-0000-0000-000000000001', 'Minha refeição'); raise notice 'FALHOU: a aluna criou refeição';
  exception when insufficient_privilege then raise notice 'OK  a aluna não cria refeição'; end;
  update public.nutrition_meal_items set grams = 999;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  a aluna não muda gramas'; else raise notice 'FALHOU: a aluna mudou gramas'; end if;
  delete from public.nutrition_meal_items;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  a aluna não apaga itens'; else raise notice 'FALHOU: a aluna apagou itens'; end if;
end $$;

-- ------------------------------------------------------------------ Carlos (outro aluno)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  select count(*) into n from public.nutrition_plans;
  if n = 0 then raise notice 'OK  Carlos não vê o plano da Maria'; else raise notice 'FALHOU: Carlos vê % planos', n; end if;
  select count(*) into n from public.nutrition_meals;
  if n = 0 then raise notice 'OK  Carlos não vê as refeições da Maria'; else raise notice 'FALHOU: Carlos vê % refeições', n; end if;
  select count(*) into n from public.nutrition_meal_items;
  if n = 0 then raise notice 'OK  Carlos não vê os itens da Maria'; else raise notice 'FALHOU: Carlos vê % itens', n; end if;
end $$;

-- ------------------------------------------------------------------ apagar o plano leva refeições e itens
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  delete from public.nutrition_plans where id = 'a0000000-0000-0000-0000-000000000001';
  select count(*) into n from public.nutrition_meals;
  if n = 0 then raise notice 'OK  apagar o plano apaga as refeições'; else raise notice 'FALHOU: sobraram % refeições', n; end if;
  select count(*) into n from public.nutrition_meal_items;
  if n = 0 then raise notice 'OK  apagar o plano apaga os itens'; else raise notice 'FALHOU: sobraram % itens', n; end if;
  delete from public.foods where id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  sem plano, o alimento próprio pode ser apagado'; else raise notice 'FALHOU: não apagou'; end if;
end $$;

-- ------------------------------------------------------------------ sem login
set role anon;
do $$
declare n int;
begin
  select count(*) into n from public.nutrition_plans;
  raise notice 'FALHOU: sem login leu % planos', n;
exception when insufficient_privilege then
  raise notice 'OK  sem login não lê planos';
end $$;

-- Tabela de alimentos (supabase/nutricao.sql e nutricao-taco.sql): os 597 da TACO, os limites
-- das colunas e quem lê e quem grava (o treinador só mexe nos seus; a TACO ninguém muda pelo app).
\set QUIET on
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- ------------------------------------------------------------------ dados da TACO (como dono do banco)
do $$
declare n int; c text;
begin
  select count(*) into n from public.foods where source = 'taco';
  if n = 597 then raise notice 'OK  a TACO tem 597 alimentos (aplicada duas vezes, sem repetir)';
  else raise notice 'FALHOU: % alimentos da TACO', n; end if;
  select count(distinct taco_number) into n from public.foods where taco_number between 1 and 597;
  if n = 597 then raise notice 'OK  números 1 a 597, sem buraco';
  else raise notice 'FALHOU: números da TACO (%)', n; end if;
  -- As restrições nascem "not valid": validar prova que os 597 alimentos da TACO também cumprem todas.
  foreach c in array array['foods_source_check', 'foods_name_check', 'foods_values_check', 'foods_micros_check'] loop
    begin
      execute format('alter table public.foods validate constraint %I', c);
      raise notice 'OK  a TACO cumpre %', c;
    exception when check_violation then
      raise notice 'FALHOU: a TACO quebra %', c;
    end;
  end loop;
  select count(*) into n from public.foods where name = 'Arroz, tipo 1, cozido' and kcal = 128 and protein_g = 2.5 and fat_g = 0.2 and carb_g = 28.1 and fiber_g = 1.6;
  if n = 1 then raise notice 'OK  arroz, tipo 1, cozido: 128 kcal, 2,5 g de proteína, 0,2 g de gordura, 28,1 g de carboidrato';
  else raise notice 'FALHOU: valores do arroz cozido'; end if;
  select count(*) into n from public.foods where name = 'Arroz, integral, cozido' and cholesterol_mg = 0 and fiber_g = 2.7;
  if n = 1 then raise notice 'OK  "NA" da TACO (colesterol do arroz) entra como 0';
  else raise notice 'FALHOU: NA do colesterol'; end if;
  select count(*) into n from public.foods where name = 'Leite, de vaca, integral' and kcal is null and protein_g is null;
  if n = 1 then raise notice 'OK  "*" da TACO (leite integral, análise em reavaliação) fica vazio, não 0';
  else raise notice 'FALHOU: leite integral deveria estar sem dado'; end if;
end $$;

set role authenticated;

-- ------------------------------------------------------------------ Jean (treinador)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int; fid uuid;
begin
  insert into public.foods (name, group_name, kcal, protein_g, fat_g, carb_g) values ('Whey protein, baunilha', 'Suplementos', 400, 80, 6, 8) returning id into fid;
  raise notice 'OK  o treinador cadastra um alimento próprio';
  select count(*) into n from public.foods where id = fid and source = 'custom' and created_by = auth.uid() and micros = '{}'::jsonb;
  if n = 1 then raise notice 'OK  alimento próprio nasce "custom", com o treinador como autor';
  else raise notice 'FALHOU: padrões do alimento próprio'; end if;
  update public.foods set kcal = 410 where id = fid;
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  o treinador edita o alimento próprio';
  else raise notice 'FALHOU: não editou o próprio'; end if;

  begin
    insert into public.foods (source, taco_number, name, kcal) values ('taco', 998, 'Falso da TACO', 100);
    raise notice 'FALHOU: o treinador criou um alimento "taco"';
  exception when insufficient_privilege or check_violation then
    raise notice 'OK  o treinador não cria alimento "taco"';
  end;
  update public.foods set kcal = 1 where source = 'taco' and taco_number = 3;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  o treinador não altera alimento da TACO';
  else raise notice 'FALHOU: alterou a TACO'; end if;
  delete from public.foods where source = 'taco' and taco_number = 3;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  o treinador não apaga alimento da TACO';
  else raise notice 'FALHOU: apagou da TACO'; end if;
  begin
    update public.foods set source = 'taco', taco_number = 997 where id = fid;
    raise notice 'FALHOU: transformou o próprio em "taco"';
  exception when insufficient_privilege then
    raise notice 'OK  o treinador não transforma o seu alimento em "taco"';
  end;
  begin
    update public.foods set taco_number = 5 where id = fid;
    raise notice 'FALHOU: deu número da TACO a um alimento próprio';
  exception when insufficient_privilege or check_violation then
    raise notice 'OK  alimento próprio não ganha número da TACO';
  end;
  update public.foods set source = 'custom', name = 'Arroz alterado' where source = 'taco' and taco_number = 3;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  não dá para "rebatizar" a TACO como própria';
  else raise notice 'FALHOU: rebatizou a TACO'; end if;

  -- limites das colunas
  begin insert into public.foods (name, kcal) values ('Negativo', -1); raise notice 'FALHOU: aceitou kcal negativa';
  exception when check_violation then raise notice 'OK  kcal negativa é recusada'; end;
  begin insert into public.foods (name, kcal) values ('Impossível', 901); raise notice 'FALHOU: aceitou 901 kcal por 100 g';
  exception when check_violation then raise notice 'OK  mais de 900 kcal por 100 g é recusado'; end;
  begin insert into public.foods (name, protein_g, fat_g, carb_g) values ('Mais de 100 g', 60, 40, 40); raise notice 'FALHOU: aceitou macros que passam de 100 g';
  exception when check_violation then raise notice 'OK  macros que passam de 100 g são recusados'; end;
  begin insert into public.foods (name) values ('x'); raise notice 'FALHOU: aceitou nome de 1 letra';
  exception when check_violation then raise notice 'OK  nome curto demais é recusado'; end;
  begin insert into public.foods (name, micros) values ('Micros ruins', '[1,2]'::jsonb); raise notice 'FALHOU: aceitou micros que não é objeto';
  exception when check_violation then raise notice 'OK  micros precisa ser um objeto'; end;

  delete from public.foods where id = fid;
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  o treinador apaga o alimento próprio';
  else raise notice 'FALHOU: não apagou o próprio'; end if;
end $$;

-- ------------------------------------------------------------------ Jean cadastra, Maria tenta mexer
do $$ begin
  insert into public.foods (id, name, kcal) values ('f0000000-0000-0000-0000-000000000001', 'Marmita do Jean', 150);
end $$;

-- ------------------------------------------------------------------ Maria (aluna)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int;
begin
  select count(*) into n from public.foods;
  if n >= 598 then raise notice 'OK  a aluna lê a tabela de alimentos (TACO e os do treinador)';
  else raise notice 'FALHOU: a aluna lê % alimentos', n; end if;
  begin
    insert into public.foods (name, kcal) values ('Da aluna', 10);
    raise notice 'FALHOU: a aluna cadastrou alimento';
  exception when insufficient_privilege then
    raise notice 'OK  a aluna não cadastra alimento';
  end;
  update public.foods set kcal = 1 where id = 'f0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  a aluna não edita alimento do treinador';
  else raise notice 'FALHOU: a aluna editou'; end if;
  delete from public.foods where source = 'taco';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  a aluna não apaga a TACO';
  else raise notice 'FALHOU: a aluna apagou % da TACO', n; end if;
end $$;

-- ------------------------------------------------------------------ sem login
set role anon;
do $$
declare n int;
begin
  select count(*) into n from public.foods;
  raise notice 'FALHOU: quem não está logado leu % alimentos', n;
exception when insufficient_privilege then
  raise notice 'OK  sem login não lê a tabela de alimentos';
end $$;

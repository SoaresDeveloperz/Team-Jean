-- GIFs dos exercícios (supabase/exercicios.sql e exercicios-casamento.sql):
-- formato do media_id, permissões e casamento reaplicável.
\set QUIET on
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'student', 'Jean Treinador', 'jean@x'),
  ('00000000-0000-0000-0000-000000000001', 'student', 'Maria Souza', 'maria@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into public.exercises (id, name, muscle_group, media_id) values
  ('10000000-0000-0000-0000-000000000001', 'Supino Reto com Barra', 'Peito', null),
  ('10000000-0000-0000-0000-000000000002', 'ELEVAÇÃO FRONTAL', 'Ombros', null),
  ('10000000-0000-0000-0000-000000000003', 'Rosca Martelo', 'Bíceps', 'escolha-do-jean'),
  ('10000000-0000-0000-0000-000000000004', 'Prancha', 'Abdômen', null),
  ('10000000-0000-0000-0000-000000000005', 'supino reto com barra (cópia)', 'Peito', null);

-- Casamento rodado duas vezes seguidas, já com exercícios cadastrados.
-- @incluir supabase/exercicios-casamento.sql
create temp table primeira as select id, name, media_id from public.exercises;
-- @incluir supabase/exercicios-casamento.sql

do $$
declare n int; v text;
begin
  if exists (select 1 from pg_constraint where conname = 'exercises_media_id_check' and conrelid = 'public.exercises'::regclass) then
    raise notice 'OK  restrição exercises_media_id_check criada';
  else raise notice 'FALHOU: sem a restrição do media_id'; end if;

  select media_id into v from public.exercises where id = '10000000-0000-0000-0000-000000000001';
  if v = '0025-EIeI8Vf' then raise notice 'OK  casamento: Supino Reto com Barra ganha o GIF do barbell bench press';
  else raise notice 'FALHOU: supino com media_id %', v; end if;
  select media_id into v from public.exercises where id = '10000000-0000-0000-0000-000000000002';
  if v = '0310-3eGE2JC' then raise notice 'OK  casamento ignora maiúsculas e acentos iguais (ELEVAÇÃO FRONTAL)';
  else raise notice 'FALHOU: elevação frontal com media_id %', v; end if;
  select media_id into v from public.exercises where id = '10000000-0000-0000-0000-000000000003';
  if v = 'escolha-do-jean' then raise notice 'OK  casamento não troca o GIF já escolhido pelo treinador';
  else raise notice 'FALHOU: casamento sobrescreveu o GIF (%)', v; end if;
  select count(*) into n from public.exercises where id in ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005') and media_id is null;
  if n = 2 then raise notice 'OK  sem equivalente (Prancha) ou nome diferente: continua sem GIF';
  else raise notice 'FALHOU: casou exercício sem equivalente'; end if;
  select count(*) into n from public.exercises e join primeira p using (id) where e.name = p.name and e.media_id is not distinct from p.media_id;
  if n = 5 and (select count(*) from public.exercises) = 5 then raise notice 'OK  rodar o casamento de novo não muda nada (idempotente, sem renomear nem duplicar)';
  else raise notice 'FALHOU: segunda rodada mudou % linhas', 5 - n; end if;

  -- Formato: só o nome do arquivo, nunca um endereço.
  begin update public.exercises set media_id = 'videos/0001-2gPfomN' where id = '10000000-0000-0000-0000-000000000004';
    raise notice 'FALHOU: aceitou media_id com barra';
  exception when check_violation then raise notice 'OK  media_id com "/" recusado'; end;
  begin update public.exercises set media_id = 'https://exemplo.com/a.gif' where id = '10000000-0000-0000-0000-000000000004';
    raise notice 'FALHOU: aceitou endereço no media_id';
  exception when check_violation then raise notice 'OK  media_id com endereço (http) recusado'; end;
  begin update public.exercises set media_id = '0001.gif' where id = '10000000-0000-0000-0000-000000000004';
    raise notice 'FALHOU: aceitou extensão no media_id';
  exception when check_violation then raise notice 'OK  media_id com ponto/extensão recusado'; end;
  begin update public.exercises set media_id = '' where id = '10000000-0000-0000-0000-000000000004';
    raise notice 'FALHOU: aceitou media_id vazio';
  exception when check_violation then raise notice 'OK  media_id vazio recusado (sem GIF é null)'; end;
  begin update public.exercises set media_id = repeat('a', 65) where id = '10000000-0000-0000-0000-000000000004';
    raise notice 'FALHOU: aceitou media_id longo';
  exception when check_violation then raise notice 'OK  media_id acima de 64 caracteres recusado'; end;
end $$;

-- Permissões: aluno lê o GIF, mas só o treinador muda.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare n int; v text;
begin
  select media_id into v from public.exercises where id = '10000000-0000-0000-0000-000000000001';
  if v = '0025-EIeI8Vf' then raise notice 'OK  aluna lê o media_id do exercício'; else raise notice 'FALHOU: aluna não lê o media_id'; end if;
  update public.exercises set media_id = '0001-2gPfomN' where id = '10000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK  aluna não troca o GIF do exercício'; else raise notice 'FALHOU: aluna trocou o GIF'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  update public.exercises set media_id = '0001-2gPfomN' where id = '10000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  treinador vincula um GIF válido'; else raise notice 'FALHOU: treinador não vinculou o GIF'; end if;
  update public.exercises set media_id = null where id = '10000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK  treinador tira o GIF (volta a null)'; else raise notice 'FALHOU: não tirou o GIF'; end if;
  insert into public.exercises (name, muscle_group, media_id) values ('Supino Inclinado com Halteres', 'Peito', '0314-ns0SIbU');
  raise notice 'OK  treinador cria exercício já com o GIF da biblioteca';
  begin insert into public.exercises (name, muscle_group, media_id) values ('Invasor', 'Peito', '../../segredo');
    raise notice 'FALHOU: criou exercício com media_id inválido';
  exception when check_violation then raise notice 'OK  criar com media_id inválido é recusado'; end;
end $$;
reset role;

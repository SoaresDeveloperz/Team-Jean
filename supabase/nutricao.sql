-- =============================================================================
-- Team Jean — Nutrição: tabela de alimentos (base da aba de nutrição)
-- =============================================================================
-- Como usar:
--   1. Supabase → SQL Editor → cole este arquivo → Run.
--   2. Depois rode o supabase/nutricao-taco.sql (os 597 alimentos da TACO).
--   3. Pode ser rodado mais de uma vez (é idempotente), em qualquer ordem com
--      os outros arquivos de supabase/ (o da TACO precisa vir depois deste).
--
-- O que ele cria:
--   - foods: alimentos com energia e macros por 100 g. Origem 'taco' (Tabela
--     Brasileira de Composição de Alimentos, NEPA/UNICAMP, 2011) ou 'custom'
--     (cadastrado à mão pelo treinador, para o que não está na TACO: whey,
--     marmita, produto de marca).
--   - Valor vazio (null) significa "sem dado" (célula em branco da TACO ou não
--     informado pelo treinador) e nunca é o mesmo que zero. Zero é zero de verdade:
--     o "NA" da TACO (não aplicável, como fibra na carne) e o traço ("Tr") entram como 0.
--     Quem soma precisa avisar quando falta dado.
--
-- Permissões: todo usuário logado lê (não tem dado de aluno aqui); só o treinador
-- cadastra, edita e apaga, e só alimentos 'custom'. Os da TACO ninguém muda pelo app.
--
-- Até este arquivo ser rodado, o app funciona como antes (sem a aba de nutrição).
-- =============================================================================

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'custom',
  taco_number smallint unique,
  name text not null,
  group_name text,
  kcal numeric(8,2),
  protein_g numeric(8,2),
  fat_g numeric(8,2),
  carb_g numeric(8,2),
  fiber_g numeric(8,2),
  sodium_mg numeric(10,2),
  cholesterol_mg numeric(8,2),
  micros jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- "not valid": vale para o que for gravado daqui em diante.
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check
  check (source in ('taco', 'custom') and ((source = 'taco') = (taco_number is not null))) not valid;
alter table public.foods drop constraint if exists foods_name_check;
alter table public.foods add constraint foods_name_check
  check (char_length(btrim(name)) between 2 and 120 and (group_name is null or char_length(group_name) <= 60)) not valid;
-- Por 100 g: energia até 900 kcal (gordura pura), macros e fibra até 100 g.
alter table public.foods drop constraint if exists foods_values_check;
alter table public.foods add constraint foods_values_check
  check (
    coalesce(kcal, 0) between 0 and 900
    and coalesce(protein_g, 0) between 0 and 100
    and coalesce(fat_g, 0) between 0 and 100
    and coalesce(carb_g, 0) between 0 and 100
    and coalesce(fiber_g, 0) between 0 and 100
    and coalesce(sodium_mg, 0) between 0 and 40000
    and coalesce(cholesterol_mg, 0) between 0 and 5000
    and coalesce(protein_g, 0) + coalesce(fat_g, 0) + coalesce(carb_g, 0) <= 105
  ) not valid;
alter table public.foods drop constraint if exists foods_micros_check;
alter table public.foods add constraint foods_micros_check
  check (jsonb_typeof(micros) = 'object' and pg_column_size(micros) <= 2000) not valid;

comment on table public.foods is
  'Alimentos por 100 g. source taco = Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed., NEPA/UNICAMP, 2011; custom = cadastrado pelo treinador.';
comment on column public.foods.micros is
  'Umidade, cinzas, minerais e vitaminas por 100 g; a unidade fica no nome da chave (ca_mg, retinol_ug...). Chave ausente = sem dado.';

alter table public.foods enable row level security;
revoke all on public.foods from anon;
grant select, insert, update, delete on public.foods to authenticated;

drop policy if exists "foods: logados leem" on public.foods;
create policy "foods: logados leem" on public.foods
  for select to authenticated using (true);

drop policy if exists "foods: treinador cria os seus" on public.foods;
create policy "foods: treinador cria os seus" on public.foods
  for insert to authenticated
  with check (public.is_admin() and source = 'custom' and taco_number is null);

drop policy if exists "foods: treinador edita os seus" on public.foods;
create policy "foods: treinador edita os seus" on public.foods
  for update to authenticated
  using (public.is_admin() and source = 'custom')
  with check (public.is_admin() and source = 'custom' and taco_number is null);

drop policy if exists "foods: treinador apaga os seus" on public.foods;
create policy "foods: treinador apaga os seus" on public.foods
  for delete to authenticated
  using (public.is_admin() and source = 'custom');

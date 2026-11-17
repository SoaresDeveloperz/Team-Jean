-- =============================================================================
-- Team Jean — Nutrição: plano alimentar de cada aluno
-- =============================================================================
-- Como usar:
--   1. Rode antes o supabase/nutricao.sql (alimentos) e o supabase/policies.sql.
--   2. Supabase → SQL Editor → cole este arquivo → Run.
--   3. Pode ser rodado mais de uma vez (é idempotente).
--
-- O que ele cria:
--   - nutrition_plans: UM plano por aluno (a existência do plano é o que liga a
--     "Alimentação" para aquele aluno), com o responsável técnico (nome e CRN do
--     nutricionista), metas do dia (kcal e macros, opcionais) e observações.
--   - nutrition_meals: as refeições do plano (Café da manhã, Almoço...), com horário opcional.
--   - nutrition_meal_items: os alimentos de cada refeição, em gramas, com a medida
--     caseira em texto ("2 unidades", "1 concha") só para o aluno entender.
--
-- Permissões: o aluno lê só o plano dele; só o treinador cria, edita e apaga. Alimento
-- que está em algum plano não pode ser apagado, e o alimento próprio do treinador que
-- está em um plano não muda de valores (duplique o alimento). Dado de saúde: ficam fora
-- de log e do texto de notificação.
--
-- Até este arquivo ser rodado, o app funciona como antes: a aba "Nutrição" do treinador
-- mostra um aviso pedindo para rodá-lo e o aluno não vê a "Alimentação".
-- =============================================================================

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.profiles (id) on delete cascade,
  responsible_name text not null,
  responsible_crn text not null,
  kcal_target integer,
  protein_target_g integer,
  carb_target_g integer,
  fat_target_g integer,
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans (id) on delete cascade,
  name text not null,
  meal_time text,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.nutrition_meals (id) on delete cascade,
  -- restrict: alimento que está num plano não pode ser apagado.
  food_id uuid not null references public.foods (id) on delete restrict,
  grams numeric(7,1) not null,
  portion_text text,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists nutrition_meals_plan_idx on public.nutrition_meals (plan_id);
create index if not exists nutrition_meal_items_meal_idx on public.nutrition_meal_items (meal_id);
create index if not exists nutrition_meal_items_food_idx on public.nutrition_meal_items (food_id);

-- "not valid": vale para o que for gravado daqui em diante.
alter table public.nutrition_plans drop constraint if exists nutrition_plans_responsible_check;
alter table public.nutrition_plans add constraint nutrition_plans_responsible_check
  check (
    char_length(responsible_name) <= 80 and char_length(btrim(responsible_name)) >= 3
    and char_length(responsible_crn) <= 30 and char_length(btrim(responsible_crn)) >= 4
  ) not valid;
alter table public.nutrition_plans drop constraint if exists nutrition_plans_targets_check;
alter table public.nutrition_plans add constraint nutrition_plans_targets_check
  check (
    (kcal_target is null or kcal_target between 800 and 10000)
    and (protein_target_g is null or protein_target_g between 0 and 1000)
    and (carb_target_g is null or carb_target_g between 0 and 1500)
    and (fat_target_g is null or fat_target_g between 0 and 600)
    and (notes is null or char_length(notes) <= 500)
  ) not valid;
alter table public.nutrition_meals drop constraint if exists nutrition_meals_check;
alter table public.nutrition_meals add constraint nutrition_meals_check
  check (
    char_length(name) <= 40 and char_length(btrim(name)) >= 1
    and (meal_time is null or meal_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    and position between 0 and 30
  ) not valid;
alter table public.nutrition_meal_items drop constraint if exists nutrition_meal_items_check;
alter table public.nutrition_meal_items add constraint nutrition_meal_items_check
  check (
    grams > 0 and grams <= 5000
    and (portion_text is null or char_length(portion_text) <= 60)
    and position between 0 and 60
  ) not valid;

comment on table public.nutrition_plans is
  'Plano alimentar do aluno (um por aluno). O responsável técnico (nutricionista) aparece para o aluno. Dado de saúde.';

-- Qualquer mudança nas refeições e nos itens atualiza o "atualizado em" do plano.
create or replace function public.touch_nutrition_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target uuid;
begin
  if tg_table_name = 'nutrition_meals' then
    target := coalesce(new.plan_id, old.plan_id);
  else
    select plan_id into target from public.nutrition_meals where id = coalesce(new.meal_id, old.meal_id);
  end if;
  update public.nutrition_plans set updated_at = clock_timestamp() where id = target;
  return null;
end;
$$;

revoke execute on function public.touch_nutrition_plan() from public, anon, authenticated;

create or replace function public.stamp_nutrition_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke execute on function public.stamp_nutrition_plan() from public, anon, authenticated;

drop trigger if exists stamp_nutrition_plan on public.nutrition_plans;
create trigger stamp_nutrition_plan
  before update on public.nutrition_plans
  for each row execute function public.stamp_nutrition_plan();

drop trigger if exists touch_nutrition_plan_meals on public.nutrition_meals;
create trigger touch_nutrition_plan_meals
  after insert or update or delete on public.nutrition_meals
  for each row execute function public.touch_nutrition_plan();
drop trigger if exists touch_nutrition_plan_items on public.nutrition_meal_items;
create trigger touch_nutrition_plan_items
  after insert or update or delete on public.nutrition_meal_items
  for each row execute function public.touch_nutrition_plan();

-- Alimento próprio que já está num plano não muda de valores (o plano do aluno mudaria
-- sem ninguém perceber): o treinador duplica o alimento. Renomear pode. A TACO fica de fora.
create or replace function public.protect_used_food()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.source = 'custom'
     and row(new.kcal, new.protein_g, new.fat_g, new.carb_g, new.fiber_g, new.sodium_mg, new.cholesterol_mg, new.micros)
         is distinct from row(old.kcal, old.protein_g, old.fat_g, old.carb_g, old.fiber_g, old.sodium_mg, old.cholesterol_mg, old.micros)
     and exists (select 1 from public.nutrition_meal_items where food_id = old.id) then
    raise exception 'Este alimento já está em um plano: duplique-o em vez de mudar os valores.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_used_food() from public, anon, authenticated;

drop trigger if exists protect_used_food on public.foods;
create trigger protect_used_food
  before update on public.foods
  for each row execute function public.protect_used_food();

-- Permissões
alter table public.nutrition_plans enable row level security;
alter table public.nutrition_meals enable row level security;
alter table public.nutrition_meal_items enable row level security;
revoke all on public.nutrition_plans, public.nutrition_meals, public.nutrition_meal_items from anon;
grant select, insert, update, delete on public.nutrition_plans, public.nutrition_meals, public.nutrition_meal_items to authenticated;

drop policy if exists "nutrition_plans: aluno lê o seu, treinador lê tudo" on public.nutrition_plans;
create policy "nutrition_plans: aluno lê o seu, treinador lê tudo" on public.nutrition_plans
  for select to authenticated using (student_id = (select auth.uid()) or public.is_admin());
drop policy if exists "nutrition_plans: treinador cria" on public.nutrition_plans;
create policy "nutrition_plans: treinador cria" on public.nutrition_plans
  for insert to authenticated with check (public.is_admin());
drop policy if exists "nutrition_plans: treinador edita" on public.nutrition_plans;
create policy "nutrition_plans: treinador edita" on public.nutrition_plans
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "nutrition_plans: treinador apaga" on public.nutrition_plans;
create policy "nutrition_plans: treinador apaga" on public.nutrition_plans
  for delete to authenticated using (public.is_admin());

drop policy if exists "nutrition_meals: aluno lê as suas, treinador lê tudo" on public.nutrition_meals;
create policy "nutrition_meals: aluno lê as suas, treinador lê tudo" on public.nutrition_meals
  for select to authenticated using (
    public.is_admin() or exists (select 1 from public.nutrition_plans p where p.id = nutrition_meals.plan_id and p.student_id = (select auth.uid()))
  );
drop policy if exists "nutrition_meals: treinador cria" on public.nutrition_meals;
create policy "nutrition_meals: treinador cria" on public.nutrition_meals
  for insert to authenticated with check (public.is_admin());
drop policy if exists "nutrition_meals: treinador edita" on public.nutrition_meals;
create policy "nutrition_meals: treinador edita" on public.nutrition_meals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "nutrition_meals: treinador apaga" on public.nutrition_meals;
create policy "nutrition_meals: treinador apaga" on public.nutrition_meals
  for delete to authenticated using (public.is_admin());

drop policy if exists "nutrition_meal_items: aluno lê os seus, treinador lê tudo" on public.nutrition_meal_items;
create policy "nutrition_meal_items: aluno lê os seus, treinador lê tudo" on public.nutrition_meal_items
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.nutrition_meals m join public.nutrition_plans p on p.id = m.plan_id
      where m.id = nutrition_meal_items.meal_id and p.student_id = (select auth.uid())
    )
  );
drop policy if exists "nutrition_meal_items: treinador cria" on public.nutrition_meal_items;
create policy "nutrition_meal_items: treinador cria" on public.nutrition_meal_items
  for insert to authenticated with check (public.is_admin());
drop policy if exists "nutrition_meal_items: treinador edita" on public.nutrition_meal_items;
create policy "nutrition_meal_items: treinador edita" on public.nutrition_meal_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "nutrition_meal_items: treinador apaga" on public.nutrition_meal_items;
create policy "nutrition_meal_items: treinador apaga" on public.nutrition_meal_items
  for delete to authenticated using (public.is_admin());

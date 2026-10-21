-- =============================================================================
-- Team Jean — Gestão: push, recado do treino, anamnese, avaliação física e
-- financeiro
-- =============================================================================
-- Como usar:
--   1. Rode antes o supabase/policies.sql (este arquivo usa public.is_admin()).
--   2. Supabase → SQL Editor → cole este arquivo → Run.
--   3. Pode ser rodado mais de uma vez (é idempotente), antes ou depois do
--      profile.sql, community.sql e coach.sql.
--
-- O que ele cria:
--   - push_subscriptions: os aparelhos que recebem notificação push. Cada um
--     vê e apaga só os seus; quem grava e envia é o servidor (service_role).
--   - notifications.created_at e notifications.pushed_at: data do aviso e
--     controle do envio por push (os avisos que já existiam não viram push).
--   - Recado do treino: o aluno deixa um recado ao finalizar e o treinador
--     responde (workout_sessions.feedback, feedback_tags, coach_reply). O
--     treinador recebe um aviso quando chega recado.
--   - anamneses: ficha de saúde (PAR-Q) do aluno; o alerta do PAR-Q é
--     calculado pelo banco a partir das respostas e o treinador é avisado
--     quando o aluno preenche a ficha.
--   - Avaliação física: sexo, nascimento e altura em profiles; perímetros,
--     dobras cutâneas e protocolo em body_measurements (se o profile.sql já
--     tiver sido rodado; ele cria as mesmas colunas).
--   - Financeiro: student_billing (mensalidade e vencimento), payments
--     (pagamentos do mês) e coach_settings (chave PIX e lembretes). Só o
--     treinador altera; o aluno vê o próprio plano e os próprios pagamentos.
-- =============================================================================

-- Atualiza updated_at nas tabelas que têm a coluna.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Avisos: data e controle do push
-- -----------------------------------------------------------------------------
-- As linhas antigas ficam sem data (não dá para saber quando foram criadas).
alter table public.notifications add column if not exists created_at timestamptz;
alter table public.notifications alter column created_at set default now();

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'pushed_at'
  ) then
    alter table public.notifications add column pushed_at timestamptz;
    -- Avisos que já existiam não viram push.
    update public.notifications set pushed_at = now();
  end if;
end;
$$;

create index if not exists notifications_push_pending_idx
  on public.notifications (created_at)
  where pushed_at is null;

-- -----------------------------------------------------------------------------
-- Aparelhos inscritos no push
-- -----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 10 and 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: dono vê os seus" on public.push_subscriptions;
create policy "push_subscriptions: dono vê os seus" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions: dono apaga os seus" on public.push_subscriptions;
create policy "push_subscriptions: dono apaga os seus" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Recado do treino e resposta do treinador
-- -----------------------------------------------------------------------------
alter table public.workout_sessions add column if not exists feedback text;
alter table public.workout_sessions add column if not exists feedback_tags text[] not null default '{}';
alter table public.workout_sessions add column if not exists coach_reply text;
alter table public.workout_sessions add column if not exists coach_reply_at timestamptz;

alter table public.workout_sessions drop constraint if exists workout_sessions_feedback_check;
alter table public.workout_sessions add constraint workout_sessions_feedback_check
  check (feedback is null or char_length(feedback) <= 500);

alter table public.workout_sessions drop constraint if exists workout_sessions_feedback_tags_check;
alter table public.workout_sessions add constraint workout_sessions_feedback_tags_check
  check (cardinality(feedback_tags) <= 8 and char_length(array_to_string(feedback_tags, ',')) <= 200);

alter table public.workout_sessions drop constraint if exists workout_sessions_coach_reply_check;
alter table public.workout_sessions add constraint workout_sessions_coach_reply_check
  check (coach_reply is null or char_length(trim(coach_reply)) between 1 and 500);

-- Só o treinador responde (o aluno pode editar a própria sessão, mas não a resposta).
create or replace function public.protect_coach_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.coach_reply is distinct from old.coach_reply or new.coach_reply_at is distinct from old.coach_reply_at)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Somente o treinador responde o recado do treino';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_coach_reply on public.workout_sessions;
create trigger protect_coach_reply
  before update on public.workout_sessions
  for each row execute function public.protect_coach_reply();

-- Aviso no sino do treinador quando o aluno finaliza o treino com recado. Se o
-- aviso falhar (ex.: restrição antiga em notifications.type), o treino é salvo
-- do mesmo jeito.
create or replace function public.notify_workout_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_name text;
  workout_name text;
  body text;
begin
  if new.status is distinct from 'completed' then
    return new;
  end if;
  if coalesce(trim(new.feedback), '') = '' and cardinality(coalesce(new.feedback_tags, '{}')) = 0 then
    return new;
  end if;
  -- Só quando o recado é novo (finalizou agora ou mudou o recado).
  if tg_op = 'UPDATE'
     and old.status = 'completed'
     and new.feedback is not distinct from old.feedback
     and new.feedback_tags is not distinct from old.feedback_tags then
    return new;
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Aluno') into student_name
  from public.profiles where id = new.student_id;
  select name into workout_name from public.assigned_workouts where id = new.assigned_workout_id;

  body := concat_ws(
    E'\n',
    concat_ws(' · ', coalesce(workout_name, 'Treino'), case when new.session_rpe is not null then 'RPE ' || new.session_rpe end),
    nullif(array_to_string(new.feedback_tags, ' · '), ''),
    case when coalesce(trim(new.feedback), '') <> '' then '“' || left(trim(new.feedback), 300) || '”' end
  );

  begin
    insert into public.notifications (recipient_id, type, title, message)
    select p.id, 'feedback', 'Recado de ' || coalesce(student_name, 'Aluno'), body
    from public.profiles p
    where lower(trim(p.role::text)) = 'admin';
  exception when check_violation then
    insert into public.notifications (recipient_id, type, title, message)
    select p.id, 'announcement', 'Recado de ' || coalesce(student_name, 'Aluno'), body
    from public.profiles p
    where lower(trim(p.role::text)) = 'admin';
  end;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists workout_sessions_notify_feedback on public.workout_sessions;
create trigger workout_sessions_notify_feedback
  after insert or update of status, feedback, feedback_tags on public.workout_sessions
  for each row execute function public.notify_workout_feedback();

-- -----------------------------------------------------------------------------
-- Anamnese (ficha de saúde com PAR-Q)
-- -----------------------------------------------------------------------------
create table if not exists public.anamneses (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  -- { parq: { pergunta: true/false, ... }, conditions: [...], injuries, ... }
  answers jsonb not null default '{}'::jsonb,
  -- Calculado pelo banco: alguma resposta "sim" no PAR-Q.
  parq_positive boolean not null default false,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.anamneses drop constraint if exists anamneses_answers_check;
alter table public.anamneses add constraint anamneses_answers_check
  check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 16000);

create or replace function public.anamneses_prepare()
returns trigger
language plpgsql
as $$
begin
  new.parq_positive := coalesce(
    (
      select bool_or(value = 'true')
      from jsonb_each_text(
        case when jsonb_typeof(new.answers -> 'parq') = 'object' then new.answers -> 'parq' else '{}'::jsonb end
      )
    ),
    false
  );
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists anamneses_prepare on public.anamneses;
create trigger anamneses_prepare
  before insert or update on public.anamneses
  for each row execute function public.anamneses_prepare();

-- Aviso para o treinador quando o aluno preenche a ficha ou quando o PAR-Q
-- passa a ter um "sim" (o envio falhar não impede salvar a ficha).
create or replace function public.anamneses_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_name text;
  title text;
  body text;
begin
  -- Só o que o próprio aluno preenche gera aviso.
  if auth.uid() is distinct from new.student_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and (not new.parq_positive or old.parq_positive) then
    return new;
  end if;
  select coalesce(nullif(trim(full_name), ''), 'Aluno') into student_name from public.profiles where id = new.student_id;
  if new.parq_positive then
    title := 'PAR-Q com alerta: ' || coalesce(student_name, 'Aluno');
    body := 'Respondeu "sim" em alguma pergunta do PAR-Q. Confira a ficha de saúde antes de intensificar o treino.';
  else
    title := 'Ficha de saúde de ' || coalesce(student_name, 'Aluno');
    body := 'Anamnese preenchida, sem alertas no PAR-Q.';
  end if;
  begin
    insert into public.notifications (recipient_id, type, title, message)
    select p.id, 'health', title, body from public.profiles p where lower(trim(p.role::text)) = 'admin';
  exception when check_violation then
    insert into public.notifications (recipient_id, type, title, message)
    select p.id, 'announcement', title, body from public.profiles p where lower(trim(p.role::text)) = 'admin';
  end;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists anamneses_notify on public.anamneses;
create trigger anamneses_notify
  after insert or update of answers on public.anamneses
  for each row execute function public.anamneses_notify();

alter table public.anamneses enable row level security;

drop policy if exists "anamneses: aluno e treinador leem" on public.anamneses;
create policy "anamneses: aluno e treinador leem" on public.anamneses
  for select to authenticated
  using (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "anamneses: aluno e treinador preenchem" on public.anamneses;
create policy "anamneses: aluno e treinador preenchem" on public.anamneses
  for insert to authenticated
  with check (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "anamneses: aluno e treinador atualizam" on public.anamneses;
create policy "anamneses: aluno e treinador atualizam" on public.anamneses
  for update to authenticated
  using (student_id = (select auth.uid()) or public.is_admin())
  with check (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "anamneses: treinador apaga" on public.anamneses;
create policy "anamneses: treinador apaga" on public.anamneses
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Avaliação física
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists sex text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists height_cm numeric(4, 1);

alter table public.profiles drop constraint if exists profiles_sex_check;
alter table public.profiles add constraint profiles_sex_check
  check (sex is null or sex in ('M', 'F'));

alter table public.profiles drop constraint if exists profiles_birth_date_check;
alter table public.profiles add constraint profiles_birth_date_check
  check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01');

alter table public.profiles drop constraint if exists profiles_height_cm_check;
alter table public.profiles add constraint profiles_height_cm_check
  check (height_cm is null or height_cm between 80 and 250);

-- Perímetros e dobras em body_measurements (mesma definição do profile.sql).
do $$
begin
  if to_regclass('public.body_measurements') is null then
    return;
  end if;
  alter table public.body_measurements add column if not exists perimeters jsonb;
  alter table public.body_measurements add column if not exists skinfolds jsonb;
  alter table public.body_measurements add column if not exists protocol text;

  alter table public.body_measurements drop constraint if exists body_measurements_perimeters_check;
  alter table public.body_measurements add constraint body_measurements_perimeters_check
    check (perimeters is null or (jsonb_typeof(perimeters) = 'object' and octet_length(perimeters::text) <= 2000));
  alter table public.body_measurements drop constraint if exists body_measurements_skinfolds_check;
  alter table public.body_measurements add constraint body_measurements_skinfolds_check
    check (skinfolds is null or (jsonb_typeof(skinfolds) = 'object' and octet_length(skinfolds::text) <= 1000));
  alter table public.body_measurements drop constraint if exists body_measurements_protocol_check;
  alter table public.body_measurements add constraint body_measurements_protocol_check
    check (protocol is null or protocol in ('pollock3', 'pollock7'));

  -- Uma avaliação só com perímetros ou dobras também vale.
  alter table public.body_measurements drop constraint if exists body_measurements_has_data;
  alter table public.body_measurements add constraint body_measurements_has_data check (
    weight_kg is not null or body_fat is not null or waist_cm is not null or cardinality(photos) > 0
    or perimeters is not null or skinfolds is not null
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Financeiro
-- -----------------------------------------------------------------------------
create table if not exists public.student_billing (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  monthly_fee numeric(10, 2) not null check (monthly_fee > 0 and monthly_fee <= 100000),
  -- Dia do vencimento (nos meses mais curtos, vale o último dia do mês).
  due_day smallint not null default 10 check (due_day between 1 and 31),
  active boolean not null default true,
  -- Primeiro mês cobrado (meses anteriores não aparecem como atrasados).
  starts_on date not null default (date_trunc('month', now() at time zone 'America/Sao_Paulo')::date),
  -- Último lembrete automático (evita mandar dois no mesmo dia).
  last_reminder_on date,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists student_billing_touch on public.student_billing;
create trigger student_billing_touch
  before update on public.student_billing
  for each row execute function public.touch_updated_at();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- Mês de referência, sempre no dia 1 (ex.: 2026-10-01).
  reference_month date not null check (extract(day from reference_month) = 1),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 100000),
  paid_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  method text not null default 'pix' check (method in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, reference_month)
);

create index if not exists payments_month_idx on public.payments (reference_month);

create table if not exists public.coach_settings (
  id smallint primary key default 1 check (id = 1),
  pix_key text check (pix_key is null or char_length(pix_key) between 1 and 77),
  pix_name text check (pix_name is null or char_length(pix_name) between 1 and 25),
  pix_city text check (pix_city is null or char_length(pix_city) between 1 and 15),
  -- Lembrete automático no vencimento (rota /api/cron/billing).
  billing_reminders boolean not null default false,
  updated_at timestamptz not null default now()
);

drop trigger if exists coach_settings_touch on public.coach_settings;
create trigger coach_settings_touch
  before update on public.coach_settings
  for each row execute function public.touch_updated_at();

alter table public.student_billing enable row level security;
alter table public.payments enable row level security;
alter table public.coach_settings enable row level security;

drop policy if exists "student_billing: aluno vê o seu, treinador todos" on public.student_billing;
create policy "student_billing: aluno vê o seu, treinador todos" on public.student_billing
  for select to authenticated
  using (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "student_billing: treinador altera" on public.student_billing;
create policy "student_billing: treinador altera" on public.student_billing
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "payments: aluno vê os seus, treinador todos" on public.payments;
create policy "payments: aluno vê os seus, treinador todos" on public.payments
  for select to authenticated
  using (student_id = (select auth.uid()) or public.is_admin());

drop policy if exists "payments: treinador registra" on public.payments;
create policy "payments: treinador registra" on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A chave PIX é pública para os alunos (é o que eles copiam para pagar).
drop policy if exists "coach_settings: logados leem" on public.coach_settings;
create policy "coach_settings: logados leem" on public.coach_settings
  for select to authenticated
  using (true);

drop policy if exists "coach_settings: treinador altera" on public.coach_settings;
create policy "coach_settings: treinador altera" on public.coach_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

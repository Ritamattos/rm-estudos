-- Migration 009: Atividades (Testes + Diário)
-- Execute este SQL no Supabase SQL Editor

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_test_offers (quadro Kanban de testes de oferta)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_test_offers (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null,
  description text        not null default '',
  status      text        not null default 'para_testar'
              check (status in ('para_testar', 'testando', 'aprovado', 'reprovado')),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table rm_test_offers enable row level security;

create policy "Users manage own test offers"
  on rm_test_offers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_test_offers_user_id_idx on rm_test_offers(user_id);
create index if not exists rm_test_offers_status_idx   on rm_test_offers(user_id, status);

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_daily_activities (Diário de atividades)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_daily_activities (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  title         text        not null,
  activity_date date        not null default current_date,
  status        text        not null default 'em_progresso'
                check (status in ('em_progresso', 'concluido')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table rm_daily_activities enable row level security;

create policy "Users manage own daily activities"
  on rm_daily_activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_daily_activities_user_id_idx on rm_daily_activities(user_id);
create index if not exists rm_daily_activities_date_idx    on rm_daily_activities(user_id, activity_date);

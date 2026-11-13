-- Migration 016: Rotina (perfil Pessoal) — refeições, água, lanches,
-- cardápio, lista de compras e peso.
-- Execute este SQL no Supabase SQL Editor

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_rotina_dias (uma linha por dia)
--   refeicoes: { "almoco": { "status": "comi"|"pulei"|"subst", "hora": "12:30", "nota": "" }, … }
--   agua_log:  ml de cada copo, em ordem (o último pode ser desfeito)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_rotina_dias (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  data       date        not null,
  acordou    text        not null default '',
  dormiu     text        not null default '',
  treino     boolean     not null default false,
  refeicoes  jsonb       not null default '{}'::jsonb,
  agua_log   jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, data)
);

alter table rm_rotina_dias enable row level security;
drop policy if exists "Users manage own rotina dias" on rm_rotina_dias;
create policy "Users manage own rotina dias"
  on rm_rotina_dias for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_rotina_lanches (banco de lanches baratos)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_rotina_lanches (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  nome         text        not null,
  ingredientes text        not null default '',
  preparo      text        not null default '',
  favorito     boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table rm_rotina_lanches enable row level security;
drop policy if exists "Users manage own rotina lanches" on rm_rotina_lanches;
create policy "Users manage own rotina lanches"
  on rm_rotina_lanches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_rotina_lanches_user_idx on rm_rotina_lanches(user_id);

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_rotina_config (linha única por usuário: metas e cardápio)
--   plano_lanches: { "seg": { "lanche_manha": "<id>", "lanche_tarde": "<id>", "lanche_noite": "<id>" }, … }
-- ──────────────────────────────────────────────────────────
create table if not exists rm_rotina_config (
  user_id                uuid        primary key references auth.users(id) on delete cascade,
  meta_agua_ml           integer     not null default 2000,
  meta_peso              numeric     not null default 48,
  meta_data              date        not null default '2027-02-28',
  cafe_padrao            text        not null default '',
  cafe_ingredientes      text        not null default '',
  marmita_a              text        not null default '',
  marmita_a_ingredientes text        not null default '',
  marmita_b              text        not null default '',
  marmita_b_ingredientes text        not null default '',
  semana_ativa           text        not null default 'A' check (semana_ativa in ('A', 'B')),
  plano_lanches          jsonb       not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

alter table rm_rotina_config enable row level security;
drop policy if exists "Users manage own rotina config" on rm_rotina_config;
create policy "Users manage own rotina config"
  on rm_rotina_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_rotina_compras (lista de compras)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_rotina_compras (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  nome       text        not null,
  quantidade text        not null default '',
  comprado   boolean     not null default false,
  origem     text        not null default 'manual' check (origem in ('manual', 'cardapio')),
  created_at timestamptz not null default now()
);

alter table rm_rotina_compras enable row level security;
drop policy if exists "Users manage own rotina compras" on rm_rotina_compras;
create policy "Users manage own rotina compras"
  on rm_rotina_compras for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_rotina_compras_user_idx on rm_rotina_compras(user_id);

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_rotina_peso (registro semanal)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_rotina_peso (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  data       date        not null,
  kg         numeric     not null,
  created_at timestamptz not null default now(),
  unique (user_id, data)
);

alter table rm_rotina_peso enable row level security;
drop policy if exists "Users manage own rotina peso" on rm_rotina_peso;
create policy "Users manage own rotina peso"
  on rm_rotina_peso for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_rotina_peso_user_idx on rm_rotina_peso(user_id, data);

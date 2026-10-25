-- Migration 013: Criativos (acompanhamento de criativos do Meta Ads)
-- Execute este SQL no Supabase SQL Editor

-- ──────────────────────────────────────────────────────────
-- TABELA: criativos
-- ──────────────────────────────────────────────────────────
create table if not exists criativos (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  nome         text        not null,
  angulo       text        not null default '',
  formato      text        not null default 'video'
               check (formato in ('video', 'imagem', 'carrossel')),
  fase         text        not null default 'teste'
               check (fase in ('teste', 'pre_escala', 'escala', 'pausado', 'cortado')),
  data_inicio  date        not null default current_date,
  observacoes  text        not null default '',
  created_at   timestamptz not null default now()
);

alter table criativos enable row level security;

drop policy if exists "Users manage own criativos" on criativos;
create policy "Users manage own criativos"
  on criativos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists criativos_user_id_idx on criativos(user_id);
create index if not exists criativos_fase_idx    on criativos(user_id, fase);

-- ──────────────────────────────────────────────────────────
-- TABELA: criativos_metricas (uma linha por criativo por dia)
-- ──────────────────────────────────────────────────────────
create table if not exists criativos_metricas (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  criativo_id      uuid        not null references criativos(id) on delete cascade,
  data             date        not null default current_date,
  gasto            numeric     not null default 0,
  impressoes       integer     not null default 0,
  alcance          integer     not null default 0,
  cliques_link     integer     not null default 0,
  conversas        integer     not null default 0,
  vendas           integer     not null default 0,
  faturamento      numeric,
  orcamento_diario numeric,
  created_at       timestamptz not null default now(),
  unique (criativo_id, data)
);

alter table criativos_metricas enable row level security;

drop policy if exists "Users manage own criativos metricas" on criativos_metricas;
create policy "Users manage own criativos metricas"
  on criativos_metricas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists criativos_metricas_user_id_idx  on criativos_metricas(user_id);
create index if not exists criativos_metricas_criativo_idx on criativos_metricas(criativo_id, data);

-- ──────────────────────────────────────────────────────────
-- TABELA: criativos_config (linha única por usuário)
-- ──────────────────────────────────────────────────────────
create table if not exists criativos_config (
  user_id              uuid        primary key references auth.users(id) on delete cascade,
  ticket_medio         numeric,
  cpa_maximo           numeric,
  ctr_minimo           numeric     not null default 1,
  freq_max_pre_escala  numeric     not null default 2,
  freq_max_escala      numeric     not null default 3,
  updated_at           timestamptz not null default now()
);

alter table criativos_config enable row level security;

drop policy if exists "Users manage own criativos config" on criativos_config;
create policy "Users manage own criativos config"
  on criativos_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

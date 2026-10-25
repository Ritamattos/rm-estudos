-- Migration 014: Criativos organizados em Pastas → Ofertas
-- Execute este SQL no Supabase SQL Editor
--
-- ATENÇÃO: apaga os criativos existentes que não pertencem a nenhuma oferta
-- (todos os criados antes desta migração), junto com os lançamentos deles.

-- ──────────────────────────────────────────────────────────
-- TABELA: criativos_pastas
-- ──────────────────────────────────────────────────────────
create table if not exists criativos_pastas (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  nome        text        not null,
  ordem       integer     not null default 0,
  created_at  timestamptz not null default now()
);

alter table criativos_pastas enable row level security;

drop policy if exists "Users manage own criativos pastas" on criativos_pastas;
create policy "Users manage own criativos pastas"
  on criativos_pastas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists criativos_pastas_user_id_idx on criativos_pastas(user_id);

-- ──────────────────────────────────────────────────────────
-- TABELA: criativos_ofertas (cada oferta tem sua própria config)
-- ──────────────────────────────────────────────────────────
create table if not exists criativos_ofertas (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  pasta_id             uuid        not null references criativos_pastas(id) on delete cascade,
  nome                 text        not null,
  idioma               text        not null default 'pt' check (idioma in ('pt', 'es', 'en')),
  moeda                text        not null default 'BRL' check (moeda in ('BRL', 'USD', 'EUR')),
  ticket_medio         numeric,
  cpa_maximo           numeric,
  ctr_minimo           numeric     not null default 1,
  freq_max_pre_escala  numeric     not null default 2,
  freq_max_escala      numeric     not null default 3,
  created_at           timestamptz not null default now()
);

alter table criativos_ofertas enable row level security;

drop policy if exists "Users manage own criativos ofertas" on criativos_ofertas;
create policy "Users manage own criativos ofertas"
  on criativos_ofertas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists criativos_ofertas_user_id_idx on criativos_ofertas(user_id);
create index if not exists criativos_ofertas_pasta_idx   on criativos_ofertas(pasta_id);

-- ──────────────────────────────────────────────────────────
-- ALTERAÇÕES: criativos
-- ──────────────────────────────────────────────────────────
alter table criativos add column if not exists oferta_id  uuid references criativos_ofertas(id) on delete cascade;
alter table criativos add column if not exists numero     integer;
alter table criativos add column if not exists link_drive text not null default '';

-- Criativos antigos, sem oferta, são descartados (os lançamentos vão junto
-- pelo on delete cascade de criativos_metricas).
delete from criativos where oferta_id is null;

alter table criativos alter column oferta_id set not null;
alter table criativos alter column numero    set not null;

-- Fase "cortado" passa a se chamar "reprovado".
alter table criativos drop constraint if exists criativos_fase_check;
update criativos set fase = 'reprovado' where fase = 'cortado';
alter table criativos add constraint criativos_fase_check
  check (fase in ('teste', 'pre_escala', 'escala', 'pausado', 'reprovado'));

create index if not exists criativos_oferta_idx on criativos(oferta_id);

-- ──────────────────────────────────────────────────────────
-- A config agora fica em cada oferta
-- ──────────────────────────────────────────────────────────
drop table if exists criativos_config;

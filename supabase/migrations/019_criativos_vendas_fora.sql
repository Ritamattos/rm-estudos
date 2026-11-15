-- Migration 019: Criativos — vendas fora da campanha (indicação, orgânico,
-- cliente que passou o contato). Ficam no nível da OFERTA, nunca de um
-- criativo: entram só no "Total da oferta", não no ranking, CPA, ROAS, ROI,
-- lucro por criativo nem no veredito.
-- Execute este SQL no Supabase SQL Editor ANTES de usar a nova versão.
-- Nada existente é apagado nem alterado: só uma tabela nova.

create table if not exists criativos_vendas_fora (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  oferta_id   uuid        not null references criativos_ofertas(id) on delete cascade,
  data        date        not null,
  vendas      integer     not null default 0,
  faturamento numeric,                         -- vazio = vendas × ticket médio
  observacao  text        not null default '', -- ex: "indicação da Ana"
  created_at  timestamptz not null default now(),
  unique (oferta_id, data)
);

alter table criativos_vendas_fora enable row level security;

drop policy if exists "Users manage own criativos vendas fora" on criativos_vendas_fora;
create policy "Users manage own criativos vendas fora"
  on criativos_vendas_fora for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists criativos_vendas_fora_oferta_idx on criativos_vendas_fora(oferta_id, data);

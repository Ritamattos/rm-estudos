-- Migration 018: Criativos — gasto na moeda da conta de anúncios (Real ou
-- Dólar) convertido para reais com o acréscimo do cartão (IOF + spread, ou
-- impostos de conta em real).
-- Execute este SQL no Supabase SQL Editor ANTES de usar a nova versão.
-- Nada é apagado nem alterado: só colunas novas. Lançamentos antigos ficam
-- como estão (o app os lê como reais, cotação 1, acréscimo 0).

-- Oferta: moeda da conta de anúncios, cotação e acréscimo padrão.
-- (A coluna "moeda" continua sendo a moeda da venda.)
alter table criativos_ofertas add column if not exists moeda_conta text not null default 'BRL';
alter table criativos_ofertas drop constraint if exists criativos_ofertas_moeda_conta_check;
alter table criativos_ofertas add constraint criativos_ofertas_moeda_conta_check
  check (moeda_conta in ('BRL', 'USD'));
alter table criativos_ofertas add column if not exists cotacao         numeric;            -- R$ por US$
alter table criativos_ofertas add column if not exists acrescimo_gasto numeric not null default 0; -- %

-- Lançamento: o que foi digitado e como virou reais. A coluna "gasto"
-- continua sendo o gasto EM REAIS (já com cotação e acréscimo), usado em
-- todos os cálculos.
alter table criativos_metricas add column if not exists gasto_original numeric;  -- valor digitado
alter table criativos_metricas add column if not exists moeda_gasto    text;     -- 'BRL' | 'USD'
alter table criativos_metricas add column if not exists cotacao        numeric;  -- R$ por US$ usada no dia
alter table criativos_metricas add column if not exists acrescimo      numeric;  -- % usado no dia
alter table criativos_metricas drop constraint if exists criativos_metricas_moeda_gasto_check;
alter table criativos_metricas add constraint criativos_metricas_moeda_gasto_check
  check (moeda_gasto is null or moeda_gasto in ('BRL', 'USD'));

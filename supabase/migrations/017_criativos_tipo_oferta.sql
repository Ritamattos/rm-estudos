-- Migration 017: Criativos — tipo da oferta (WhatsApp / Direta) e novos
-- campos do lançamento diário (CTR, frequência, checkouts).
-- Execute este SQL no Supabase SQL Editor ANTES de usar a nova versão.
-- Nada é apagado: ofertas existentes viram "whatsapp" e os lançamentos
-- antigos continuam iguais.

-- Tipo da oferta: para onde o anúncio leva.
alter table criativos_ofertas add column if not exists tipo text not null default 'whatsapp';
alter table criativos_ofertas drop constraint if exists criativos_ofertas_tipo_check;
alter table criativos_ofertas add constraint criativos_ofertas_tipo_check
  check (tipo in ('whatsapp', 'direta'));

-- Lançamento diário:
--   ctr        = CTR (%) como aparece no Gerenciador (ex: 1,8 = 1,8%)
--   frequencia = frequência do dia, como aparece no Gerenciador
--   checkouts  = checkouts iniciados (oferta direta, opcional)
alter table criativos_metricas add column if not exists ctr        numeric;
alter table criativos_metricas add column if not exists frequencia numeric;
alter table criativos_metricas add column if not exists checkouts  integer;

-- Cliques no link passam a ser opcionais: vazio = calcular por
-- impressões × CTR. Valores já lançados não mudam.
alter table criativos_metricas alter column cliques_link drop not null;
alter table criativos_metricas alter column cliques_link drop default;

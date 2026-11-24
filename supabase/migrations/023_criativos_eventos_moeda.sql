-- Migration 023: Criativos — moeda do orçamento nas mudanças (R$ ou US$).
-- Inclui tudo da migration 022 (orçamento anterior e novo).
-- Execute este SQL no Supabase SQL Editor ANTES de usar a nova versão.
-- É completo: funciona mesmo se as migrations 021 e 022 ainda não tiverem
-- rodado (cria o que faltar). Nada existente é apagado.

-- Tabela de mudanças (a mesma da migration 021).
create table if not exists public.criativos_eventos (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  oferta_id   uuid        not null references public.criativos_ofertas(id) on delete cascade,
  criativo_id uuid        references public.criativos(id) on delete set null, -- vazio = campanha inteira
  data        date        not null,
  tipo        text        not null default 'outro'
              check (tipo in ('separou', 'aumentou', 'reduziu', 'pausou', 'reativou', 'novo', 'outro')),
  nota        text        not null default '',
  created_at  timestamptz not null default now()
);

-- Novo: orçamento diário antes e depois da mudança (opcionais).
alter table public.criativos_eventos
  add column if not exists orcamento_anterior numeric,
  add column if not exists orcamento_novo     numeric;

-- Novo na 023: moeda em que o orçamento foi digitado. Vazio = moeda da
-- conta de anúncio da oferta (como era antes).
alter table public.criativos_eventos
  add column if not exists orcamento_moeda text;
alter table public.criativos_eventos
  drop constraint if exists criativos_eventos_orcamento_moeda_check;
alter table public.criativos_eventos
  add constraint criativos_eventos_orcamento_moeda_check
  check (orcamento_moeda is null or orcamento_moeda in ('BRL', 'USD'));

alter table public.criativos_eventos enable row level security;

drop policy if exists "Users manage own criativos eventos" on public.criativos_eventos;
create policy "Users manage own criativos eventos"
  on public.criativos_eventos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists criativos_eventos_oferta_idx   on public.criativos_eventos(oferta_id, data);
create index if not exists criativos_eventos_criativo_idx on public.criativos_eventos(criativo_id, data);

-- Recarrega o cache do PostgREST para as colunas novas aparecerem na hora.
notify pgrst, 'reload schema';

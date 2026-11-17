-- Migration 021: Criativos — aba "Análise" (analista de tráfego por regras).
-- Execute este SQL no Supabase SQL Editor ANTES de usar a nova versão.
-- Nada existente é apagado: só uma coluna nova em criativos, uma coluna nova
-- em criativos_ofertas e uma tabela nova.

-- Grupo na Meta (campanha ou CBO) de cada criativo. Vazio = sem grupo.
alter table public.criativos
  add column if not exists grupo_meta text not null default '';

-- Limites das regras da análise editados na oferta (vazio = padrões).
alter table public.criativos_ofertas
  add column if not exists analise_config jsonb;

-- Mudanças registradas (linha do tempo e comparação antes × depois).
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

alter table public.criativos_eventos enable row level security;

drop policy if exists "Users manage own criativos eventos" on public.criativos_eventos;
create policy "Users manage own criativos eventos"
  on public.criativos_eventos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists criativos_eventos_oferta_idx on public.criativos_eventos(oferta_id, data);

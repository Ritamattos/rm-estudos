-- Migration 010: Histórico de testes (Aprovados / Reprovados)
-- Execute este SQL no Supabase SQL Editor

create table if not exists rm_test_offers_archive (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  source_card_id uuid        references rm_test_offers(id) on delete set null,
  title          text        not null,
  description    text        not null default '',
  result_status  text        not null check (result_status in ('aprovado', 'reprovado')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table rm_test_offers_archive enable row level security;

create policy "Users manage own archived tests"
  on rm_test_offers_archive for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_test_offers_archive_user_id_idx on rm_test_offers_archive(user_id);
create index if not exists rm_test_offers_archive_status_idx  on rm_test_offers_archive(user_id, result_status);
create index if not exists rm_test_offers_archive_source_idx  on rm_test_offers_archive(source_card_id);

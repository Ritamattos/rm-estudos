-- Migration 008: Notion-style notes for subcategories (Marketing / Pessoal)
-- Execute este SQL no Supabase SQL Editor

create table if not exists rm_notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  workspace   text        not null,
  cat_id      uuid        references rm_categories(id) on delete cascade,
  sub_id      uuid        references rm_subcategories(id) on delete cascade,
  title       text        not null default 'Sem título',
  content     text        not null default '',
  note_date   date        not null default current_date,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table rm_notes enable row level security;

create policy "Users manage own notes"
  on rm_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_notes_user_id_idx on rm_notes(user_id);
create index if not exists rm_notes_sub_id_idx  on rm_notes(sub_id);

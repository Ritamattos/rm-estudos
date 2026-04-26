-- ============================================================
-- Migration 001: Biblioteca de Livros e Filmes & Séries
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_books (Biblioteca de Livros)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_books (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null,
  author      text,
  category    text,                          -- Romance, Ficção, Marketing, etc.
  status      text        not null default 'quero_ler'
              check (status in ('lendo', 'lido', 'quero_ler')),
  link        text,                          -- Google Drive ou qualquer URL
  rating      integer     check (rating >= 1 and rating <= 5),
  notes       text,
  cover_url   text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

alter table rm_books enable row level security;

create policy "Users can manage own books"
  on rm_books for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- TABELA: rm_media (Filmes, Séries, Desenhos, Animes)
-- ──────────────────────────────────────────────────────────
create table if not exists rm_media (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null,
  type        text        not null default 'filme'
              check (type in ('filme', 'serie', 'desenho', 'anime')),
  genre       text,                          -- Ação, Comédia, Drama, etc.
  platform    text,                          -- Netflix, Prime, Disney+, etc.
  status      text        not null default 'quero_assistir'
              check (status in ('assistindo', 'assistido', 'quero_assistir')),
  link        text,                          -- URL opcional
  rating      integer     check (rating >= 1 and rating <= 5),
  notes       text,
  cover_url   text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

alter table rm_media enable row level security;

create policy "Users can manage own media"
  on rm_media for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- Índices para performance
-- ──────────────────────────────────────────────────────────
create index if not exists rm_books_user_id_idx   on rm_books(user_id);
create index if not exists rm_books_status_idx    on rm_books(user_id, status);
create index if not exists rm_media_user_id_idx   on rm_media(user_id);
create index if not exists rm_media_status_idx    on rm_media(user_id, status);
create index if not exists rm_media_type_idx      on rm_media(user_id, type);

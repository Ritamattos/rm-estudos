-- Add tipo column to rm_books for filtering by Livro/Série/Filme/Mangá
alter table rm_books add column if not exists tipo text default 'livro';

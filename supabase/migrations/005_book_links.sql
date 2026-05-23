-- Add read and buy link columns to rm_books for Biblioteca card buttons
alter table rm_books add column if not exists link_read text default '';
alter table rm_books add column if not exists link_buy  text default '';

-- Add country column to rm_media for flag display on Cinemateca cards
alter table rm_media add column if not exists country text default '';

-- Add category column to rm_media for sidebar filtering in Cinemateca
alter table rm_media add column if not exists category text default '';

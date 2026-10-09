-- Migration 012: mind maps living alongside notes in rm_notes
-- Execute este SQL no Supabase SQL Editor
--
-- note_type = 'note'    → content holds TipTap HTML (comportamento atual)
-- note_type = 'mindmap' → content holds the mind map tree as a JSON string

alter table rm_notes
  add column if not exists note_type text not null default 'note';

alter table rm_notes
  drop constraint if exists rm_notes_note_type_check;

alter table rm_notes
  add constraint rm_notes_note_type_check check (note_type in ('note', 'mindmap'));

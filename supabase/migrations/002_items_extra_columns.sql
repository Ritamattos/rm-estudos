-- Migration 002: Extra columns for rm_items
-- Execute no Supabase SQL Editor

alter table rm_items add column if not exists status         text not null default 'quero_comecar';
alter table rm_items add column if not exists tipo           text;
alter table rm_items add column if not exists conteudo_nota  text;
alter table rm_items add column if not exists proporcao_capa text default '16:9';

create index if not exists rm_items_status_idx on rm_items(user_id, status);
create index if not exists rm_items_tipo_idx   on rm_items(user_id, tipo);

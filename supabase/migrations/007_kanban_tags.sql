-- Kanban cards linked to categories (Marketing / Pessoal)
create table if not exists rm_kanban_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references rm_categories(id) on delete cascade,
  title text not null,
  status text not null default 'estudar' check (status in ('estudar', 'estudando', 'estudado')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Tags scoped per workspace per user
create table if not exists rm_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace text not null,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- Item <-> Tag junction
create table if not exists rm_item_tags (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references rm_items(id) on delete cascade,
  tag_id uuid not null references rm_tags(id) on delete cascade,
  unique (item_id, tag_id)
);

-- Row Level Security
alter table rm_kanban_cards enable row level security;
alter table rm_tags enable row level security;
alter table rm_item_tags enable row level security;

create policy "Users manage own kanban cards"
  on rm_kanban_cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own tags"
  on rm_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own item tags"
  on rm_item_tags for all
  using (exists (select 1 from rm_items i where i.id = item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from rm_items i where i.id = item_id and i.user_id = auth.uid()));

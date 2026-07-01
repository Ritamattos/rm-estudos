create table if not exists rm_financial_data (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  month_number        integer     not null,
  month_name          text        not null,
  receita_total       numeric     not null default 0,
  lucro_bruto         numeric     not null default 0,
  lucro_liquido       numeric     not null default 0,
  investido_ads       numeric     not null default 0,
  ativos              numeric     not null default 0,
  despesas_fixas      numeric     not null default 0,
  despesas_variaveis  numeric     not null default 0,
  roi                 numeric,
  roas                numeric,
  synced_at           timestamptz not null default now(),
  unique(user_id, month_number)
);

alter table rm_financial_data enable row level security;
create policy "Users manage own financial data"
  on rm_financial_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists rm_financial_offers (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  month_number    integer     not null,
  offer_name      text        not null,
  investido       numeric     not null default 0,
  vendas          numeric     not null default 0,
  receita_total   numeric     not null default 0,
  lucro_bruto     numeric     not null default 0,
  roi             numeric,
  status          text,
  synced_at       timestamptz not null default now()
);

alter table rm_financial_offers enable row level security;
create policy "Users manage own financial offers"
  on rm_financial_offers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_financial_offers_month_idx on rm_financial_offers(user_id, month_number);

-- Line items behind "Despesas Fixas" / "Despesas Variáveis" in the sheet, kept
-- separately so the "Dados" screen can show a detailed breakdown per month
-- instead of just the two totals already on rm_financial_data.
create table if not exists rm_financial_expenses (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  month_number integer     not null,
  tipo         text        not null check (tipo in ('fixa', 'variavel')),
  categoria    text        not null,
  descricao    text        not null default '',
  valor        numeric     not null default 0,
  synced_at    timestamptz not null default now()
);

alter table rm_financial_expenses enable row level security;
create policy "Users manage own financial expenses"
  on rm_financial_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists rm_financial_expenses_month_idx on rm_financial_expenses(user_id, month_number);

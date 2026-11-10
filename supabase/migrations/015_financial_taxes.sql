-- IOF and imposto, read from each offer's own tab in the monthly spreadsheet
-- (they are not in "Consolidado"). Stored per offer and summed per month.
-- Months without taxes keep 0.
alter table rm_financial_data   add column if not exists iof     numeric not null default 0;
alter table rm_financial_data   add column if not exists imposto numeric not null default 0;
alter table rm_financial_offers add column if not exists iof     numeric not null default 0;
alter table rm_financial_offers add column if not exists imposto numeric not null default 0;

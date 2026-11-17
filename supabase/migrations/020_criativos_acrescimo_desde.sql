-- Acréscimo (IOF + spread) só a partir de uma data, como "IOF desde dia 6"
-- na planilha. Vazio = o acréscimo vale para todos os dias.
alter table public.criativos_ofertas
  add column if not exists acrescimo_desde date;

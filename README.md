# RM Estudos

App pessoal de estudos e organização com notas, links e PDFs.

## Setup

### 1. Instalar e rodar
```bash
npm install
npm run dev
```

### 2. Criar projeto no Supabase
Crie um projeto em supabase.com e execute o SQL abaixo no SQL Editor:

```sql
-- Categorias
CREATE TABLE IF NOT EXISTS rm_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📁',
  workspace text NOT NULL DEFAULT 'marketing',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Itens (notas, links, pdfs)
CREATE TABLE IF NOT EXISTS rm_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  cat_id uuid REFERENCES rm_categories(id) ON DELETE SET NULL,
  workspace text NOT NULL DEFAULT 'marketing',
  type text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  description text DEFAULT '',
  content text DEFAULT '',
  url text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE rm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rm_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categories" ON rm_categories USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own items" ON rm_items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 3. Criar arquivo .env
```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

### 4. Criar bucket no Supabase Storage
- Nome: `rm-files`
- Público: sim

### 5. Deploy na Vercel
- Adicione as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas configurações do projeto na Vercel

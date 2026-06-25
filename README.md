# Dashboard de Equipes

Dashboard para acompanhamento de ordens de serviço (OS) por equipe, com login, perfis de usuário e dados na nuvem.

**Stack:** Next.js 14 · Supabase · Chart.js · Vercel

---

## 1. Configurar o Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) (gratuito)
2. Crie um novo projeto
3. Vá em **SQL Editor** e cole todo o conteúdo de `supabase/schema.sql` → Execute
4. Vá em **Settings → API** e copie:
   - `Project URL` → será o `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → será o `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 2. Criar o primeiro usuário admin

1. No Supabase, vá em **Authentication → Users → Add User**
2. Crie com e-mail e senha
3. Vá em **Table Editor → profiles**
4. Encontre o usuário criado e altere o campo `role` de `viewer` para `admin`

---

## 3. Rodar localmente

```bash
# Clone ou extraia o projeto
cd dashboard-equipes

# Instale as dependências
npm install

# Copie o arquivo de variáveis
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# Rode em desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

---

## 4. Deploy na Vercel

1. Suba o código para um repositório GitHub (pode ser privado)
2. Acesse [vercel.com](https://vercel.com) → New Project → importe o repositório
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em **Deploy**

Pronto! A Vercel dará uma URL pública (ex: `dashboard-equipes.vercel.app`).

---

## 5. Adicionar novos usuários

1. Supabase → Authentication → Users → Add User
2. Defina e-mail e senha
3. Table Editor → profiles → altere `role`:
   - `admin` → pode importar CSV, editar pontuações e configurar equipes
   - `viewer` → só visualiza dashboard e relatórios

---

## Estrutura do projeto

```
app/
  login/          → Página de login
  dashboard/      → Dashboard principal com gráficos e ranking
  equipes/        → Cards detalhados por equipe
  servicos/       → Lista de serviços com edição de pontuação
  configuracoes/  → Importação CSV, gerenciamento de equipes, apelidos

components/
  layout/AppLayout.tsx  → Header + navegação compartilhada
  ui/Toast.tsx          → Notificações

hooks/
  useDashboard.ts  → Hook central: busca dados, filtra, computa stats

lib/
  supabase.ts        → Cliente Supabase (browser)
  supabase-server.ts → Cliente Supabase (servidor)
  utils.ts           → Formatação, CSV, cálculo de stats

supabase/
  schema.sql  → Schema completo do banco — execute no Supabase SQL Editor

types/
  index.ts  → Tipos TypeScript + constantes
```

---

## Segurança

- Dados sensíveis dos clientes (nome, endereço, observações) **nunca são importados** — apenas as 9 colunas necessárias são aceitas
- Row Level Security (RLS) ativo em todas as tabelas
- Viewers só leem dados; apenas admins escrevem
- Chaves de API ficam nas variáveis de ambiente, nunca no código

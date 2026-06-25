-- ================================================================
-- DASHBOARD DE EQUIPES — Schema Supabase
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- ================================================================

-- ── Perfis de usuário (ligado ao auth.users do Supabase) ────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  role       text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "Usuário vê seu próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admin vê todos os perfis"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Cria perfil automaticamente ao registrar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── Ordens de Serviço ───────────────────────────────────────────
create table public.work_orders (
  id            bigserial primary key,
  os_number     text unique not null,          -- "Nº OS" — chave de dedup
  os_id         text,                          -- "ID OS"
  team          text,                          -- "Equipe Executada"
  service       text,                          -- "Serviço"
  status        text,                          -- "Situação"
  executed_at   date,                          -- "Execução"
  city          text,                          -- "Cidade"
  service_type  text,                          -- "Tipo Serviço"
  service_type2 text,                          -- "Tipo Serviço Classificado"
  imported_at   timestamptz default now()
);
alter table public.work_orders enable row level security;

-- Qualquer usuário autenticado pode ler
create policy "Leitura autenticada"
  on public.work_orders for select
  using (auth.role() = 'authenticated');

-- Apenas admin pode inserir/atualizar/deletar
create policy "Admin escreve"
  on public.work_orders for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin deleta"
  on public.work_orders for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Índices para performance nas queries mais comuns
create index idx_wo_team        on public.work_orders(team);
create index idx_wo_city        on public.work_orders(city);
create index idx_wo_status      on public.work_orders(status);
create index idx_wo_executed_at on public.work_orders(executed_at);
create index idx_wo_service     on public.work_orders(service);


-- ── Pontuação por serviço ───────────────────────────────────────
create table public.scores (
  service   text primary key,
  points    numeric(10,2) not null default 1,
  updated_at timestamptz default now()
);
alter table public.scores enable row level security;

create policy "Leitura autenticada scores"
  on public.scores for select using (auth.role() = 'authenticated');

create policy "Admin escreve scores"
  on public.scores for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ── Configurações de equipes ────────────────────────────────────
create table public.team_settings (
  team        text primary key,
  alias       text,
  hidden      boolean not null default false,
  removed     boolean not null default false,
  is_custom   boolean not null default false,
  updated_at  timestamptz default now()
);
alter table public.team_settings enable row level security;

create policy "Leitura autenticada team_settings"
  on public.team_settings for select using (auth.role() = 'authenticated');

create policy "Admin escreve team_settings"
  on public.team_settings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ── Serviços removidos (blacklist) ──────────────────────────────
create table public.removed_services (
  service    text primary key,
  removed_at timestamptz default now()
);
alter table public.removed_services enable row level security;

create policy "Leitura autenticada removed_services"
  on public.removed_services for select using (auth.role() = 'authenticated');

create policy "Admin escreve removed_services"
  on public.removed_services for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ── Inserir pontuações padrão ───────────────────────────────────
insert into public.scores (service, points) values
  ('PRIMEIRA CONEXAO DO ASSINANTE', 10),
  ('ASSISTENCIA - VT 24H', 5),
  ('ALTERACAO DE PROGRAMACAO - UPGRADE', 4),
  ('TRANSF. DE ENDERECO SINGLE', 6),
  ('TROCAR CABEAMENTO', 5),
  ('RETIRADA DE EQUIPAMENTO', 3),
  ('EQUIPAMENTO - TROCA', 5),
  ('CONTRATO - CANCELAMENTO INTERNET', 2),
  ('ALTERACAO DE PROGRAMACAO - MESMO VALOR', 3),
  ('REDE - MANUTENCAO CAIXA SECUNDARIA', 8),
  ('LIBERACAO DE CONFIANCA', 2),
  ('CABONNET PLAY - HABILITACAO', 4),
  ('REDE - MANUTENCAO ACOMPANHAMENTO', 7),
  ('INS - ALTERACAO', 4),
  ('CABONNET PLAY - CANCELAMENTO', 2),
  ('CONF. ROTEADOR COMODATO', 3),
  ('EXITLAG - HABILITACAO', 3),
  ('TROCA DE POSTES', 8),
  ('QUALIDADE E EXECUCAO', 5),
  ('INADIMPLENCIA - RECONEXAO MANUAL', 2)
on conflict (service) do nothing;

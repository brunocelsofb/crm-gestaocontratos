-- Schema dedicado, para conviver no mesmo projeto Supabase com outro app
create schema if not exists contract_crm;

-- ============================================================
-- CRM de Gestão de Contratos — Schema v3 (PostgreSQL/Supabase)
-- Separa a identidade permanente do contrato (contracts) de cada
-- passagem por um funil (pipeline_runs), preservando histórico
-- completo e imutável de cada movimentação entre funis.
-- ============================================================
-- NOTA: sintaxe de RLS/triggers é a que eu conheço, mas recomendo
-- validar contra a documentação atual do Supabase antes de aplicar.

-- ------------------------------------------------------------
-- 1. PROFILES
-- ------------------------------------------------------------
create table contract_crm.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 2. PIPELINES (funis)
-- ------------------------------------------------------------
create table contract_crm.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_default boolean not null default false,
  type text not null default 'gestao_contratos' check (type in ('vendas', 'gestao_contratos')),
  won_label text not null default 'Ganho',
  lost_label text not null default 'Perdido',
  won_target_pipeline_id uuid references contract_crm.pipelines(id),
  created_at timestamptz not null default now()
);

insert into contract_crm.pipelines (name, description, is_default) values
  ('Renovação de Contratos', 'Funil padrão de acompanhamento de contratos recorrentes em renovação', true),
  ('Impugnação / Recursos', 'Funil específico para processos com impugnação ou recurso', false);


-- ------------------------------------------------------------
-- 3. STAGES (etapas de cada pipeline)
-- ------------------------------------------------------------
create table contract_crm.stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references contract_crm.pipelines(id) on delete cascade,
  name text not null,
  order_index integer not null,
  color text default '#6B7280',
  is_won boolean not null default false,
  is_lost boolean not null default false,
  sla_days integer,
  created_at timestamptz not null default now(),
  unique (pipeline_id, order_index)
);

insert into contract_crm.stages (pipeline_id, name, order_index, color, is_won, is_lost, sla_days)
select id, s.name, s.order_index, s.color, s.is_won, s.is_lost, s.sla_days
from contract_crm.pipelines,
  (values
    ('Vigente',              1, '#1B556B', false, false, null),
    ('Notificado p/ renovação', 2, '#1B556B', false, false, 15),
    ('Em negociação c/ fornecedor', 3, '#E98C5F', false, false, 20),
    ('Proposta recebida',    4, '#524E9C', false, false, 10),
    ('Renovado',             5, '#32AF9D', true,  false, 5),
    ('Não renovado',         6, '#AF5B65', false, true,  0)
  ) as s(name, order_index, color, is_won, is_lost, sla_days)
where contract_crm.pipelines.name = 'Renovação de Contratos';

insert into contract_crm.stages (pipeline_id, name, order_index, color, is_won, is_lost, sla_days)
select id, s.name, s.order_index, s.color, s.is_won, s.is_lost, s.sla_days
from contract_crm.pipelines,
  (values
    ('Impugnação Recebida', 1, '#E98C5F', false, false, 2),
    ('Em Análise Jurídica', 2, '#E98C5F', false, false, 5),
    ('Resposta Enviada',    3, '#32AF9D', true,  false, 3),
    ('Indeferido',          4, '#AF5B65', false, true,  0)
  ) as s(name, order_index, color, is_won, is_lost, sla_days)
where contract_crm.pipelines.name = 'Impugnação / Recursos';




-- ------------------------------------------------------------
-- 4. CONTRACTS — identidade permanente, NUNCA é sobrescrita
--    com dados de posição em funil (isso vive em pipeline_runs)
-- ------------------------------------------------------------
create table contract_crm.contracts (
  id uuid primary key default gen_random_uuid(),
  process_number text not null unique,
  title text not null,
  client_name text not null,
  description text,
  owner_id uuid not null references contract_crm.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contracts_owner on contract_crm.contracts(owner_id);
create index idx_contracts_process_number on contract_crm.contracts(process_number);


-- ------------------------------------------------------------
-- 5. PIPELINE_RUNS — cada passagem do contrato por um funil
-- ------------------------------------------------------------
-- Quando um contrato é movido para outro pipeline, a run atual é
-- encerrada (status = 'moved', ended_at preenchido) e uma NOVA run
-- é criada no pipeline de destino, com previous_run_id apontando
-- para a run anterior. Nada é apagado ou sobrescrito — é assim que
-- se preserva o histórico completo de cada funil percorrido.

create table contract_crm.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  pipeline_id uuid not null references contract_crm.pipelines(id),
  stage_id uuid references contract_crm.stages(id) on delete set null,
  stage_entered_at timestamptz not null default now(),
  value numeric(14,2) default 0,
  expected_close_date date,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'moved')),
  lost_reason text,
  previous_run_id uuid references contract_crm.pipeline_runs(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_pipeline_runs_contract on contract_crm.pipeline_runs(contract_id);
create index idx_pipeline_runs_pipeline on contract_crm.pipeline_runs(pipeline_id);

-- Garante no máximo UMA run aberta por contrato de cada vez.
-- Isso reflete a suposição "um pipeline ativo por vez" que assumi
-- nesta conversa — se no futuro vocês precisarem de runs paralelas
-- (ex: comercial E jurídico rodando ao mesmo tempo), remova este
-- índice único e ajuste a lógica de moveContractStage.
create unique index idx_pipeline_runs_one_open_per_contract
  on contract_crm.pipeline_runs(contract_id) where status = 'open';


-- ------------------------------------------------------------
-- 6. STAGE_HISTORY — tempo gasto em cada etapa, dentro de cada run
-- ------------------------------------------------------------
create table contract_crm.stage_history (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references contract_crm.pipeline_runs(id) on delete cascade,
  stage_id uuid references contract_crm.stages(id) on delete set null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  duration_seconds integer,
  changed_by uuid references contract_crm.profiles(id)
);

create index idx_stage_history_run on contract_crm.stage_history(pipeline_run_id);
create index idx_stage_history_open on contract_crm.stage_history(pipeline_run_id) where exited_at is null;


-- ------------------------------------------------------------
-- 7. ACTIVITIES — timeline unificada do contrato (atravessa runs)
-- ------------------------------------------------------------
create table contract_crm.activities (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  pipeline_run_id uuid references contract_crm.pipeline_runs(id),  -- nullable: nota pode não estar ligada a uma run específica
  user_id uuid references contract_crm.profiles(id),
  type text not null check (type in (
    'note', 'task', 'call', 'email',
    'stage_change', 'pipeline_change', 'automation_triggered', 'system'
  )),
  content text not null,
  due_date timestamptz,
  completed boolean default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_activities_contract on contract_crm.activities(contract_id);
create index idx_activities_created_at on contract_crm.activities(created_at desc);


-- ------------------------------------------------------------
-- 8. AUTOMATION_RULES — MVP simples (ver ressalva na v2)
-- ------------------------------------------------------------
create table contract_crm.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_stage_id uuid not null references contract_crm.stages(id),
  action_type text not null check (action_type in ('move_to_pipeline', 'move_to_stage', 'create_task')),
  target_pipeline_id uuid references contract_crm.pipelines(id),
  target_stage_id uuid references contract_crm.stages(id),
  task_content text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 9. VIEW de conveniência — contrato + sua run aberta atual
-- ------------------------------------------------------------
-- Usada nas telas de listagem e no dashboard, para não repetir o
-- mesmo join em todo lugar. Contratos sem run aberta (arquivados
-- ou nunca iniciados) aparecem com os campos de run como null.
create view contract_crm.contracts_with_current_run as
select
  c.id,
  c.process_number,
  c.title,
  c.client_name,
  c.description,
  c.owner_id,
  c.created_at,
  c.updated_at,
  r.id as run_id,
  r.pipeline_id,
  r.stage_id,
  r.stage_entered_at,
  r.value,
  r.status as run_status,
  r.expected_close_date
from contract_crm.contracts c
left join contract_crm.pipeline_runs r
  on r.contract_id = c.id and r.status = 'open';


-- ------------------------------------------------------------
-- 10. Row Level Security (RLS) — esboço conceitual
-- ------------------------------------------------------------
alter table contract_crm.contracts enable row level security;
alter table contract_crm.activities enable row level security;
alter table contract_crm.profiles enable row level security;
alter table contract_crm.stage_history enable row level security;
alter table contract_crm.pipelines enable row level security;
alter table contract_crm.stages enable row level security;
alter table contract_crm.automation_rules enable row level security;
alter table contract_crm.pipeline_runs enable row level security;


-- ------------------------------------------------------------
-- 11. GRANTS — obrigatórios para o schema customizado ficar
--     acessível pela API do Supabase (schemas fora do "public"
--     não recebem essas permissões automaticamente).
-- ------------------------------------------------------------
-- Fonte: documentação oficial "Using Custom Schemas" do Supabase.
-- IMPORTANTE: depois de rodar isto, você AINDA precisa ir no painel
-- em Settings > API (ou Data API) > "Exposed schemas" e adicionar
-- "contract_crm" na lista — sem esse passo manual no painel, a API
-- não vai enxergar o schema mesmo com os grants certos.

grant usage on schema contract_crm to anon, authenticated, service_role;
grant all on all tables in schema contract_crm to anon, authenticated, service_role;
grant all on all routines in schema contract_crm to anon, authenticated, service_role;
grant all on all sequences in schema contract_crm to anon, authenticated, service_role;
alter default privileges for role postgres in schema contract_crm grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema contract_crm grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema contract_crm grant all on sequences to anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 12. COMPANIES e CONTACTS (adicionado após feedback do usuário:
--     cliente precisa ser uma entidade própria com contatos,
--     não só um texto solto dentro do contrato)
-- ------------------------------------------------------------
create table contract_crm.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade_name text,
  cnpj text,
  notes text,
  owner_id uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_companies_name on contract_crm.companies(name);

create table contract_crm.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references contract_crm.companies(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_contacts_company on contract_crm.contacts(company_id);

alter table contract_crm.contracts
  add column company_id uuid references contract_crm.companies(id);

create index idx_contracts_company on contract_crm.contracts(company_id);

alter table contract_crm.contracts
  add column contact_id uuid references contract_crm.contacts(id);

create index idx_contracts_contact on contract_crm.contracts(contact_id);

alter table contract_crm.contracts
  add column valid_from date;
alter table contract_crm.contracts
  add column valid_until date;

alter table contract_crm.companies enable row level security;
alter table contract_crm.contacts enable row level security;

create policy "all_companies" on contract_crm.companies
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "all_contacts" on contract_crm.contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 13. ORGANIZATION_SETTINGS (configurações gerais, singleton)
-- ------------------------------------------------------------
create table contract_crm.organization_settings (
  id text primary key default 'default',
  name text not null default 'Contract CRM',
  company_name text,
  updated_at timestamptz not null default now()
);

insert into contract_crm.organization_settings (id, name) values ('default', 'Contract CRM');

alter table contract_crm.organization_settings enable row level security;

create policy "org_settings_select" on contract_crm.organization_settings
  for select using (auth.role() = 'authenticated');
create policy "org_settings_update_admin" on contract_crm.organization_settings
  for update using (exists (select 1 from contract_crm.profiles where id = auth.uid() and role = 'admin'));


-- ------------------------------------------------------------
-- 14. NPS_SURVEYS
-- ------------------------------------------------------------
create table contract_crm.nps_surveys (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  token text not null unique,
  score integer check (score >= 0 and score <= 10),
  comment text,
  respondent_name text,
  respondent_email text,
  respondent_phone text,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  sent_at timestamptz not null default now(),
  answered_at timestamptz,
  created_by uuid references contract_crm.profiles(id)
);

create index idx_nps_surveys_contract on contract_crm.nps_surveys(contract_id);
create index idx_nps_surveys_token on contract_crm.nps_surveys(token);

alter table contract_crm.nps_surveys enable row level security;

create policy "nps_select_staff" on contract_crm.nps_surveys for select using (auth.role() = 'authenticated');
create policy "nps_insert_staff" on contract_crm.nps_surveys for insert with check (auth.role() = 'authenticated');
create policy "nps_delete_staff" on contract_crm.nps_surveys for delete using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 15. STORAGE (upload de arquivos por contrato)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contract-files', 'contract-files', false)
on conflict (id) do nothing;

create policy "contract_files_select" on storage.objects
  for select using (bucket_id = 'contract-files' and auth.role() = 'authenticated');
create policy "contract_files_insert" on storage.objects
  for insert with check (bucket_id = 'contract-files' and auth.role() = 'authenticated');
create policy "contract_files_delete" on storage.objects
  for delete using (bucket_id = 'contract-files' and auth.role() = 'authenticated');

create table contract_crm.contract_files (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_contract_files_contract on contract_crm.contract_files(contract_id);

alter table contract_crm.contract_files enable row level security;

create policy "contract_files_meta_select" on contract_crm.contract_files
  for select using (auth.role() = 'authenticated');
create policy "contract_files_meta_insert" on contract_crm.contract_files
  for insert with check (auth.role() = 'authenticated');
create policy "contract_files_meta_delete" on contract_crm.contract_files
  for delete using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 16. SURVEY_TEMPLATES e CUSTOM_SURVEYS (formularios customizaveis)
-- ------------------------------------------------------------
create table contract_crm.survey_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  questions jsonb not null default '[]'::jsonb,
  created_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now()
);

create table contract_crm.custom_surveys (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  template_id uuid not null references contract_crm.survey_templates(id),
  token text not null unique,
  responses jsonb,
  respondent_name text,
  respondent_email text,
  respondent_phone text,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  sent_at timestamptz not null default now(),
  answered_at timestamptz,
  created_by uuid references contract_crm.profiles(id)
);

create index idx_custom_surveys_contract on contract_crm.custom_surveys(contract_id);
create index idx_custom_surveys_token on contract_crm.custom_surveys(token);

alter table contract_crm.survey_templates enable row level security;
alter table contract_crm.custom_surveys enable row level security;

create policy "survey_templates_select" on contract_crm.survey_templates for select using (auth.role() = 'authenticated');
create policy "survey_templates_insert" on contract_crm.survey_templates for insert with check (auth.role() = 'authenticated');
create policy "survey_templates_update" on contract_crm.survey_templates for update using (auth.role() = 'authenticated');
create policy "survey_templates_delete" on contract_crm.survey_templates for delete using (auth.role() = 'authenticated');

create policy "custom_surveys_select" on contract_crm.custom_surveys for select using (auth.role() = 'authenticated');
create policy "custom_surveys_insert" on contract_crm.custom_surveys for insert with check (auth.role() = 'authenticated');



-- ------------------------------------------------------------
-- 17. TAGS (cor livre) para contratos, ex: linha de produto
-- ------------------------------------------------------------
create table contract_crm.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6B7280',
  created_at timestamptz not null default now()
);

create table contract_crm.contract_tags (
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  tag_id uuid not null references contract_crm.tags(id) on delete cascade,
  primary key (contract_id, tag_id)
);

alter table contract_crm.survey_templates
  add column tag_id uuid references contract_crm.tags(id);

alter table contract_crm.tags enable row level security;
alter table contract_crm.contract_tags enable row level security;

create policy "tags_select" on contract_crm.tags for select using (auth.role() = 'authenticated');
create policy "tags_insert" on contract_crm.tags for insert with check (auth.role() = 'authenticated');
create policy "tags_update" on contract_crm.tags for update using (auth.role() = 'authenticated');
create policy "tags_delete" on contract_crm.tags for delete using (auth.role() = 'authenticated');

create policy "contract_tags_select" on contract_crm.contract_tags for select using (auth.role() = 'authenticated');
create policy "contract_tags_insert" on contract_crm.contract_tags for insert with check (auth.role() = 'authenticated');
create policy "contract_tags_delete" on contract_crm.contract_tags for delete using (auth.role() = 'authenticated');

insert into contract_crm.tags (name, color) values
  ('Engenharia Clínica', '#0EA5A5'),
  ('Engenharia Hospitalar', '#7C5CFC');

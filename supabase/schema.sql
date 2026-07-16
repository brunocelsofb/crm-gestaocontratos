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
  type text not null default 'gestao_contratos' check (type in ('vendas', 'gestao_contratos', 'servico_avulso')),
  won_label text not null default 'Ganho',
  lost_label text not null default 'Perdido',
  won_target_pipeline_id uuid references contract_crm.pipelines(id),
  renewal_trigger_days integer,
  renewal_target_stage_id uuid references contract_crm.stages(id) on delete set null,
  won_target_stage_id uuid references contract_crm.stages(id) on delete set null,
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
  inbound_email_code text unique default encode(gen_random_bytes(16), 'hex'),
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
    'stage_change', 'pipeline_change', 'automation_triggered', 'system',
    'transfer'
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
  trigger_type text not null default 'stage_entry' check (trigger_type in (
    'stage_entry', 'days_without_progress', 'outcome_won', 'outcome_lost',
    'tag_added', 'tag_removed', 'days_before_expiration', 'ticket_linked'
  )),
  trigger_stage_id uuid references contract_crm.stages(id),
  trigger_pipeline_id uuid references contract_crm.pipelines(id),
  trigger_tag_id uuid references contract_crm.tags(id) on delete cascade,
  days_threshold integer,
  action_type text not null check (action_type in ('move_to_pipeline', 'move_to_stage', 'create_task', 'send_email', 'notify_user', 'send_whatsapp')),
  target_pipeline_id uuid references contract_crm.pipelines(id),
  target_stage_id uuid references contract_crm.stages(id),
  task_content text,
  email_template_id uuid references contract_crm.email_templates(id) on delete set null,
  notify_user_id uuid references contract_crm.profiles(id),
  notify_message text,
  whatsapp_template_id uuid references contract_crm.email_templates(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table contract_crm.automation_rule_triggers (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references contract_crm.automation_rules(id) on delete cascade,
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  unique (rule_id, contract_id)
);

alter table contract_crm.automation_rule_triggers enable row level security;
create policy "automation_rule_triggers_all" on contract_crm.automation_rule_triggers for all using (auth.role() = 'authenticated');


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
  legal_name text,
  nf_email text,
  address text,
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
  cpf text,
  address text,
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
  logo_storage_path text,
  proposal_header_text text,
  proposal_footer_text text,
  proposal_brand_color text default '#1B556B',
  assistant_monthly_budget_usd numeric default 10,
  ticket_number_prefix text default 'TICKET',
  proposal_number_prefix text default 'PROP',
  company_cnpj text,
  zapi_instance_id text,
  zapi_token text,
  zapi_client_token text,
  zapi_webhook_secret text,
  inbound_email_domain text,
  mailgun_webhook_signing_key text,
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


-- ------------------------------------------------------------
-- 18. Departamentos, Plano de Ação, Aprovação de Dimensionamento
-- ------------------------------------------------------------
alter table contract_crm.profiles
  add column department text;

alter table contract_crm.contracts
  add column current_department text default 'comercial';

alter table contract_crm.contracts
  add column auto_renewal boolean not null default false;

alter table contract_crm.contracts
  add column current_assignee_id uuid references contract_crm.profiles(id);
alter table contract_crm.contracts
  add column previous_department text;
alter table contract_crm.contracts
  add column previous_assignee_id uuid references contract_crm.profiles(id);

create table contract_crm.action_plan_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  description text not null,
  responsible_department text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  created_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_action_plan_items_contract on contract_crm.action_plan_items(contract_id);

create table contract_crm.dimensioning_reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  file_storage_path text,
  file_name text,
  sent_by uuid references contract_crm.profiles(id),
  sent_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'acknowledged_ok', 'acknowledged_disagree')),
  reviewed_by uuid references contract_crm.profiles(id),
  reviewed_at timestamptz,
  review_notes text
);

create index idx_dimensioning_reviews_contract on contract_crm.dimensioning_reviews(contract_id);

alter table contract_crm.action_plan_items enable row level security;
alter table contract_crm.dimensioning_reviews enable row level security;

create policy "action_plan_select" on contract_crm.action_plan_items for select using (auth.role() = 'authenticated');
create policy "action_plan_insert" on contract_crm.action_plan_items for insert with check (auth.role() = 'authenticated');
create policy "action_plan_update" on contract_crm.action_plan_items for update using (auth.role() = 'authenticated');
create policy "action_plan_delete" on contract_crm.action_plan_items for delete using (auth.role() = 'authenticated');

create policy "dimensioning_select" on contract_crm.dimensioning_reviews for select using (auth.role() = 'authenticated');
create policy "dimensioning_insert" on contract_crm.dimensioning_reviews for insert with check (auth.role() = 'authenticated');
create policy "dimensioning_update" on contract_crm.dimensioning_reviews for update using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 19. Notificações
-- ------------------------------------------------------------
create table contract_crm.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references contract_crm.profiles(id) on delete cascade,
  contract_id uuid references contract_crm.contracts(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on contract_crm.notifications(user_id, read);

alter table contract_crm.notifications enable row level security;

create policy "notifications_select_own" on contract_crm.notifications for select using (auth.uid() = user_id);
create policy "notifications_insert" on contract_crm.notifications for insert with check (auth.role() = 'authenticated');
create policy "notifications_update_own" on contract_crm.notifications for update using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 20. Meta anual e Faturamento confirmado
-- ------------------------------------------------------------
alter table contract_crm.contracts
  add column billing_type text not null default 'fixed' check (billing_type in ('fixed', 'metered'));

create table contract_crm.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  target_value numeric not null default 0,
  updated_by uuid references contract_crm.profiles(id),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table contract_crm.billing_records (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  amount numeric not null,
  file_storage_path text,
  file_name text,
  notes text,
  confirmed_by uuid references contract_crm.profiles(id),
  confirmed_at timestamptz not null default now(),
  unique (contract_id, year, month)
);

create index idx_billing_records_period on contract_crm.billing_records(year, month);
create index idx_billing_records_contract on contract_crm.billing_records(contract_id);

alter table contract_crm.monthly_goals enable row level security;
alter table contract_crm.billing_records enable row level security;

create policy "monthly_goals_select" on contract_crm.monthly_goals for select using (auth.role() = 'authenticated');
create policy "monthly_goals_upsert" on contract_crm.monthly_goals for insert with check (auth.role() = 'authenticated');
create policy "monthly_goals_update" on contract_crm.monthly_goals for update using (auth.role() = 'authenticated');

create policy "billing_records_select" on contract_crm.billing_records for select using (auth.role() = 'authenticated');
create policy "billing_records_insert" on contract_crm.billing_records for insert with check (auth.role() = 'authenticated');
create policy "billing_records_update" on contract_crm.billing_records for update using (auth.role() = 'authenticated');
create policy "billing_records_delete" on contract_crm.billing_records for delete using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 21. Módulo de Propostas Comerciais
-- ------------------------------------------------------------
create table contract_crm.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_storage_path text not null,
  file_name text not null,
  page_count integer not null default 1,
  created_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now()
);

create table contract_crm.proposals (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  control_code text not null unique,
  version integer not null default 1,
  status text not null default 'draft' check (status in (
    'draft', 'pending_technical', 'pending_commercial',
    'declined_internal', 'pending_client', 'approved', 'declined_client'
  )),
  currency text not null default 'BRL',
  client_po_number text,
  valid_until date,
  token text unique,
  assigned_technical_approver_id uuid references contract_crm.profiles(id),
  assigned_commercial_approver_id uuid references contract_crm.profiles(id),
  discount_type text check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null default 0,
  payment_terms text,
  installments integer not null default 1,
  is_recurring boolean not null default false,
  pdf_storage_path text,
  created_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_proposals_contract on contract_crm.proposals(contract_id);
create index idx_proposals_token on contract_crm.proposals(token);

create table contract_crm.proposal_pages (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references contract_crm.proposals(id) on delete cascade,
  position integer not null,
  template_id uuid references contract_crm.proposal_templates(id),
  is_standard_proposal boolean not null default false
);

create index idx_proposal_pages_proposal on contract_crm.proposal_pages(proposal_id);

create table contract_crm.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references contract_crm.proposals(id) on delete cascade,
  position integer not null default 0,
  quantity numeric not null default 1,
  category text,
  item text not null,
  characteristics text,
  type text,
  delivery_forecast text,
  unit_value numeric not null default 0,
  discount numeric not null default 0,
  subtotal numeric not null default 0
);

create index idx_proposal_items_proposal on contract_crm.proposal_items(proposal_id);

create table contract_crm.proposal_approvals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references contract_crm.proposals(id) on delete cascade,
  stage text not null check (stage in ('technical', 'commercial', 'client')),
  decision text not null check (decision in ('approved', 'declined')),
  comment text not null,
  decided_by uuid references contract_crm.profiles(id),
  signer_name text,
  signer_email text,
  signer_role text,
  signer_phone text,
  signer_cpf text,
  decided_at timestamptz not null default now()
);

create index idx_proposal_approvals_proposal on contract_crm.proposal_approvals(proposal_id);

alter table contract_crm.proposal_templates enable row level security;
alter table contract_crm.proposals enable row level security;
alter table contract_crm.proposal_pages enable row level security;
alter table contract_crm.proposal_items enable row level security;
alter table contract_crm.proposal_approvals enable row level security;

create policy "proposal_templates_select" on contract_crm.proposal_templates for select using (auth.role() = 'authenticated');
create policy "proposal_templates_insert" on contract_crm.proposal_templates for insert with check (auth.role() = 'authenticated');
create policy "proposal_templates_delete" on contract_crm.proposal_templates for delete using (auth.role() = 'authenticated');

create policy "proposals_select" on contract_crm.proposals for select using (auth.role() = 'authenticated');
create policy "proposals_insert" on contract_crm.proposals for insert with check (auth.role() = 'authenticated');
create policy "proposals_update" on contract_crm.proposals for update using (auth.role() = 'authenticated');
create policy "proposals_delete" on contract_crm.proposals for delete using (auth.role() = 'authenticated');

create policy "proposal_pages_select" on contract_crm.proposal_pages for select using (auth.role() = 'authenticated');
create policy "proposal_pages_insert" on contract_crm.proposal_pages for insert with check (auth.role() = 'authenticated');
create policy "proposal_pages_delete" on contract_crm.proposal_pages for delete using (auth.role() = 'authenticated');

create policy "proposal_items_select" on contract_crm.proposal_items for select using (auth.role() = 'authenticated');
create policy "proposal_items_insert" on contract_crm.proposal_items for insert with check (auth.role() = 'authenticated');
create policy "proposal_items_update" on contract_crm.proposal_items for update using (auth.role() = 'authenticated');
create policy "proposal_items_delete" on contract_crm.proposal_items for delete using (auth.role() = 'authenticated');

create policy "proposal_approvals_select" on contract_crm.proposal_approvals for select using (auth.role() = 'authenticated');
create policy "proposal_approvals_insert" on contract_crm.proposal_approvals for insert with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('proposal-files', 'proposal-files', false)
on conflict (id) do nothing;

create policy "proposal_files_select" on storage.objects
  for select using (bucket_id = 'proposal-files' and auth.role() = 'authenticated');
create policy "proposal_files_insert" on storage.objects
  for insert with check (bucket_id = 'proposal-files' and auth.role() = 'authenticated');
create policy "proposal_files_delete" on storage.objects
  for delete using (bucket_id = 'proposal-files' and auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 22. Catálogo de produtos/serviços (propostas)
-- ------------------------------------------------------------
create table contract_crm.proposal_catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  type text,
  characteristics text,
  unit_value numeric not null default 0,
  created_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now()
);

alter table contract_crm.proposal_catalog_items enable row level security;

create policy "proposal_catalog_select" on contract_crm.proposal_catalog_items for select using (auth.role() = 'authenticated');
create policy "proposal_catalog_insert" on contract_crm.proposal_catalog_items for insert with check (auth.role() = 'authenticated');
create policy "proposal_catalog_update" on contract_crm.proposal_catalog_items for update using (auth.role() = 'authenticated');
create policy "proposal_catalog_delete" on contract_crm.proposal_catalog_items for delete using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 23. Blocos de conteúdo extra da proposta (imagem/tabela)
-- ------------------------------------------------------------
create table contract_crm.proposal_content_blocks (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references contract_crm.proposals(id) on delete cascade,
  position integer not null default 0,
  block_type text not null check (block_type in ('image', 'table', 'text')),
  image_storage_path text,
  table_data jsonb,
  text_content text,
  created_at timestamptz not null default now()
);

create index idx_proposal_content_blocks_proposal on contract_crm.proposal_content_blocks(proposal_id);

alter table contract_crm.proposal_content_blocks enable row level security;

create policy "proposal_content_blocks_select" on contract_crm.proposal_content_blocks for select using (auth.role() = 'authenticated');
create policy "proposal_content_blocks_insert" on contract_crm.proposal_content_blocks for insert with check (auth.role() = 'authenticated');
create policy "proposal_content_blocks_delete" on contract_crm.proposal_content_blocks for delete using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 24. Log de ações do Assistente de IA
-- ------------------------------------------------------------
create table contract_crm.assistant_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references contract_crm.profiles(id),
  tool_name text not null,
  tool_input jsonb not null,
  result_summary text,
  contract_id uuid references contract_crm.contracts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_assistant_action_log_user on contract_crm.assistant_action_log(user_id, created_at desc);

alter table contract_crm.assistant_action_log enable row level security;

create policy "assistant_action_log_select" on contract_crm.assistant_action_log for select using (auth.role() = 'authenticated');
create policy "assistant_action_log_insert" on contract_crm.assistant_action_log for insert with check (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 25. Consumo de tokens do Assistente de IA
-- ------------------------------------------------------------
create table contract_crm.assistant_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references contract_crm.profiles(id),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_assistant_usage_log_created on contract_crm.assistant_usage_log(created_at);

alter table contract_crm.assistant_usage_log enable row level security;

create policy "assistant_usage_log_select" on contract_crm.assistant_usage_log for select using (auth.role() = 'authenticated');
create policy "assistant_usage_log_insert" on contract_crm.assistant_usage_log for insert with check (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 26. Leads & Captação
-- ------------------------------------------------------------
create table contract_crm.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company_name text,
  message text,
  source text default 'manual',
  status text not null default 'novo' check (status in ('novo', 'em_qualificacao', 'qualificado', 'descartado', 'convertido')),
  score integer not null default 0,
  assigned_to uuid references contract_crm.profiles(id),
  converted_contract_id uuid references contract_crm.contracts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_status on contract_crm.leads(status);
create index idx_leads_score on contract_crm.leads(score desc);

create table contract_crm.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references contract_crm.leads(id) on delete cascade,
  user_id uuid references contract_crm.profiles(id),
  type text not null default 'note' check (type in ('note', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_lead_activities_lead on contract_crm.lead_activities(lead_id);

alter table contract_crm.leads enable row level security;
alter table contract_crm.lead_activities enable row level security;

create policy "leads_select" on contract_crm.leads for select using (auth.role() = 'authenticated');
create policy "leads_insert_public" on contract_crm.leads for insert with check (true);
create policy "leads_update" on contract_crm.leads for update using (auth.role() = 'authenticated');
create policy "leads_delete" on contract_crm.leads for delete using (auth.role() = 'authenticated');

create policy "lead_activities_select" on contract_crm.lead_activities for select using (auth.role() = 'authenticated');
create policy "lead_activities_insert" on contract_crm.lead_activities for insert with check (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 27. Atendimento & Tickets
-- ------------------------------------------------------------
create table contract_crm.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  subject text not null,
  description text,
  status text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado')),
  priority text not null default 'pouco_critica' check (priority in ('nao_critica', 'pouco_critica', 'critica', 'muito_critica')),
  gravity integer check (gravity between 1 and 5),
  trend integer check (trend between 1 and 5) default 3,
  category text,
  contract_id uuid references contract_crm.contracts(id) on delete set null,
  company_id uuid references contract_crm.companies(id) on delete set null,
  requester_name text not null,
  requester_email text,
  requester_phone text,
  requester_cnpj text,
  current_department text,
  previous_department text,
  assigned_to uuid references contract_crm.profiles(id),
  source text default 'manual',
  sla_due_at timestamptz,
  resolved_at timestamptz,
  public_token text unique default gen_random_uuid()::text,
  satisfaction_token text unique,
  satisfaction_rating integer check (satisfaction_rating between 1 and 5),
  satisfaction_comment text,
  satisfaction_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tickets_status on contract_crm.tickets(status);
create index idx_tickets_sla on contract_crm.tickets(sla_due_at);
create index idx_tickets_contract on contract_crm.tickets(contract_id);

create table contract_crm.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references contract_crm.tickets(id) on delete cascade,
  author_type text not null check (author_type in ('interno', 'cliente')),
  author_id uuid references contract_crm.profiles(id),
  author_name text not null,
  message text not null,
  is_internal_note boolean not null default false,
  author_department text,
  created_at timestamptz not null default now()
);

create index idx_ticket_messages_ticket on contract_crm.ticket_messages(ticket_id);

alter table contract_crm.tickets enable row level security;
alter table contract_crm.ticket_messages enable row level security;

create policy "tickets_select" on contract_crm.tickets for select using (auth.role() = 'authenticated');
create policy "tickets_insert_public" on contract_crm.tickets for insert with check (true);
create policy "tickets_update" on contract_crm.tickets for update using (auth.role() = 'authenticated');
create policy "tickets_delete" on contract_crm.tickets for delete using (auth.role() = 'authenticated');

create policy "ticket_messages_select" on contract_crm.ticket_messages for select using (auth.role() = 'authenticated');
create policy "ticket_messages_insert" on contract_crm.ticket_messages for insert with check (true);


-- ------------------------------------------------------------
-- 28. Numeração sequencial (protocolo de ticket e proposta)
-- ------------------------------------------------------------
create sequence contract_crm.ticket_protocol_seq;
create sequence contract_crm.proposal_protocol_seq;

create or replace function contract_crm.next_ticket_protocol()
returns bigint
language sql
security definer
as $$
  select nextval('contract_crm.ticket_protocol_seq');
$$;

create or replace function contract_crm.next_proposal_protocol()
returns bigint
language sql
security definer
as $$
  select nextval('contract_crm.proposal_protocol_seq');
$$;

grant execute on function contract_crm.next_ticket_protocol() to authenticated, anon;
grant execute on function contract_crm.next_proposal_protocol() to authenticated, anon;

create or replace function contract_crm.set_next_ticket_protocol(new_start bigint)
returns void
language sql
security definer
as $$
  select setval('contract_crm.ticket_protocol_seq', new_start, false);
$$;

create or replace function contract_crm.set_next_proposal_protocol(new_start bigint)
returns void
language sql
security definer
as $$
  select setval('contract_crm.proposal_protocol_seq', new_start, false);
$$;

grant execute on function contract_crm.set_next_ticket_protocol(bigint) to authenticated;
grant execute on function contract_crm.set_next_proposal_protocol(bigint) to authenticated;


-- ------------------------------------------------------------
-- 29. Módulo de E-mail (Gmail)
-- ------------------------------------------------------------
create table contract_crm.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references contract_crm.profiles(id) on delete cascade unique,
  email text not null,
  connection_type text not null default 'oauth_google' check (connection_type in ('oauth_google', 'smtp')),
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  smtp_secure boolean not null default true,
  connected_at timestamptz not null default now()
);

create table contract_crm.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text,
  body text not null,
  context text not null default 'contract' check (context in ('contract', 'ticket')),
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  trigger_stage_id uuid references contract_crm.stages(id) on delete set null,
  created_by uuid references contract_crm.profiles(id),
  created_at timestamptz not null default now()
);

create table contract_crm.contract_emails (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  sent_by uuid references contract_crm.profiles(id),
  from_email text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  template_id uuid references contract_crm.email_templates(id) on delete set null,
  triggered_automatically boolean not null default false,
  gmail_message_id text,
  status text not null default 'enviado' check (status in ('enviado', 'falhou')),
  direction text not null default 'enviado' check (direction in ('enviado', 'recebido')),
  cc_email text,
  bcc_email text,
  error_message text,
  sent_at timestamptz not null default now()
);

create index idx_contract_emails_contract on contract_crm.contract_emails(contract_id);

alter table contract_crm.email_accounts enable row level security;
alter table contract_crm.email_templates enable row level security;
alter table contract_crm.contract_emails enable row level security;

create policy "email_accounts_select_own" on contract_crm.email_accounts for select using (auth.uid() = user_id);
create policy "email_accounts_all_own" on contract_crm.email_accounts for all using (auth.uid() = user_id);

create policy "email_templates_select" on contract_crm.email_templates for select using (auth.role() = 'authenticated');
create policy "email_templates_insert" on contract_crm.email_templates for insert with check (auth.role() = 'authenticated');
create policy "email_templates_update" on contract_crm.email_templates for update using (auth.role() = 'authenticated');
create policy "email_templates_delete" on contract_crm.email_templates for delete using (auth.role() = 'authenticated');

create policy "contract_emails_select" on contract_crm.contract_emails for select using (auth.role() = 'authenticated');
create policy "contract_emails_insert" on contract_crm.contract_emails for insert with check (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 30. Extras do módulo de E-mail: assinatura e rastreamento de abertura
-- ------------------------------------------------------------
alter table contract_crm.profiles add column email_signature text;
alter table contract_crm.contract_emails add column tracking_token text unique default gen_random_uuid()::text;
alter table contract_crm.contract_emails add column opened_at timestamptz;


-- ------------------------------------------------------------
-- 31. Campos customizados
-- ------------------------------------------------------------
create table contract_crm.custom_fields (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  field_key text not null unique,
  field_type text not null default 'text' check (field_type in ('text', 'textarea', 'number', 'date', 'select', 'multiselect', 'file')),
  select_options jsonb,
  context text not null default 'contract' check (context in ('contract')),
  created_at timestamptz not null default now()
);

create table contract_crm.contract_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  custom_field_id uuid not null references contract_crm.custom_fields(id) on delete cascade,
  value text,
  updated_at timestamptz not null default now(),
  unique (contract_id, custom_field_id)
);

create index idx_ccfv_contract on contract_crm.contract_custom_field_values(contract_id);

alter table contract_crm.custom_fields enable row level security;
alter table contract_crm.contract_custom_field_values enable row level security;

create policy "custom_fields_select" on contract_crm.custom_fields for select using (auth.role() = 'authenticated');
create policy "custom_fields_all" on contract_crm.custom_fields for all using (auth.role() = 'authenticated');

create policy "ccfv_select" on contract_crm.contract_custom_field_values for select using (auth.role() = 'authenticated');
create policy "ccfv_all" on contract_crm.contract_custom_field_values for all using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 32. Integração com WhatsApp (Z-API)
-- ------------------------------------------------------------
create table contract_crm.contract_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contract_crm.contracts(id) on delete cascade,
  sent_by uuid references contract_crm.profiles(id),
  direction text not null check (direction in ('enviado', 'recebido')),
  phone text not null,
  message text not null,
  template_id uuid references contract_crm.email_templates(id) on delete set null,
  triggered_automatically boolean not null default false,
  zapi_message_id text,
  status text not null default 'enviado' check (status in ('enviado', 'falhou')),
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_contract_whatsapp_contract on contract_crm.contract_whatsapp_messages(contract_id);

alter table contract_crm.contract_whatsapp_messages enable row level security;
create policy "contract_whatsapp_select" on contract_crm.contract_whatsapp_messages for select using (auth.role() = 'authenticated');
create policy "contract_whatsapp_insert" on contract_crm.contract_whatsapp_messages for insert with check (true);

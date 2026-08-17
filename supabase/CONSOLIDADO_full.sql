-- ============================================================================
-- MEU RIM — SQL CONSOLIDADO (schema completo, idempotente)
-- Gerado a partir das migrações do projeto. Seguro rodar em banco novo OU existente.
-- Rode no Supabase (SQL Editor). Nao apaga nem altera dados existentes.
-- ============================================================================

create extension if not exists pgcrypto;

-- ===== 20260728102000_init_meu_rim.sql =====
create extension if not exists pgcrypto;

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  crm text not null,
  specialty text not null,
  bio text not null default '',
  consultation_price_cents integer not null,
  pix_key text,
  bank_account_hint text,
  stripe_connect_ready boolean not null default false,
  weekly_availability jsonb not null default '[]'::jsonb,
  blocked_slots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_name text not null,
  patient_email text not null,
  patient_phone text not null default '',
  patient_city text not null default '',
  care_reason text not null check (care_reason in ('pressa', 'acompanhamento', 'segunda_opiniao', 'outro')),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  price_cents integer not null,
  payment_method text not null check (payment_method in ('card', 'pix', 'boleto')),
  status text not null check (status in ('pending_payment', 'paid', 'confirmed', 'completed', 'cancelled')),
  meeting_room_id uuid not null unique,
  payment_id uuid,
  paid_at timestamptz,
  confirmation_email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  amount_cents integer not null,
  method text not null check (method in ('card', 'pix', 'boleto')),
  status text not null check (status in ('succeeded', 'failed', 'pending')),
  doctor_payout_cents integer not null,
  platform_fee_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.signaling_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  from_role text not null check (from_role in ('doctor', 'patient')),
  type text not null check (type in ('offer', 'answer', 'ice')),
  payload text not null,
  created_at timestamptz not null default now()
);

create index if not exists bookings_doctor_id_idx on public.bookings (doctor_id);
create index if not exists bookings_patient_email_idx on public.bookings (patient_email);
create index if not exists bookings_meeting_room_id_idx on public.bookings (meeting_room_id);
create index if not exists signaling_messages_room_id_created_at_idx
  on public.signaling_messages (room_id, created_at desc);

alter table public.doctors enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.signaling_messages enable row level security;

comment on table public.doctors is 'Meu Rim doctors. Server-side access only for now.';
comment on table public.bookings is 'Meu Rim bookings. Server-side access only for now.';
comment on table public.payments is 'Meu Rim payment records. Server-side access only for now.';
comment on table public.signaling_messages is 'Ephemeral signaling messages for WebRTC setup.';

-- ===== 20260805190000_patient_home_records.sql =====
-- Fase 2 — Área do paciente: registro domiciliar + diário alimentar.
-- Acesso apenas server-side (chave service_role). RLS habilitado sem policies
-- públicas; o servidor grava/lê usando a service key.

create table if not exists public.home_records (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  kind text not null check (kind in ('bp', 'glucose', 'weight', 'symptom')),
  systolic integer,
  diastolic integer,
  heart_rate integer,
  glucose_mg_dl integer,
  glucose_context text,
  weight_kg numeric(6, 2),
  arm text,
  body_position text,
  med_context text,
  symptoms text,
  note text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.home_food_logs (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  food text not null,
  meal text,
  quantity text,
  note text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists home_records_email_kind_idx
  on public.home_records (patient_email, kind, measured_at desc);
create index if not exists home_food_logs_email_idx
  on public.home_food_logs (patient_email, logged_at desc);

alter table public.home_records enable row level security;
alter table public.home_food_logs enable row level security;

-- Permissões para a chave secreta (service_role) acessar as novas tabelas.
grant all privileges on public.home_records to service_role;
grant all privileges on public.home_food_logs to service_role;

comment on table public.home_records is 'Registros domiciliares do paciente (pressão, glicemia, peso, sintomas).';
comment on table public.home_food_logs is 'Diário alimentar do paciente.';

-- ===== 20260805200000_clinical_notes.sql =====
-- Evolução/consulta escrita pelo médico no prontuário do paciente.
-- Acesso server-side (service_role). RLS habilitado sem policies públicas.

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid not null,
  doctor_name text not null,
  kind text not null default 'evolucao',
  chief_complaint text,
  history text,
  assessment text,
  plan text,
  shared_with_patient boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clinical_notes_email_idx
  on public.clinical_notes (patient_email, created_at desc);

alter table public.clinical_notes enable row level security;

grant all privileges on public.clinical_notes to service_role;

comment on table public.clinical_notes is 'Evoluções/consultas escritas pelo médico no prontuário.';

-- ===== 20260806000000_documents.sql =====
-- Documentos clínicos: receita, pedido de exame e relatório.
-- Acesso server-side (service_role). RLS habilitado sem policies públicas.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid not null,
  doctor_name text not null,
  doctor_crm text,
  type text not null check (type in ('receita', 'exame', 'relatorio')),
  title text not null,
  body text not null default '',
  shared_with_patient boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists documents_email_idx
  on public.documents (patient_email, created_at desc);

alter table public.documents enable row level security;

grant all privileges on public.documents to service_role;

comment on table public.documents is 'Receitas, pedidos de exame e relatórios emitidos pelo médico.';

-- ===== 20260806010000_doctor_approval.sql =====
-- Fluxo de aprovação de médicos pelo administrador + dados cadastrais.

alter table public.doctors
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended', 'correction')),
  add column if not exists phone text,
  add column if not exists crm_state text,
  add column if not exists rqe text,
  add column if not exists clinic text,
  add column if not exists admin_note text;

-- Médicos que já existiam antes do fluxo de aprovação seguem aprovados.
update public.doctors set status = 'approved' where status is null;

create index if not exists doctors_status_idx on public.doctors (status);

-- ===== 20260806020000_consent_lgpd.sql =====
-- Módulo de consentimento eletrônico (LGPD + CFM).
-- Documentos versionados, aceites imutáveis e trilha de auditoria.

create table if not exists public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy', 'telehealth')),
  version text not null,
  title text not null,
  body text not null,
  sha256 text not null,
  published_at timestamptz not null default now(),
  active boolean not null default true,
  unique (type, version)
);

create table if not exists public.consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  patient_id text,
  patient_email text not null,
  patient_cpf text,
  consent_type text not null,
  consent_version text not null,
  document_id uuid,
  document_sha256 text not null,
  accepted boolean not null default true,
  accepted_at timestamptz not null default now(), -- hora do servidor
  ip_address text,
  user_agent text,
  browser text,
  operating_system text,
  device text,
  language text,
  screen_resolution text,
  session_id text,
  revoked boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  patient_id text,
  patient_email text,
  action text not null,
  table_name text,
  record_id text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists consent_acceptances_email_idx
  on public.consent_acceptances (patient_email, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.consent_documents enable row level security;
alter table public.consent_acceptances enable row level security;
alter table public.audit_logs enable row level security;

grant all privileges on public.consent_documents to service_role;
grant all privileges on public.consent_acceptances to service_role;
grant all privileges on public.audit_logs to service_role;

comment on table public.consent_acceptances is 'Aceites de consentimento — imutáveis (somente INSERT; revogação via flag).';
comment on table public.audit_logs is 'Trilha de auditoria de eventos sensíveis.';

-- ===== 20260806030000_platform_settings.sql =====
-- Configurações da plataforma (dados da empresa/controlador para documentos legais).
-- Linha única (id fixo). Acesso apenas server-side (service_role).

create table if not exists public.platform_settings (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
grant all privileges on public.platform_settings to service_role;

insert into public.platform_settings (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

comment on table public.platform_settings is 'Dados da empresa e configurações da plataforma.';

-- ===== 20260806040000_patients.sql =====
-- Pacientes criados diretamente pelo médico (sem depender de agendamento).
-- Acesso server-side (service_role). O médico dono é doctor_id.

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  name text not null,
  cpf text,
  cpf_normalized text,
  birthdate date,
  sex text,
  phone text,
  email text,
  address text,
  emergency_contact text,
  guardian_name text,
  guardian_phone text,
  insurance text,
  allergies text,
  diseases text,
  medications text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists patients_doctor_idx on public.patients (doctor_id, created_at desc);
create index if not exists patients_cpf_idx on public.patients (cpf_normalized);

alter table public.patients enable row level security;
grant all privileges on public.patients to service_role;

comment on table public.patients is 'Pacientes cadastrados pelo médico (prontuário próprio).';

-- ===== 20260806050000_lab_results.sql =====
-- Resultados de exames laboratoriais (foco nefrologia) para gráficos no prontuário.
create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid,
  test_key text not null,
  value numeric not null,
  unit text,
  reference_range text,
  origin text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lab_results_email_test_idx
  on public.lab_results (patient_email, test_key, measured_at);

alter table public.lab_results enable row level security;
grant all privileges on public.lab_results to service_role;

comment on table public.lab_results is 'Resultados laboratoriais por data (creatinina, TFGe, RAC, etc.).';

-- ===== 20260806060000_patient_uploads.sql =====
-- Exames/documentos enviados pelo paciente (arquivos em bucket privado 'exames').
create table if not exists public.patient_uploads (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  uploader text not null default 'patient',
  name text not null,
  category text,
  file_path text not null,
  mime text,
  size_bytes integer,
  exam_date date,
  created_at timestamptz not null default now()
);

create index if not exists patient_uploads_email_idx
  on public.patient_uploads (patient_email, created_at desc);

alter table public.patient_uploads enable row level security;
grant all privileges on public.patient_uploads to service_role;

comment on table public.patient_uploads is 'Metadados dos exames/documentos enviados pelo paciente (arquivo no Storage privado).';

-- ===== 20260806070000_lme_requests.sql =====
-- LME / CEAF: Laudo de Solicitação de Medicamento(s) do Componente Especializado.
create table if not exists public.lme_requests (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid,
  doctor_name text,
  doctor_crm text,
  doctor_cns text,
  establishment_name text,
  cnes text,
  patient_name text,
  mother_name text,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  patient_cpf text,
  patient_cns text,
  patient_phone text,
  patient_email_contact text,
  race text,
  cid10 text,
  diagnosis text,
  anamnesis text,
  prior_treatment boolean not null default false,
  prior_treatment_desc text,
  incapable boolean not null default false,
  responsible_name text,
  medications jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho',
  created_at timestamptz not null default now()
);

create index if not exists lme_requests_email_idx on public.lme_requests (patient_email, created_at desc);

alter table public.lme_requests enable row level security;
grant all privileges on public.lme_requests to service_role;

comment on table public.lme_requests is 'Solicitações de LME (CEAF) preenchidas pelo médico.';

-- ===== 20260806080000_ceaf_protocols.sql =====
-- Biblioteca de protocolos do CEAF (gerenciada pelo administrador).
-- Conteúdo clínico é cadastrado pelo administrador/médico (não fixado em código).
create table if not exists public.ceaf_protocols (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cid10 text,
  medications jsonb not null default '[]'::jsonb,
  required_exams jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  notes text,
  source text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ceaf_protocols_active_idx on public.ceaf_protocols (active, name);

alter table public.ceaf_protocols enable row level security;
grant all privileges on public.ceaf_protocols to service_role;

comment on table public.ceaf_protocols is 'Protocolos do CEAF: doença -> CID, medicamentos, exames e documentos exigidos.';

-- ===== 20260806090000_document_templates.sql =====
-- "Meus Padrões": modelos de documento reutilizáveis (por médico) com variáveis.
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  scope text not null default 'personal' check (scope in ('personal','clinic','official')),
  type text not null,
  title text not null,
  body text not null default '',
  favorite boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_templates_doctor_idx on public.document_templates (doctor_id, type, created_at desc);

alter table public.document_templates enable row level security;
grant all privileges on public.document_templates to service_role;

-- Amplia os tipos de documento aceitos (mantém os existentes).
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.documents'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%type%';
  if c is not null then execute format('alter table public.documents drop constraint %I', c); end if;
exception when undefined_table then null;
end $$;

alter table public.documents
  add constraint documents_type_check
  check (type in ('receita','exame','relatorio','atestado','declaracao','encaminhamento','ter','consentimento','orientacao'));

comment on table public.document_templates is 'Modelos de documento reutilizáveis do médico (Meus Padrões).';

-- ===== 20260807010000_doctor_logo.sql =====
-- Logo do médico exibida no cabeçalho dos documentos/PDF (data URL base64 ou URL pública).
alter table public.doctors add column if not exists logo_url text;

-- ===== 20260807020000_doctor_links.sql =====
-- Biblioteca de links úteis do médico, organizados por condição/tópico
-- (ex.: Anemia, Doença Renal Crônica, CEAF). Assim o médico não precisa sair
-- do site para procurar referências e documentos.
create table if not exists public.doctor_links (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  title text not null,
  url text not null,
  category text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists doctor_links_doctor_idx on public.doctor_links (doctor_id, category);

alter table public.doctor_links enable row level security;
grant all privileges on public.doctor_links to service_role;

comment on table public.doctor_links is 'Links úteis salvos pelo médico, organizados por condição/tópico.';

-- ===== 20260807030000_patient_password.sql =====
-- Senha de acesso do paciente (login por CPF). Padrão inicial "123456",
-- que o paciente pode trocar depois. Armazenada com hash (bcrypt).
alter table public.patients add column if not exists password_hash text;

-- ===== 20260808010000_clinical_profile.sql =====
-- Perfil clínico estruturado do paciente (comorbidades, DRC G/A, etiologia etc.).
-- Guardado como JSONB para ser extensível (novas variáveis não exigem migração).
-- Não substitui o prontuário: apenas estrutura dados para acompanhamento e pesquisa.
create table if not exists public.patient_clinical_profile (
  patient_key text primary key,
  doctor_id uuid,
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.patient_clinical_profile enable row level security;
grant all privileges on public.patient_clinical_profile to service_role;

comment on table public.patient_clinical_profile is 'Perfil clínico estruturado (JSONB extensível) por paciente, para longitudinal e pesquisa.';

-- ===== 20260808020000_provenance_and_egfr_meta.sql =====
-- Proveniência por dado + histórico de correções no perfil clínico,
-- e metadados da TFGe (equação/versão/creatinina de origem) em lab_results.

-- Perfil clínico: meta (fonte por campo) e history (log de alterações)
alter table public.patient_clinical_profile add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.patient_clinical_profile add column if not exists history jsonb not null default '[]'::jsonb;

-- Exames: metadados (ex.: TFGe calculada preservando creatinina/equação/versão)
alter table public.lab_results add column if not exists meta jsonb;

-- ===== 20260808030000_doctor_mp_account.sql =====
-- Conta Mercado Pago do próprio médico: quando preenchido, o pagamento da
-- consulta é cobrado nessa conta (o dinheiro vai para o médico).
-- Segredo — acessado somente no servidor (service role).
alter table public.doctors add column if not exists mp_access_token text;

-- ===== 20260808040000_doctor_finance.sql =====
-- Regras financeiras: preço (definido pelo médico) x percentual de repasse
-- (definido SOMENTE pelo administrador), com liberação de recebimento e histórico.

-- Percentual de repasse do médico (0–100) e status de liberação financeira.
alter table public.doctors add column if not exists commission_percent integer;
alter table public.doctors add column if not exists payout_status text default 'active';

-- Snapshot do percentual aplicado em cada pagamento (não recalcular pagamentos antigos).
alter table public.payments add column if not exists doctor_share_percent integer;

-- Histórico de alterações financeiras (preço e percentual), com autor e data.
create table if not exists public.doctor_financial_events (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  kind text not null check (kind in ('price', 'commission', 'payout_status')),
  old_value text,
  new_value text not null,
  changed_by text not null check (changed_by in ('admin', 'medico')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists doctor_financial_events_doctor_idx
  on public.doctor_financial_events (doctor_id, created_at desc);

-- ===== 20260809020000_consulta_confirmacao_remarcacao.sql =====
-- Confirmação da consulta pelo médico, proposta de novo horário, remarcação
-- (mantendo o pagamento) e linha do tempo. Não altera pagamentos existentes.

-- WhatsApp do médico para avisos de consultas
alter table public.doctors add column if not exists notify_whatsapp text;
alter table public.doctors add column if not exists use_whatsapp_notifications boolean not null default false;

-- Fluxo de agendamento (separado do pagamento) na consulta
alter table public.bookings add column if not exists stage text;               -- ver ConsultationStage
alter table public.bookings add column if not exists events jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists proposed_slot_start timestamptz;
alter table public.bookings add column if not exists proposed_slot_end timestamptz;
alter table public.bookings add column if not exists proposal_message text;
alter table public.bookings add column if not exists proposal_by text;
alter table public.bookings add column if not exists not_realized_reason text;

-- ===== 20260809030000_doctor_whatsapp_privacy.sql =====
-- Privacidade do WhatsApp do médico: número interno de notificações (nunca exposto)
-- separado do número de contato dos pacientes (pode ser secretária/clínica).

alter table public.doctors add column if not exists patient_contact_whatsapp text;
alter table public.doctors add column if not exists allow_patient_contact boolean not null default false;
alter table public.doctors add column if not exists notify_new_bookings boolean not null default true;
alter table public.doctors add column if not exists notify_payments boolean not null default true;
alter table public.doctors add column if not exists notify_reschedules boolean not null default true;

-- ===== 20260809040000_agenda_locais_modalidade.sql =====
-- Agenda avançada: locais de atendimento, períodos por local/modalidade, modalidade
-- na consulta e reserva temporária (anti dupla marcação). Não quebra a agenda atual.

alter table public.doctors add column if not exists locations jsonb not null default '[]'::jsonb;
alter table public.doctors add column if not exists availability_periods jsonb not null default '[]'::jsonb;

alter table public.bookings add column if not exists modality text;
alter table public.bookings add column if not exists location_id text;
alter table public.bookings add column if not exists location_name text;

-- Reserva temporária de horário (expira). Server-side, evita dupla marcação.
create table if not exists public.appointment_holds (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  slot_start timestamptz not null,
  holder text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists appointment_holds_doctor_idx on public.appointment_holds (doctor_id, slot_start);
alter table public.appointment_holds enable row level security;
grant all privileges on table public.appointment_holds to service_role;

-- ===== 20260809050000_reminders.sql =====
-- Lembretes de consulta (24h e 2h antes). Controle para não reenviar.
alter table public.bookings add column if not exists reminder_24_sent boolean not null default false;
alter table public.bookings add column if not exists reminder_2_sent boolean not null default false;

-- ===== 20260810010000_notifications_pwa.sql =====
-- PWA + Notificações (push web/mobile) + preferências + calendário.
-- 100% aditivo/idempotente. Não remove nem altera dados existentes.

-- ---------- Dispositivos/assinaturas de push (um usuário pode ter vários) ----------
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                 -- id do médico (uuid) OU chave do paciente (cpf/e-mail)
  role text not null default 'paciente', -- 'medico' | 'paciente'
  platform text not null default 'web',  -- 'web' | 'ios' | 'android'
  endpoint text not null,                -- endpoint do PushSubscription (único por dispositivo)
  subscription jsonb not null,           -- PushSubscription completo (keys p256dh/auth)
  device_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists user_devices_endpoint_key on public.user_devices (endpoint);
create index if not exists user_devices_user_idx on public.user_devices (user_id);
alter table public.user_devices enable row level security;
grant all privileges on table public.user_devices to service_role;

-- ---------- Histórico + central de notificações (in-app) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                 -- destinatário (médico id ou chave do paciente)
  role text not null default 'paciente',
  type text not null,                    -- ex.: nova_consulta, confirmada, remarcada, lembrete...
  title text not null,
  message text,
  target_url text,                       -- deep link interno
  related_entity_type text,              -- ex.: 'booking'
  related_entity_id text,
  read_at timestamptz,
  sent_at timestamptz,                   -- quando push foi disparado (best-effort)
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
grant all privileges on table public.notifications to service_role;

-- ---------- Preferências do médico (push + lembretes + calendário + fuso) ----------
alter table public.doctors add column if not exists notify_push boolean not null default true;
alter table public.doctors add column if not exists notify_reminder_24 boolean not null default true;
alter table public.doctors add column if not exists notify_reminder_2 boolean not null default true;
-- Formato do título do evento no calendário do médico: 'meurim' = "Consulta — Meu Rim"; 'patient' = "Consulta — Nome".
alter table public.doctors add column if not exists calendar_event_mode text not null default 'meurim';
alter table public.doctors add column if not exists tz text not null default 'America/Bahia';

-- ---------- Preferências do paciente (quando cadastrado) ----------
alter table public.patients add column if not exists notify_push boolean not null default true;
alter table public.patients add column if not exists notify_reminder_24 boolean not null default true;
alter table public.patients add column if not exists notify_reminder_2 boolean not null default true;

-- ===== 20260811010000_letterheads_documents.sql =====
-- Motor universal de documentos: papéis timbrados por médico + extensão da tabela documents.
-- 100% aditivo/idempotente. Não remove dados. Não altera identidade visual da plataforma.

-- ---------- Papéis timbrados (por médico) ----------
create table if not exists public.letterheads (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  name text not null,
  kind text not null default 'image',       -- 'pdf' | 'image'
  mime text,
  storage text not null default 'supabase',  -- 'supabase' | 'local'
  file_path text not null,                   -- caminho no bucket (ou local em dev)
  is_default boolean not null default false,
  active boolean not null default true,
  -- Área útil (frações 0..1 da página A4) + comportamento de páginas.
  area jsonb not null default '{"marginTop":0.22,"marginBottom":0.14,"marginLeft":0.10,"marginRight":0.10,"repeat":"all","showPatientHeader":true,"showSignature":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists letterheads_doctor_idx on public.letterheads (doctor_id, created_at desc);
alter table public.letterheads enable row level security;
grant all privileges on table public.letterheads to service_role;

-- ---------- Extensão da tabela documents (universal) ----------
-- Libera o tipo (documento livre, atestado, encaminhamento, laudo, etc.) sem quebrar dados.
alter table public.documents drop constraint if exists documents_type_check;

alter table public.documents add column if not exists letterhead_id text;
alter table public.documents add column if not exists pdf_path text;         -- PDF final gerado (storage)
alter table public.documents add column if not exists pdf_storage text;      -- 'supabase' | 'local'
alter table public.documents add column if not exists status text not null default 'draft'; -- draft | final | signed
alter table public.documents add column if not exists version integer not null default 1;
alter table public.documents add column if not exists group_id uuid;         -- agrupa versões do mesmo documento
alter table public.documents add column if not exists content_json jsonb;    -- conteúdo estruturado (opcional)
alter table public.documents add column if not exists signed_at timestamptz;
alter table public.documents add column if not exists signed_by text;
alter table public.documents add column if not exists signature_method text; -- 'eletronica' | 'imagem' | 'certificada'
alter table public.documents add column if not exists signature_hash text;
alter table public.documents add column if not exists available_at timestamptz;   -- quando foi disponibilizado ao paciente
alter table public.documents add column if not exists patient_viewed_at timestamptz;
alter table public.documents add column if not exists history jsonb not null default '[]'::jsonb;

-- ===== 20260812010000_attendants.sql =====
-- Perfil ATENDENTE/SECRETÁRIA: conta própria (CPF e/ou e-mail), vínculo a vários médicos,
-- permissões por vínculo e auditoria. 100% aditivo/idempotente. Não altera dados existentes.

create table if not exists public.attendants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text,
  cpf_normalized text,
  email text,
  phone text,
  whatsapp text,
  password_hash text,
  status text not null default 'active',   -- 'active' | 'inactive'
  created_at timestamptz not null default now(),
  last_access_at timestamptz
);
create index if not exists attendants_cpf_idx on public.attendants (cpf_normalized);
create index if not exists attendants_email_idx on public.attendants (lower(email));
alter table public.attendants enable row level security;
grant all privileges on table public.attendants to service_role;

-- Vínculo atendente ⇄ médico (as permissões pertencem ao VÍNCULO).
create table if not exists public.attendant_links (
  id uuid primary key default gen_random_uuid(),
  attendant_id uuid not null,
  doctor_id uuid not null,
  active boolean not null default true,
  permissions jsonb not null default '{"agenda":true,"verHorarios":true,"criarPaciente":true,"editarCadastro":true,"agendar":true,"remarcar":true,"cancelar":true,"confirmar":true,"ausencia":true,"whatsapp":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists attendant_links_unique on public.attendant_links (attendant_id, doctor_id);
create index if not exists attendant_links_doctor_idx on public.attendant_links (doctor_id);
alter table public.attendant_links enable row level security;
grant all privileges on table public.attendant_links to service_role;

-- Auditoria das ações administrativas da atendente.
create table if not exists public.attendant_audit (
  id uuid primary key default gen_random_uuid(),
  attendant_id uuid not null,
  attendant_name text,
  doctor_id uuid not null,
  action text not null,
  patient_key text,
  booking_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists attendant_audit_doctor_idx on public.attendant_audit (doctor_id, created_at desc);
alter table public.attendant_audit enable row level security;
grant all privileges on table public.attendant_audit to service_role;

-- ===== 20260812020000_cns_fields.sql =====
-- CNS (Cartão Nacional de Saúde): médico (sempre) e paciente (quando necessário).
-- Aditivo/idempotente. Reutilizado no preenchimento da LME oficial.
alter table public.doctors add column if not exists cns text;
alter table public.patients add column if not exists cns text;

-- ===== 20260812030000_patient_mother_name.sql =====
-- Nome da mãe do paciente (exigido na LME/CEAF). CNES da clínica vai no JSONB doctors.locations.
alter table public.patients add column if not exists mother_name text;

-- ===== 20260816010000_research_studies.sql =====
-- Pesquisa Científica: estudos e casos interessantes (por médico).
-- Idempotente. Isolamento por doctor_id.

create table if not exists public.research_studies (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  type text not null default 'projeto_livre',
  title text not null default '',
  question text not null default '',
  filters jsonb not null default '[]'::jsonb,
  variables jsonb not null default '[]'::jsonb,
  journal text,
  status text not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_studies_doctor_idx on public.research_studies (doctor_id, updated_at desc);
alter table public.research_studies enable row level security;
grant all privileges on table public.research_studies to service_role;

create table if not exists public.research_cases (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text,
  categories jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists research_cases_unique on public.research_cases (doctor_id, patient_key);
create index if not exists research_cases_doctor_idx on public.research_cases (doctor_id, updated_at desc);
alter table public.research_cases enable row level security;
grant all privileges on table public.research_cases to service_role;

-- ===== 20260817010000_doctor_pix_profile.sql =====
-- Perfil Pix estruturado do médico (chave + titular + documento + banco), para
-- recebimento direto por Pix. Idempotente e aditivo (mantém pix_key existente).
alter table public.doctors add column if not exists pix_profile jsonb;

-- ===== EXTRA: editor de caixas TER/CEAF (PR #67) =====
create table if not exists public.ceaf_doc_patterns (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  doc_key text not null,
  boxes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists ceaf_doc_patterns_unique on public.ceaf_doc_patterns (doctor_id, doc_key);
alter table public.ceaf_doc_patterns enable row level security;
grant all privileges on table public.ceaf_doc_patterns to service_role;

-- ===== EXTRA: assinatura visual do medico (PR #71) =====
alter table public.doctors add column if not exists signature_visual jsonb;

-- ===== 20260817030000_doctor_cpf.sql =====
alter table public.doctors add column if not exists cpf text;


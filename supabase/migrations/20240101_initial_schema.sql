-- ============================================================
-- EmailTool — Initial Schema
-- ============================================================

-- uuid support
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type message_status as enum ('pending', 'sent', 'failed');
create type import_type    as enum ('leads', 'outreach');
create type duplicate_behavior as enum ('ignore', 'replace');

-- ============================================================
-- LEADS
-- Primary entity. One row per (union_name + local) pair.
-- ============================================================

create table leads (
  id               uuid        primary key default uuid_generate_v4(),

  -- composite natural key
  union_name       text        not null,
  local            text        not null,

  email            text        not null,

  -- optional fields
  phone            text,
  address          text,
  province         text,
  name             text,

  -- outreach tracking (denormalised for fast reads)
  total_contacts   integer     not null default 0,
  last_contacted_at timestamptz,

  -- state
  responded        boolean     not null default false,
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint uq_leads_union_local unique (union_name, local)
);

-- ============================================================
-- MESSAGES
-- One row per email sent to a lead.
-- ============================================================

create table messages (
  id                  uuid           primary key default uuid_generate_v4(),
  lead_id             uuid           not null references leads(id) on delete cascade,

  subject             text           not null,
  body                text           not null,

  -- sender identity captured at send-time (may differ per campaign)
  sender_name         text,
  sender_email        text,

  -- SendGrid response
  sendgrid_message_id text,
  status              message_status not null default 'pending',
  error_message       text,

  sent_at             timestamptz,
  created_at          timestamptz    not null default now()
);

-- ============================================================
-- IMPORT LOGS
-- Audit trail for every CSV upload (leads or outreach).
-- ============================================================

create table import_logs (
  id            uuid        primary key default uuid_generate_v4(),
  import_type   import_type not null,
  filename      text        not null,

  -- row-level summary
  total_rows    integer     not null default 0,
  created_count integer     not null default 0,
  updated_count integer     not null default 0,
  skipped_count integer     not null default 0,
  failed_count  integer     not null default 0,

  -- per-row errors stored as [{row, reason}]
  errors        jsonb,

  created_at    timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Keep leads.updated_at current on every UPDATE
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function fn_set_updated_at();


-- Maintain denormalised contact stats on leads after message changes
create or replace function fn_sync_lead_contact_stats()
returns trigger language plpgsql as $$
declare
  v_lead_id uuid;
begin
  -- resolve which lead to update
  if TG_OP = 'DELETE' then
    v_lead_id := old.lead_id;
  else
    v_lead_id := new.lead_id;
  end if;

  update leads
  set
    total_contacts    = (
      select count(*) from messages
      where lead_id = v_lead_id and status = 'sent'
    ),
    last_contacted_at = (
      select max(sent_at) from messages
      where lead_id = v_lead_id and status = 'sent'
    ),
    updated_at = now()
  where id = v_lead_id;

  return null;
end;
$$;

create trigger trg_message_stats
  after insert or update of status or delete on messages
  for each row execute function fn_sync_lead_contact_stats();

-- ============================================================
-- INDEXES
-- ============================================================

-- leads — primary lookups
create index idx_leads_union_local   on leads (union_name, local);
create index idx_leads_email         on leads (email);
create index idx_leads_responded     on leads (responded);
create index idx_leads_province      on leads (province);
create index idx_leads_last_contact  on leads (last_contacted_at desc nulls last);

-- messages — foreign key + time-series queries
create index idx_messages_lead_id    on messages (lead_id);
create index idx_messages_sent_at    on messages (sent_at desc nulls last);
create index idx_messages_status     on messages (status);

-- import_logs — audit queries
create index idx_import_logs_type       on import_logs (import_type);
create index idx_import_logs_created_at on import_logs (created_at desc);

-- ============================================================
-- DASHBOARD VIEW  (avoids repeating aggregate SQL)
-- ============================================================

create or replace view vw_dashboard_stats as
select
  (select count(*)                        from leads)    as total_leads,
  (select count(*) from messages where status = 'sent')  as total_sent,
  (select count(*) from leads where responded = true)    as total_responded,
  case
    when (select count(*) from leads) = 0 then 0
    else round(
      (select count(*) from leads where responded = true)::numeric
      / (select count(*) from leads)::numeric * 100, 1
    )
  end                                                     as response_rate_pct;

-- ============================================================
-- RECENT ACTIVITY VIEW  (last 50 messages with lead context)
-- ============================================================

create or replace view vw_recent_activity as
select
  m.id,
  m.sent_at,
  m.status,
  m.subject,
  l.union_name,
  l.local,
  l.email,
  l.name
from messages m
join leads   l on l.id = m.lead_id
order by m.sent_at desc nulls last
limit 50;

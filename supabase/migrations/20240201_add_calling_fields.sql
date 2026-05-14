-- ============================================================
-- Add fields to support the calling workflow
-- ============================================================

alter table leads add column if not exists website text;
alter table leads add column if not exists called  boolean not null default false;

-- Email is no longer strictly required: phone-only leads are valid for
-- the calling workflow. At least one of (email, phone) should be present,
-- but we enforce this at the application layer for flexibility.
alter table leads alter column email drop not null;

create index if not exists idx_leads_called  on leads (called);

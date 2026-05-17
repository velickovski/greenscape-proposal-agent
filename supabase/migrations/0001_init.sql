-- =============================================================================
-- Greenscape Proposal Agent — initial schema
-- =============================================================================
-- All tables enable RLS; the service role used by the Next.js server bypasses
-- RLS by design (Postgres role-level), so app code routes everything through
-- the server. No public/anon writes anywhere.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- clients: who we are sending the proposal to
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    email           text,
    phone           text,
    address         text,
    hoa             boolean not null default false,
    notes           text,
    ghl_contact_id  text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists clients_email_idx on public.clients (lower(email));

-- ---------------------------------------------------------------------------
-- site_walks: raw notes + metadata for one site visit; one client may have
-- multiple, one site_walk feeds zero-or-many proposals
-- ---------------------------------------------------------------------------
create table if not exists public.site_walks (
    id              uuid primary key default gen_random_uuid(),
    client_id       uuid not null references public.clients(id) on delete cascade,
    visited_at      timestamptz not null default now(),
    raw_notes       text not null,
    sqft_hint       integer,
    created_at      timestamptz not null default now()
);

create index if not exists site_walks_client_idx on public.site_walks (client_id);

-- ---------------------------------------------------------------------------
-- line_items_catalog: the deterministic price source-of-truth.
-- Claude returns sku_id values from this table; it cannot invent prices.
-- ---------------------------------------------------------------------------
create table if not exists public.line_items_catalog (
    sku_id            text primary key,
    category          text not null,
    name              text not null,
    description       text,
    unit              text not null,                      -- 'sqft', 'linear_ft', 'each', 'job'
    unit_price_cents  integer not null check (unit_price_cents >= 0),
    min_charge_cents  integer not null default 0 check (min_charge_cents >= 0),
    margin_pct        numeric(4,2) not null default 38.00,
    active            boolean not null default true,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists catalog_category_idx on public.line_items_catalog (category) where active;

-- ---------------------------------------------------------------------------
-- proposals: parent record for one proposal
-- status lifecycle: draft -> extracted -> approved -> sent
-- ---------------------------------------------------------------------------
create type public.proposal_status as enum ('draft', 'extracted', 'approved', 'sent', 'rejected');

create table if not exists public.proposals (
    id                  uuid primary key default gen_random_uuid(),
    client_id           uuid not null references public.clients(id) on delete cascade,
    site_walk_id        uuid references public.site_walks(id) on delete set null,
    status              public.proposal_status not null default 'draft',
    title               text not null,
    cover_letter        text,
    subtotal_cents      integer not null default 0,
    tax_pct             numeric(4,2) not null default 0.00,
    total_cents         integer not null default 0,
    deposit_pct         numeric(4,2) not null default 50.00,
    pdf_storage_path    text,
    extracted_at        timestamptz,
    sent_at             timestamptz,
    -- LLM cost tracking
    extract_input_tokens   integer not null default 0,
    extract_output_tokens  integer not null default 0,
    copy_input_tokens      integer not null default 0,
    copy_output_tokens     integer not null default 0,
    api_cost_usd_micros    bigint not null default 0,    -- store in micro-dollars (1e-6 USD)
    -- Integration handles
    stripe_deposit_url  text,
    ghl_opportunity_id  text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists proposals_client_idx on public.proposals (client_id);
create index if not exists proposals_status_idx on public.proposals (status);
create index if not exists proposals_created_idx on public.proposals (created_at desc);

-- ---------------------------------------------------------------------------
-- proposal_line_items: extracted line items joined back to the catalog.
-- We snapshot the catalog price at extraction time so the proposal is stable
-- if the catalog later changes.
-- ---------------------------------------------------------------------------
create table if not exists public.proposal_line_items (
    id                      uuid primary key default gen_random_uuid(),
    proposal_id             uuid not null references public.proposals(id) on delete cascade,
    sku_id                  text not null references public.line_items_catalog(sku_id) on delete restrict,
    quantity                numeric(12,2) not null check (quantity > 0),
    -- snapshotted from catalog at extraction time
    unit                    text not null,
    unit_price_cents        integer not null check (unit_price_cents >= 0),
    -- computed: max(quantity * unit_price, catalog.min_charge_cents)
    line_total_cents        integer not null check (line_total_cents >= 0),
    llm_notes               text,                          -- why Claude chose this SKU
    sort_order              integer not null default 0,
    created_at              timestamptz not null default now()
);

create index if not exists pli_proposal_idx on public.proposal_line_items (proposal_id, sort_order);

-- ---------------------------------------------------------------------------
-- approvals: HITL hard gate. /send route returns 403 unless a row exists.
-- ---------------------------------------------------------------------------
create table if not exists public.approvals (
    id             uuid primary key default gen_random_uuid(),
    proposal_id    uuid not null references public.proposals(id) on delete cascade,
    approver_email text not null,
    approved_at    timestamptz not null default now(),
    note           text,
    unique (proposal_id)         -- exactly one approval per proposal
);

-- ---------------------------------------------------------------------------
-- audit_log: append-only record of every state change and side-effect
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
    id             bigserial primary key,
    proposal_id    uuid references public.proposals(id) on delete cascade,
    event          text not null,                          -- 'extracted', 'edited', 'approved', 'sent', 'ghl_pushed', 'stripe_link_created', 'email_sent'
    actor          text,                                   -- 'system', 'marcus@...', etc.
    payload        jsonb not null default '{}'::jsonb,
    created_at     timestamptz not null default now()
);

create index if not exists audit_proposal_idx on public.audit_log (proposal_id, created_at desc);
create index if not exists audit_event_idx on public.audit_log (event, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers — generic
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

create trigger trg_clients_updated_at before update on public.clients
    for each row execute function public.set_updated_at();

create trigger trg_catalog_updated_at before update on public.line_items_catalog
    for each row execute function public.set_updated_at();

create trigger trg_proposals_updated_at before update on public.proposals
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: enable on all tables. Service role bypasses RLS at the Postgres level
-- so server-side code (Next.js using the service role key) works unchanged.
-- No public policies = no anon/auth client can read or write these tables.
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.site_walks enable row level security;
alter table public.line_items_catalog enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_line_items enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;

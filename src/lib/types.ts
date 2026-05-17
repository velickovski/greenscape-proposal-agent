// Domain types mirroring the Supabase schema. Kept hand-written (rather than
// generating from supabase) because the schema is small and stable for this MVP.

export type ProposalStatus = 'draft' | 'extracted' | 'approved' | 'sent' | 'rejected';

export interface Client {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    hoa: boolean;
    notes: string | null;
    ghl_contact_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface SiteWalk {
    id: string;
    client_id: string;
    visited_at: string;
    raw_notes: string;
    sqft_hint: number | null;
    created_at: string;
}

export interface CatalogItem {
    sku_id: string;
    category: string;
    name: string;
    description: string | null;
    unit: 'sqft' | 'linear_ft' | 'each' | 'job';
    unit_price_cents: number;
    min_charge_cents: number;
    margin_pct: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Proposal {
    id: string;
    client_id: string;
    site_walk_id: string | null;
    status: ProposalStatus;
    title: string;
    cover_letter: string | null;
    subtotal_cents: number;
    tax_pct: number;
    total_cents: number;
    deposit_pct: number;
    pdf_storage_path: string | null;
    extracted_at: string | null;
    sent_at: string | null;
    extract_input_tokens: number;
    extract_output_tokens: number;
    copy_input_tokens: number;
    copy_output_tokens: number;
    api_cost_usd_micros: number;
    stripe_deposit_url: string | null;
    ghl_opportunity_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProposalLineItem {
    id: string;
    proposal_id: string;
    sku_id: string;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    line_total_cents: number;
    llm_notes: string | null;
    sort_order: number;
    created_at: string;
}

export interface Approval {
    id: string;
    proposal_id: string;
    approver_email: string;
    approved_at: string;
    note: string | null;
}

export interface AuditLogEntry {
    id: number;
    proposal_id: string | null;
    event: AuditEvent;
    actor: string | null;
    payload: Record<string, unknown>;
    created_at: string;
}

export type AuditEvent =
    | 'client_created'
    | 'site_walk_recorded'
    | 'proposal_draft_created'
    | 'extracted'
    | 'extract_retry'
    | 'extract_failed'
    | 'line_items_edited'
    | 'cover_letter_generated'
    | 'pdf_rendered'
    | 'approved'
    | 'send_initiated'
    | 'email_sent'
    | 'email_failed'
    | 'stripe_link_created'
    | 'stripe_link_failed'
    | 'ghl_pushed'
    | 'ghl_push_failed'
    | 'slack_notified'
    | 'sent'
    | 'sanity_check_warning';

// View models used by the UI

export interface ProposalWithDetails {
    proposal: Proposal;
    client: Client;
    line_items: (ProposalLineItem & { catalog: Pick<CatalogItem, 'name' | 'category' | 'description'> })[];
    approval: Approval | null;
}

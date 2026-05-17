import 'server-only';
import { getSupabase } from '@/lib/supabase/server';
import type { Proposal, Client, ProposalLineItem, CatalogItem, Approval, AuditLogEntry } from '@/lib/types';

export type ProposalDetail = {
    proposal: Proposal;
    client: Client;
    line_items: (ProposalLineItem & { catalog: Pick<CatalogItem, 'name' | 'description' | 'category'> })[];
    approval: Approval | null;
    audit_log: AuditLogEntry[];
};

export async function fetchProposalDetail(proposalId: string): Promise<ProposalDetail | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('proposals')
        .select(
            '*, client:clients(*), line_items:proposal_line_items(*, catalog:line_items_catalog(name, description, category))',
        )
        .eq('id', proposalId)
        .maybeSingle();
    if (error) throw new Error(`fetch proposal: ${error.message}`);
    if (!data) return null;

    const { data: approval } = await supabase
        .from('approvals')
        .select('*')
        .eq('proposal_id', proposalId)
        .maybeSingle();

    const { data: audit } = await supabase
        .from('audit_log')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false })
        .limit(50);

    type Row = Proposal & { client: Client } & {
        line_items: (ProposalLineItem & {
            catalog: { name: string; description: string | null; category: string };
        })[];
    };
    const row = data as unknown as Row;

    return {
        proposal: stripJoined(row),
        client: row.client,
        line_items: row.line_items
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order),
        approval: (approval as Approval | null) ?? null,
        audit_log: (audit ?? []) as unknown as AuditLogEntry[],
    };
}

function stripJoined(row: object): Proposal {
    const r = { ...(row as Record<string, unknown>) };
    delete r.client;
    delete r.line_items;
    return r as unknown as Proposal;
}

export async function listProposals(limit = 20): Promise<{ proposal: Proposal; client: Client }[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('proposals')
        .select('*, client:clients(*)')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`list proposals: ${error.message}`);
    type Row = Proposal & { client: Client };
    return (data ?? []).map((r) => {
        const row = r as unknown as Row;
        return {
            proposal: stripJoined(row),
            client: row.client,
        };
    });
}

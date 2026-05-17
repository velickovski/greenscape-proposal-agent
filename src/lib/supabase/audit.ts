import 'server-only';
import { getSupabase } from './server';
import type { AuditEvent } from '@/lib/types';

export async function writeAudit(args: {
    proposalId: string | null;
    event: AuditEvent;
    actor?: string;
    payload?: Record<string, unknown>;
}): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('audit_log').insert({
        proposal_id: args.proposalId,
        event: args.event,
        actor: args.actor ?? 'system',
        payload: args.payload ?? {},
    });
    if (error) {
        // Audit failure should never break the user flow; log and move on.
        console.error('[audit] write failed', { event: args.event, error });
    }
}

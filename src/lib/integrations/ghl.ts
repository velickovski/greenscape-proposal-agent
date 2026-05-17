import 'server-only';
import { env, isGhlEnabled } from '@/lib/env';

// =============================================================================
// GoHighLevel CRM adapter. The interface is what production code calls; the
// mock implementation logs to console + the audit_log so the demo runs
// end-to-end without a real GHL sub-account. Swap in the real adapter by
// setting GHL_API_KEY + GHL_LOCATION_ID.
// =============================================================================

export interface GhlOpportunityPayload {
    proposalId: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    title: string;
    totalCents: number;
    pdfUrl: string | null;
    depositUrl: string | null;
}

export interface GhlPushResult {
    opportunityId: string | null;
    mocked: boolean;
    payload: Record<string, unknown>;
}

export interface GhlAdapter {
    advanceOpportunity(p: GhlOpportunityPayload): Promise<GhlPushResult>;
}

class MockGhlAdapter implements GhlAdapter {
    async advanceOpportunity(p: GhlOpportunityPayload): Promise<GhlPushResult> {
        const payload = {
            action: 'opportunity.stage_changed',
            stage: 'proposal_sent',
            ...p,
        };
        console.warn('[ghl mock] would push to GHL →', payload);
        return {
            opportunityId: `mock_${p.proposalId.slice(0, 8)}`,
            mocked: true,
            payload,
        };
    }
}

class RealGhlAdapter implements GhlAdapter {
    constructor(private apiKey: string, private locationId: string) {}

    async advanceOpportunity(p: GhlOpportunityPayload): Promise<GhlPushResult> {
        // Skeleton call. The exact GHL endpoint depends on whether the sub-account
        // is v1 or v2 of the API; this is the v2 shape. For the take-home demo we
        // never reach this code path (no creds), but the interface is
        // production-shaped for easy swap-in.
        const body = {
            locationId: this.locationId,
            pipelineId: 'proposal-pipeline',
            stageId: 'proposal-sent',
            name: p.title,
            monetaryValue: p.totalCents / 100,
            contactId: p.proposalId,           // would be a real GHL contact id in prod
            customFields: { pdfUrl: p.pdfUrl, depositUrl: p.depositUrl },
        };
        const res = await fetch('https://services.leadconnectorhq.com/opportunities/', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                Version: '2021-07-28',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`GHL push failed: ${res.status} ${text}`);
        }
        const json = (await res.json()) as { opportunity?: { id?: string } };
        return {
            opportunityId: json.opportunity?.id ?? null,
            mocked: false,
            payload: { ...body },
        };
    }
}

let _adapter: GhlAdapter | null = null;
export function getGhl(): GhlAdapter {
    if (_adapter) return _adapter;
    _adapter = isGhlEnabled()
        ? new RealGhlAdapter(env.GHL_API_KEY!, env.GHL_LOCATION_ID!)
        : new MockGhlAdapter();
    return _adapter;
}

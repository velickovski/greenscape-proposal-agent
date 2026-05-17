import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { approveProposal } from '@/lib/agent/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
    approver_email: z.string().email(),
    note: z.string().max(500).optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
    }

    const result = await approveProposal({
        proposalId: id,
        approverEmail: parsed.data.approver_email,
        note: parsed.data.note,
    });
    if ('reason' in result && result.approved === false) {
        return NextResponse.json({ error: 'not_approved', reason: result.reason }, { status: 403 });
    }
    return NextResponse.json({ approved: true });
}

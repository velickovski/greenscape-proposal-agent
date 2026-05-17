import { NextResponse, type NextRequest } from 'next/server';
import { sendProposal } from '@/lib/agent/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    try {
        const result = await sendProposal({ proposalId: id });
        return NextResponse.json(result);
    } catch (err) {
        const msg = (err as Error).message;
        const status = msg.startsWith('Send blocked') ? 403 : 500;
        return NextResponse.json({ error: 'send_failed', message: msg }, { status });
    }
}

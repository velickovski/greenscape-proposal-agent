import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createProposal } from '@/lib/agent/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
    client: z.object({
        name: z.string().min(1),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        hoa: z.boolean().optional(),
    }),
    title: z.string().min(3).max(200),
    site_walk_notes: z.string().min(20).max(20_000),
});

export async function POST(request: NextRequest) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    const parsed = Body.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
    }
    const input = parsed.data;

    try {
        const out = await createProposal({
            client: {
                name: input.client.name,
                email: input.client.email ?? null,
                phone: input.client.phone ?? null,
                address: input.client.address ?? null,
                hoa: input.client.hoa ?? false,
            },
            title: input.title,
            site_walk_notes: input.site_walk_notes,
        });
        return NextResponse.json(out);
    } catch (err) {
        console.error('[/api/proposals POST]', err);
        return NextResponse.json(
            { error: 'pipeline_failed', message: (err as Error).message },
            { status: 500 },
        );
    }
}

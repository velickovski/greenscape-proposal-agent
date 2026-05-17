import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/supabase/audit';
import { renderAndStorePdf } from '@/lib/agent/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
    updates: z
        .array(
            z.object({
                line_item_id: z.string().uuid(),
                quantity: z.number().positive().optional(),
                delete: z.boolean().optional(),
            }),
        )
        .min(1),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: existing, error: fetchErr } = await supabase
        .from('proposal_line_items')
        .select('*, catalog:line_items_catalog(min_charge_cents)')
        .eq('proposal_id', id);
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const byId = new Map(
        existing.map((r) => [
            r.id as string,
            r as {
                id: string;
                quantity: number;
                unit_price_cents: number;
                catalog: { min_charge_cents: number };
            },
        ]),
    );

    for (const u of parsed.data.updates) {
        const row = byId.get(u.line_item_id);
        if (!row) continue;
        if (u.delete) {
            await supabase.from('proposal_line_items').delete().eq('id', u.line_item_id);
            byId.delete(u.line_item_id);
            continue;
        }
        if (u.quantity !== undefined) {
            const raw = Math.round(u.quantity * row.unit_price_cents);
            const newTotal = Math.max(raw, row.catalog.min_charge_cents);
            await supabase
                .from('proposal_line_items')
                .update({ quantity: u.quantity, line_total_cents: newTotal })
                .eq('id', u.line_item_id);
            row.quantity = u.quantity;
        }
    }

    // Recompute totals
    const { data: refreshed } = await supabase
        .from('proposal_line_items')
        .select('line_total_cents')
        .eq('proposal_id', id);
    const subtotal = (refreshed ?? []).reduce((s, r) => s + (r.line_total_cents as number), 0);
    await supabase
        .from('proposals')
        .update({ subtotal_cents: subtotal, total_cents: subtotal })
        .eq('id', id);

    await writeAudit({
        proposalId: id,
        event: 'line_items_edited',
        payload: { updates: parsed.data.updates.length, subtotal },
    });

    // Re-render PDF.
    await renderAndStorePdf(id);

    return NextResponse.json({ ok: true, subtotal_cents: subtotal });
}

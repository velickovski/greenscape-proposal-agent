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

const AddBody = z.object({
    sku_id: z.string().min(1),
    quantity: z.number().positive(),
    note: z.string().max(500).optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = AddBody.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
    }

    const supabase = getSupabase();

    // Look up catalog row for this SKU.
    const { data: sku, error: skuErr } = await supabase
        .from('line_items_catalog')
        .select('sku_id, unit, unit_price_cents, min_charge_cents, active')
        .eq('sku_id', parsed.data.sku_id)
        .maybeSingle();
    if (skuErr) return NextResponse.json({ error: skuErr.message }, { status: 500 });
    if (!sku || !sku.active) {
        return NextResponse.json({ error: 'unknown_sku' }, { status: 400 });
    }

    // Determine next sort_order.
    const { data: existing } = await supabase
        .from('proposal_line_items')
        .select('sort_order')
        .eq('proposal_id', id)
        .order('sort_order', { ascending: false })
        .limit(1);
    const nextSort = ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1;

    const raw = Math.round(parsed.data.quantity * sku.unit_price_cents);
    const lineTotal = Math.max(raw, sku.min_charge_cents);

    const { error: insErr } = await supabase.from('proposal_line_items').insert({
        proposal_id: id,
        sku_id: sku.sku_id,
        quantity: parsed.data.quantity,
        unit: sku.unit,
        unit_price_cents: sku.unit_price_cents,
        line_total_cents: lineTotal,
        llm_notes: parsed.data.note ?? 'Added manually by Marcus.',
        sort_order: nextSort,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // Recompute totals.
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
        payload: { action: 'manual_add', sku_id: sku.sku_id, quantity: parsed.data.quantity, subtotal },
    });

    await renderAndStorePdf(id);

    return NextResponse.json({ ok: true, subtotal_cents: subtotal });
}

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

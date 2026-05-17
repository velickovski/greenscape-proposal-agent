import 'server-only';
import type { CatalogItem } from '@/lib/types';

// =============================================================================
// Deterministic pricing. The LLM never sees these numbers; this is the only
// place dollars touch the system.
// =============================================================================

export interface PricedLineItem {
    sku_id: string;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    line_total_cents: number;
    name: string;
    description: string | null;
    category: string;
    llm_notes: string | null;
}

export interface PricingResult {
    items: PricedLineItem[];
    subtotal_cents: number;
    /** SKUs that the LLM returned but were not in the catalog. Always empty if
     *  extraction validation passed first; defensive belt-and-suspenders. */
    unknown_skus: string[];
}

export function priceLineItems(args: {
    extracted: { sku_id: string; quantity: number; notes: string }[];
    catalog: CatalogItem[];
}): PricingResult {
    const catalogMap = new Map(args.catalog.map((c) => [c.sku_id, c]));
    const unknown: string[] = [];
    const items: PricedLineItem[] = [];

    for (const ex of args.extracted) {
        const cat = catalogMap.get(ex.sku_id);
        if (!cat || !cat.active) {
            unknown.push(ex.sku_id);
            continue;
        }
        const raw = Math.round(ex.quantity * cat.unit_price_cents);
        const line_total_cents = Math.max(raw, cat.min_charge_cents);
        items.push({
            sku_id: ex.sku_id,
            quantity: ex.quantity,
            unit: cat.unit,
            unit_price_cents: cat.unit_price_cents,
            line_total_cents,
            name: cat.name,
            description: cat.description,
            category: cat.category,
            llm_notes: ex.notes,
        });
    }

    const subtotal_cents = items.reduce((sum, it) => sum + it.line_total_cents, 0);
    return { items, subtotal_cents, unknown_skus: unknown };
}

export function formatUsd(cents: number): string {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUsdRounded(cents: number): string {
    const dollars = Math.round(cents / 100);
    return `$${dollars.toLocaleString('en-US')}`;
}

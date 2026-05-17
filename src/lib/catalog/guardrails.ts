import 'server-only';
import type { PricedLineItem } from './pricing';

// =============================================================================
// Guardrails are warnings on top of validation. Validation is strict (e.g.
// unknown SKU = hard reject). These are heuristic checks shown to Marcus on
// the review screen — never block, only flag.
// =============================================================================

export interface SanityCheck {
    code:
        | 'low_total_vs_sqft'
        | 'high_total_vs_sqft'
        | 'empty_proposal'
        | 'duplicate_sku'
        | 'min_charge_dominates';
    severity: 'info' | 'warning';
    message: string;
}

const TARGET_DOLLAR_PER_SQFT_LOW = 25;
const TARGET_DOLLAR_PER_SQFT_HIGH = 200;
const MIN_CHARGE_DOMINATION_PCT = 0.85;

export function runSanityChecks(args: {
    items: PricedLineItem[];
    subtotal_cents: number;
    sqft_estimate: number | null | undefined;
}): SanityCheck[] {
    const out: SanityCheck[] = [];

    if (args.items.length === 0) {
        out.push({
            code: 'empty_proposal',
            severity: 'warning',
            message: 'No line items extracted. Try re-dictating with more specifics.',
        });
        return out;
    }

    // Duplicate SKUs?
    const seen = new Set<string>();
    for (const it of args.items) {
        if (seen.has(it.sku_id)) {
            out.push({
                code: 'duplicate_sku',
                severity: 'info',
                message: `Duplicate line item for ${it.sku_id} — consider merging.`,
            });
            break;
        }
        seen.add(it.sku_id);
    }

    // sqft sanity
    if (args.sqft_estimate && args.sqft_estimate > 0) {
        const dollarPerSqft = args.subtotal_cents / 100 / args.sqft_estimate;
        if (dollarPerSqft < TARGET_DOLLAR_PER_SQFT_LOW) {
            out.push({
                code: 'low_total_vs_sqft',
                severity: 'info',
                message: `Total is ~$${dollarPerSqft.toFixed(0)}/sqft — low for Greenscape's market. Did the model miss line items?`,
            });
        } else if (dollarPerSqft > TARGET_DOLLAR_PER_SQFT_HIGH) {
            out.push({
                code: 'high_total_vs_sqft',
                severity: 'info',
                message: `Total is ~$${dollarPerSqft.toFixed(0)}/sqft — quite high. Confirm scope with the customer.`,
            });
        }
    }

    // Are any line totals dominated by min_charge?
    for (const it of args.items) {
        const raw = it.quantity * it.unit_price_cents;
        if (raw > 0 && raw / it.line_total_cents < (1 - MIN_CHARGE_DOMINATION_PCT)) {
            out.push({
                code: 'min_charge_dominates',
                severity: 'info',
                message: `${it.sku_id}: quantity is small enough that the minimum charge dominates the line total. Confirm quantity.`,
            });
        }
    }

    return out;
}

import 'server-only';
import { z } from 'zod';
import type { MessageParam, ToolUseBlock, Tool } from '@anthropic-ai/sdk/resources/messages';
import { getAnthropic } from './client';
import { env } from '@/lib/env';
import { priceCallMicros } from './pricing';
import type { CatalogItem } from '@/lib/types';

// =============================================================================
// Structured scope extraction using Claude's tool-use as a forced JSON schema.
// The model never sees dollar amounts. It picks SKU IDs and quantities; the
// server JOINs to the catalog to get prices.
// =============================================================================

export const ExtractedLineItemSchema = z.object({
    sku_id: z.string().min(1),
    quantity: z.number().positive(),
    notes: z.string().min(1).max(500),
});

export const ExtractedScopeSchema = z.object({
    line_items: z.array(ExtractedLineItemSchema).min(1),
    scope_summary: z.string().min(1).max(2000),
    sqft_estimate: z.number().int().positive().nullable().optional(),
    warnings: z.array(z.string().max(500)).default([]),
});

export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;
export type ExtractedScope = z.infer<typeof ExtractedScopeSchema>;

export interface ExtractResult {
    scope: ExtractedScope;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    model: string;
    attempts: number;
}

const SYSTEM_PROMPT = `You are an expert estimator at Greenscape Pro, a premium residential hardscape and landscape design-build company in Phoenix, Arizona. Marcus Tate (the founder) just finished a site walk and dictated notes. Your job is to convert his notes into a structured scope of work, choosing line items from the company catalog.

CRITICAL RULES:
1. You may ONLY use sku_id values from the catalog below. Never invent SKUs.
2. You do NOT see prices. Just choose the right SKUs and quantities. The server prices the work deterministically.
3. Be conservative in quantities. When the notes say "approximately X sqft", use that. When uncertain, take the lower bound and add a warning.
4. Always include a scope_summary (1-3 sentences, Marcus's voice — direct, no fluff).
5. Always include warnings for: drainage concerns, HOA implications, permit needs, site access issues, anything Marcus's notes flag as "ask the customer."
6. If the notes are too vague to estimate, return an empty line_items array and put the reason in warnings.

Submit your structured output via the submit_scope tool.`;

function buildCatalogSection(catalog: CatalogItem[]): string {
    const byCategory = new Map<string, CatalogItem[]>();
    for (const it of catalog) {
        if (!it.active) continue;
        const list = byCategory.get(it.category) ?? [];
        list.push(it);
        byCategory.set(it.category, list);
    }
    const sections: string[] = [];
    for (const [cat, items] of byCategory.entries()) {
        sections.push(`## ${cat.toUpperCase()}`);
        for (const it of items) {
            sections.push(`- \`${it.sku_id}\` (${it.unit}) — ${it.name}${it.description ? `: ${it.description}` : ''}`);
        }
        sections.push('');
    }
    return sections.join('\n');
}

const TOOL_DEF: Tool = {
    name: 'submit_scope',
    description: 'Submit the structured scope of work extracted from the site-walk notes.',
    input_schema: {
        type: 'object',
        properties: {
            line_items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        sku_id: {
                            type: 'string',
                            description: 'Must exactly match one of the sku_id values in the catalog.',
                        },
                        quantity: {
                            type: 'number',
                            description: "Quantity in the SKU's unit (sqft, linear_ft, each, or job).",
                        },
                        notes: {
                            type: 'string',
                            description: 'Short rationale for why this SKU and this quantity.',
                        },
                    },
                    required: ['sku_id', 'quantity', 'notes'],
                },
            },
            scope_summary: {
                type: 'string',
                description: "1-3 sentence summary of the project, in Marcus's direct voice.",
            },
            sqft_estimate: {
                type: ['integer', 'null'],
                description: 'Total project sqft if mentioned in the notes.',
            },
            warnings: {
                type: 'array',
                items: { type: 'string' },
                description: 'Things to flag to Marcus before sending. Empty array if none.',
            },
        },
        required: ['line_items', 'scope_summary', 'warnings'],
    },
};

export async function extractScope(args: {
    siteWalkNotes: string;
    catalog: CatalogItem[];
    clientName?: string;
}): Promise<ExtractResult> {
    const anthropic = getAnthropic();
    const model = env.ANTHROPIC_MODEL_EXTRACT;
    const catalogSection = buildCatalogSection(args.catalog);
    const validSkus = new Set(args.catalog.filter((c) => c.active).map((c) => c.sku_id));

    // Cache the stable prefix (system prompt + catalog). Cache reads are ~10x cheaper.
    const systemBlocks = [
        { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
        { type: 'text' as const, text: `## CATALOG\n\n${catalogSection}`, cache_control: { type: 'ephemeral' as const } },
    ];

    const userMessage = [
        args.clientName ? `Client: ${args.clientName}` : null,
        '',
        'Site-walk notes:',
        '"""',
        args.siteWalkNotes.trim(),
        '"""',
    ]
        .filter((x) => x !== null)
        .join('\n');

    let attempts = 0;
    let lastError: string | null = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    while (attempts < 2) {
        attempts++;

        const messages: MessageParam[] = [{ role: 'user', content: userMessage }];
        if (lastError) {
            messages.push({
                role: 'assistant',
                content: [{ type: 'text', text: 'I will retry with valid SKU IDs and a complete schema.' }],
            });
            messages.push({
                role: 'user',
                content: `Previous attempt failed validation: ${lastError}\n\nPlease retry. Remember: sku_id must exactly match one of the catalog IDs above; warnings is always an array (possibly empty).`,
            });
        }

        const response = await anthropic.messages.create({
            model,
            max_tokens: 2048,
            system: systemBlocks,
            tools: [TOOL_DEF],
            tool_choice: { type: 'tool', name: 'submit_scope' },
            messages,
        });

        totalInputTokens +=
            response.usage.input_tokens +
            (response.usage.cache_creation_input_tokens ?? 0) +
            (response.usage.cache_read_input_tokens ?? 0);
        totalOutputTokens += response.usage.output_tokens;

        const toolBlock = response.content.find(
            (b): b is ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_scope',
        );

        if (!toolBlock) {
            lastError = 'Model did not call submit_scope tool.';
            continue;
        }

        const parsed = ExtractedScopeSchema.safeParse(toolBlock.input);
        if (!parsed.success) {
            lastError = `Schema validation failed: ${parsed.error.message}`;
            continue;
        }

        const invalidSkus = parsed.data.line_items
            .map((li) => li.sku_id)
            .filter((s) => !validSkus.has(s));
        if (invalidSkus.length > 0) {
            lastError = `Unknown SKUs: ${invalidSkus.join(', ')}. Use only catalog SKUs.`;
            continue;
        }

        const costMicros = priceCallMicros({
            model,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
        });

        return {
            scope: parsed.data,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            costMicros,
            model,
            attempts,
        };
    }

    throw new Error(`Scope extraction failed after ${attempts} attempts. Last error: ${lastError}`);
}

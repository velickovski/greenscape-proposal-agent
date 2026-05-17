import 'server-only';
import { getAnthropic } from './client';
import { env } from '@/lib/env';
import { priceCallMicros } from './pricing';
import type { CatalogItem } from '@/lib/types';

// =============================================================================
// Cover-letter copy in Marcus's voice. Cheap model (Haiku 4.5) — this is a
// soft writing task, not reasoning. Cost per call ~$0.003.
// =============================================================================

const SYSTEM_PROMPT = `You write the opening paragraph of proposals for Marcus Tate, founder of Greenscape Pro in Phoenix. Marcus's voice is direct, warm but not florid, confident, and grounded. He talks like a craftsman who knows what he's doing, not a salesperson. He never uses the word "synergy", "leverage", "robust", or "delight." He never opens with "I hope this finds you well."

Write ONE paragraph (3-5 sentences max) that:
- Greets the client by first name
- Names the project in one short phrase
- States in concrete terms what Greenscape will deliver
- Closes with a clear next step (review, ask questions, sign the deposit invoice when ready)

No bullets. No headers. Just the paragraph.`;

export interface CopyResult {
    coverLetter: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    model: string;
}

export async function writeCoverLetter(args: {
    clientFirstName: string;
    scopeSummary: string;
    chosenLineItems: { sku_id: string; quantity: number }[];
    catalog: CatalogItem[];
    totalUsd: number;
}): Promise<CopyResult> {
    const anthropic = getAnthropic();
    const model = env.ANTHROPIC_MODEL_COPY;

    const catalogMap = new Map(args.catalog.map((c) => [c.sku_id, c]));
    const lineItemSummary = args.chosenLineItems
        .map((li) => {
            const cat = catalogMap.get(li.sku_id);
            return `- ${cat?.name ?? li.sku_id} (${li.quantity} ${cat?.unit ?? 'units'})`;
        })
        .join('\n');

    const userMessage = `Client first name: ${args.clientFirstName}
Project summary: ${args.scopeSummary}
Total: $${args.totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}

Line items:
${lineItemSummary}

Write Marcus's opening paragraph.`;

    const response = await anthropic.messages.create({
        model,
        max_tokens: 400,
        system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const coverLetter = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

    const inputTokens =
        response.usage.input_tokens +
        (response.usage.cache_creation_input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0);
    const outputTokens = response.usage.output_tokens;
    const costMicros = priceCallMicros({ model, inputTokens, outputTokens });

    return { coverLetter, inputTokens, outputTokens, costMicros, model };
}

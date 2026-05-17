// Per-million-token pricing in micro-dollars (1 USD = 1,000,000 micros).
// Update these when Anthropic changes prices; cost-per-proposal is reported
// in the UI and stored on each proposal row.

interface ModelPricing {
    inputMicrosPerMillion: number;
    outputMicrosPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
    // Opus 4.x: $15 / $75 per million
    'claude-opus-4-7': { inputMicrosPerMillion: 15_000_000, outputMicrosPerMillion: 75_000_000 },
    // Sonnet 4.x: $3 / $15 per million
    'claude-sonnet-4-6': { inputMicrosPerMillion: 3_000_000, outputMicrosPerMillion: 15_000_000 },
    // Haiku 4.5: $1 / $5 per million
    'claude-haiku-4-5-20251001': { inputMicrosPerMillion: 1_000_000, outputMicrosPerMillion: 5_000_000 },
};

const FALLBACK: ModelPricing = {
    inputMicrosPerMillion: 3_000_000,
    outputMicrosPerMillion: 15_000_000,
};

export function priceCallMicros(args: {
    model: string;
    inputTokens: number;
    outputTokens: number;
}): number {
    const p = PRICING[args.model] ?? FALLBACK;
    const inputCost = Math.round((args.inputTokens / 1_000_000) * p.inputMicrosPerMillion);
    const outputCost = Math.round((args.outputTokens / 1_000_000) * p.outputMicrosPerMillion);
    return inputCost + outputCost;
}

export function microsToUsd(micros: number): number {
    return micros / 1_000_000;
}

export function formatUsd(micros: number): string {
    const usd = microsToUsd(micros);
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

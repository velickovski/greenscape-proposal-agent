import 'server-only';

function required(name: string): string {
    const v = process.env[name];
    if (!v || v.length === 0) {
        throw new Error(
            `Missing required env var: ${name}. See .env.example and DEPLOY.md.`,
        );
    }
    return v;
}

function optional(name: string): string | undefined {
    const v = process.env[name];
    return v && v.length > 0 ? v : undefined;
}

export const env = {
    // Supabase
    SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

    // Anthropic
    ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
    ANTHROPIC_MODEL_EXTRACT: optional('ANTHROPIC_MODEL_EXTRACT') ?? 'claude-opus-4-7',
    ANTHROPIC_MODEL_COPY: optional('ANTHROPIC_MODEL_COPY') ?? 'claude-haiku-4-5-20251001',

    // Email
    RESEND_API_KEY: optional('RESEND_API_KEY'),
    RESEND_FROM_EMAIL: optional('RESEND_FROM_EMAIL') ?? 'Marcus Tate <onboarding@resend.dev>',

    // Stripe
    STRIPE_SECRET_KEY: optional('STRIPE_SECRET_KEY'),

    // GHL
    GHL_API_KEY: optional('GHL_API_KEY'),
    GHL_LOCATION_ID: optional('GHL_LOCATION_ID'),

    // Slack
    SLACK_APPROVAL_WEBHOOK_URL: optional('SLACK_APPROVAL_WEBHOOK_URL'),

    // App
    APP_URL: optional('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',
    APPROVER_EMAILS:
        (optional('APPROVER_EMAILS') ?? 'marcus@greenscapepro.test')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
};

export function isResendEnabled(): boolean {
    return Boolean(env.RESEND_API_KEY);
}
export function isStripeEnabled(): boolean {
    return Boolean(env.STRIPE_SECRET_KEY);
}
export function isGhlEnabled(): boolean {
    return Boolean(env.GHL_API_KEY && env.GHL_LOCATION_ID);
}
export function isSlackEnabled(): boolean {
    return Boolean(env.SLACK_APPROVAL_WEBHOOK_URL);
}

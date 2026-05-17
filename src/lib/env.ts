import 'server-only';

// During `next build`, Next.js statically analyzes route files which means
// env.ts is imported even before runtime env vars are set. Throwing in that
// phase blocks the build, so we use a sentinel placeholder during build and
// only throw at request time.
const IS_BUILD_PHASE =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export';

const BUILD_PLACEHOLDER = '__build_placeholder__';

function required(name: string): string {
    const v = process.env[name];
    if (v && v.length > 0) return v;
    if (IS_BUILD_PHASE) return BUILD_PLACEHOLDER;
    throw new Error(
        `Missing required env var: ${name}. See .env.example and DEPLOY.md.`,
    );
}

function optional(name: string): string | undefined {
    const v = process.env[name];
    if (!v || v.length === 0) return undefined;
    // Treat unfilled placeholders from .env.example (e.g. "sk_test_...",
    // "re_...") as unset so the mock fallback kicks in instead of failing
    // with a real API "invalid key" error.
    if (v.endsWith('...') || v === '...') return undefined;
    return v;
}

export const env = {
    SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

    ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
    ANTHROPIC_MODEL_EXTRACT: optional('ANTHROPIC_MODEL_EXTRACT') ?? 'claude-opus-4-7',
    ANTHROPIC_MODEL_COPY: optional('ANTHROPIC_MODEL_COPY') ?? 'claude-haiku-4-5-20251001',

    RESEND_API_KEY: optional('RESEND_API_KEY'),
    RESEND_FROM_EMAIL: optional('RESEND_FROM_EMAIL') ?? 'Marcus Tate <onboarding@resend.dev>',

    STRIPE_SECRET_KEY: optional('STRIPE_SECRET_KEY'),

    GHL_API_KEY: optional('GHL_API_KEY'),
    GHL_LOCATION_ID: optional('GHL_LOCATION_ID'),

    SLACK_APPROVAL_WEBHOOK_URL: optional('SLACK_APPROVAL_WEBHOOK_URL'),

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

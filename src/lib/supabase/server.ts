import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// Server-only client using the service role key. Bypasses RLS by design.
// Every database touch in this app goes through this client; no auth-user
// concept exists in this MVP.

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (_client) return _client;
    _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: { 'x-application': 'greenscape-proposal-agent' },
        },
    });
    return _client;
}

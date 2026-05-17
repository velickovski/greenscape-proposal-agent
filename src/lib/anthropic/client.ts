import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
    if (_client) return _client;
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return _client;
}

import 'server-only';
import { env, isSlackEnabled } from '@/lib/env';

export async function notifySlack(args: { text: string; proposalUrl?: string }): Promise<{ ok: boolean }> {
    if (!isSlackEnabled()) return { ok: false };

    const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: args.text } },
    ] as unknown[];
    if (args.proposalUrl) {
        blocks.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: { type: 'plain_text', text: 'Open proposal' },
                    url: args.proposalUrl,
                },
            ],
        });
    }

    const res = await fetch(env.SLACK_APPROVAL_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: args.text, blocks }),
    });
    return { ok: res.ok };
}

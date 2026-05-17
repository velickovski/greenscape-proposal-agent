import 'server-only';
import Stripe from 'stripe';
import { env, isStripeEnabled } from '@/lib/env';

export interface DepositLinkResult {
    url: string;
    providerId: string | null;
    mocked: boolean;
}

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
    if (_stripe) return _stripe;
    if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe not configured');
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
    return _stripe;
}

export async function createDepositLink(args: {
    proposalId: string;
    clientName: string;
    depositCents: number;
    description: string;
}): Promise<DepositLinkResult> {
    if (!isStripeEnabled()) {
        const url = `${env.APP_URL}/mock-deposit?proposal=${args.proposalId}&amount=${args.depositCents}`;
        console.warn(
            '[stripe] STRIPE_SECRET_KEY not set, mocking deposit link →',
            { proposalId: args.proposalId, depositCents: args.depositCents, url },
        );
        return { url, providerId: null, mocked: true };
    }

    const stripe = getStripe();
    const product = await stripe.products.create({
        name: `Greenscape Pro deposit · ${args.clientName}`,
        description: args.description.slice(0, 500),
        metadata: { proposal_id: args.proposalId },
    });
    const price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: args.depositCents,
    });
    const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { proposal_id: args.proposalId },
    });
    return { url: link.url, providerId: link.id, mocked: false };
}

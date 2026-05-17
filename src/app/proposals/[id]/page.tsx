import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProposalDetail } from '@/lib/agent/fetch';
import { loadCatalog } from '@/lib/catalog/load';
import ProposalReview from './proposal-review';
import { formatUsd, formatUsdRounded } from '@/lib/catalog/pricing';
import { formatUsd as formatLlmUsd } from '@/lib/anthropic/pricing';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProposalPage(
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const [detail, catalog] = await Promise.all([
        fetchProposalDetail(id),
        loadCatalog(),
    ]);
    if (!detail) return notFound();
    const { proposal, client, line_items, approval, audit_log } = detail;

    const totalTokens =
        proposal.extract_input_tokens +
        proposal.extract_output_tokens +
        proposal.copy_input_tokens +
        proposal.copy_output_tokens;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <Link href="/" className="text-xs text-muted hover:underline">← Dashboard</Link>
                    <h1 className="text-2xl font-bold text-ink mt-1">{proposal.title}</h1>
                    <p className="text-sm text-muted mt-1">
                        For <span className="font-medium text-ink">{client.name}</span>
                        {client.email ? ` · ${client.email}` : ''}
                    </p>
                </div>
                <div className="text-right space-y-1">
                    <div className={`pill ${
                        proposal.status === 'sent' ? 'pill-sent' :
                        proposal.status === 'approved' ? 'pill-approved' :
                        proposal.status === 'extracted' ? 'pill-extracted' :
                        proposal.status === 'rejected' ? 'pill-rejected' : 'pill-draft'
                    }`}>{proposal.status}</div>
                    <div className="text-xs text-muted font-mono">GSP-{proposal.id.slice(0, 8).toUpperCase()}</div>
                </div>
            </div>

            {(() => {
                const extracted = audit_log.find((row) => row.event === 'extracted');
                const sanity = audit_log.find((row) => row.event === 'sanity_check_warning');
                const extractWarnings = ((extracted?.payload as { warnings?: unknown[] } | undefined)?.warnings ?? []) as string[];
                const sanityChecks = ((sanity?.payload as { checks?: { code: string; severity: string; message: string }[] } | undefined)?.checks ?? []);
                if (extractWarnings.length === 0 && sanityChecks.length === 0) return null;
                return (
                    <section className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--warning)' }}>
                        <h3 className="label" style={{ color: 'var(--warning)' }}>Discuss with the customer before sending</h3>
                        <p className="text-xs text-muted mt-1">
                            The agent skipped or flagged these because it would not quote a size, material, or service the customer didn&apos;t explicitly ask for. Resolve each one and either regenerate or add a manual line.
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                            {extractWarnings.map((w, i) => (
                                <li key={`w${i}`} className="flex gap-2">
                                    <span style={{ color: 'var(--warning)' }} aria-hidden>⚠</span>
                                    <span>{w}</span>
                                </li>
                            ))}
                            {sanityChecks.map((c, i) => (
                                <li key={`s${i}`} className="flex gap-2">
                                    <span style={{ color: 'var(--warning)' }} aria-hidden>•</span>
                                    <span>{c.message}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })()}

            <ProposalReview
                proposalId={proposal.id}
                status={proposal.status}
                lineItems={line_items.map((li) => ({
                    id: li.id,
                    sku_id: li.sku_id,
                    name: li.catalog.name,
                    description: li.catalog.description,
                    category: li.catalog.category,
                    quantity: Number(li.quantity),
                    unit: li.unit,
                    unit_price_cents: li.unit_price_cents,
                    line_total_cents: li.line_total_cents,
                    llm_notes: li.llm_notes,
                }))}
                subtotalCents={proposal.subtotal_cents}
                totalCents={proposal.total_cents}
                depositPct={Number(proposal.deposit_pct)}
                coverLetter={proposal.cover_letter ?? ''}
                clientName={client.name}
                clientEmail={client.email}
                hasApproval={Boolean(approval)}
                sentAt={proposal.sent_at}
                stripeDepositUrl={proposal.stripe_deposit_url}
                defaultApproverEmail={env.APPROVER_EMAILS[0] ?? ''}
                catalog={catalog.map((c) => ({
                    sku_id: c.sku_id,
                    name: c.name,
                    category: c.category,
                    unit: c.unit,
                    unit_price_cents: c.unit_price_cents,
                }))}
            />

            <section className="grid md:grid-cols-2 gap-6">
                <div className="card p-6">
                    <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">PDF preview</h3>
                    <div className="mt-3 rounded-md overflow-hidden border border-rule">
                        <iframe
                            src={`/api/proposals/${proposal.id}/pdf`}
                            className="w-full"
                            style={{ height: '600px', background: '#525659' }}
                            title="Proposal PDF"
                        />
                    </div>
                    <div className="mt-3 text-xs text-muted">
                        <a href={`/api/proposals/${proposal.id}/pdf`} target="_blank" className="text-brand font-semibold hover:underline" rel="noreferrer">
                            Open PDF in new tab →
                        </a>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="card p-6">
                        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Cost & telemetry</h3>
                        <dl className="mt-3 text-sm space-y-2">
                            <div className="flex justify-between"><dt className="text-muted">LLM cost</dt><dd className="font-mono">{formatLlmUsd(proposal.api_cost_usd_micros)}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Total tokens</dt><dd className="font-mono">{totalTokens.toLocaleString()}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Line items</dt><dd className="font-mono">{line_items.length}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Project total</dt><dd className="font-mono">{formatUsd(proposal.total_cents)}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Deposit ({Number(proposal.deposit_pct).toFixed(0)}%)</dt><dd className="font-mono">{formatUsdRounded(Math.round(proposal.total_cents * Number(proposal.deposit_pct) / 100))}</dd></div>
                        </dl>
                    </div>
                    <div className="card p-6">
                        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Audit log</h3>
                        <ol className="mt-3 text-xs space-y-2 max-h-[260px] overflow-y-auto pr-2">
                            {audit_log.map((row) => (
                                <li key={row.id} className="flex justify-between gap-3 border-b border-rule pb-1">
                                    <span className="font-mono">{row.event}</span>
                                    <span className="text-muted whitespace-nowrap">{new Date(row.created_at).toLocaleString('en-US')}</span>
                                </li>
                            ))}
                            {audit_log.length === 0 ? <li className="text-muted">No events yet.</li> : null}
                        </ol>
                    </div>
                </div>
            </section>
        </div>
    );
}

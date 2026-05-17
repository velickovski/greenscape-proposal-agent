import Link from 'next/link';
import { listProposals } from '@/lib/agent/fetch';
import { formatUsdRounded } from '@/lib/catalog/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function StatusPill({ status }: { status: string }) {
    const cls =
        status === 'sent' ? 'pill pill-sent' :
        status === 'approved' ? 'pill pill-approved' :
        status === 'extracted' ? 'pill pill-extracted' :
        status === 'rejected' ? 'pill pill-rejected' :
        'pill pill-draft';
    return <span className={cls}>{status}</span>;
}

export default async function Home() {
    let proposals: Awaited<ReturnType<typeof listProposals>> = [];
    let loadError: string | null = null;
    try {
        proposals = await listProposals(20);
    } catch (e) {
        loadError = (e as Error).message;
    }

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
                <p className="text-sm text-muted mt-1">
                    Latest proposals. Paste site-walk notes into a new proposal and the agent will draft a priced PDF for your review.
                </p>
            </section>

            {loadError ? (
                <div className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--danger)' }}>
                    <p className="text-sm font-semibold text-ink">Could not load proposals.</p>
                    <p className="text-xs text-muted mt-1">{loadError}</p>
                    <p className="text-xs text-muted mt-3">
                        If this is a fresh install: confirm your Supabase env vars are set and that migrations <code>0001_init.sql</code> and <code>0002_seed_catalog.sql</code> have been applied.
                    </p>
                </div>
            ) : proposals.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-sm text-muted">No proposals yet.</p>
                    <Link href="/proposals/new" className="btn btn-primary mt-4 inline-flex">
                        Create your first proposal
                    </Link>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-[#F4F1EB] text-muted">
                            <tr>
                                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider">Project</th>
                                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider">Client</th>
                                <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wider">Total</th>
                                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                                <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wider">Created</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.map(({ proposal, client }) => (
                                <tr key={proposal.id} className="border-t border-rule hover:bg-[#FAF8F5]">
                                    <td className="px-5 py-3 font-semibold">{proposal.title}</td>
                                    <td className="px-5 py-3 text-muted">{client.name}</td>
                                    <td className="px-5 py-3 text-right font-mono">{formatUsdRounded(proposal.total_cents)}</td>
                                    <td className="px-5 py-3"><StatusPill status={proposal.status} /></td>
                                    <td className="px-5 py-3 text-right text-muted text-xs">
                                        {new Date(proposal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <Link href={`/proposals/${proposal.id}`} className="text-brand font-semibold text-xs hover:underline">
                                            Open →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

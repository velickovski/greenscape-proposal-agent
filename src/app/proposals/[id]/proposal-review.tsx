'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface LineItemView {
    id: string;
    sku_id: string;
    name: string;
    description: string | null;
    category: string;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    line_total_cents: number;
    llm_notes: string | null;
}

interface Props {
    proposalId: string;
    status: string;
    lineItems: LineItemView[];
    subtotalCents: number;
    totalCents: number;
    depositPct: number;
    coverLetter: string;
    clientName: string;
    clientEmail: string | null;
    hasApproval: boolean;
    sentAt: string | null;
    stripeDepositUrl: string | null;
    defaultApproverEmail: string;
}

function formatUsd(cents: number): string {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const UNIT_LABEL: Record<string, string> = { sqft: 'sqft', linear_ft: 'lf', each: 'ea', job: 'job' };

export default function ProposalReview(props: Props) {
    const router = useRouter();
    const [items, setItems] = useState(props.lineItems);
    const [edits, setEdits] = useState<Record<string, { quantity?: number; delete?: boolean }>>({});
    const [saving, setSaving] = useState(false);
    const [approverEmail, setApproverEmail] = useState(props.defaultApproverEmail || 'marcus@greenscapepro.test');
    const [sendBusy, setSendBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const isEditable = props.status === 'extracted' || props.status === 'draft';
    const subtotal = items.reduce((s, it) => s + it.line_total_cents, 0);

    function updateQty(id: string, qty: number) {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        // Optimistic client-side preview only — server recomputes against the
        // catalog min_charge_cents on save. This matches qty * unit price and
        // intentionally does not enforce min charges here.
        const newTotal = Math.max(0, Math.round(qty * item.unit_price_cents));
        setItems(items.map((i) => (i.id === id ? { ...i, quantity: qty, line_total_cents: newTotal } : i)));
        setEdits({ ...edits, [id]: { ...edits[id], quantity: qty } });
    }
    function toggleDelete(id: string) {
        setItems(items);
        setEdits({ ...edits, [id]: { ...edits[id], delete: !edits[id]?.delete } });
    }

    async function saveEdits() {
        const updates = Object.entries(edits).map(([line_item_id, e]) => ({ line_item_id, ...e }));
        if (updates.length === 0) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/proposals/${props.proposalId}/line-items`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });
            if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as { message?: string };
                setError(j.message ?? `Save failed (HTTP ${res.status}).`);
                return;
            }
            setEdits({});
            startTransition(() => router.refresh());
        } finally {
            setSaving(false);
        }
    }

    async function approveAndSend() {
        if (!props.clientEmail) {
            setError('This client has no email on file. Add one before sending.');
            return;
        }
        setSendBusy(true);
        setError(null);
        setSuccess(null);
        try {
            // 1. Approve
            if (!props.hasApproval) {
                const approveRes = await fetch(`/api/proposals/${props.proposalId}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ approver_email: approverEmail.trim() }),
                });
                if (!approveRes.ok) {
                    const j = (await approveRes.json().catch(() => ({}))) as { reason?: string; message?: string };
                    setError(j.reason ?? j.message ?? 'Approval failed.');
                    return;
                }
            }
            // 2. Send
            const sendRes = await fetch(`/api/proposals/${props.proposalId}/send`, { method: 'POST' });
            const sendJson = (await sendRes.json().catch(() => ({}))) as {
                sent?: boolean; emailMocked?: boolean; stripeMocked?: boolean; ghlMocked?: boolean;
                emailTo?: string; depositUrl?: string; message?: string;
            };
            if (!sendRes.ok || !sendJson.sent) {
                setError(sendJson.message ?? 'Send failed.');
                return;
            }
            const flags: string[] = [];
            if (sendJson.emailMocked) flags.push('email mocked');
            if (sendJson.stripeMocked) flags.push('Stripe mocked');
            if (sendJson.ghlMocked) flags.push('GHL mocked');
            setSuccess(
                `Sent to ${sendJson.emailTo}. ${flags.length ? `(${flags.join(', ')})` : ''}`,
            );
            startTransition(() => router.refresh());
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSendBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="card p-6">
                <h2 className="label">Cover letter (Marcus&apos;s voice)</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink whitespace-pre-line">{props.coverLetter || '—'}</p>
            </div>

            <div className="card overflow-hidden">
                <div className="flex justify-between items-center px-5 py-3 bg-[#F4F1EB]">
                    <h2 className="label">Scope of work</h2>
                    <span className="text-xs text-muted">{items.length} line items</span>
                </div>
                <table className="w-full text-sm">
                    <thead className="text-xs text-muted">
                        <tr className="border-b border-rule">
                            <th className="text-left px-5 py-2 font-medium">Item</th>
                            <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
                            <th className="text-left px-3 py-2 font-medium w-12">Unit</th>
                            <th className="text-right px-3 py-2 font-medium w-28">Rate</th>
                            <th className="text-right px-3 py-2 font-medium w-28">Line total</th>
                            {isEditable ? <th className="w-12" /> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => {
                            const isDeleted = edits[it.id]?.delete;
                            return (
                                <tr key={it.id} className={`border-b border-rule ${isDeleted ? 'opacity-30 line-through' : ''}`}>
                                    <td className="px-5 py-3">
                                        <div className="font-semibold text-ink">{it.name}</div>
                                        {it.llm_notes ? <div className="text-xs text-muted mt-0.5 italic">{it.llm_notes}</div> : null}
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        {isEditable ? (
                                            <input
                                                type="number" step="0.01" min="0"
                                                className="input text-right py-1"
                                                value={it.quantity}
                                                onChange={(e) => updateQty(it.id, parseFloat(e.target.value) || 0)}
                                            />
                                        ) : (
                                            <span className="font-mono">{it.quantity}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-muted text-xs">{UNIT_LABEL[it.unit] ?? it.unit}</td>
                                    <td className="px-3 py-3 text-right font-mono">{formatUsd(it.unit_price_cents)}</td>
                                    <td className="px-3 py-3 text-right font-mono font-semibold">{formatUsd(it.line_total_cents)}</td>
                                    {isEditable ? (
                                        <td className="px-2 py-3 text-right">
                                            <button
                                                type="button" onClick={() => toggleDelete(it.id)}
                                                className="text-xs text-muted hover:text-[color:var(--danger)]"
                                                title={edits[it.id]?.delete ? 'Restore' : 'Remove'}
                                            >
                                                {edits[it.id]?.delete ? '↺' : '×'}
                                            </button>
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-[#F4F1EB]">
                            <td colSpan={isEditable ? 4 : 3} className="px-5 py-3 text-right text-muted">Subtotal</td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-base">{formatUsd(subtotal)}</td>
                            {isEditable ? <td /> : null}
                        </tr>
                    </tfoot>
                </table>
                {isEditable && Object.keys(edits).length > 0 ? (
                    <div className="px-5 py-3 border-t border-rule flex justify-end gap-3">
                        <button type="button" onClick={() => { setEdits({}); setItems(props.lineItems); }} className="btn btn-ghost">
                            Discard
                        </button>
                        <button type="button" onClick={saveEdits} disabled={saving} className="btn btn-primary">
                            {saving ? 'Saving…' : 'Save edits & re-render PDF'}
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="card p-6 space-y-4">
                <h2 className="label">Approve &amp; send</h2>
                {props.status === 'sent' ? (
                    <div className="text-sm">
                        <p className="font-semibold text-[color:var(--success)]">Sent on {new Date(props.sentAt!).toLocaleString('en-US')}</p>
                        {props.stripeDepositUrl ? (
                            <p className="mt-2 text-xs text-muted">
                                Deposit link: <a href={props.stripeDepositUrl} target="_blank" rel="noreferrer" className="text-brand underline">{props.stripeDepositUrl}</a>
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-muted">
                            Approval is a hard gate — the <code>/send</code> endpoint refuses without an <code>approvals</code> row.
                            Approver email must be on the <code>APPROVER_EMAILS</code> allow-list.
                        </p>
                        <div className="flex gap-3 items-end">
                            <div className="flex-1 space-y-1">
                                <label className="label">Approver email</label>
                                <input
                                    type="email" className="input"
                                    value={approverEmail} onChange={(e) => setApproverEmail(e.target.value)}
                                />
                            </div>
                            <button
                                type="button" onClick={approveAndSend} disabled={sendBusy || items.length === 0}
                                className="btn btn-primary"
                            >
                                {sendBusy ? 'Sending…' : 'Approve & send'}
                            </button>
                        </div>
                    </>
                )}
                {error ? (
                    <div className="text-sm text-[color:var(--danger)] border-l-2 pl-3" style={{ borderLeftColor: 'var(--danger)' }}>
                        {error}
                    </div>
                ) : null}
                {success ? (
                    <div className="text-sm text-[color:var(--success)] border-l-2 pl-3" style={{ borderLeftColor: 'var(--success)' }}>
                        {success}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

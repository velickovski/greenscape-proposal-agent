'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
    sampleNotes: string;
}

export default function NewProposalForm({ sampleNotes }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [clientName, setClientName] = useState('Smith Family');
    const [clientEmail, setClientEmail] = useState('');
    const [clientAddress, setClientAddress] = useState('4421 Camelback Rd, Phoenix AZ');
    const [hoa, setHoa] = useState(true);
    const [title, setTitle] = useState('Smith backyard hardscape & landscape');
    const [notes, setNotes] = useState(sampleNotes);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch('/api/proposals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client: {
                        name: clientName.trim(),
                        email: clientEmail.trim() || null,
                        address: clientAddress.trim() || null,
                        hoa,
                    },
                    title: title.trim(),
                    site_walk_notes: notes.trim(),
                }),
            });
            const json = (await res.json()) as { proposalId?: string; error?: string; message?: string };
            if (!res.ok || !json.proposalId) {
                setError(json.message ?? json.error ?? 'Generation failed.');
                return;
            }
            startTransition(() => {
                router.push(`/proposals/${json.proposalId}`);
            });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    const busy = submitting || pending;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card p-6 grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="label">Client name</label>
                    <input className="input" required value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <label className="label">Client email</label>
                    <input className="input" type="email" placeholder="for delivery" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                    <label className="label">Address</label>
                    <input className="input" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <label className="label">Project title</label>
                    <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 mt-7">
                    <input type="checkbox" checked={hoa} onChange={(e) => setHoa(e.target.checked)} className="h-4 w-4" />
                    <span className="text-sm">HOA approval required</span>
                </label>
            </div>

            <div className="card p-6 space-y-2">
                <label className="label">Site-walk notes</label>
                <p className="text-xs text-muted">
                    Raw is fine. Talk like you would on the phone — Claude handles structure. Mention sqft, materials, special requests, HOA, drainage, anything Marcus would say in person.
                </p>
                <textarea
                    className="textarea"
                    rows={14}
                    required
                    minLength={20}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>

            {error ? (
                <div className="card p-4 border-l-4 text-sm" style={{ borderLeftColor: 'var(--danger)' }}>
                    <p className="font-semibold text-ink">Couldn&apos;t generate proposal.</p>
                    <p className="text-muted mt-1">{error}</p>
                </div>
            ) : null}

            <div className="flex items-center gap-3">
                <button type="submit" disabled={busy} className="btn btn-primary">
                    {busy ? 'Generating…' : 'Generate proposal'}
                </button>
                <p className="text-xs text-muted">
                    {busy
                        ? 'Calling Claude, pricing against catalog, rendering PDF. Usually 5-10 seconds.'
                        : 'Two LLM calls, ~$0.10 in API cost. PDF will land on the review screen.'}
                </p>
            </div>
        </form>
    );
}

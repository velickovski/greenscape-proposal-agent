import NewProposalForm from './new-proposal-form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAMPLE_NOTES = `Smith family, 4421 Camelback Rd.
Backyard, roughly 1,200 sqft. They want a travertine patio about 20x30, gas fire pit in the middle area, and a 12x12 cedar pergola off the master bedroom. Existing concrete slab needs to come out.
Drip irrigation for the planting beds along the back wall, about 200 sqft of beds, plus path lighting along the side yard — call it 8 fixtures and a transformer.
HOA: yes, La Casa Verde. Customer said they're OK waiting for the board meeting but want to start as soon as possible.
Budget: comfortable with mid-30s, would stretch for the right design.`;

export default function NewProposalPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-ink">New proposal</h1>
                <p className="text-sm text-muted mt-1">
                    Paste raw site-walk notes — Claude will extract a scope of work, price it against the catalog, and render a branded PDF for your review.
                </p>
            </div>
            <NewProposalForm sampleNotes={SAMPLE_NOTES} />
        </div>
    );
}

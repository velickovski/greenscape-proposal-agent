import 'server-only';
import { getSupabase } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/supabase/audit';
import { loadCatalog } from '@/lib/catalog/load';
import { priceLineItems } from '@/lib/catalog/pricing';
import { runSanityChecks, type SanityCheck } from '@/lib/catalog/guardrails';
import { extractScope } from '@/lib/anthropic/extract-scope';
import { writeCoverLetter } from '@/lib/anthropic/write-copy';
import { renderProposalPdfBuffer } from '@/lib/pdf/proposal-pdf';
import { uploadProposalPdf, downloadProposalPdf } from '@/lib/storage/proposals';
import { sendProposalEmail } from '@/lib/integrations/resend';
import { createDepositLink } from '@/lib/integrations/stripe';
import { getGhl } from '@/lib/integrations/ghl';
import { notifySlack } from '@/lib/integrations/slack';
import { env } from '@/lib/env';
import { formatUsdRounded } from '@/lib/catalog/pricing';
import type { Client, Proposal, ProposalLineItem } from '@/lib/types';

// =============================================================================
// The Greenscape Proposal Agent — orchestrated pipeline.
//
// createProposal:  notes → Claude extract → catalog price → Haiku copy
//                  → guardrails → PDF → Storage
// approveProposal: HITL hard gate (writes row to `approvals`)
// sendProposal:    requires approval; runs Resend + Stripe + GHL + Slack
// =============================================================================

export interface CreateProposalInput {
    client: { name: string; email: string | null; phone: string | null; address: string | null; hoa: boolean };
    title: string;
    site_walk_notes: string;
}

export interface CreateProposalResult {
    proposalId: string;
    warnings: string[];
    sanity_checks: SanityCheck[];
    api_cost_usd_micros: number;
    line_item_count: number;
    extraction_attempts: number;
}

export async function createProposal(input: CreateProposalInput): Promise<CreateProposalResult> {
    const supabase = getSupabase();

    // 1) Upsert client by email if provided; otherwise insert fresh.
    let clientId: string;
    if (input.client.email) {
        const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .eq('email', input.client.email.toLowerCase())
            .maybeSingle();
        if (existing?.id) {
            clientId = existing.id;
            await supabase
                .from('clients')
                .update({
                    name: input.client.name,
                    phone: input.client.phone,
                    address: input.client.address,
                    hoa: input.client.hoa,
                })
                .eq('id', clientId);
        } else {
            const { data, error } = await supabase
                .from('clients')
                .insert({ ...input.client, email: input.client.email.toLowerCase() })
                .select('id')
                .single();
            if (error) throw new Error(`client insert: ${error.message}`);
            clientId = data.id;
        }
    } else {
        const { data, error } = await supabase
            .from('clients')
            .insert(input.client)
            .select('id')
            .single();
        if (error) throw new Error(`client insert: ${error.message}`);
        clientId = data.id;
    }
    await writeAudit({ proposalId: null, event: 'client_created', payload: { client_id: clientId, email: input.client.email } });

    // 2) site_walks row
    const { data: walk, error: walkErr } = await supabase
        .from('site_walks')
        .insert({ client_id: clientId, raw_notes: input.site_walk_notes })
        .select('id')
        .single();
    if (walkErr) throw new Error(`site_walk insert: ${walkErr.message}`);

    // 3) draft proposal row
    const { data: draft, error: draftErr } = await supabase
        .from('proposals')
        .insert({
            client_id: clientId,
            site_walk_id: walk.id,
            status: 'draft',
            title: input.title,
        })
        .select('id')
        .single();
    if (draftErr) throw new Error(`proposal insert: ${draftErr.message}`);
    const proposalId: string = draft.id;
    await writeAudit({ proposalId, event: 'proposal_draft_created', payload: { client_id: clientId } });

    try {
        // 4) Catalog + extract
        const catalog = await loadCatalog();
        const ext = await extractScope({
            siteWalkNotes: input.site_walk_notes,
            catalog,
            clientName: input.client.name,
        });
        await writeAudit({
            proposalId,
            event: 'extracted',
            payload: {
                model: ext.model,
                attempts: ext.attempts,
                input_tokens: ext.inputTokens,
                output_tokens: ext.outputTokens,
                cost_micros: ext.costMicros,
                line_item_count: ext.scope.line_items.length,
                warnings: ext.scope.warnings,
            },
        });

        // 5) Price + insert line items
        const priced = priceLineItems({ extracted: ext.scope.line_items, catalog });

        if (priced.items.length > 0) {
            const rows = priced.items.map((it, idx) => ({
                proposal_id: proposalId,
                sku_id: it.sku_id,
                quantity: it.quantity,
                unit: it.unit,
                unit_price_cents: it.unit_price_cents,
                line_total_cents: it.line_total_cents,
                llm_notes: it.llm_notes,
                sort_order: idx,
            }));
            const { error: pliErr } = await supabase.from('proposal_line_items').insert(rows);
            if (pliErr) throw new Error(`line items insert: ${pliErr.message}`);
        }

        // 6) Cover letter
        const firstName = input.client.name.split(/\s+/)[0] ?? input.client.name;
        const copy = await writeCoverLetter({
            clientFirstName: firstName,
            scopeSummary: ext.scope.scope_summary,
            chosenLineItems: ext.scope.line_items,
            catalog,
            totalUsd: priced.subtotal_cents / 100,
        });
        await writeAudit({
            proposalId,
            event: 'cover_letter_generated',
            payload: { model: copy.model, cost_micros: copy.costMicros, output_tokens: copy.outputTokens },
        });

        // 7) Sanity checks
        const checks = runSanityChecks({
            items: priced.items,
            subtotal_cents: priced.subtotal_cents,
            sqft_estimate: ext.scope.sqft_estimate ?? null,
        });
        if (checks.some((c) => c.severity === 'warning')) {
            await writeAudit({ proposalId, event: 'sanity_check_warning', payload: { checks } });
        }

        // 8) Update proposal aggregates
        const totalApiCostMicros = ext.costMicros + copy.costMicros;
        const { error: updErr } = await supabase
            .from('proposals')
            .update({
                status: 'extracted',
                subtotal_cents: priced.subtotal_cents,
                total_cents: priced.subtotal_cents,
                cover_letter: copy.coverLetter,
                extracted_at: new Date().toISOString(),
                extract_input_tokens: ext.inputTokens,
                extract_output_tokens: ext.outputTokens,
                copy_input_tokens: copy.inputTokens,
                copy_output_tokens: copy.outputTokens,
                api_cost_usd_micros: totalApiCostMicros,
            })
            .eq('id', proposalId);
        if (updErr) throw new Error(`proposal update: ${updErr.message}`);

        // PDF is intentionally NOT rendered here. It renders inside sendProposal()
        // when Marcus clicks Approve & Send, against the final edited state.

        return {
            proposalId,
            warnings: ext.scope.warnings,
            sanity_checks: checks,
            api_cost_usd_micros: totalApiCostMicros,
            line_item_count: priced.items.length,
            extraction_attempts: ext.attempts,
        };
    } catch (err) {
        await writeAudit({
            proposalId,
            event: 'extract_failed',
            payload: { error: (err as Error).message },
        });
        throw err;
    }
}

// =============================================================================

export async function renderAndStorePdf(proposalId: string): Promise<void> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('proposals')
        .select('*, client:clients(*), line_items:proposal_line_items(*, catalog:line_items_catalog(name, description, category))')
        .eq('id', proposalId)
        .single();
    if (error || !data) throw new Error(`fetch proposal: ${error?.message}`);
    type Row = Proposal & { client: Client } & {
        line_items: (ProposalLineItem & {
            catalog: { name: string; description: string | null; category: string };
        })[];
    };
    const p = data as unknown as Row;

    const pdf = await renderProposalPdfBuffer({
        proposalNumber: `GSP-${p.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date(),
        title: p.title,
        client: { name: p.client.name, email: p.client.email, address: p.client.address },
        coverLetter: p.cover_letter ?? '',
        items: p.line_items
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((li) => ({
                sku_id: li.sku_id,
                quantity: Number(li.quantity),
                unit: li.unit,
                unit_price_cents: li.unit_price_cents,
                line_total_cents: li.line_total_cents,
                name: li.catalog.name,
                description: li.catalog.description,
                category: li.catalog.category,
                llm_notes: li.llm_notes,
            })),
        subtotalCents: p.subtotal_cents,
        totalCents: p.total_cents,
        depositPct: Number(p.deposit_pct),
        depositUrl: p.stripe_deposit_url,
    });
    const { path } = await uploadProposalPdf({ proposalId: p.id, pdf });
    await supabase.from('proposals').update({ pdf_storage_path: path }).eq('id', p.id);
    await writeAudit({ proposalId, event: 'pdf_rendered', payload: { path, bytes: pdf.length } });
}

// =============================================================================

export async function approveProposal(args: {
    proposalId: string;
    approverEmail: string;
    note?: string;
}): Promise<{ approved: true } | { approved: false; reason: string }> {
    const email = args.approverEmail.toLowerCase().trim();
    if (!env.APPROVER_EMAILS.includes(email)) {
        return { approved: false, reason: 'Approver not on the allow-list (APPROVER_EMAILS).' };
    }
    const supabase = getSupabase();
    const { error: insErr } = await supabase
        .from('approvals')
        .insert({
            proposal_id: args.proposalId,
            approver_email: email,
            note: args.note ?? null,
        });
    if (insErr) {
        // Unique-violation = already approved; treat as idempotent success.
        if (insErr.code !== '23505') {
            return { approved: false, reason: `db: ${insErr.message}` };
        }
    }
    await supabase.from('proposals').update({ status: 'approved' }).eq('id', args.proposalId);
    await writeAudit({ proposalId: args.proposalId, event: 'approved', actor: email });
    return { approved: true };
}

// =============================================================================

export interface SendResult {
    sent: true;
    emailMocked: boolean;
    stripeMocked: boolean;
    ghlMocked: boolean;
    depositUrl: string;
    emailTo: string;
}

export async function sendProposal(args: { proposalId: string }): Promise<SendResult> {
    const supabase = getSupabase();

    // Gate: approval must exist.
    const { data: approval, error: appErr } = await supabase
        .from('approvals')
        .select('approver_email')
        .eq('proposal_id', args.proposalId)
        .maybeSingle();
    if (appErr) throw new Error(`approval lookup: ${appErr.message}`);
    if (!approval) {
        throw new Error('Send blocked: no approval row for this proposal. Approve first.');
    }

    await writeAudit({ proposalId: args.proposalId, event: 'send_initiated' });

    // Fetch proposal + client.
    const { data, error } = await supabase
        .from('proposals')
        .select('*, client:clients(*)')
        .eq('id', args.proposalId)
        .single();
    if (error || !data) throw new Error(`fetch proposal: ${error?.message}`);
    type Row = Proposal & { client: Client };
    const p = data as unknown as Row;

    if (!p.client.email) throw new Error('Send blocked: client has no email on file.');

    // Render the PDF against the final edited state. This is where dollars
    // get locked in — no more edits after this.
    await renderAndStorePdf(p.id);

    // Re-fetch to pick up pdf_storage_path written by renderAndStorePdf.
    const { data: refreshed } = await supabase
        .from('proposals')
        .select('pdf_storage_path')
        .eq('id', p.id)
        .single();
    const pdfPath = (refreshed?.pdf_storage_path as string | null) ?? null;
    if (!pdfPath) throw new Error('Send blocked: PDF render did not produce a file.');

    const pdf = await downloadProposalPdf(pdfPath);

    // Stripe deposit link.
    const depositCents = Math.round(p.total_cents * (Number(p.deposit_pct) / 100));
    const stripe = await createDepositLink({
        proposalId: p.id,
        clientName: p.client.name,
        depositCents,
        description: p.title,
    });
    await writeAudit({
        proposalId: p.id,
        event: 'stripe_link_created',
        payload: { mocked: stripe.mocked, providerId: stripe.providerId, depositCents },
    });
    await supabase.from('proposals').update({ stripe_deposit_url: stripe.url }).eq('id', p.id);

    // Email via Resend.
    const firstName = p.client.name.split(/\s+/)[0] ?? p.client.name;
    const totalUsd = formatUsdRounded(p.total_cents);
    const emailBody = [
        `Hi ${firstName},`,
        '',
        p.cover_letter ?? '',
        '',
        `Project total: ${totalUsd}`,
        `Deposit (${Number(p.deposit_pct).toFixed(0)}%): ${formatUsdRounded(depositCents)}`,
        '',
        `Pay deposit: ${stripe.url}`,
        '',
        '— Marcus',
        'Greenscape Pro',
    ].join('\n');

    const email = await sendProposalEmail({
        to: p.client.email,
        subject: `${p.title} — proposal from Greenscape Pro`,
        bodyText: emailBody,
        pdfBuffer: pdf,
        pdfFilename: `GSP-${p.id.slice(0, 8).toUpperCase()}.pdf`,
    });
    await writeAudit({
        proposalId: p.id,
        event: email.sent ? 'email_sent' : 'email_failed',
        payload: { mocked: email.mocked, providerId: email.providerId, to: p.client.email },
    });

    // GHL push.
    const ghl = getGhl();
    const push = await ghl.advanceOpportunity({
        proposalId: p.id,
        clientName: p.client.name,
        clientEmail: p.client.email,
        clientPhone: p.client.phone,
        title: p.title,
        totalCents: p.total_cents,
        pdfUrl: p.pdf_storage_path,
        depositUrl: stripe.url,
    });
    await writeAudit({
        proposalId: p.id,
        event: 'ghl_pushed',
        payload: { mocked: push.mocked, opportunity_id: push.opportunityId },
    });
    if (push.opportunityId) {
        await supabase.from('proposals').update({ ghl_opportunity_id: push.opportunityId }).eq('id', p.id);
    }

    // Slack notify.
    const slack = await notifySlack({
        text: `Proposal sent: *${p.title}* → ${p.client.name} · ${totalUsd}`,
        proposalUrl: `${env.APP_URL}/proposals/${p.id}`,
    });
    if (slack.ok) {
        await writeAudit({ proposalId: p.id, event: 'slack_notified' });
    }

    await supabase.from('proposals').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', p.id);
    await writeAudit({ proposalId: p.id, event: 'sent' });

    return {
        sent: true,
        emailMocked: email.mocked,
        stripeMocked: stripe.mocked,
        ghlMocked: push.mocked,
        depositUrl: stripe.url,
        emailTo: p.client.email,
    };
}

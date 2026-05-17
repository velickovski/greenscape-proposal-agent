import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { PricedLineItem } from '@/lib/catalog/pricing';
import { formatUsd } from '@/lib/catalog/pricing';

// =============================================================================
// Branded proposal PDF. Helvetica only (bundled with react-pdf) so we avoid
// font-loading on serverless. Layout reads like a real general-contractor
// quote: header, client block, scope, line items, totals, terms.
// =============================================================================

const BRAND = {
    primary: '#1F3D2E',     // deep green
    accent: '#A88455',      // warm tan
    ink: '#1A1A1A',
    muted: '#6B6B6B',
    rule: '#D8D6D2',
    bg: '#FFFFFF',
} as const;

const styles = StyleSheet.create({
    page: {
        backgroundColor: BRAND.bg,
        color: BRAND.ink,
        fontSize: 10.5,
        fontFamily: 'Helvetica',
        padding: 48,
        lineHeight: 1.4,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
    brandWordmark: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BRAND.primary, letterSpacing: 1 },
    brandSub: { fontSize: 9, color: BRAND.muted, marginTop: 2 },
    proposalLabel: { fontSize: 9, color: BRAND.muted, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 },
    proposalNumber: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND.ink, textAlign: 'right', marginTop: 2 },
    rule: { height: 1, backgroundColor: BRAND.rule, marginVertical: 14 },
    h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BRAND.ink, marginBottom: 6 },
    h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND.primary, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
    clientBlock: { marginTop: 8, marginBottom: 4 },
    clientName: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
    clientLine: { fontSize: 10, color: BRAND.muted, marginTop: 1 },
    body: { marginTop: 4 },
    paragraph: { marginBottom: 8 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BRAND.rule, paddingBottom: 4, marginTop: 6 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BRAND.rule, paddingVertical: 6 },
    colItem: { flex: 5 },
    colQty: { flex: 1, textAlign: 'right' },
    colUnit: { flex: 1, textAlign: 'right' },
    colRate: { flex: 1.4, textAlign: 'right' },
    colTotal: { flex: 1.6, textAlign: 'right' },
    colHeaderText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    itemName: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
    itemDescription: { fontSize: 9, color: BRAND.muted, marginTop: 1 },
    totalsBlock: { marginTop: 14, alignSelf: 'flex-end', width: '50%' },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    totalsLabel: { fontSize: 10, color: BRAND.muted },
    totalsValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
    totalsGrandRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingVertical: 6, marginTop: 4,
        borderTopWidth: 1, borderTopColor: BRAND.ink,
    },
    totalsGrandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND.ink },
    totalsGrandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: BRAND.primary },
    terms: { marginTop: 24, fontSize: 9, color: BRAND.muted },
    footer: {
        position: 'absolute', bottom: 24, left: 48, right: 48,
        flexDirection: 'row', justifyContent: 'space-between',
        fontSize: 8, color: BRAND.muted, paddingTop: 8,
        borderTopWidth: 0.5, borderTopColor: BRAND.rule,
    },
});

export interface ProposalPdfProps {
    proposalNumber: string;
    issuedAt: Date;
    title: string;
    client: { name: string; email: string | null; address: string | null };
    coverLetter: string;
    items: PricedLineItem[];
    subtotalCents: number;
    totalCents: number;
    depositPct: number;
    depositUrl?: string | null;
}

const UNIT_LABEL: Record<string, string> = {
    sqft: 'sqft',
    linear_ft: 'lf',
    each: 'ea',
    job: 'job',
};

export function ProposalPdf(p: ProposalPdfProps): React.ReactElement {
    const issuedStr = p.issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const depositCents = Math.round(p.totalCents * (p.depositPct / 100));
    return (
        <Document title={p.title} author="Greenscape Pro">
            <Page size="LETTER" style={styles.page}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.brandWordmark}>GREENSCAPE PRO</Text>
                        <Text style={styles.brandSub}>Design · Build · Maintain — Phoenix, AZ</Text>
                    </View>
                    <View>
                        <Text style={styles.proposalLabel}>Proposal</Text>
                        <Text style={styles.proposalNumber}>{p.proposalNumber}</Text>
                        <Text style={styles.brandSub}>{issuedStr}</Text>
                    </View>
                </View>

                <View style={styles.rule} />

                <Text style={styles.h1}>{p.title}</Text>
                <View style={styles.clientBlock}>
                    <Text style={styles.clientName}>{p.client.name}</Text>
                    {p.client.address ? <Text style={styles.clientLine}>{p.client.address}</Text> : null}
                    {p.client.email ? <Text style={styles.clientLine}>{p.client.email}</Text> : null}
                </View>

                <View style={styles.body}>
                    <Text style={styles.paragraph}>{p.coverLetter}</Text>
                </View>

                <Text style={styles.h2}>Scope of Work</Text>
                <View style={styles.tableHeader}>
                    <Text style={[styles.colItem, styles.colHeaderText]}>Item</Text>
                    <Text style={[styles.colQty, styles.colHeaderText]}>Qty</Text>
                    <Text style={[styles.colUnit, styles.colHeaderText]}>Unit</Text>
                    <Text style={[styles.colRate, styles.colHeaderText]}>Rate</Text>
                    <Text style={[styles.colTotal, styles.colHeaderText]}>Total</Text>
                </View>
                {p.items.map((it) => (
                    <View key={it.sku_id + ':' + it.quantity} style={styles.tableRow} wrap={false}>
                        <View style={styles.colItem}>
                            <Text style={styles.itemName}>{it.name}</Text>
                            {it.description ? <Text style={styles.itemDescription}>{it.description}</Text> : null}
                        </View>
                        <Text style={styles.colQty}>{formatQuantity(it.quantity)}</Text>
                        <Text style={styles.colUnit}>{UNIT_LABEL[it.unit] ?? it.unit}</Text>
                        <Text style={styles.colRate}>{formatUsd(it.unit_price_cents)}</Text>
                        <Text style={styles.colTotal}>{formatUsd(it.line_total_cents)}</Text>
                    </View>
                ))}

                <View style={styles.totalsBlock}>
                    <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>Subtotal</Text>
                        <Text style={styles.totalsValue}>{formatUsd(p.subtotalCents)}</Text>
                    </View>
                    <View style={styles.totalsGrandRow}>
                        <Text style={styles.totalsGrandLabel}>Project Total</Text>
                        <Text style={styles.totalsGrandValue}>{formatUsd(p.totalCents)}</Text>
                    </View>
                    <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>
                            Deposit ({p.depositPct.toFixed(0)}%)
                        </Text>
                        <Text style={styles.totalsValue}>{formatUsd(depositCents)}</Text>
                    </View>
                </View>

                <Text style={styles.h2}>Terms</Text>
                <Text style={styles.terms}>
                    Pricing valid for 30 days. {p.depositPct.toFixed(0)}% deposit secures your spot in the build calendar; balance due upon project completion. Schedule is provided after permitting and HOA approval are complete. Any changes in scope will be quoted as a written change order before work begins. Phoenix-area only; AZ ROC #—.
                </Text>

                {p.depositUrl ? (
                    <Text style={[styles.terms, { marginTop: 8 }]}>
                        Deposit link: {p.depositUrl}
                    </Text>
                ) : null}

                <View style={styles.footer}>
                    <Text>Greenscape Pro · Phoenix, AZ · hello@greenscape.pro</Text>
                    <Text>{p.proposalNumber}</Text>
                </View>
            </Page>
        </Document>
    );
}

function formatQuantity(q: number): string {
    if (Number.isInteger(q)) return q.toLocaleString('en-US');
    return q.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export async function renderProposalPdfBuffer(props: ProposalPdfProps): Promise<Buffer> {
    return renderToBuffer(<ProposalPdf {...props} />);
}

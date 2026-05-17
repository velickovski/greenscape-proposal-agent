import 'server-only';
import { getSupabase } from '@/lib/supabase/server';

const BUCKET = 'proposals';

export async function uploadProposalPdf(args: {
    proposalId: string;
    pdf: Buffer;
}): Promise<{ path: string }> {
    const supabase = getSupabase();
    const path = `${args.proposalId}.pdf`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, args.pdf, {
        contentType: 'application/pdf',
        upsert: true,
    });
    if (error) throw new Error(`PDF upload failed: ${error.message}`);
    return { path };
}

export async function downloadProposalPdf(path: string): Promise<Buffer> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw new Error(`PDF download failed: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
}

export async function signedProposalPdfUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw new Error(`signed url failed: ${error?.message}`);
    return data.signedUrl;
}

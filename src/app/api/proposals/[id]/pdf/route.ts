import { NextResponse, type NextRequest } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { downloadProposalPdf } from '@/lib/storage/proposals';
import { renderAndStorePdf } from '@/lib/agent/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('proposals')
        .select('pdf_storage_path')
        .eq('id', id)
        .maybeSingle();
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    let path = data.pdf_storage_path as string | null;
    if (!path) {
        await renderAndStorePdf(id);
        const refreshed = await supabase
            .from('proposals')
            .select('pdf_storage_path')
            .eq('id', id)
            .single();
        path = (refreshed.data?.pdf_storage_path as string) ?? null;
    }
    if (!path) {
        return NextResponse.json({ error: 'pdf_unavailable' }, { status: 500 });
    }

    const buffer = await downloadProposalPdf(path);
    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="GSP-${id.slice(0, 8).toUpperCase()}.pdf"`,
            'Cache-Control': 'private, no-cache',
        },
    });
}

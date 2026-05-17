import 'server-only';
import { Resend } from 'resend';
import { env, isResendEnabled } from '@/lib/env';

export interface SendEmailResult {
    sent: boolean;
    providerId: string | null;
    mocked: boolean;
}

let _resend: Resend | null = null;
function getResend(): Resend {
    if (_resend) return _resend;
    if (!env.RESEND_API_KEY) throw new Error('Resend not configured');
    _resend = new Resend(env.RESEND_API_KEY);
    return _resend;
}

export async function sendProposalEmail(args: {
    to: string;
    subject: string;
    bodyText: string;
    pdfBuffer: Buffer;
    pdfFilename: string;
}): Promise<SendEmailResult> {
    if (!isResendEnabled()) {
        console.warn(
            '[resend] RESEND_API_KEY not set, mocking send →',
            { to: args.to, subject: args.subject, attachmentBytes: args.pdfBuffer.length },
        );
        return { sent: true, providerId: null, mocked: true };
    }

    const resend = getResend();
    const { data, error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: args.to,
        subject: args.subject,
        text: args.bodyText,
        attachments: [
            { filename: args.pdfFilename, content: args.pdfBuffer },
        ],
    });

    if (error) {
        throw new Error(`Resend send failed: ${error.message}`);
    }
    return { sent: true, providerId: data?.id ?? null, mocked: false };
}

import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
    title: 'Greenscape Proposal Agent',
    description: 'Site-walk notes in, priced & branded proposal PDF out — in under 5 minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="h-full antialiased">
            <body className="min-h-full flex flex-col">
                <header className="border-b border-rule bg-card">
                    <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                        <Link href="/" className="flex items-baseline gap-3">
                            <span className="text-lg font-bold tracking-wider text-brand">GREENSCAPE PRO</span>
                            <span className="text-xs text-muted uppercase tracking-widest">Proposal Agent</span>
                        </Link>
                        <Link href="/proposals/new" className="btn btn-primary">
                            New proposal
                        </Link>
                    </div>
                </header>
                <main className="flex-1">
                    <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
                </main>
                <footer className="border-t border-rule">
                    <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted flex justify-between">
                        <span>Greenscape Pro · Phoenix, AZ</span>
                        <span>Built for the L&amp;S take-home · 2026</span>
                    </div>
                </footer>
            </body>
        </html>
    );
}

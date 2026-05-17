import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // react-pdf imports a bunch of Node-only deps (yoga, hyphenation, etc.).
    // Externalizing keeps the bundler from trying to ship them client-side
    // and avoids known SSR bundling issues.
    serverExternalPackages: ['@react-pdf/renderer'],
    // The agent endpoints run real LLM + PDF work — they need real Node, not Edge.
    // (Per-route export `runtime = 'nodejs'` is also set, this is belt + suspenders.)
};

export default nextConfig;

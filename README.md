# Greenscape Proposal Agent

> AI-powered quote-compression agent for Greenscape Pro.
> Site-walk notes in → priced, branded proposal PDF out → Marcus approves → client receives in <5 minutes.

Built for the License & Scale AI Developer take-home. See [`STRATEGY.md`](./STRATEGY.md) for the five-agent strategy this P0 was selected from.

## What this is

A focused workflow agent (not an autonomous tool-using loop) that replaces Marcus Tate's 6–9 day manual proposal process. Marcus types or dictates site-walk notes; the system extracts structured scope, prices it deterministically against a SQL line-item catalog, generates a branded PDF, and waits for Marcus to approve before sending anything external.

**Why this and not Marcus's stated #1, #3, or #4?** See `STRATEGY.md`. Short version: Marcus *did* say quoting was #1, and the math agrees independently — 35–40% close-rate recovery × ~150 projects × $28K ≈ $630K/year. The strategy doc spells out which of his stated priorities I disagreed with.

## Architecture

```
Marcus (browser)
   │ 1. paste site-walk notes + client info
   ▼
Next.js (Vercel)
   ├─ POST /api/proposals  ──►  Claude Opus 4.7 (structured extraction)
   │                              ├─ returns [{sku_id, quantity, notes}, ...]
   │                              └─ JSON schema enforced; retry-on-malformed
   ├─ JOIN catalog (Supabase) ──► deterministic pricing (no hallucinated $)
   ├─ Claude Haiku 4.5 ──► cover-letter copy in Marcus's voice
   ├─ react-pdf ──► branded PDF → Supabase Storage
   │
   │ 2. Marcus reviews + edits line items
   ▼
   │ 3. Marcus clicks Approve  (HITL hard gate)
   ▼
POST /api/proposals/[id]/send  (gated on approval row)
   ├─ Resend ─► email PDF to client
   ├─ Stripe ─► deposit checkout link
   ├─ GHL adapter ─► log "opportunity.stage_changed" (mocked if no creds)
   └─ audit_log row written
```

Two LLM calls per proposal. One database. Three external integrations (Resend real, Stripe real, GHL mocked behind a swappable adapter). One human approval gate. Predictable cost (~$0.10/proposal), deterministic output, fully auditable.

## Stack

- **Next.js 16** (App Router, Server Actions, Route Handlers) — App Router because the workflow is a few stateful pages, not a heavy SPA
- **TypeScript** strict — no `any` in business logic
- **Tailwind v4** — minimal styling, function over form
- **Supabase** Postgres + Storage — primary data store, PDF blob storage
- **Anthropic SDK** — direct, no LangChain framework overhead
- **@react-pdf/renderer** — server-side PDF, no Chromium dependency
- **Resend** for email, **Stripe** for deposit links, **mock GHL adapter** for CRM
- **Vercel** for hosting (zero-config Next deploy)

## Cost per proposal

| Step | Model | ~Input tokens | ~Output tokens | Cost |
|---|---|---|---|---|
| Scope extraction | Opus 4.7 | 3,000 | 800 | ~$0.105 |
| Cover letter | Haiku 4.5 | 1,000 | 400 | ~$0.003 |
| **Total** | | | | **~$0.108** |

At 150 proposals/year that is ~$16/year in API cost — rounding error vs. the $630K/year revenue recovered.

## Local development

Prerequisites: Node 20+, a Supabase project, an Anthropic API key.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (all required).
# Resend/Stripe/Slack/GHL are optional and fall back to mocks.

# 3. Apply schema
# Open your Supabase project -> SQL Editor and run, in order:
#   supabase/migrations/0001_init.sql
#   supabase/migrations/0002_seed_catalog.sql

# 4. Run
npm run dev
# Open http://localhost:3000
```

## Deploy

See [`DEPLOY.md`](./DEPLOY.md) for the step-by-step Vercel deploy.

## What's mocked vs. real

| Component | Status |
|---|---|
| Claude extraction + copy | **Real** (live API) |
| Supabase Postgres + Storage | **Real** |
| Resend email | Real if `RESEND_API_KEY` set, else logs to console |
| Stripe deposit link | Real test-mode if `STRIPE_SECRET_KEY` set, else mocked URL |
| Slack approval ping | Real if `SLACK_APPROVAL_WEBHOOK_URL` set, else no-op |
| GoHighLevel CRM | Mocked behind a swappable adapter; logs payload to `audit_log` |

The brief requires "at least one external integration that touches the outside world" — Resend + Stripe both qualify when configured. GHL is mocked because we don't have a sandbox sub-account; the adapter interface is production-shaped, so swapping in a real client is a one-file change.

## Guardrails

- **Claude never sees dollar amounts.** It picks catalog SKU IDs and quantities only. Server-side JOIN against `line_items_catalog` produces the price.
- **JSON schema retry.** If the model returns malformed JSON or unknown SKUs, the orchestrator retries once with the schema re-explained. Second failure surfaces an error to Marcus instead of silently writing garbage.
- **HITL hard gate.** The `/send` endpoint returns 403 unless an `approvals` row exists for the proposal. No bypass path.
- **Audit log.** Every state transition (extracted, edited, approved, sent, GHL-pushed) gets a row with actor, payload, and timestamp.
- **Sanity check.** If the LLM-derived total is wildly disproportionate to site-walk size hints (sqft), the UI warns Marcus on the review screen.

## What I'd build next, with another week

1. **CompanyCam intake.** Pull site-walk photos automatically and pass them to Claude (vision) for measurement extraction.
2. **Voice intake.** Marcus dictates on the drive home; Whisper transcribes; we run the same pipeline.
3. **Catalog price drift.** Weekly cron that re-prices a sample of past proposals against the current catalog and flags drift >5%.
4. **Marcus-voice fine-tuning loop.** Thumbs up/down on the cover-letter copy feeds a few-shot examples table; over 50 approvals the voice tightens significantly.
5. **Real GHL adapter.** Trade the mock for live opportunity creation + stage advance.

## Layout

```
greenscape-proposal-agent/
├─ STRATEGY.md           ← five-agent strategy doc (strategy submission)
├─ README.md             ← this file
├─ DEPLOY.md             ← Vercel deploy guide
├─ .env.example          ← every required env var, documented
├─ supabase/migrations/  ← SQL migrations (run via dashboard SQL editor)
└─ src/
   ├─ app/               ← Next.js App Router pages + API routes
   ├─ components/        ← React UI components
   └─ lib/               ← business logic, adapters, integrations
```

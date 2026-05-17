# Deploying to Vercel

These steps assume the GitHub repo already exists and you have Vercel/Supabase/Anthropic accounts set up.

## 1. Create the Supabase project

If you have not already:

1. https://supabase.com/dashboard/new → name `greenscape-proposal-agent` → region close to your users → set DB password (save it).
2. Wait ~2 minutes for provisioning.
3. Project Settings → API → copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (server-only)

## 2. Apply database migrations

In the Supabase Dashboard → SQL Editor, run these files in order:

1. `supabase/migrations/0001_init.sql` — tables, indexes, RLS policies
2. `supabase/migrations/0002_seed_catalog.sql` — Greenscape pricing catalog (~30 SKUs)

Verify in Table Editor that `line_items_catalog` has rows.

## 3. Create the Supabase Storage bucket

Storage → New bucket → name `proposals` → **Private**. (The app uses the service role key to write/read; clients never touch the bucket directly.)

## 4. Push to GitHub

```bash
gh repo create greenscape-proposal-agent --public --source=. --push
```

## 5. Import on Vercel

1. https://vercel.com/new → Import Git Repository → pick `greenscape-proposal-agent`.
2. Framework preset: **Next.js** (auto-detected).
3. Add environment variables — copy them from your local `.env.local`:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | from Supabase API page |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | from Supabase API page |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server-only, **do not** prefix with `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | yes | from console.anthropic.com |
| `RESEND_API_KEY` | optional | else falls back to console log |
| `RESEND_FROM_EMAIL` | optional | e.g. `Marcus <hello@example.com>` |
| `STRIPE_SECRET_KEY` | optional | use `sk_test_...` |
| `GHL_API_KEY` | optional | leave blank to use the mock adapter |
| `GHL_LOCATION_ID` | optional | required only if `GHL_API_KEY` is set |
| `SLACK_APPROVAL_WEBHOOK_URL` | optional | else no Slack ping |
| `NEXT_PUBLIC_APP_URL` | yes | set to your Vercel URL after first deploy |
| `APPROVER_EMAILS` | yes | comma-separated approver list |

4. Click **Deploy**.

## 6. Update `NEXT_PUBLIC_APP_URL`

After the first deploy, Vercel gives you a `*.vercel.app` URL.

1. Project → Settings → Environment Variables.
2. Set `NEXT_PUBLIC_APP_URL` to that URL.
3. Trigger a redeploy (Deployments → ... → Redeploy).

The approval emails use this URL to build the "Approve & send" link.

## 7. Smoke test

1. Open the deployed URL → click "New proposal".
2. Use the sample site-walk notes from `STRATEGY.md` discovery transcript ("Smith family, 1200 sqft travertine patio, fire pit, pergola").
3. Confirm scope extracts within ~5 seconds.
4. Edit one line item, save.
5. Click "Approve & send" → confirm:
   - Approval row appears in `approvals` table
   - Email lands (or console log if Resend not configured)
   - `audit_log` rows for `extracted`, `approved`, `sent`, `ghl_pushed`

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 500 on `/api/proposals` | Anthropic key missing or invalid | Check Vercel env, redeploy |
| Empty line items | Catalog seed not run | Re-run `0002_seed_catalog.sql` |
| PDF download 404 | Storage bucket `proposals` missing or wrong name | Create with exact name |
| `policy violation` errors from Supabase | RLS blocking service role | Verify SUPABASE_SERVICE_ROLE_KEY is set server-side only (no `NEXT_PUBLIC_` prefix) |

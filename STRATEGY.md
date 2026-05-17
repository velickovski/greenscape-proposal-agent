# Greenscape Pro — Five AI Agents, Ranked

**Author:** Andrej Velickovski for License & Scale
**Client:** Greenscape Pro (Marcus Tate, founder)
**Date:** May 2026

---

## Executive take

Greenscape Pro is a healthy $4.2M residential hardscape business with one bleeding wound: **Marcus is a single point of failure on every proposal**, and 35–40% of qualified leads die during the 6–9 day quote cycle. Every other bottleneck (post-sign drag, customer communications, lead reactivation) is real, but they are an order of magnitude smaller than the quote-cycle gap. The five agents below are ranked by **dollars unlocked per week of build effort**, not by Marcus's stated priority order. Two of his stated priorities (crew coaching, marketing content) intentionally did not make the cut.

---

## #1 — Proposal Agent ("Quote Compressor")

**Purpose:** Convert Marcus's site-walk notes into a priced, branded proposal PDF for his approval in under 5 minutes.

**What it does**
- Marcus dictates or types raw notes from the site walk (one paragraph + measurements is enough).
- Claude maps notes → catalog SKUs + quantities; **server enforces deterministic pricing** from a SQL line-item catalog (zero hallucinated dollars).
- Generates a branded PDF with a cover letter in Marcus's voice (Haiku 4.5).
- Marcus reviews + edits in a single screen and clicks Approve.
- On approve: PDF emailed to client, Stripe deposit link generated, GHL opportunity stage advanced.

**What it replaces:** Marcus reading his own notes → opening a Google Doc template → keying line items from a pricing spreadsheet → exporting PDF → emailing. Currently 6–9 days end to end. New target: **<24 hours**.

**Estimated ROI:** 35–40% of qualified leads currently lost to faster competitors. Recovering half is +15pp close rate × ~150 projects/yr × $28K = **~$630K/year of recovered revenue**.

**Why #1:** Single highest-leverage intervention in the business. Every other bottleneck compounds on top of an open quote pipeline. Fix the quote and Brittany has fewer stale leads, Jenna has more signed projects to onboard, and Marcus reclaims evenings.

---

## #2 — Post-Sign Operations Agent ("Pipeline Unblocker")

**Purpose:** Eliminate the 4–6 week post-signature limbo by automating HOA, permit, and deposit follow-ups.

**What it does**
- Watches every signed project; tracks three deadlines per project: deposit, HOA submission, permit issuance.
- Auto-nudges customer (deposit, HOA), Jenna (HOA board meeting dates), Marcus (permit revisions).
- Posts every nudge to GHL as an activity record on the opportunity.
- Escalates to Slack/SMS for items >14 days stale.

**What it replaces:** Jenna chasing 8–12 projects manually every day.

**Estimated ROI:** 8–12 projects × $28K avg = **$224K–$336K of revenue stuck in limbo at any given moment**. Compressing average post-sign time from 4–6 weeks to 2–3 weeks releases ~$150K of working capital and 4–6 extra build weeks per crew per year. Plus Jenna gets her day back.

**Why #2:** Operationally invisible, financially massive. Marcus did not list it — the auditor flagged it. #1 sells the program; #2 pays for it.

---

## #3 — Closed-Lost Reactivation Agent ("Pipeline Resurrector")

**Purpose:** Reanimate 1,400+ dead leads with personalized, Marcus-voiced re-engagement at GHL scale.

**What it does**
- Pulls every closed-lost lead from GHL with original notes/scope and seasonality metadata.
- Claude drafts a 2–3 sentence SMS or email in Marcus's voice referencing the original project ("Hey Sarah, we talked about your backyard last June…").
- Batches to Marcus for approval (10–20 at a time, one tap each).
- Sends via GHL on approval; logs replies; auto-routes responders into the new-lead funnel (which is now fed by Agent #1).

**What it replaces:** Brittany's sporadic re-engagement blasts that "feel like a mass blast" (Marcus's words) and convert poorly.

**Estimated ROI:** 1,400 × 2% re-close × $28K = **$784K latent revenue**. Even at 0.5% it is $196K. Lowest build cost per dollar unlocked of any agent in the list.

**Why #3 not #1:** It depends on Agent #1 being live. Reactivating leads only matters if the funnel behind it can actually convert them; without it, this just funnels work back into the same broken bottleneck.

---

## #4 — Job-Site Update Agent ("Halfway-Loom Replacement")

**Purpose:** Auto-send Marcus-branded progress updates to active-build clients every 2–3 days.

**What it does**
- Subscribes to CompanyCam photo uploads + Jobber milestone events.
- Bundles 2–3 photos + a short Claude-written status in Marcus's voice.
- Sends via GHL SMS or email with a "reply to Marcus" thread.
- Marcus reviews a daily digest of outgoing updates; can edit or kill any before send.

**What it replaces:** Marcus's manual Loom updates (30% adherence) and the silence-then-anxiety-call pattern Jenna fields daily.

**Estimated ROI:** Marcus explicitly said personal updates **drive referrals**. Conservative: 5 extra referred deals/year × $28K = **~$140K/year**, plus the elimination of the daily anxiety-call workload Jenna currently absorbs.

**Why #4:** Real money, but it is a referral driver, not a primary lead source. It also depends on Marcus's voice being well-tuned in the system, which #1 and #3 will have already trained.

---

## #5 — Lead Pre-Qualifier ("Calendar Defender")

**Purpose:** SMS-qualify every Meta/Google lead before Marcus's phone rings.

**What it does**
- Triggered by Zapier → GHL lead-created event.
- Asks 4–5 questions via 2-way SMS: scope, budget band, timeline, ownership, ZIP.
- Auto-tags the GHL opportunity (qualified / disqualified / cool) before Marcus sees it.
- Disqualified leads get a polite "not a fit" message; Marcus's calendar receives only qualified ones.

**What it replaces:** 4–6 unqualified phone calls per week, ~10–15 minutes each.

**Estimated ROI:** 1–2 hours/week of Marcus's time. Modest in dollars. But Marcus's calendar **is** the constraint — every unqualified call displaces a real site walk where he closes at 70%+.

**Why #5 and not higher:** ROI in pure dollars is the smallest of the five. It is in the top five because it protects the input to Agent #1: Marcus's calendar.

---

## Why my #1 ≠ Marcus's stated #1 (it agrees — but only because the math agrees)

Marcus said quoting was his #1. I agree, but not because he said so. The math says it independently: $28K avg × ~150 projects × 15pp close-rate recovery ≈ $630K. The same exercise demolishes his stated #3 (crew coaching, hard ceiling at ~$104K/yr with high adoption risk) and his #4 (marketing/content, which Marcus himself contradicted mid-call: *"I cannot keep up with the leads I have. Quote is the constraint."*). If Marcus had instead said his #1 was crew coaching, I would have argued back with the same numbers.

## One agent I considered but excluded: Marketing & Content Generator

Marcus listed it. I am not building it. He explicitly said on the call: *"Lead volume is not the problem. Quote is the constraint."* Building a content engine when ROAS is already 4–4.5x and the funnel is choked at the next stage is solving the wrong problem — and it reads as taking the founder's request at face value instead of doing the audit. The crew-coaching agent loses on similar grounds: ~$104K/year ceiling with material adoption risk (will hardscape crews actually pull out their phones mid-job?). If forced to add a 6th, an **internal approval rulebook for Jenna** (replacing the 5–10 daily Slack pings to Marcus on small approvals) is more defensible than either of Marcus's stated #3 or #4.

## Interdependencies

```
#1 Proposal ─┬─► increases close-rate, makes #3 worth running
             └─► fills the post-sign pipeline that #2 unblocks
#2 Post-Sign ──► frees Jenna to run #3 batch approvals
#3 Reactivation ─► funnels into #1 (more proposals = compounding return)
#4 Job-Site Updates ─► trained on Marcus-voice from #1 and #3
#5 Pre-Qualifier ─► protects the calendar that feeds #1's site walks
```

## Trade-offs I am aware of

- **Pricing-catalog hygiene.** Agent #1 assumes Marcus's pricing spreadsheet can be seeded into a SQL catalog. If that spreadsheet is messier than implied (200+ items, last cleaned ?), expect a 1–2 week one-time data-hygiene project before full production rollout.
- **GHL lock-in.** All five agents assume GHL stays the system of record (per Jenna: *"everything has to be in GHL"*). If Marcus migrates platforms mid-year, all five integrations rewrite.
- **Voice quality compounds.** Early proposals and updates will sound less like Marcus than later ones. Build a thumbs-up/down feedback loop into the approval UI from day one so the voice tightens over the first ~50 proposals.
- **What breaks first at scale:** Catalog drift. Materials prices in Phoenix landscape will change faster than the catalog can be hand-curated. After ~6 months, add a quarterly Marcus-reviews-catalog ritual or wire in a supplier price-feed.

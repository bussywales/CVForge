# Smoke tests

Tests: run `npm test` locally; use `npm run test:ci` for sandbox/CI.

## Login
- Request a magic link from /login.
- Confirm redirect to /app after /auth/callback.

## Activation loop
- Signed-in user on /app sees Activation card; new user shows “Add your first application” as the first step.
- After creating an application, refresh /app and the next step becomes Outreach with the correct anchor deep link.
- Clicking the CTA navigates to the linked tab/anchor without errors; if logging is blocked the UI still works.
- Progress counts update as steps are completed; “Try again” reload works if the model fails to load.
- Skip for now hides the card for the week and emits activation_skip_week; Do next/step links emit activation_cta_click/activation_step_click.
- No duplicate “Next best actions” cards; ordering is activation steps first, then high-impact tasks, capped at 5; progress copy matches activation steps (0/4 → Add app, 4/4 → on track).

## Keep Momentum
- Dashboard shows “Keep momentum this week” card with one recommended move and secondary “Not now”.
- CTA deep-links to the right page/anchor; skip hides the card for a week and emits keep_momentum_skip_week.
- If activation is incomplete, Keep Momentum still renders without stealing focus.
- Ops Activation Funnel reflects keep-momentum aggregates (views/clicks/skips) after interactions.

## Quick prod checks (v0.8.09)
- With one archived and one active application, Activation and Keep Momentum CTAs deep-link to the newest active app (outreach/overview anchors) without dead links.
- With zero applications, both cards surface a create-application CTA instead of empty/null states.
- Activation/Keep Momentum view and CTA logging is fire-and-forget, deduped (day/week), and never blocks navigation even when the log API fails.

## Quick prod checks (v0.8.10)
- Visit `/app/billing?portal_error=1&req=req_test&code=STRIPE_PORTAL` → premium portal error banner shows with retry link to /api/billing/portal?mode=navigation; dismiss works.
- Visit `/app/billing` normally → Billing status strip is present (subscription, credits, last action) with support snippet modal.
- Ops Incident Console → billing health callout appears; chips apply filters (portal/checkout/webhook or top code) without exposing URLs.

## Quick prod checks (v0.8.11)
- Ops user dossier `/app/ops/users/:id` → Billing triage card appears below Support actions; Refresh snapshot succeeds and shows Stripe/local status side-by-side.
- Billing triage next-step hints suggest focused billing link (with from=ops_support flags) and portal navigation; external Stripe links only appear when IDs exist.
- Ops Incident Console billing-related group shows “Open user billing triage” shortcut that deep-links to the dossier card.

## Quick prod checks (v0.8.12)
- Open `/app/billing` → status strip visible; Recent billing activity timeline renders with support snippet copy buttons.
- Add `?portal_error=1&req=req_test&code=STRIPE_PORTAL` → portal banner still shows with retry; credit delay card appears in “watching” state after checkout success logs in dev.
- Ops Incident Console → webhook/credit trace card shows ratios/counts; chips filter incidents without exposing URLs.

## Quick prod checks (v0.8.13)
- /app/billing shows webhook status badge + Billing timeline block with #billing-trace anchor; clicking Re-check status refreshes timeline/delay without navigation and shows ErrorBanner with requestId on failure.
- Copy billing trace snippet → masked snippet includes health + recent events without URLs; portal_error banner still works with requestId support snippet.
- Ops Incident Console shows webhook health callout (24h/7d counts + code chips) that filters incidents; Ops dossier Billing triage card shows recent billing timeline + “Open billing trace” deep link for support.

## Quick prod checks (v0.8.14)
- Simulate delayed credits (checkout success without webhook/ledger) and see delay bucket appear in Billing Trace correlation row with appropriate message.
- Click Re-check status → correlation row updates without navigation; unknown state offers support snippet copy.
- /app/billing still shows #billing-trace anchor + timeline; portal_error banner still works.
- Ops Incident Console shows delay bucket callout; chips filter incidents by bucket safely.

## Quick prod checks (v0.8.15)
- Spam Re-check on /app/billing until rate-limited → 429 handled gracefully; Re-check button shows cooldown/countdown and page stays usable.
- Force delayV2 scenario (or mock) → playbook card renders with premium guidance; copy support snippet works.
- From ops support billing link → “Open related incidents” deep-link applies filters without exposing URLs/emails.
- Ops dossier billing triage → “Open audits for request” works when requestId present.

## Quick prod checks (v0.8.16a)
- Open /app/billing: help prompt shows; Yes hides it; No reveals Copy support snippet + Try portal again link; dismiss (X) persists across reload for 7 days.
- Copy support snippet from prompt logs; portal retry link navigates via /api/billing/portal navigation.

## Ops support toolkit (ops/admin only)
- Confirm “Ops Console” appears in the app nav only for ops/admin/super_admin; clicking opens /app/ops.
- Non-ops user hitting /app/ops shows a 403-style Access denied page with reference/support snippet copy.
- Open /app/ops/users/<id> as an ops user; Support actions card renders.
- Apply a small credit adjustment (e.g., +5 goodwill) and see the new balance + audit entry.
- Generate support links (billing pack, app outreach focus, interview focus session) and copy/regenerate them (includes from=ops_support&support=1) — URL + timestamp stay visible even if logging/copy fails.
- If clipboard is blocked, manual copy hint appears but the link stays visible for copy/paste.
- Errors show ErrorBanner with request reference.
- Validate response JSON: support-link endpoint returns complete JSON and UI shows the URL.
  - Response ends with `}` and includes `from=ops_support&support=1` in the URL.
- Open generated support link for outreach focus → Applications page scrolls/highlights `#outreach` with a short offset.
- Open generated interview focus link (with or without appId) → Interview Focus Session anchor scrolls/highlights.
- Ops Command Centre: search by email or UUID, see results table, click “Open dossier” to load user page.
- Ops Audits: open /app/ops/audits, apply userId filter (from dossier link), see filtered entries; Export JSON/CSV downloads masked data.
- Correlation: from audits click requestId → /app/ops/incidents filtered; from incidents “View audits” → audits filtered by requestId; support bundle copies masked data.
- Incident Playbooks: filter incidents by requestId to trigger a playbook, click Open Billing deeplink, generate support link from playbook, copy customer reply template.
- Billing portal: “Manage in Stripe” / “Continue to Stripe” open Stripe portal via /api/billing/portal; if portal fails, it redirects back with portal_error=1&req=<id>&mode=navigation and Billing shows ErrorBanner with requestId + Try again link; portal attempts log billing_portal_* events.
- Ops Incidents: when multiple portal errors occur in window, Stripe portal failures callout appears; View audits link works.
- Non-ops access: /app/ops shows AccessDenied; /api/ops/users/search returns 403 JSON with requestId.
- Ops Activation Funnel: open /app/ops/activation as ops, toggle 7d/24h ranges, see counts for activation events after interacting with the Activation card; non-ops are blocked.
- Open generated support link with pack=starter → Billing scrolls to Packs section and highlights it.
- Open generated support link with plan=monthly_80 → Billing scrolls to Subscription section and highlights it.
- Support link with portal=1&flow=cancel... → Billing scrolls to portal-return (or subscription fallback) and highlights banner.
- Anchors exist: #compare, #portal-return, #subscription, #packs should all resolve when visiting /app/billing#anchor.
- With debug=1 in the support link, a small debug note briefly shows where the deeplink applied.
- Verify in Firefox: element top positions differ (packs vs subscription vs compare) and height > 0; pack link must not highlight compare.
- Pack-specific: pack=starter/pro/power scrolls/highlights the matching pack card; if missing, falls back to Packs section.

## Applications
- Create an application with job title, job description, and optional job URL.
- Edit the application and confirm changes persist.
- If a job URL is present, fetch the job advert and confirm the snapshot updates.

## Application detail tabs
- Open an application detail page and confirm the Overview tab shows the collapsible edit form, job advert card, and banner.
- Switch to the Apply tab and ensure Smart Apply plus Autopacks render without console errors; confirm the CTAs now include `?tab=apply`.
- Switch to Evidence, Interview, and Activity; verify the tab badges reflect outstanding gaps, practice priority, or due actions.
- Check the sticky “Next best actions” bar under the tabs: it shows up to three steps, deep links to the right tab/anchor, and remembers the collapsed state after refresh.
- Reload the page with `/app/applications/<id>?tab=interview` and confirm the requested tab stays active.
- Switch tabs, reload, and confirm the last selected tab is remembered per application (without a `tab` query param set).

## Role Fit and gap actions
- Open an application detail page and confirm Role Fit score and gaps render.
- Use a gap action to create or update an achievement and refresh the page.
- If a fetched snapshot exists, confirm Role Fit uses it.

## Evidence Engine
- Open Role Fit gaps and confirm suggested evidence appears for taxonomy gaps.
- Confirm each suggestion shows a quality score and uses fuzzy matching (e.g. runbooks/standards).
- Select an evidence item and refresh to see it listed as selected.
- Apply evidence to create a draft achievement and confirm it appears in Profile.
- Apply evidence to a STAR draft and confirm the draft contains the evidence line.
- If no match exists, use Create draft evidence or Insert clause into action.

## Interview Lift
- Log an activity and confirm Interview Lift suggestions appear.
- Create a STAR draft and confirm it persists after refresh.

## Interview Pack
- Open an application detail page and confirm the Interview Pack renders.
- Copy a STAR prompt and create a STAR draft from a question.
- Export the Interview Pack in Standard and ATS-Minimal variants.
- Toggle Practice Mode, score an answer, generate a rewrite, and confirm the draft persists after refresh.
- In the Interview tab, “Today’s Focus (15 mins)” shows three items, Open deep-links to the matching answer anchor, and Done/Undo persists for the week.
- Open the Practice Dashboard and start Drill Mode to practise the lowest-score question.
- In Drill Mode, generate the Answer Pack (90-second first) and confirm answers appear in an accordion with per-answer copy and copy-all; toggle to Standard and copy still works.

## Outreach
- In Activity tab, open Outreach panel (`#outreach`), copy a message, log sent, and schedule next follow-up; status badge updates.
- Mark “Reply received” and confirm outcome prompt; deep-link to activity log still works.
- Applications Command Centre → Outreach tab shows overdue/due soon follow-ups; Copy + log updates the row and “Open” deep-links to the outreach anchor.
- Add recruiter email/LinkedIn in Outreach panel, Save, then click Open Gmail to see mail prefilled; LinkedIn opens when set.
- Add a reply triage selection: Interested/Not now/Rejected/No response shows; quick outcome logging works; Next move CTA updates and matches command centre row.

## Ops
- Ops access blocked for non-whitelisted users (404).
- Whitelisted email can open `/app/ops` and search users by email to see billing snapshot.
- `/app/ops/users/:id` loads dossier with billing/apps/outreach/outcomes (read-only).

## STAR Library
- From the application detail page, create a STAR draft for a gap.
- Open the STAR draft editor and save edits.
- In Drill Mode, use the STAR draft paste action and confirm it updates the draft answer.

## Answer Pack
- In Drill Mode, generate a Standard answer and a 90-second answer.
- Copy each answer and apply one to the draft; confirm it persists after refresh.

## Application Kit
- Open an application detail page and confirm the Application Kit checklist renders.
- Download the Application Kit ZIP and confirm it contains CV, cover letter, interview pack, and STAR JSON.
- Check that kit.download activity appears in the activity log.

## Smart Apply
- Open an application detail page and confirm the Smart Apply header shows readiness plus “X of Y steps”.
- Check that the “Next 3 actions” strip lists deterministic actions and that each “Go” button adds the correct `?tab=` (and anchor) to the URL.
- Confirm the checklist is collapsed by default; expand it, refresh, and verify the collapsed/expanded state persists per application.
- Set a closing date and source platform and confirm they persist after refresh.
- Export CV/cover/interview pack and confirm checklist timestamps update.
- Mark as submitted and schedule a follow-up; verify next action due date updates and the follow-up link scrolls to the right anchor.
- In the Follow-up Autopilot strip, copy a template, click Log + schedule, and confirm an activity is created and `next_action_due` moves forward.
- Set an outcome (interview invite / rejected / offer) and confirm it shows on the Apply tab and pipeline badges.

## Pipeline Action Centre
- Visit /app/pipeline and open the Action Centre for a card.
- Log an activity and set a next action date.
- Download an ICS follow-up invite.

## Outreach Engine
- Open the Outreach section in the Action Centre.
- Copy an outreach template and log it as sent.
- Confirm next outreach date updates.

## DOCX import
- Upload a DOCX CV and confirm preview details render.
- Apply the import and confirm profile, achievements, and work history update.

## DOCX export
- Export Standard and ATS-Minimal CV and cover letter.
- Download the submission pack ZIP and confirm it contains CV, cover letter, and STAR JSON.

## Job Link Fetch resilience
- Provide an Indeed or LinkedIn job URL and confirm the fetch endpoint reports the source as blocked (instead of a scary HTTP error).
- When blocked, the Job advert card should show a calm notice plus “Open,” “Copy link,” and “Paste job text” buttons while disabling the Fetch/Refresh button.

## Outcome Loop
- On an application, open the Outcome Loop panel (Overview tab) and record an outcome with status + optional reason.
- Verify the recent outcomes list updates and an action snapshot shows counts (evidence/outreach/practice/exports/kit/follow-ups).
- Check pipeline cards show the outcome chip and that the “Hide lost” filter removes rejected/no response roles.
- Call /api/outcomes/insights (or refresh panel) and confirm “Not enough data” appears until at least three outcomes exist.

## Apply Kit Wizard
- Open an application detail page (Overview and Apply tabs) and confirm the Apply Kit Wizard shows all five steps.
- With missing job text, Step 1 blocks and deep-links to the Job advert section.
- Add evidence for 1–2 gaps; Step 2 updates to partial/ready after refresh.
- Create a STAR draft; Step 3 shows ready.
- Download the Application Kit ZIP from Step 4 (uses existing export route).
- Mark submitted and schedule follow-up from Step 5; verify status updates and next follow-up date is set.

## Insights Dashboard
- “This Week” card shows “Your next best actions to move applications forward” with sections: Do next (1), Up next (≤2), If you have time (≤2).
- No duplicate action types appear unless expanded; “Also needed for N other application(s)” toggles the extra items with working deep links.
- Buttons use action-specific labels (Select evidence / Draft STAR / Generate Autopack / Schedule follow-up / Start practice).
- Goal badge shows the total action count for the week.
- Mark done/Undo on each row dims the row without removing the CTA; completion state persists after reload.
- Completing all visible actions shows the “Week complete” state with Add one more step / Leave it there options.
- Weekly Review shows applications moved forward with an Examples dropdown linking into applications; logging outcomes inline updates the counts.
- Streak Saver: when eligible, clicking the CTA opens billing with `from=streak_saver&plan=...`; banner shows with logging, plan preselects, and checkout start/return logs fire.
- Subscription Intent tile shows when eligible; clicking a plan opens Billing with `from=intent_tile&plan=` preselected; dismiss hides it for the week.
- Subscription Home (active subs): shows “Your subscription this week” with credits used, moved-forward count, streak badge, and next best actions; save-offer card opens with switch/keep/continue options and portal links.
- Low activity nudge (active subs): when no completions/movement this week, Insights shows “Save your streak” with Do a quick step/Not today; dismissal sticks for the week.
- Portal return: returning from Stripe portal with `portal=1` shows “Welcome back” banner; Continue hides it, “I still want to cancel” reopens portal; inactive subs see a resubscribe prompt.
- Cancel save offer: returning with `portal=1&flow=cancel` shows “Before you go — keep your momentum” card; Keep going/Downgrade open portal; “Use top-ups instead” jumps to packs; dismiss hides for the week.
- Cancel reasons: after portal cancel return, reason picker appears; selecting a bucket logs once; Continue opens portal; refresh does not duplicate view log; pause hint link opens portal.
- Cancel deflection: clicking Continue to Stripe on cancel flow shows deflection modal with reason + recommended action; recommended CTA opens portal with flow=cancel_deflect; Continue bypasses; dismissal persists for the week.
- “This Week” card shows the current week range with 3–5 actions and “Do it” links.
- Clicking a “Do it” CTA deep-links to the expected tab/anchor for that application.
- Weekly targets on the card show follow-ups, practice, and applications without errors.
- Visit /app/insights and confirm “Today” lists up to five actions with Go links.
- Check funnel counters populate (drafted/submitted/interview/offer/rejected/no response).
- Ensure response rate shows a percentage or 0% when none.
- Behaviour insights should show text or “Not enough data yet.”
- Revenue funnel shows gate/billing/checkout/resume/autopack counts for 7d/30d or a calm empty state when no events.
- Trigger a credit gate, click through to billing, complete checkout, and resume; refresh Insights and confirm funnel counts increase accordingly.

## Coach Mode (Insights)
- Visit /app/insights and confirm Coach Mode shows weekly targets and a weakest-step card.
- Trigger a coach action (schedule follow-up or create STAR); confirm redirect and a coach banner on return.
- Coach actions should deep-link to the right tab/anchor when no mutation is needed (Apply Kit Wizard).
- Weekly targets reset each week; counts update after logging activities.

## Billing and credits
- Billing availability is server-derived: packs/subscriptions are enabled when env vars are present; no “pack unavailable” due to client env gaps.
- Billing shows Monthly 30 and Monthly 80 with one marked Recommended; switching plans updates the subscription CTA/compare, and unavailable plans disable with inline copy.
- With an active subscription, Billing shows the current plan plus Upgrade/Downgrade buttons that open the Stripe portal; portal failures show retry/dismiss and returning with `?portal=1` shows a neutral banner.
- After checkout success/cancel/failure, return banner shows premium copy (Payment confirmed / Checkout cancelled / Checkout didn’t complete) with Resume/Try again/Retry + Dismiss/Help and a countdown when resume=1.
- If a checkout redirect is blocked, a helper appears with “Try again” and “Open billing” buttons that restart checkout.
- Returning with resume shows a completion nudge at the target anchor; if unfinished for ~90s, recovery ping appears with Continue/Dismiss/Mark done and auto-hides after completion.
- Visit /app/billing and confirm balance plus pack selector (Starter/Pro/Power) render.
- Start checkout for any pack; on return with `?purchased=1`, a success banner shows.
- If checkout URL fails to open, inline banner appears with retry/help/dismiss and retry works.
- Recent credit activity renders without errors.
- Start a subscription from /app/billing and ensure you are redirected to Stripe; manage portal link works when a customer exists.
- Subscription CTA disables with helper text if the plan env var is missing and logs `billing_plan_unavailable`.
- Subscription checkout opens Stripe; return still lands on /app/billing.
- Forcing a failed subscription checkout shows an inline banner with retry/dismiss.
- In credit gates (Autopack/Interview Pack/Application Kit/Answer Pack), the subscription nudge appears when recommended, includes plan selection, and starts subscription checkout with the same return link.
- Billing and gate modals show the Top up vs Subscribe comparison card; recommended column is highlighted and CTAs start the correct checkout flows.
- Credit gate modal shows action name + ROI line; referral hint links to the billing referral anchor.
- Returning with a pending action and `resume=1` shows the Resume Accelerator banner with a 3s countdown and auto-jump to the saved tab/anchor; manual Resume still works and logging stays clean.
- Billing page shows only one primary purchase hero; alternate packs are secondary and the balance/usage row has no duplicate pack selector.
- After checkout success with a pending action, the Resume Accelerator banner appears with neutral copy; Resume returns to the correct tab/anchor and hides after use or dismiss.
- Success banner also appears on the application/drill pages when returning from billing; session guard prevents repeat spam; completion nudge appears after the resumed action finishes with a CTA to the next best step and auto-dismisses after a short time.
- If the resumed action is not completed within ~90s, completion watchdog nudge appears with Take me back/Mark as done/Dismiss and logs interactions.
- Subscription checkout return shows “Subscription active — resuming…” banner, auto-redirects with `resume=1`, and the completion nudge behaves the same as top-ups.

## Referrals
- Fetch your referral link on /app/billing; copy and share.
- New user signup with `?ref=` shows +3 credits; inviter receives +3 credits.
- Redeeming twice with same invitee does not double-grant credits; self-referral is blocked.

## First Job Win onboarding
- Visit /app/insights and confirm the First Job Win panel shows five steps with statuses.
- With zero data, it should offer “Create a sample application.”
- After adding achievements/work history/applications, progress updates and links deep-link to the correct tab/anchor (profile, new application, Apply Kit Wizard).

## Landing page
- Visit / (marketing landing) and confirm hero, how-it-works, product tour, pricing teaser, FAQ, and Optional AI Boost sections render cleanly.
- “See how it works” scrolls to the section; primary CTA goes to signup (or application create when signed in); pricing CTA deep-links to billing/signup.

## Dashboard v2
- Visit /app after login: header shows credits and a Continue/Create CTA.
- Next best actions list up to five items with Go links to the correct application tab/anchor.
- Active applications shows recent roles with status and next action; Continue links to Apply tab anchor.
- Coach nudge renders weakest step or “on track” with a Fix button.
- Funnel snapshot shows counts or 0s and links to Insights.

## Paywall + resume (credits)
- Attempt Interview Pack export with 0 credits → billing CTA; after purchase and return with `resume=1`, auto-resume kicks off the export without manual clicks.
- Attempt Application Kit download with 0 credits → billing CTA; after purchase and return with `resume=1`, auto-resume starts the kit download.
- Attempt Answer Pack generation in Drill Mode with 0 credits → billing CTA; after purchase and return with `resume=1`, auto-resume triggers generation.
- With credits available, soft gate/modal appears (or proceeds) and the action succeeds.
- Credits idle: when credits > 0 and a paid action is ready, dashboard/command centre shows a nudge; Go deep-links correctly and dismiss hides it.

## Outcome Loop v2 (v0.7.73)
- Weekly Review card: click “Log outcomes” → quick log opens, save succeeds without full refresh, and outcomes count updates.
- Outreach panel: when triage shows reply/rejection, quick log appears; save logs success and next move updates.
- Application Overview Outcome panel: quick log saves outcome (status/reason/note) and shows success toast; insights show top reasons + recommended links.

## Interview Focus Session (v0.7.74)
- On Interview tab, the Focus Session card shows Do now/Up next/If time lanes with 5–7 questions.
- Mark items ready/undo; progress updates and persists per week/application; copy-all works and opens Answer Pack link.
- Session complete state appears after all ready; logging remains non-blocking.

## Outreach Engine v4 (v0.7.75)
- Outreach panel shows Polite/Direct/Warm variants with quality chips; switching variants persists and updates message.
- Copy/Open Gmail/LinkedIn use the selected variant; send works when contact present and logs events.
- Insights “Outreach performance” tile shows 14d reply rate and tip; Command Centre Outreach tab shows same summary.

## Offer & Negotiation Pack (v0.7.76)
- Log an offer outcome or click “I’ve received an offer” → Offer Pack appears on Overview (#offer-pack).
- Fill offer fields, Save, reload → details persist locally; completeness updates.
- Set counter, copy negotiation scripts (email/LinkedIn/phone) and decision templates; next-best actions include offer tasks.

## Offer Decision Loop (v0.7.77)
- Decision block shows (negotiating/accepted/declined/asked for time); save persists + auto logs outcome.
- Refresh retains decision; next-best actions reflect decision (counter/follow-up/close others).
- Accepted decision shows “Close other applications” templates; copy email/LinkedIn buttons work and log.

## Offer Close-Out Loop (v0.7.79)
- Accept an offer → close-out panel appears under Offer Pack (not for the accepted app itself).
- Select other apps → Mark closed logs outcomes; retry shows on failure and logged state persists.
- Withdrawal templates (warm/direct/short) send via Gmail/LinkedIn/Copy; Add contact path works.
- Refresh keeps dismissal/completion via local storage (week/app scoped).

## Outreach Autopilot (v0.7.80)
- Dashboard and Applications Command Centre show “Follow-ups due” strip (overdue first, max 7).
- Send + log opens modal with variant copy + Gmail/LinkedIn/Copy; contact missing path deep-links to outreach.
- Log + schedule updates strip optimistically; recovery badge appears for ≥72h overdue and preselects warm copy.

## Observability (v0.7.81)
- Trigger a checkout start failure (invalid mode/unavailable pack) and confirm the error banner shows a Reference ID and copyable support snippet.
- Trigger a portal open failure; banner shows Reference ID and retry/dismiss.
- Force an outcome/contact save failure and confirm the Reference ID surfaces for support handoff.

## Ops Incident Console (v0.7.82)
- Visit /app/ops/incidents as an ops user; non-ops gets 404.
- Paste a known Reference ID from checkout/portal failure; incident detail shows surface/code/message and copyable support snippet.
- Recent incidents feed shows last items with reference copy; filters by surface/time apply.

## Billing Compare (v0.7.83)
- Open /app/billing and see “Choose the best option for you” with Subscription and Top-up cards.
- Recommended badge appears with one-line reason; “Why this?” shows bullets.
- Click recommended CTA → checkout/portal starts; switching options logs and starts the other path.

## Observability coverage (v0.7.84)
- Trigger a checkout failure (missing price/mode) → ErrorBanner shows Reference + support snippet; response header x-request-id is set.
- Trigger portal open failure → Reference visible; snippet copies.
- Force outcome/contact save failure → banner shows standard message + requestId for support.

## Ops Incident Console v2 (v0.7.85)
- Open /app/ops/incidents as ops: feed shows grouped incidents with counts and filters (time/surface/code/flow/high impact).
- Expand a group to see individual events and copy requestIds/snippets; related timeline shows nearby events.
- RequestId lookup shows details + related timeline; export CSV/JSON works and omits secrets (masked users).

## Applications Command Centre (v0.7.43)
- /app/applications shows Queue with next-action CTA and readiness 0–5.
- Tabs filter between Queue/Drafts/Submitted/Interview/Closed.
- Search finds job title/company and preserves filters.
- CTA deep-links into application detail tab + anchor (Apply/Evidence/Interview/Activity).

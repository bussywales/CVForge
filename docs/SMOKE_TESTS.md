# Smoke tests

## Login
- Request a magic link from /login.
- Confirm redirect to /app after /auth/callback.

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
- Open the Practice Dashboard and start Drill Mode to practise the lowest-score question.
- In Drill Mode, generate the Answer Pack (90-second first) and confirm answers appear in an accordion with per-answer copy and copy-all; toggle to Standard and copy still works.

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
- Visit /app/billing and confirm balance plus pack selector (Starter/Pro/Power) render.
- Start checkout for any pack; on return with `?purchased=1`, a success banner shows.
- Recent credit activity renders without errors.
- Start a subscription from /app/billing and ensure you are redirected to Stripe; manage portal link works when a customer exists.
- Recommended pack shows with reasons; pack selector defaults to the recommended pack.
- Credit gate modal shows action name + ROI line; referral hint links to the billing referral anchor.
- After checkout return with a pending action, resume banner shows and resumes on click; logging does not error.
- Billing page shows only one primary purchase hero; alternate packs are secondary and the balance/usage row has no duplicate pack selector.
- After checkout success with a pending action, a “Top up successful — resume” banner appears; Resume returns to the correct tab/anchor; dismiss hides it until the next purchase.
- Success banner also appears on the application/drill pages when returning from billing; session guard prevents repeat spam; completion nudge appears after the resumed action finishes with a CTA to the next best step.

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
- Attempt Interview Pack export with 0 credits → billing CTA; after purchase, resume banner appears and export works.
- Attempt Application Kit download with 0 credits → billing CTA; after purchase, resume banner resumes the download.
- Attempt Answer Pack generation in Drill Mode with 0 credits → billing CTA; after purchase, resume banner resumes generation.
- With credits available, soft gate/modal appears (or proceeds) and the action succeeds.

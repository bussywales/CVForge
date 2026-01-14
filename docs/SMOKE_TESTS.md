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
- Open an application detail page and confirm Smart Apply renders with checklist items.
- Set a closing date and source platform and confirm they persist after refresh.
- Export CV/cover/interview pack and confirm checklist timestamps update.
- Mark as submitted and schedule a follow-up; verify next action due date updates.

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

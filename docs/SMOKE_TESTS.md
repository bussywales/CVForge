# Smoke tests

## Login
- Request a magic link from /login.
- Confirm redirect to /app after /auth/callback.

## Applications
- Create an application with job title, job description, and optional job URL.
- Edit the application and confirm changes persist.
- If a job URL is present, fetch the job advert and confirm the snapshot updates.

## Role Fit and gap actions
- Open an application detail page and confirm Role Fit score and gaps render.
- Use a gap action to create or update an achievement and refresh the page.
- If a fetched snapshot exists, confirm Role Fit uses it.

## Interview Lift
- Log an activity and confirm Interview Lift suggestions appear.
- Create a STAR draft and confirm it persists after refresh.

## Interview Pack
- Open an application detail page and confirm the Interview Pack renders.
- Copy a STAR prompt and create a STAR draft from a question.
- Export the Interview Pack in Standard and ATS-Minimal variants.
- Toggle Practice Mode, score an answer, generate a rewrite, and confirm the draft persists after refresh.
- Open the Practice Dashboard and start Drill Mode to practise the lowest-score question.

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

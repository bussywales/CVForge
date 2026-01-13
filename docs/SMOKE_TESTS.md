# Smoke tests

## Login
- Request a magic link from /login.
- Confirm redirect to /app after /auth/callback.

## Applications
- Create an application with job title, job description, and optional job URL.
- Edit the application and confirm changes persist.

## Role Fit and gap actions
- Open an application detail page and confirm Role Fit score and gaps render.
- Use a gap action to create or update an achievement and refresh the page.

## Interview Lift
- Log an activity and confirm Interview Lift suggestions appear.
- Create a STAR draft and confirm it persists after refresh.

## Interview Pack
- Open an application detail page and confirm the Interview Pack renders.
- Copy a STAR prompt and create a STAR draft from a question.
- Export the Interview Pack in Standard and ATS-Minimal variants.
- Toggle Practice Mode, score an answer, generate a rewrite, and confirm the draft persists after refresh.
- Open the Practice Dashboard and start Drill Mode to practise the lowest-score question.

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

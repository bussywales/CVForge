# CVForge User Guide v1

## A. What CVForge is
CVForge is your mission control for modern job hunting: a secured workspace that stores applications, tracks outreach, scores your evidence against job descriptions, and builds tailored submission artifacts (CVs, cover letters, interview prompts) without AI hallucinations. It combines deterministic role-fit scoring, a guided evidence engine, and practice tools so every application feels intentional.

## B. 10-minute quick start
1. **Create or select an application** on `/app/applications`. Add the job title, company, and any job advert link or pasted description.
2. **Add the job advert** by pasting text into the job description or entering a URL. If Indeed/LinkedIn blocks the fetch, the Job advert card now says “Open & paste” instead — just copy the text manually and paste it.
3. **Fetch/refresh the advert** when possible; the fetched snapshot powers the Role Fit score and autopack generator. Blocks show a calm notice; click “Paste job text” to jump to the textarea.
4. **Visit the Evidence tab**, review Role Fit gaps, select matching evidence, and toggle where it should be used (CV, cover, STAR) via the targets.
5. **Generate an Autopack** on the Apply tab; it produces ATS-minimal CV + cover letter + STAR JSON ready for export.
6. **Use Smart Apply** to monitor the readiness checklist, download the Application Kit ZIP, and mark exports/submissions as done.
7. **Practice on the Interview tab**: open the Practice Dashboard, drill your weakest questions, and use the Answer Pack/STAR Library drafts to build responses.
8. **Log Activity in Activity tab**: record calls, follow-ups, interviews. Set the next action due date for reminders and ICS download if needed.
9. **Schedule outreach** from the Action Centre (pipeline) and copy the deterministic templates for email or LinkedIn notes.
10. **Export artifacts** from Apply → Smart Apply or Application Kit: choose ATS-minimal for submission and Standard for human readers.

## C. The Application Detail Tabs
- **Overview**: Quick access to edit details, view job adverts, and refresh fetches (with blocked sources showing an “open & paste” prompt).
- **Apply**: Smart Apply checklist, readiness score, automation-friendly CTAs, Autopack list, and the Application Kit download with `?tab=apply` links.
- **Evidence**: Role Fit score, gap suggestions, selected evidence with CV/cover/STAR toggles, and the STAR Library panel for evidence-driven drafts.
- **Interview**: Interview Lift recommendations, Interview Pack + Practice Dashboard link, Drill Mode access, and Answer Pack previews.
- **Activity**: Tracking panel, follow-up templates, activity log, and next-action badges that update the Activity tab badge.
- **Admin/Debug**: Danger zone features (delete application) and low-frequency settings kept safely isolated.

## D. Core workflows
1. **Evidence → Autopack precision**: Select evidence per gap, assign targets, regenerate an autopack, and use the evidence trace panel to see what made it into the CV/cover/STAR.
2. **Role Fit gaps → apply evidence**: Pick a gap, select matching evidence, choose CV/cover/STAR toggles, copy the snippet, or push it into a STAR draft or new achievement.
3. **STAR Library → Practice → Answer Pack**: Create per-gap STAR drafts, practise in Drill Mode, paste the draft into your answer, then generate Standard + 90-second answers to copy/apply back into Practice.
4. **Outreach Engine**: Copy deterministic outreach templates, log them as sent, and schedule the next follow-up from the Activity tab (or pipeline Action Centre).
5. **Smart Apply**: Keep metrics discipline (≤120 chars), use ATS-minimal exports, mark exports as done, download the kit ZIP, and mark “submitted” to close an application.

## E. Handling common issues
- **Job fetch blocked (Indeed/LinkedIn)**: Those sites block bots. Open the advert in your browser, copy the description, paste it into the job description, and rely on the manual text. Fetched snapshots from other sites remain preferred.
- **“No matching evidence found”**: Add achievements, work history bullets, or metrics that mention the gap keywords/aliases (the Evidence Engine uses fuzzy matching). Re-run Role Fit to surface new suggestions.
- **STAR draft button disabled**: Select a STAR-targeted evidence item first (the Thumbs indicator) before invoking STAR Library actions.
- **Exports show placeholders**: Fix placeholders in profile, achievements, work history, or the pasted job description before regenerating the autopack.

## F. Best practices
- Keep **metrics ≤120 characters** and anchored in measurable improvements (percentages, time saved, scale).
- Write **atomic achievements** so they can be reused across applications.
- Use **work history bullets** for long-tenured roles and **achievements** for project/impact highlights.
- Default to **ATS-minimal exports** when submitting; use Standard for recruiter/home review.

## G. Privacy & data handling
- CVForge stores applications, job advert snapshots, evidence selections, practice answers, and linked activities; it does not auto-send emails or store raw HTML beyond sanitized snapshots.
- Opt-in JD learning (if enabled) only captures anonymised terms; your practice answers and STAR drafts stay tied to your account.

## H. Appendix
- **Glossary**: [See the glossary](GLOSSARY.md) for fast definitions.
- **Other docs**: Explore [docs/INDEX.md](INDEX.md) for architecture, roadmap, APIs, release process, and smoke tests.

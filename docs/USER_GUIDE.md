# CVForge User Guide v1.1

## Table of Contents
- [A. What CVForge is](#a-what-cvforge-is)
- [B. Core daily flow (10-minute quick start)](#b-core-daily-flow-10-minute-quick-start)
- [C. By-tab workflows](#c-by-tab-workflows)
- [D. Common issues and how to recover](#d-common-issues-and-how-to-recover)
- [E. Best practices](#e-best-practices)
- [F. Recommended default settings](#f-recommended-default-settings)
- [G. Privacy & data handling](#g-privacy--data-handling)
- [H. Appendix](#h-appendix)

## A. What CVForge is
CVForge is your deterministic job-application cockpit. It keeps applications, job adverts, evidence, outreach, submissions, and practice workflows in one place, without any AI wizardry except where explicitly called out (Rewrite Coach, Answer Pack). You get traceable Role Fit scoring, guided evidence selection, interview preparation, and submission-grade outputs plus paperwork-ready reporting.

## B. Core daily flow (10-minute quick start)
1. **Create/select an application** at `/app/applications`, then update the role details. The Overview tab gives the edit form, job advert card, and blocked-source notice if needed.
2. **Bring the job advert in**: paste the JD text or link it. If LinkedIn/Indeed blocks the fetch, the Job advert card will prompt “Open & paste” and disable the fetch button.
3. **Refresh the advert** whenever possible. A successful fetch feeds the Role Fit score and autopacks; blocked responses stay calm and push you to paste manually.
4. **Go to the Evidence tab**: Role Fit highlights gaps, evidence suggestions appear with quality badges, and you can toggle each selection for CV, cover letter, or STAR output.
5. **Generate an Autopack** from the Apply tab to get ATS-minimal CV + cover letter + STAR JSON; the Smart Apply checklist tracks readiness.
6. **Use Smart Apply**: mark exports (CV, cover, interview pack), download the Application Kit ZIP, and schedule/mark follow-ups directly from the Apply tab.
7. **Visit Interview tab**: practise on the Practice Dashboard, open Drill Mode for top gaps, and generate Answer Pack variants (Standard + 90-second).
8. **Log everything in Activity**: record emails/calls, set next_action_due, and use pipeline outreach templates for deterministic follow-ups.
9. **Export artifacts**: Standard for recruiter review, ATS-minimal for submission, and the ZIP to package CV + cover + interview pack + STAR drafts.
10. **Close applications** when done by marking “Submitted” in Smart Apply and continuing to log follow-ups.
**Next best action:** Refresh blocked adverts manually, select evidence, generate an autopack, and mark the Smart Apply checklist item to keep momentum.

## C. By-tab workflows
- **Overview**: edit the job description, monitor job-fetch status (with friendly blocked-state copy), and jump into the edit form via the collapsible header.
  - Next best action: keep the job URL/current description refreshed so Role Fit and autopacks have accurate input.
- **Apply**: Smart Apply checklist, CV/Cover exports, Autopack list, and Application Kit download. CTAs deep-link via `?tab=apply`.
  - Next best action: export the ATS-minimal CV + cover, download the ZIP, and update the checklist.
- **Evidence**: Role Fit score, gap-by-gap evidence suggestions, selected evidence targets, and the STAR Library panel for per-gap drafts.
  - Next best action: select at least one evidence item per gap and toggle CV/cover/STAR, then review the STAR Library entry.
- **Interview**: Interview Lift prompts, Interview Pack + Practice Dashboard, Drill Mode, and Answer Pack generation with Standard/90-second variants.
  - Next best action: practise your weakest question, apply the Answer Pack into Practice, and refresh with the STAR draft you edited.
- **Activity**: Tracking panel, follow-up templates/ICS, activity log, and due-action badges tied to the Activity tab.
  - Next best action: log the latest touchpoint and set the next action due + outreach stage if needed.
- **Admin/Debug**: delete an application or inspect low-use controls without cluttering the main experience.
  - Next best action: keep Admin/Debug clean; delete only when you are certain the application is archived.

## D. Common issues and how to recover
- **Job fetch blocked (Indeed/LinkedIn)**: These domains block automated requests. Open the advert manually, paste the text into the job description, and rely on the pasted snapshot. You can still select evidence and generate autopacks from the manual text.
- **“No matching evidence found”**: Add new achievements or work-history bullets that mention the gap keywords/aliases, include metrics, and rerun Role Fit. The Evidence Engine uses fuzzy matching to find them quickly.
- **STAR draft button disabled**: Select a STAR-targeted evidence item (the dropdown shows “STAR” icon) before opening the STAR Library; drafts require evidence to anchor them.
- **Exports show placeholders**: Edit profile/achievements/work history or the pasted JD to remove `[TBD]` tokens, rerun the autopack, and regenerate the export.
**Next best action:** When any issue surfaces, look for the “Fix it” hint (e.g., schedule manual paste, add evidence, refresh autopack) and take that task before moving on.

## E. Best practices
- Keep **metrics ≤120 characters** and include numbers, percentages, or time-to-impact language.
- Write **atomic achievements** so they can be reused and matched with multiple gaps.
- Use **work history bullets** for operational duties; use **achievements** for project/impact stories.
- Default to **ATS-minimal exports** for submissions and Standard when you need a richer formatting for humans.
**Next best action:** Review your metrics and make sure each evidence selection has a measurable context.

## F. Recommended default settings
- Export variant: **ATS-minimal** for applications; switch to Standard when reviewing with humans.
- Metrics helper: keep your metrics entries capped at 120 characters; the metrics helper modal enforces this.
- Evidence targets: start with CV and cover toggles enabled and activate STAR only when drafting stories.
**Next best action:** Revisit these defaults every few applications to ensure consistency.

## G. Privacy & data handling
- CVForge stores applications, job advert snapshots, evidence selections, practice answers, STAR drafts, and activity logs; it does not auto-send emails or store raw HTML beyond sanitized snapshots.
- Opt-in JD learning (if enabled) only captures anonymised terms; your practice answers and STAR drafts remain tied to your account.
**Next best action:** Review the privacy section if you change teams or workspace ownership.

## H. Appendix
- **Glossary:** [Definitions and terms](GLOSSARY.md).
- **Other docs:** [See docs/INDEX.md](INDEX.md) for architecture, APIs, roadmap, runbooks, smoke tests, and release process.

---
description: Update PROGRESS.md to reflect the session's meaningful changes
---

Update `PROGRESS.md` with the changes made in this session. Standing rule (from `memories/feedback_progress_md.md`): meaningful changes update the doc proactively — do not ask first.

Steps:

1. **List what changed.** Run `git status` and `git diff --stat` to enumerate touched files and the scope of edits.

2. **Decide what's meaningful.** Update PROGRESS.md for:
   - Bug fixes that change behaviour
   - Parametric / invariant changes
   - New helpers, removed constants
   - Architecture moves
   - Anything a future maintainer needs to know about

   Skip:
   - Pure typo / whitespace / comment-only edits
   - Reverted experiments

3. **Edit PROGRESS.md.** Update:
   - The date stamp at the top
   - The "Branch" line if the commit head has moved
   - The relevant per-step "What's Done" bullets
   - The "What's Next" priorities if any moved up / down or closed
   - The "Known Issues" table — strike through anything resolved this session, add anything newly surfaced

4. **Cross-check** that PROGRESS.md and the matching `CLAUDE.md` files don't disagree. If they do, the PROGRESS.md update is authoritative — but flag it so the matching `CLAUDE.md` can be updated next.

5. **One-line summary** of what PROGRESS.md now says.

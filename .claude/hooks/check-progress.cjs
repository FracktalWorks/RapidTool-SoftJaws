#!/usr/bin/env node
/**
 * Stop hook — non-blocking reminder.
 *
 * Fires when Claude finishes responding. If meaningful source files changed
 * this session but PROGRESS.md did not, emit a one-line reminder. The
 * standing rule (memories/feedback_progress_md.md): meaningful edits update
 * PROGRESS.md proactively.
 *
 * Non-blocking on purpose:
 *   - exit 0 + stdout → notice shown to user/agent without re-prompting
 *   - mid-task turns (still working, not done yet) aren't disrupted
 *   - if the changes were pure typos or comments, the agent can ignore
 *
 * Skips silently when git isn't initialised or `PROGRESS.md` doesn't exist.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(function main() {
  // No-op if PROGRESS.md doesn't exist in this repo.
  if (!fs.existsSync(path.join(process.cwd(), 'PROGRESS.md'))) return;

  let status = '';
  try {
    status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return; // Not a git repo or git unavailable — silent skip.
  }

  const lines = status.split('\n').filter(Boolean);

  // Count files that are likely "meaningful" edits and exclude PROGRESS.md itself.
  const meaningful = lines.filter((line) => {
    const filePath = line.slice(3); // strip the two-char status flag + space
    return /\.(ts|tsx|js|jsx|md|json|css)$/i.test(filePath)
        && !filePath.endsWith('PROGRESS.md');
  });
  const progressTouched = lines.some((line) => line.includes('PROGRESS.md'));

  if (meaningful.length > 0 && !progressTouched) {
    console.log(
      `ℹ Reminder: ${meaningful.length} file(s) changed this session, ` +
      `PROGRESS.md was not updated. If the edits were meaningful, please ` +
      `update PROGRESS.md per the standing rule.`
    );
  }
})();

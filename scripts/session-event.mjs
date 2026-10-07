#!/usr/bin/env node
// Claude Code hook handler (.claude/settings.json): appends this session's
// lifecycle event to the shared log that `npm run sessions` reads.
//
// Hooks run on every prompt and every turn of every session, so this script
// must stay invisible: it prints nothing (SessionStart and UserPromptSubmit
// output would land in the model's context), swallows every error, and
// always exits 0.
import { readFileSync } from 'node:fs';
import { appendEvent } from './session-io.mjs';
import { clip } from './session-lib.mjs';

/** The one field worth keeping from each hook's input. */
function detailOf(input) {
  switch (input.hook_event_name) {
    case 'Notification':
      return input.message;
    case 'SessionStart':
      return input.source;
    case 'SessionEnd':
      return input.reason;
    case 'UserPromptSubmit':
      return clip(input.prompt, 80);
    default:
      return '';
  }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.hook_event_name) {
    appendEvent(input.cwd || process.cwd(), {
      event: input.hook_event_name,
      session: input.session_id,
      detail: clip(detailOf(input)),
    });
  }
} catch {
  // Not in a git repo, no stdin, log not writable: the session matters more than the log.
}
process.exit(0);

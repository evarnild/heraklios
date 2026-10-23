#!/usr/bin/env node
// `npm run orchestrator [-- --port <n>]` (§52, spec B1): the local page that
// lists the intents and worktrees, spawns, launches headless Claude Code
// sessions, records gates on the owner's click and ships. It runs from the
// main checkout, on main, like `npm run ship`, and listens on 127.0.0.1 only.
// The logic is in orchestrator-lib.mjs, state.mjs, server.mjs and
// sdk-sessions.mjs; this file only wires the real seams together.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, mainCheckout } from '../../scripts/session-io.mjs';
import { realFs, realRunner, serve } from './node-io.mjs';
import { parseCliArgs } from './orchestrator-lib.mjs';
import { createSessionManager } from './sdk-sessions.mjs';
import { createHandler } from './server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

function fail(message) {
  console.error(`orchestrator: ${message}`);
  process.exit(1);
}

async function loadSessions() {
  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    return createSessionManager({ query });
  } catch (e) {
    console.error(`orchestrator: the Agent SDK is not installed (${e.message}); sessions are off. Run npm ci.`);
    return null;
  }
}

async function main() {
  let args;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (e) {
    return fail(e.message);
  }
  const mainPath = mainCheckout(root).replace(/\\/g, '/');
  if (mainPath.toLowerCase() !== root.replace(/\\/g, '/').toLowerCase()) fail(`run it from the main checkout (${mainPath}), not a worktree.`);
  const branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') fail(`the main checkout is on "${branch}", not main.`);

  const sessions = await loadSessions();
  const handler = createHandler({
    runner: realRunner,
    fs: realFs,
    sessions,
    root,
    port: args.port,
    publicDir: resolve(here, 'public'),
  });
  const server = await serve(handler, args.port).catch((e) => fail(`cannot listen on 127.0.0.1:${args.port}: ${e.message}`));
  console.log(`Orchestrator: http://127.0.0.1:${args.port}/  (main checkout ${root})`);

  const shutdown = () => {
    sessions?.stopAll();
    server.close();
    setTimeout(() => process.exit(0), 300).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();

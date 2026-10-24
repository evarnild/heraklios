// Headless Claude Code sessions for the orchestrator (spec §52 B5, B6, B11),
// through the Agent SDK's `query()`, which is injected so the tests drive a
// fake. A session streams into an in-memory transcript (spec B12: nothing is
// stored on disk), and every permission prompt or question parks until the
// owner answers it from the page. Nothing here ever allows by itself: no
// timeout, no default, and a stop or a shutdown denies whatever is pending.
//
// SDK 0.3.309 (read from its sdk.d.ts): `query({prompt, options})` returns an
// async iterable with `interrupt()`; `options.canUseTool(tool, input, {signal})`
// returns `{behavior:'allow', updatedInput?}` or `{behavior:'deny', message}`;
// `settingSources` is left unset so the project's CLAUDE.md, skills and hooks
// load as in a terminal; AskUserQuestion arrives through `canUseTool` and is
// answered by `updatedInput` carrying `answers` (question text -> answer).

const MAX_TEXT = 20000;
const MAX_ITEMS = 2000;
const LIVE_STATES = new Set(['running', 'needs you']);

const clip = (text) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n[clipped]` : text);

function stringify(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function blockItem(block) {
  if (block.type === 'text') return { kind: 'text', text: block.text };
  if (block.type === 'tool_use') return { kind: 'tool_use', text: `${block.name} ${stringify(block.input)}` };
  if (block.type === 'tool_result') return { kind: 'tool_result', text: stringify(block.content) };
  return null;
}

/** The transcript lines one SDK message adds: assistant text and tool calls, tool results, the final result. */
export function describeMessage(message) {
  if (!message || typeof message !== 'object') return [];
  if (message.type === 'result') {
    const text = typeof message.result === 'string' ? message.result : (message.subtype ?? 'result');
    return [{ kind: 'result', text, isError: Boolean(message.is_error) }];
  }
  if (message.type !== 'assistant' && message.type !== 'user') return [];
  const content = message.message?.content;
  if (typeof content === 'string') return [{ kind: message.type === 'user' ? 'user' : 'text', text: content }];
  if (!Array.isArray(content)) return [];
  return content.map(blockItem).filter(Boolean);
}

/** `{behavior:'allow'|'deny', ...}` for the SDK from the page's answer; only AskUserQuestion may change the input. */
export function toPermissionResult(pending, answer) {
  if (answer.behavior === 'deny') {
    return { behavior: 'deny', message: answer.message || 'Denied by the owner' };
  }
  if (pending.tool !== 'AskUserQuestion') return { behavior: 'allow', updatedInput: pending.input };
  const given = answer.updatedInput ?? {};
  return {
    behavior: 'allow',
    updatedInput: { ...pending.input, answers: given.answers ?? {}, ...(given.annotations ? { annotations: given.annotations } : {}) },
  };
}

function emit(s, item) {
  const entry = { seq: s.transcript.length ? s.transcript.at(-1).seq + 1 : 1, at: s.now(), ...item };
  if (typeof entry.text === 'string') entry.text = clip(entry.text);
  s.transcript.push(entry);
  if (s.transcript.length > MAX_ITEMS) s.transcript.shift();
  for (const send of s.subscribers) send(entry);
}

function setState(s, state) {
  if (s.state === state) return;
  s.state = state;
  emit(s, { kind: 'state', state });
}

function denyAll(s, message) {
  for (const [rid, p] of s.pending) {
    p.resolve({ behavior: 'deny', message, interrupt: true });
    s.pending.delete(rid);
    emit(s, { kind: 'answered', requestId: rid, behavior: 'deny' });
  }
}

/** The promise `canUseTool` returns: it settles only on the owner's answer, a stop, or the SDK aborting the call. */
function park(s, tool, input, signal) {
  return new Promise((resolve) => {
    const rid = `r${s.nextRequest++}`;
    s.pending.set(rid, { tool, input, resolve });
    emit(s, { kind: 'pending', requestId: rid, tool, question: tool === 'AskUserQuestion', input });
    if (s.state === 'running') setState(s, 'needs you');
    signal?.addEventListener('abort', () => {
      const p = s.pending.get(rid);
      if (!p) return;
      s.pending.delete(rid);
      p.resolve({ behavior: 'deny', message: 'Aborted' });
      emit(s, { kind: 'answered', requestId: rid, behavior: 'deny' });
      // Nothing left to answer: the session is working again, as after answer() (review F14).
      if (!s.pending.size && s.state === 'needs you') setState(s, 'running');
    });
  });
}

async function pump(s) {
  try {
    for await (const message of s.query) {
      for (const item of describeMessage(message)) emit(s, item);
    }
    if (LIVE_STATES.has(s.state)) setState(s, 'done');
  } catch (e) {
    if (s.state !== 'stopped') {
      emit(s, { kind: 'error', text: e instanceof Error ? e.message : String(e) });
      setState(s, 'error');
    }
  } finally {
    denyAll(s, 'The session ended');
  }
}

function summary(s) {
  return {
    sid: s.sid,
    role: s.role,
    intent: s.intent,
    cwd: s.cwd,
    state: s.state,
    startedAt: s.startedAt,
    pending: [...s.pending].map(([requestId, p]) => ({ requestId, tool: p.tool, question: p.tool === 'AskUserQuestion', input: p.input })),
  };
}

function interruptQuietly(s) {
  try {
    Promise.resolve(s.query?.interrupt?.()).catch(() => {});
  } catch {
    // an interrupt that throws must not stop the abort that follows
  }
}

export function createSessionManager({ query, now = () => new Date().toISOString() }) {
  const sessions = new Map();
  let nextSession = 1;

  return {
    /** Starts a session; `cwd`, `prompt` and `agent` (the SDK's `options.agent`, absent for reviewer and auto) come from `roleLaunch`. Returns its summary. */
    launch({ role, id, cwd, prompt, agent }) {
      const abort = new AbortController();
      const s = {
        sid: `s${nextSession++}`,
        role,
        intent: id,
        cwd,
        state: 'running',
        startedAt: now(),
        now,
        transcript: [],
        subscribers: new Set(),
        pending: new Map(),
        nextRequest: 1,
        abort,
        query: null,
      };
      sessions.set(s.sid, s);
      emit(s, { kind: 'state', state: 'running' });
      emit(s, { kind: 'prompt', text: prompt });
      const canUseTool = (tool, input, options) => park(s, tool, input, options?.signal);
      s.query = query({ prompt, options: { cwd, canUseTool, abortController: abort, ...(agent ? { agent } : {}) } });
      void pump(s);
      return summary(s);
    },

    /** Resolves one parked request with the owner's answer. False when there is no such request. */
    answer(sid, requestId, result) {
      const s = sessions.get(sid);
      const p = s?.pending.get(requestId);
      if (!s || !p) return false;
      s.pending.delete(requestId);
      p.resolve(toPermissionResult(p, result));
      emit(s, { kind: 'answered', requestId, behavior: result.behavior });
      if (!s.pending.size && s.state === 'needs you') setState(s, 'running');
      return true;
    },

    /** Interrupts a session, aborts it and denies everything pending. False for an unknown session. */
    stop(sid) {
      const s = sessions.get(sid);
      if (!s) return false;
      if (!LIVE_STATES.has(s.state)) return true;
      setState(s, 'stopped');
      denyAll(s, 'Stopped by the owner');
      interruptQuietly(s);
      s.abort.abort();
      return true;
    },

    /** Stops every live session: the server's shutdown. */
    stopAll() {
      for (const sid of sessions.keys()) this.stop(sid);
    },

    has: (sid) => sessions.has(sid),
    list: () => [...sessions.values()].map(summary),
    runningFor: (id) => [...sessions.values()].some((s) => s.intent === String(id) && LIVE_STATES.has(s.state)),

    /** Replays the transcript to `send`, then streams new items; returns the unsubscribe. */
    subscribe(sid, send) {
      const s = sessions.get(sid);
      if (!s) return () => {};
      for (const entry of s.transcript) send(entry);
      s.subscribers.add(send);
      return () => s.subscribers.delete(send);
    },
  };
}

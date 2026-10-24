import { describe, expect, it } from 'vitest';
import { createSessionManager, describeMessage, toPermissionResult } from './sdk-sessions.mjs';

/** A fake SDK Query: an async iterable the test feeds, with a recorded interrupt(). */
function fakeQuery() {
  const calls = [];
  const queries = [];
  const query = (params) => {
    calls.push(params);
    const buffer = [];
    let wake = null;
    let ended = false;
    let failure = null;
    const q = {
      interrupts: 0,
      push(m) {
        buffer.push(m);
        wake?.();
      },
      end() {
        ended = true;
        wake?.();
      },
      fail(e) {
        failure = e;
        wake?.();
      },
      async interrupt() {
        q.interrupts += 1;
      },
      [Symbol.asyncIterator]() {
        return {
          async next() {
            for (;;) {
              if (failure) throw failure;
              if (buffer.length) return { value: buffer.shift(), done: false };
              if (ended) return { value: undefined, done: true };
              await new Promise((r) => (wake = r));
            }
          },
        };
      },
    };
    queries.push(q);
    return q;
  };
  return { query, calls, queries };
}

const tick = () => new Promise((r) => setTimeout(r, 10));
const launchArgs = { role: 'implementer', id: '52', cwd: 'C:/wt/52', prompt: 'do it' };

function start() {
  const fake = fakeQuery();
  const manager = createSessionManager({ query: fake.query, now: () => '2026-10-24T10:00:00Z' });
  const summary = manager.launch(launchArgs);
  const can = fake.calls[0].options.canUseTool;
  return { fake, manager, summary, can, q: fake.queries[0] };
}

describe('launch (spec B5)', () => {
  it('calls query with the prompt, cwd, canUseTool and an AbortController, and no settingSources', () => {
    const { fake, summary } = start();
    const { prompt, options } = fake.calls[0];
    expect(prompt).toBe('do it');
    expect(Object.keys(options).sort()).toEqual(['abortController', 'canUseTool', 'cwd']);
    expect(options.cwd).toBe('C:/wt/52');
    expect(options.abortController).toBeInstanceOf(AbortController);
    expect(summary).toMatchObject({ sid: 's1', role: 'implementer', intent: '52', cwd: 'C:/wt/52', state: 'running', pending: [] });
  });
  it('passes the agent to query() as options.agent, and only when there is one', () => {
    const fake = fakeQuery();
    const manager = createSessionManager({ query: fake.query });
    manager.launch({ ...launchArgs, agent: 'heraklios-implementer' });
    manager.launch({ ...launchArgs, id: '53' });
    expect(fake.calls[0].options.agent).toBe('heraklios-implementer');
    expect('agent' in fake.calls[1].options).toBe(false);
  });
  it('streams messages into the transcript and finishes done', async () => {
    const { manager, q } = start();
    const seen = [];
    manager.subscribe('s1', (e) => seen.push(e));
    q.push({ type: 'assistant', message: { content: [{ type: 'text', text: 'hello <b>x</b>' }, { type: 'tool_use', name: 'Read', input: { file_path: 'a' } }] } });
    q.push({ type: 'user', message: { content: [{ type: 'tool_result', content: 'file text' }] } });
    q.push({ type: 'result', subtype: 'success', result: 'all done', is_error: false });
    q.end();
    await tick();
    expect(seen.filter((e) => e.kind !== 'state' && e.kind !== 'prompt').map((e) => [e.kind, e.text])).toEqual([
      ['text', 'hello <b>x</b>'],
      ['tool_use', 'Read {"file_path":"a"}'],
      ['tool_result', 'file text'],
      ['result', 'all done'],
    ]);
    expect(manager.list()[0].state).toBe('done');
    expect(manager.runningFor('52')).toBe(false);
  });
  it('replays the transcript to a late subscriber, then goes live, and unsubscribes', async () => {
    const { manager, q } = start();
    q.push({ type: 'assistant', message: { content: [{ type: 'text', text: 'one' }] } });
    await tick();
    const seen = [];
    const off = manager.subscribe('s1', (e) => seen.push(e.text ?? e.state));
    expect(seen).toEqual(['running', 'do it', 'one']);
    q.push({ type: 'assistant', message: { content: [{ type: 'text', text: 'two' }] } });
    await tick();
    expect(seen.at(-1)).toBe('two');
    off();
    q.push({ type: 'assistant', message: { content: [{ type: 'text', text: 'three' }] } });
    await tick();
    expect(seen).not.toContain('three');
  });
  it('ends in error when the stream throws', async () => {
    const { manager, q } = start();
    q.fail(new Error('network down'));
    await tick();
    expect(manager.list()[0].state).toBe('error');
    const seen = [];
    manager.subscribe('s1', (e) => seen.push(e));
    expect(seen.find((e) => e.kind === 'error').text).toBe('network down');
  });
  it('numbers sessions and tells which intents have a live one', () => {
    const { manager } = start();
    manager.launch({ ...launchArgs, id: '53', role: 'auto' });
    expect(manager.list().map((s) => s.sid)).toEqual(['s1', 's2']);
    expect(manager.runningFor('52')).toBe(true);
    expect(manager.runningFor(53)).toBe(true);
    expect(manager.runningFor('54')).toBe(false);
  });
});

describe('permission requests (spec B6)', () => {
  it('parks a request until answered, never resolving on its own', async () => {
    const { manager, can } = start();
    let result = null;
    const done = can('Bash', { command: 'ls' }, { signal: new AbortController().signal }).then((r) => (result = r));
    await tick();
    await tick();
    expect(result).toBeNull();
    const [s] = manager.list();
    expect(s.state).toBe('needs you');
    expect(s.pending).toEqual([{ requestId: 'r1', tool: 'Bash', question: false, input: { command: 'ls' } }]);
    expect(manager.runningFor('52')).toBe(true);
    expect(manager.answer('s1', 'r1', { behavior: 'allow' })).toBe(true);
    await done;
    expect(result).toEqual({ behavior: 'allow', updatedInput: { command: 'ls' } });
    expect(manager.list()[0].state).toBe('running');
    expect(manager.list()[0].pending).toEqual([]);
  });
  it('a deny answer denies, with a default or the given message', async () => {
    const { manager, can } = start();
    const a = can('Bash', { command: 'rm x' }, {});
    const b = can('Write', { file_path: 'y' }, {});
    manager.answer('s1', 'r1', { behavior: 'deny' });
    manager.answer('s1', 'r2', { behavior: 'deny', message: 'not that file' });
    expect(await a).toEqual({ behavior: 'deny', message: 'Denied by the owner' });
    expect(await b).toEqual({ behavior: 'deny', message: 'not that file' });
  });
  it('ignores updatedInput for an ordinary tool: the owner approves the call as asked', async () => {
    const { manager, can } = start();
    const r = can('Bash', { command: 'ls' }, {});
    manager.answer('s1', 'r1', { behavior: 'allow', updatedInput: { command: 'rm -rf /' } });
    expect(await r).toEqual({ behavior: 'allow', updatedInput: { command: 'ls' } });
  });
  it('carries an AskUserQuestion answer back in updatedInput.answers', async () => {
    const { manager, can } = start();
    const input = { questions: [{ question: 'Which port?', header: 'Port', options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] }] };
    const r = can('AskUserQuestion', input, {});
    expect(manager.list()[0].pending[0].question).toBe(true);
    manager.answer('s1', 'r1', { behavior: 'allow', updatedInput: { answers: { 'Which port?': 'B' }, other: 'dropped' } });
    expect(await r).toEqual({ behavior: 'allow', updatedInput: { questions: input.questions, answers: { 'Which port?': 'B' } } });
  });
  it('refuses an answer for an unknown session or request, and a second answer', async () => {
    const { manager, can } = start();
    void can('Bash', {}, {});
    expect(manager.answer('s9', 'r1', { behavior: 'allow' })).toBe(false);
    expect(manager.answer('s1', 'r9', { behavior: 'allow' })).toBe(false);
    expect(manager.answer('s1', 'r1', { behavior: 'deny' })).toBe(true);
    expect(manager.answer('s1', 'r1', { behavior: 'allow' })).toBe(false);
  });
  it('denies a request when the SDK aborts its signal', async () => {
    const { manager, can } = start();
    const ac = new AbortController();
    const r = can('Bash', {}, { signal: ac.signal });
    ac.abort();
    expect(await r).toEqual({ behavior: 'deny', message: 'Aborted' });
    expect(manager.list()[0].pending).toEqual([]);
  });
  it('goes back to running when the abort leaves nothing pending (F14)', async () => {
    const { manager, can } = start();
    const ac = new AbortController();
    const r = can('Bash', {}, { signal: ac.signal });
    expect(manager.list()[0].state).toBe('needs you');
    ac.abort();
    await r;
    expect(manager.list()[0].state).toBe('running');
  });
  it('stays needs you after an abort while another request is pending (F14)', async () => {
    const { manager, can } = start();
    const ac = new AbortController();
    const first = can('Bash', {}, { signal: ac.signal });
    void can('Edit', {}, {});
    ac.abort();
    await first;
    expect(manager.list()[0].pending).toHaveLength(1);
    expect(manager.list()[0].state).toBe('needs you');
  });
  it('denies everything still pending when the stream ends', async () => {
    const { q, can } = start();
    const r = can('Bash', {}, {});
    q.end();
    expect((await r).behavior).toBe('deny');
  });
});

describe('stop (spec B5)', () => {
  it('interrupts, aborts, denies everything pending (with interrupt) and marks the session stopped', async () => {
    const { manager, can, q, fake } = start();
    const a = can('Bash', { command: 'ls' }, {});
    const b = can('AskUserQuestion', { questions: [] }, {});
    expect(manager.stop('s1')).toBe(true);
    expect(await a).toEqual({ behavior: 'deny', message: 'Stopped by the owner', interrupt: true });
    expect((await b).behavior).toBe('deny');
    expect(q.interrupts).toBe(1);
    expect(fake.calls[0].options.abortController.signal.aborted).toBe(true);
    expect(manager.list()[0]).toMatchObject({ state: 'stopped', pending: [] });
    expect(manager.runningFor('52')).toBe(false);
    await tick();
    expect(manager.list()[0].state).toBe('stopped'); // the stream ending does not turn it into done
  });
  it('is true and harmless on a finished session, false on an unknown one', async () => {
    const { manager, q } = start();
    q.end();
    await tick();
    expect(manager.stop('s1')).toBe(true);
    expect(q.interrupts).toBe(0);
    expect(manager.stop('s9')).toBe(false);
  });
  it('still aborts when interrupt() throws', () => {
    const { manager, q, fake } = start();
    q.interrupt = () => {
      throw new Error('gone');
    };
    expect(manager.stop('s1')).toBe(true);
    expect(fake.calls[0].options.abortController.signal.aborted).toBe(true);
  });
  it('stopAll stops every live session', () => {
    const { manager } = start();
    manager.launch({ ...launchArgs, id: '53' });
    manager.stopAll();
    expect(manager.list().map((s) => s.state)).toEqual(['stopped', 'stopped']);
  });
});

describe('pure helpers', () => {
  it('describeMessage keeps text, tool calls, results and the final result, and drops the rest', () => {
    expect(describeMessage({ type: 'system', subtype: 'init' })).toEqual([]);
    expect(describeMessage(null)).toEqual([]);
    expect(describeMessage({ type: 'assistant', message: { content: 'plain' } })).toEqual([{ kind: 'text', text: 'plain' }]);
    expect(describeMessage({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'x' }] } })).toEqual([]);
    expect(describeMessage({ type: 'result', subtype: 'error_max_turns', is_error: true })).toEqual([{ kind: 'result', text: 'error_max_turns', isError: true }]);
  });
  it('toPermissionResult never turns a deny into an allow', () => {
    expect(toPermissionResult({ tool: 'AskUserQuestion', input: {} }, { behavior: 'deny', updatedInput: { answers: { q: 'a' } } })).toEqual({
      behavior: 'deny',
      message: 'Denied by the owner',
    });
  });
});

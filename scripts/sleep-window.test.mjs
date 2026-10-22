import { describe, expect, it } from 'vitest';
import { eventsInWindow, parseSleepEvents, shouldCheck, sleepNotice } from './sleep-window.mjs';

const at = (h, m, s) => new Date(2026, 9, 21, h, m, s).getTime();
const iso = (ms) => new Date(ms).toISOString();
// The recorded 2026-10-21 critical-battery sleep (local times).
const recorded = JSON.stringify([
  { Id: 107, Time: iso(at(22, 15, 55)) },
  { Id: 42, Time: iso(at(22, 15, 52)) },
  { Id: 524, Time: iso(at(22, 15, 49)) },
  { Id: 105, Time: iso(at(22, 16, 23)) },
]);

describe('parseSleepEvents', () => {
  it('keeps 42/107/524, drops other ids, sorts by time', () => {
    expect(parseSleepEvents(recorded).map((e) => e.id)).toEqual([524, 42, 107]);
  });
  it('accepts a single object, and empty or broken input', () => {
    expect(parseSleepEvents(JSON.stringify({ Id: 42, Time: iso(at(1, 2, 3)) }))).toHaveLength(1);
    expect(parseSleepEvents('')).toEqual([]);
    expect(parseSleepEvents('not json')).toEqual([]);
    expect(parseSleepEvents(JSON.stringify([{ Id: 42, Time: 'garbage' }]))).toEqual([]);
  });
});

describe('eventsInWindow', () => {
  const events = parseSleepEvents(recorded);
  it('reports events inside the window, in order', () => {
    expect(eventsInWindow(events, at(22, 15, 0), at(22, 17, 0)).map((e) => e.id)).toEqual([524, 42, 107]);
  });
  it('bounds are inclusive; one second outside is excluded', () => {
    expect(eventsInWindow(events, at(22, 15, 52), at(22, 15, 52)).map((e) => e.id)).toEqual([42]);
    expect(eventsInWindow(events, at(22, 15, 53), at(22, 17, 0)).map((e) => e.id)).toEqual([107]);
    expect(eventsInWindow(events, at(22, 0, 0), at(22, 15, 51)).map((e) => e.id)).toEqual([524]);
  });
  it('ignores other event ids even if handed them', () => {
    expect(eventsInWindow([{ id: 105, at: at(22, 16, 23) }], at(22, 0, 0), at(23, 0, 0))).toEqual([]);
  });
  it('finds nothing in a run that avoided the sleep', () => {
    expect(eventsInWindow(events, at(20, 0, 0), at(20, 5, 0))).toEqual([]);
  });
});

describe('sleepNotice', () => {
  it('names the sleep and the critical battery', () => {
    const notice = sleepNotice(parseSleepEvents(recorded).slice(0, 3));
    expect(notice).toContain('slept at 22:15:52');
    expect(notice).toContain('critical battery');
  });
  it('says nothing for no events or a lone battery warning', () => {
    expect(sleepNotice([])).toBe('');
    expect(sleepNotice([{ id: 524, at: at(22, 15, 49) }])).toBe('');
  });
  it('names a resume whose sleep began before the run', () => {
    expect(sleepNotice([{ id: 107, at: at(22, 15, 55) }])).toContain('resumed from sleep at 22:15:55');
  });
});

describe('shouldCheck', () => {
  it('skips a passed run', () => {
    expect(shouldCheck('passed', 'win32')).toBe(false);
  });
  it('checks failed, timedout and interrupted runs on Windows', () => {
    for (const status of ['failed', 'timedout', 'interrupted']) expect(shouldCheck(status, 'win32')).toBe(true);
  });
  it('never checks off Windows', () => {
    for (const status of ['passed', 'failed', 'timedout', 'interrupted']) expect(shouldCheck(status, 'linux')).toBe(false);
  });
});

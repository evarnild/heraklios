// Did the machine sleep during an e2e run? (intents/41-e2e-dev-server-first-load)
//
// A laptop that sleeps mid-run makes Chromium report net::ERR_NETWORK_IO_SUSPENDED
// and every scenario time out waiting for the game, which looks like a code
// failure and isn't. Windows logs the sleep in the System log (provider
// Microsoft-Windows-Kernel-Power): 42 "entering sleep", 107 "resumed from
// sleep", 524 "critical battery trigger met". This module is the pure part:
// parsing those events and picking the ones inside a run's window. The
// PowerShell call itself lives in sleep-reporter.mjs.

/** Kernel-Power event ids that say the machine slept or was about to. */
export const SLEEP_EVENT_IDS = [42, 107, 524];

/**
 * Parse the JSON `Get-WinEvent ... | ConvertTo-Json` printed: an array of
 * `{ Id, Time }` (Time an ISO-8601 instant), a single object (PowerShell
 * unwraps one-element arrays), or nothing. Unusable entries are dropped.
 */
export function parseSleepEvents(text) {
  if (!text || !text.trim()) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : [data];
  return list
    .map((e) => ({ id: Number(e?.Id), at: Date.parse(e?.Time) }))
    .filter((e) => SLEEP_EVENT_IDS.includes(e.id) && Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);
}

/** The events with startMs <= at <= endMs (bounds inclusive), in time order. */
export function eventsInWindow(events, startMs, endMs) {
  return events.filter((e) => SLEEP_EVENT_IDS.includes(e.id) && e.at >= startMs && e.at <= endMs).sort((a, b) => a.at - b.at);
}

function clock(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * The line to print under a red run, or '' when no sleep fell inside it.
 * A lone 524 (battery warning without a sleep event) is not a sleep.
 */
export function sleepNotice(events) {
  const slept = events.filter((e) => e.id === 42 || e.id === 107);
  if (slept.length === 0) return '';
  const times = slept.filter((e) => e.id === 42).map((e) => clock(e.at));
  const when = times.length ? `slept at ${times.join(', ')}` : `resumed from sleep at ${clock(slept[0].at)}`;
  const battery = events.some((e) => e.id === 524) ? ' (critical battery)' : '';
  return `The machine ${when} during this run${battery}; its failures may not be the code's. Rerun on mains power.`;
}

/** Only a red run on Windows is worth asking the event log about. */
export function shouldCheck(status, platform) {
  return platform === 'win32' && status !== 'passed';
}

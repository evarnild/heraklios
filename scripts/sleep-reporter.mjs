// Playwright reporter: after a red run on Windows, say whether the machine
// slept during it. Adds one line; never changes the exit status (a reporter's
// onEnd returns nothing, and every failure here is swallowed).
import { execFileSync } from 'node:child_process';
import { eventsInWindow, parseSleepEvents, shouldCheck, sleepNotice, SLEEP_EVENT_IDS } from './sleep-window.mjs';

function readEvents(startMs) {
  const ps =
    `$s=[DateTimeOffset]::FromUnixTimeMilliseconds(${Math.floor(startMs)}).LocalDateTime;` +
    `Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-Power';` +
    `Id=${SLEEP_EVENT_IDS.join(',')};StartTime=$s} -ErrorAction SilentlyContinue | ` +
    `Select-Object Id,@{n='Time';e={$_.TimeCreated.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`;
  return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 15_000 });
}

export default class SleepReporter {
  constructor() {
    // Constructed before the web server and global setup run, so the window
    // covers the whole run.
    this.startMs = Date.now();
  }

  onEnd(result) {
    if (!shouldCheck(result.status, process.platform)) return;
    try {
      const notice = sleepNotice(eventsInWindow(parseSleepEvents(readEvents(this.startMs)), this.startMs, Date.now()));
      if (notice) process.stdout.write(`\n${notice}\n`);
    } catch {
      // No event log, no PowerShell, no permission: say nothing.
    }
  }
}

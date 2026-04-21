const { execSync } = require('node:child_process');

const ENDPOINT = 'http://127.0.0.1:7890/ingest/916b598f-9bd7-43b5-a43f-e20ad3aa526e';
const SESSION_ID = '898778';
const RUN_ID = `pre-fix-${Date.now()}`;

function sendLog(hypothesisId, location, message, data) {
  // #region agent log
  fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      runId: RUN_ID,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function safeExec(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (error) {
    return (error && error.stdout ? error.stdout.toString() : '') || String(error);
  }
}

sendLog('H0', 'scripts/debug-dev-startup.cjs:35', 'predev probe started', { cwd: process.cwd() });

const netstatOutput = safeExec('netstat -ano | findstr :3000');
sendLog('H1', 'scripts/debug-dev-startup.cjs:38', 'netstat rows for port 3000', {
  hasMatches: Boolean(netstatOutput.trim()),
  rows: netstatOutput.trim().split('\n').map((line) => line.trim()).slice(0, 10),
});

const pids = Array.from(
  new Set(
    netstatOutput
      .split('\n')
      .map((line) => line.trim().split(/\s+/).pop())
      .filter((pid) => /^\d+$/.test(pid || ''))
  )
);

sendLog('H2', 'scripts/debug-dev-startup.cjs:51', 'candidate pid owners for port 3000', { pids });

if (pids.length > 0) {
  const tasklistOutput = safeExec(`tasklist /FI "PID eq ${pids[0]}"`);
  sendLog('H3', 'scripts/debug-dev-startup.cjs:55', 'tasklist for first pid', {
    pid: pids[0],
    tasklist: tasklistOutput.trim().split('\n').slice(0, 10),
  });
}

sendLog('H4', 'scripts/debug-dev-startup.cjs:62', 'resolved dev command target port', {
  forcedPort: 3000,
  envPort: process.env.PORT || null,
});

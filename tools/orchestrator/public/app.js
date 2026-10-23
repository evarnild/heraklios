// The orchestrator page (spec §52 B3-B6, B8, B9). No framework, no build.
// Every piece of text from the server or from a session goes in through
// textContent (see el() below), never parsed as HTML: session output is untrusted
// text, and the page's Content-Security-Policy forbids inline script anyway.
const POLL_MS = 3000;
const $ = (id) => document.getElementById(id);

/** Builds an element; strings become text nodes, so nothing is ever parsed as HTML. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'onclick') node.addEventListener('click', value);
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  return { status: res.status, data };
}

function showAction(title, result) {
  const { status, data } = result;
  const lines = [title, data.error ? `error: ${data.error}` : null, data.output ?? null, `(HTTP ${status})`];
  $('action-output').textContent = lines.filter((l) => l !== null).join('\n');
}

async function act(title, method, url, body) {
  $('action-output').textContent = `${title} ...`;
  const result = await api(method, url, body);
  showAction(title, result);
  await refresh();
  return result;
}

// --- tables ---------------------------------------------------------------

function table(headers, rows) {
  return el(
    'table',
    {},
    el('thead', {}, el('tr', {}, headers.map((h) => el('th', { text: h })))),
    el('tbody', {}, rows.map((cells) => el('tr', {}, cells.map((c) => el('td', {}, c))))),
  );
}

function button(label, onclick, cls = '') {
  return el('button', { type: 'button', class: cls, onclick }, label);
}

function gateButton(intent) {
  const gate = intent.next.gate;
  if (!gate) return null;
  return button(`Record ${gate}`, async () => {
    const ok = confirm(
      `Record ${gate} for §${intent.id} (${intent.title})?\n\nThis writes today's date as a bare date (you did it, not an agent) and commits it.`,
    );
    if (ok) await act(`Record ${gate} for §${intent.id}`, 'POST', `/api/gate/${intent.id}/${gate}`);
  });
}

function spawnButtons(intent) {
  const open = !['done', 'abandoned', 'deferred'].includes(intent.status);
  const out = [];
  if (open && !intent.worktree.exists) {
    out.push(
      button('Spawn', async () => {
        if (confirm(`Spawn the worktree for §${intent.id}? (runs npm ci, it takes a while)`)) {
          await act(`Spawn §${intent.id}`, 'POST', `/api/spawn/${intent.id}`);
        }
      }),
    );
  }
  if (intent.status === 'done' && intent.worktree.exists) {
    out.push(
      button('Remove', async () => {
        if (confirm(`Remove the worktree of §${intent.id}? The script refuses if it is unmerged or dirty.`)) {
          await act(`Remove §${intent.id}`, 'POST', `/api/remove/${intent.id}`);
        }
      }),
    );
  }
  return out;
}

function launchButtons(intent) {
  if (['done', 'abandoned', 'deferred'].includes(intent.status)) return [];
  const roles = [];
  if (intent.worktree.exists) roles.push(['implementer', 'Implementer']);
  roles.push(['reviewer', 'Review'], ['auto', 'Auto']);
  return roles.map(([role, label]) =>
    button(label, async () => {
      const ok = confirm(`Launch a ${role} session on §${intent.id}? It runs Claude Code and may use your quota.`);
      if (!ok) return;
      const result = await act(`Launch ${role} on §${intent.id}`, 'POST', '/api/sessions', { role, id: String(intent.id) });
      if (result.data.session) openSession(result.data.session);
    }, 'launch'),
  );
}

function intentActions(intent) {
  const ship = intent.status === 'in-review' ? button('Ship…', () => startShip(intent)) : null;
  return el('div', { class: 'actions' }, gateButton(intent), spawnButtons(intent), launchButtons(intent), ship);
}

function intentRow(intent) {
  const next = el('span', { class: `owner-${intent.next.owner}`, text: `${intent.next.step} (${intent.next.owner})` });
  return [
    `§${intent.id}`,
    el('span', {}, intent.title ?? intent.slug ?? '', el('small', { text: ` ${intent.type ?? ''}` })),
    intent.status ?? '',
    [intent.gates, intent.auto].filter(Boolean).join('  '),
    intent.source === 'main' ? 'main' : intent.worktree.exists ? intent.worktree.branch : 'branch',
    intent.session ?? '',
    next,
    intentActions(intent),
  ];
}

const INTENT_HEADERS = ['§', 'title', 'status', 'gates', 'where', 'session', 'next step', 'actions'];

function renderState(state) {
  const waiting = state.intents.filter((i) => i.next.owner === 'owner' || i.session === 'needs you');
  $('waiting-list').replaceChildren(waiting.length ? table(INTENT_HEADERS, waiting.map(intentRow)) : el('p', { text: 'Nothing waits on you.' }));
  const open = state.intents.filter((i) => !['done', 'abandoned', 'deferred'].includes(i.status));
  $('intent-table').replaceChildren(table(INTENT_HEADERS, open.map(intentRow)));
  const rows = state.worktrees.map((w) => [
    w.id ? `§${w.id}` : '-',
    w.branch ?? '(detached)',
    w.status ?? '',
    [w.gates, w.auto].filter(Boolean).join('  '),
    w.ahead === null ? '' : `+${w.ahead}/-${w.behind}`,
    w.dirty ? String(w.dirty) : '',
    w.session.ageSeconds === null ? w.session.state : `${w.session.state} (${w.session.ageSeconds}s)`,
    w.port ? String(w.port) : '',
  ]);
  $('worktree-table').replaceChildren(table(['§', 'branch', 'status', 'gates', '±main', 'dirty', 'session', 'port'], rows));
}

// --- ship -----------------------------------------------------------------

async function startShip(intent) {
  $('ship').hidden = false;
  $('ship-title').textContent = `Ship §${intent.id}: dry-run`;
  $('ship-output').textContent = 'running the dry-run ...';
  $('ship-controls').replaceChildren();
  const { status, data } = await api('POST', `/api/ship/${intent.id}?dry=1`);
  $('ship-output').textContent = data.error ? `error: ${data.error} (HTTP ${status})` : data.output;
  const controls = [button('Close', () => ($('ship').hidden = true))];
  if (data.ok) {
    const words = el('input', { type: 'text', placeholder: 'live check words (optional)', size: '40', maxlength: '500' });
    controls.unshift(
      words,
      button('Ship for real', async () => {
        const ok = confirm(`Ship §${intent.id} (${intent.title})?\n\nThis merges into main, runs npm run verify, pushes and removes the worktree and branch.`);
        if (!ok) return;
        const live = words.value.trim();
        const result = await act(`Ship §${intent.id}`, 'POST', `/api/ship/${intent.id}`, live ? { live } : {});
        $('ship-output').textContent = result.data.output ?? result.data.error ?? '';
        $('ship-controls').replaceChildren(button('Close', () => ($('ship').hidden = true)));
      }, 'danger'),
    );
  }
  $('ship-controls').replaceChildren(...controls);
}

// --- sessions -----------------------------------------------------------------

const panels = new Map();

function questionForm(panel, req) {
  const picked = {};
  const rows = (req.input.questions ?? []).map((q) =>
    el(
      'div',
      { class: 'question' },
      el('p', { text: `${q.header ? `${q.header}: ` : ''}${q.question}` }),
      (q.options ?? []).map((o) =>
        button(o.label, () => {
          picked[q.question] = q.multiSelect && picked[q.question] ? `${picked[q.question]}, ${o.label}` : o.label;
          panel.status.textContent = `chosen: ${Object.values(picked).join(' | ')}`;
        }),
      ),
    ),
  );
  const submit = button('Send answers', () =>
    answerRequest(panel, req, { behavior: 'allow', updatedInput: { answers: picked } }),
  );
  const decline = button('Decline', () => answerRequest(panel, req, { behavior: 'deny', message: 'The owner declined to answer' }), 'danger');
  return [rows, submit, decline];
}

function answerRequest(panel, req, result) {
  return api('POST', `/api/sessions/${panel.sid}/answer`, { requestId: req.requestId, result });
}

function renderPending(panel) {
  const nodes = [...panel.pending.values()].map((req) =>
    el(
      'div',
      { class: 'pending' },
      el('strong', { text: req.question ? 'Question' : `Permission: ${req.tool}` }),
      el('pre', { text: JSON.stringify(req.input, null, 2) }),
      req.question
        ? questionForm(panel, req)
        : [
            button('Allow', () => answerRequest(panel, req, { behavior: 'allow' })),
            button('Deny', () => answerRequest(panel, req, { behavior: 'deny', message: 'The owner denied it' }), 'danger'),
          ],
    ),
  );
  panel.pendingBox.replaceChildren(...nodes);
}

function onEvent(panel, item) {
  if (item.kind === 'pending') panel.pending.set(item.requestId, item);
  else if (item.kind === 'answered') panel.pending.delete(item.requestId);
  else if (item.kind === 'state') {
    panel.status.textContent = item.state;
    if (['done', 'stopped', 'error'].includes(item.state)) {
      panel.pending.clear();
      setTimeout(() => panel.source.close(), 500);
    }
  }
  if (item.kind === 'pending' || item.kind === 'answered' || item.kind === 'state') renderPending(panel);
  const line = el('div', { class: `line ${item.kind}`, text: `${item.kind}: ${item.text ?? item.tool ?? item.state ?? item.behavior ?? ''}` });
  panel.log.append(line);
  line.scrollIntoView({ block: 'nearest' });
}

function openSession(session) {
  if (panels.has(session.sid)) return;
  const panel = { sid: session.sid, pending: new Map(), status: el('span', { class: 'state', text: session.state }) };
  panel.log = el('div', { class: 'log' });
  panel.pendingBox = el('div', { class: 'pending-box' });
  panel.source = new EventSource(`/api/sessions/${session.sid}/events`);
  panel.source.onmessage = (e) => onEvent(panel, JSON.parse(e.data));
  const stop = button('Stop', async () => {
    await api('POST', `/api/sessions/${session.sid}/stop`);
  }, 'danger');
  const root = el('div', { class: 'session' }, el('h3', {}, `${session.role} on §${session.intent} `, panel.status, ' ', stop), panel.pendingBox, panel.log);
  $('session-list').prepend(root);
  panels.set(session.sid, panel);
}

async function syncSessions() {
  const { data } = await api('GET', '/api/sessions');
  for (const session of data.sessions ?? []) openSession(session);
}

// --- polling ------------------------------------------------------------------

let inFlight = false;
async function refresh() {
  if (inFlight) return;
  inFlight = true;
  try {
    const { status, data } = await api('GET', '/api/state');
    if (status !== 200) throw new Error(data.error ?? `HTTP ${status}`);
    renderState(data);
    await syncSessions();
    $('status').textContent = `updated ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    $('status').textContent = `error: ${e.message}`;
  } finally {
    inFlight = false;
  }
}

refresh();
setInterval(refresh, POLL_MS);

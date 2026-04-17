export function renderLiveUI(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jinsong — Agent Experience</title>
  <style>
    :root {
      --bg: #0b0d10;
      --panel: #14171c;
      --panel-2: #1b1f26;
      --border: #262b33;
      --text: #e6e8eb;
      --muted: #8b93a1;
      --accent: #7dd3fc;
      --good: #22c55e;
      --fair: #eab308;
      --poor: #ef4444;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    a { color: var(--accent); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
    .muted { color: var(--muted); }
    .status-bar { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; gap: 20px; flex-wrap: wrap; align-items: center; font-size: 13px; }
    .status-bar .item { display: flex; gap: 6px; align-items: baseline; }
    .status-bar .val { font-weight: 600; color: var(--text); }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); margin-right: 6px; vertical-align: middle; }
    .dot.scanning { background: var(--accent); animation: pulse 1.2s ease-in-out infinite; }
    .dot.idle { background: var(--good); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .kpi { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
    .kpi .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi .value { font-size: 24px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    thead { background: var(--panel-2); }
    th, td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
    th { font-weight: 500; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    tr:last-child td { border-bottom: none; }
    tr.new { animation: flash 1.5s ease-out; }
    @keyframes flash { 0% { background: rgba(125, 211, 252, 0.15); } 100% { background: transparent; } }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; }
    .pill.good { background: rgba(34, 197, 94, 0.15); color: var(--good); }
    .pill.fair { background: rgba(234, 179, 8, 0.15); color: var(--fair); }
    .pill.poor { background: rgba(239, 68, 68, 0.15); color: var(--poor); }
    .pill.na { background: rgba(139, 147, 161, 0.15); color: var(--muted); }
    .empty { padding: 48px; text-align: center; color: var(--muted); }
    .sid { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--muted); }
    .progress { height: 3px; background: var(--border); margin-top: 8px; border-radius: 2px; overflow: hidden; }
    .progress-bar { height: 100%; background: var(--accent); transition: width 0.3s ease; width: 0%; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Jinsong</h1>
      <span class="muted" id="connected">connecting…</span>
    </header>

    <div class="status-bar">
      <div class="item"><span class="dot" id="scan-dot"></span><span id="scan-label">idle</span></div>
      <div class="item"><span class="muted">Discovered</span><span class="val" id="s-discovered">0</span></div>
      <div class="item"><span class="muted">Processed</span><span class="val" id="s-processed">0</span></div>
      <div class="item"><span class="muted">Skipped</span><span class="val" id="s-skipped">0</span></div>
      <div class="item"><span class="muted">Errors</span><span class="val" id="s-errors">0</span></div>
    </div>
    <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>

    <div class="summary" id="summary">
      <div class="kpi"><div class="label">Sessions</div><div class="value" id="kpi-sessions">0</div></div>
      <div class="kpi"><div class="label">Total Turns</div><div class="value" id="kpi-turns">0</div></div>
      <div class="kpi"><div class="label">Total Tool Calls</div><div class="value" id="kpi-tools">0</div></div>
      <div class="kpi"><div class="label">Median TTFT</div><div class="value" id="kpi-ttft">—</div></div>
      <div class="kpi"><div class="label">Median Stall Ratio</div><div class="value" id="kpi-stall">—</div></div>
      <div class="kpi"><div class="label">Task Completion</div><div class="value" id="kpi-completion">—</div></div>
    </div>

    <div id="table-wrap">
      <div class="empty" id="empty">No sessions yet. Waiting for discovery…</div>
      <table id="sessions" style="display: none;">
        <thead>
          <tr>
            <th>Session</th>
            <th>Started</th>
            <th>Agent</th>
            <th>Model</th>
            <th>Turns</th>
            <th>Duration</th>
            <th>TTFT</th>
            <th>Stall %</th>
            <th>Errors</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  </div>

<script>
(function () {
  var state = { sessions: [], byId: new Map() };

  function fmtDuration(seconds) {
    if (seconds == null) return '—';
    if (seconds < 60) return seconds.toFixed(1) + 's';
    var m = Math.floor(seconds / 60);
    var s = Math.round(seconds % 60);
    if (m < 60) return m + 'm ' + s + 's';
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }
  function fmtNum(n, digits) {
    if (n == null) return '—';
    return n.toLocaleString(undefined, { maximumFractionDigits: digits == null ? 0 : digits });
  }
  function fmtPct(x) {
    if (x == null) return '—';
    return (x * 100).toFixed(1) + '%';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString();
  }
  function median(xs) {
    var ys = xs.filter(function (x) { return x != null && !isNaN(x); }).sort(function (a, b) { return a - b; });
    if (ys.length === 0) return null;
    var m = Math.floor(ys.length / 2);
    return ys.length % 2 ? ys[m] : (ys[m - 1] + ys[m]) / 2;
  }
  function pill(value, thresholds, formatter) {
    if (value == null) return '<span class="pill na">—</span>';
    var cls;
    if (thresholds.reverse) {
      cls = value >= thresholds.good ? 'good' : value >= thresholds.fair ? 'fair' : 'poor';
    } else {
      cls = value <= thresholds.good ? 'good' : value <= thresholds.fair ? 'fair' : 'poor';
    }
    return '<span class="pill ' + cls + '">' + formatter(value) + '</span>';
  }

  function renderRow(row, isNew) {
    var s = row.session, m = row.metrics || {};
    var tr = document.createElement('tr');
    if (isNew) tr.className = 'new';
    tr.dataset.sid = s.session_id;

    var ttft = pill(m.r_time_to_first_token, { good: 2, fair: 5 }, function (v) { return v.toFixed(2) + 's'; });
    var stall = pill(m.rel_stall_ratio, { good: 0.1, fair: 0.2 }, function (v) { return (v * 100).toFixed(1) + '%'; });
    var errors = pill(m.rel_error_rate == null ? 0 : m.rel_error_rate, { good: 0, fair: 2 }, function (v) { return v.toFixed(2); });
    var done = s.task_completed ? '<span class="pill good">✓</span>' : '<span class="pill poor">✗</span>';

    tr.innerHTML =
      '<td><span class="sid">' + s.session_id.substring(0, 8) + '…</span></td>' +
      '<td>' + fmtDate(s.started_at) + '</td>' +
      '<td>' + (s.agent_name || '—') + '</td>' +
      '<td>' + (s.model_id || '—') + '</td>' +
      '<td>' + fmtNum(s.total_turns) + '</td>' +
      '<td>' + fmtDuration(m.duration_seconds) + '</td>' +
      '<td>' + ttft + '</td>' +
      '<td>' + stall + '</td>' +
      '<td>' + errors + '</td>' +
      '<td>' + done + '</td>';
    return tr;
  }

  function renderAll() {
    var tbody = document.getElementById('tbody');
    var table = document.getElementById('sessions');
    var empty = document.getElementById('empty');
    if (state.sessions.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    table.style.display = 'table';
    tbody.innerHTML = '';
    // newest first
    var sorted = state.sessions.slice().sort(function (a, b) {
      return new Date(b.session.started_at) - new Date(a.session.started_at);
    });
    for (var i = 0; i < sorted.length; i++) tbody.appendChild(renderRow(sorted[i], false));
    renderSummary();
  }

  function renderSummary() {
    var rows = state.sessions;
    document.getElementById('kpi-sessions').textContent = rows.length.toLocaleString();
    var turns = rows.reduce(function (a, r) { return a + (r.session.total_turns || 0); }, 0);
    var tools = rows.reduce(function (a, r) { return a + (r.session.total_tool_calls || 0); }, 0);
    document.getElementById('kpi-turns').textContent = turns.toLocaleString();
    document.getElementById('kpi-tools').textContent = tools.toLocaleString();

    var ttft = median(rows.map(function (r) { return r.metrics ? r.metrics.r_time_to_first_token : null; }));
    document.getElementById('kpi-ttft').textContent = ttft == null ? '—' : ttft.toFixed(2) + 's';

    var stall = median(rows.map(function (r) { return r.metrics ? r.metrics.rel_stall_ratio : null; }));
    document.getElementById('kpi-stall').textContent = stall == null ? '—' : (stall * 100).toFixed(1) + '%';

    var done = rows.filter(function (r) { return r.session.task_completed; }).length;
    var pct = rows.length === 0 ? null : done / rows.length;
    document.getElementById('kpi-completion').textContent = pct == null ? '—' : (pct * 100).toFixed(0) + '%';
  }

  function updateStatus(s) {
    document.getElementById('s-discovered').textContent = s.discovered.toLocaleString();
    document.getElementById('s-processed').textContent = s.processed.toLocaleString();
    document.getElementById('s-skipped').textContent = s.skipped.toLocaleString();
    document.getElementById('s-errors').textContent = s.errors.toLocaleString();
    var dot = document.getElementById('scan-dot');
    var label = document.getElementById('scan-label');
    if (s.scanning) {
      dot.className = 'dot scanning';
      label.textContent = 'scanning…';
    } else {
      dot.className = 'dot idle';
      label.textContent = 'idle';
    }
    var bar = document.getElementById('progress-bar');
    var total = s.discovered;
    var done = s.processed + s.skipped + s.errors;
    bar.style.width = (total === 0 ? 0 : Math.min(100, (done / total) * 100)) + '%';
    if (!s.scanning) setTimeout(function () { bar.style.width = '0%'; }, 800);
  }

  function addSession(row) {
    if (state.byId.has(row.session.session_id)) return;
    state.byId.set(row.session.session_id, row);
    state.sessions.push(row);
    var empty = document.getElementById('empty');
    var table = document.getElementById('sessions');
    empty.style.display = 'none';
    table.style.display = 'table';
    var tbody = document.getElementById('tbody');
    var tr = renderRow(row, true);
    tbody.insertBefore(tr, tbody.firstChild);
    renderSummary();
  }

  function loadInitial() {
    fetch('/api/sessions').then(function (r) { return r.json(); }).then(function (data) {
      state.sessions = data.sessions || [];
      state.byId = new Map(state.sessions.map(function (r) { return [r.session.session_id, r]; }));
      renderAll();
    });
    fetch('/api/status').then(function (r) { return r.json(); }).then(updateStatus);
  }

  function connectSSE() {
    var es = new EventSource('/events');
    es.onopen = function () {
      document.getElementById('connected').textContent = 'live';
    };
    es.onerror = function () {
      document.getElementById('connected').textContent = 'reconnecting…';
    };
    es.addEventListener('status', function (e) {
      try { updateStatus(JSON.parse(e.data)); } catch (_) {}
    });
    es.addEventListener('session', function (e) {
      try { addSession(JSON.parse(e.data)); } catch (_) {}
    });
  }

  loadInitial();
  connectSSE();
})();
</script>
</body>
</html>`;
}

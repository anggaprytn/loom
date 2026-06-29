import type { FastifyInstance } from 'fastify';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .header(
        'Content-Security-Policy',
        "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
      )
      .send(renderDashboard()),
  );
}

function renderDashboard() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>team-llm-gateway</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f7f4;
        --surface: #ffffff;
        --surface-subtle: #f9faf7;
        --border: #d9dfd6;
        --border-strong: #b8c2b7;
        --text: #17201b;
        --muted: #5e6d63;
        --faint: #7c887f;
        --brand: #1f6f4d;
        --brand-strong: #165239;
        --brand-soft: #e7f3ec;
        --danger: #a33a35;
        --danger-soft: #f9e7e5;
        --warn: #966b1f;
        --warn-soft: #fff3d7;
        --info: #315f9f;
        --info-soft: #e7effb;
        --success: #23724f;
        --success-soft: #e5f3ec;
        --shadow: 0 1px 2px rgba(23, 32, 27, 0.05), 0 10px 32px rgba(23, 32, 27, 0.06);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background: var(--bg);
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      button, input, select { font: inherit; }
      button {
        min-height: 36px; border: 1px solid transparent; border-radius: 7px; padding: 0 12px;
        font-weight: 700; cursor: pointer; transition: background .12s, border-color .12s, color .12s, opacity .12s;
      }
      button:focus-visible, input:focus-visible, select:focus-visible {
        outline: 3px solid rgba(31, 111, 77, .2); outline-offset: 1px;
      }
      button.primary { background: var(--brand); color: #fff; border-color: var(--brand); }
      button.primary:hover { background: var(--brand-strong); }
      button.secondary { background: var(--surface); color: var(--brand); border-color: var(--border-strong); }
      button.ghost { background: transparent; color: var(--muted); border-color: transparent; }
      button.danger { background: var(--danger); color: #fff; border-color: var(--danger); }
      button:disabled { opacity: .55; cursor: not-allowed; }
      input, select {
        width: 100%; min-height: 38px; border: 1px solid var(--border); border-radius: 7px;
        padding: 8px 10px; background: var(--surface); color: var(--text);
      }
      label { display: block; margin: 0 0 6px; font-size: 12px; font-weight: 750; color: var(--muted); }
      .app { min-height: 100vh; display: grid; grid-template-columns: 246px 1fr; }
      .sidebar {
        position: sticky; top: 0; height: 100vh; padding: 20px 14px; border-right: 1px solid var(--border);
        background: #fbfcfa;
      }
      .brand { padding: 4px 8px 18px; }
      .brand h1 { margin: 0; font-size: 18px; line-height: 1.15; letter-spacing: 0; }
      .brand p { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
      .nav { display: grid; gap: 4px; }
      .nav button {
        width: 100%; display: flex; align-items: center; gap: 9px; justify-content: flex-start;
        padding: 9px 10px; color: var(--muted); background: transparent; border-color: transparent;
      }
      .nav button[aria-selected="true"] { background: var(--brand-soft); color: var(--brand-strong); }
      .nav .icon { width: 18px; text-align: center; font-size: 15px; }
      .shell { min-width: 0; }
      .topbar {
        min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 14px;
        padding: 16px 24px; border-bottom: 1px solid var(--border); background: rgba(246, 247, 244, .9);
        backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 5;
      }
      .title h2 { margin: 0; font-size: 22px; line-height: 1.2; letter-spacing: 0; }
      .title p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
      .session { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .session input { width: min(320px, 48vw); }
      .content { max-width: 1240px; margin: 0 auto; padding: 22px 24px 48px; }
      .section { display: none; }
      .section.active { display: block; }
      .grid { display: grid; gap: 16px; }
      .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .card {
        background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
        box-shadow: var(--shadow); padding: 16px;
      }
      .card.compact { box-shadow: none; }
      .card h3 { margin: 0 0 10px; font-size: 15px; line-height: 1.25; }
      .card .sub { margin: -4px 0 14px; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .metric { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-height: 94px; }
      .metric .value { font-size: 28px; font-weight: 780; line-height: 1; }
      .metric .label { margin-top: 7px; color: var(--muted); font-size: 13px; }
      .badge {
        display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 999px;
        font-size: 12px; font-weight: 750; border: 1px solid transparent; white-space: nowrap;
      }
      .badge.ok { background: var(--success-soft); color: var(--success); border-color: #bfdecf; }
      .badge.warn { background: var(--warn-soft); color: var(--warn); border-color: #ead397; }
      .badge.info { background: var(--info-soft); color: var(--info); border-color: #bfd1ee; }
      .badge.off { background: #eef0ec; color: var(--muted); border-color: var(--border); }
      .badge.danger { background: var(--danger-soft); color: var(--danger); border-color: #efc1bd; }
      .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .form-grid .full { grid-column: 1 / -1; }
      .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
      .hint { color: var(--muted); font-size: 12px; line-height: 1.45; }
      .table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
      table { width: 100%; border-collapse: collapse; min-width: 720px; font-size: 13px; }
      th, td { border-bottom: 1px solid #e8ece5; padding: 10px 10px; text-align: left; vertical-align: middle; }
      th { color: var(--muted); background: var(--surface-subtle); font-size: 12px; font-weight: 800; }
      tr:last-child td { border-bottom: 0; }
      code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .truncate { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .empty {
        border: 1px dashed var(--border-strong); border-radius: 8px; padding: 22px; background: var(--surface-subtle);
        color: var(--muted); font-size: 13px; line-height: 1.5;
      }
      .callout { border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.45; border: 1px solid var(--border); }
      .callout.info { background: var(--info-soft); border-color: #bfd1ee; color: #244977; }
      .callout.warn { background: var(--warn-soft); border-color: #ead397; color: #6f4e18; }
      .secret {
        display: grid; gap: 10px; margin-top: 12px; padding: 12px; border: 1px solid #bfd1ee; border-radius: 8px;
        background: var(--info-soft);
      }
      .secret code { word-break: break-all; font-size: 12px; }
      .toast {
        position: fixed; right: 18px; bottom: 18px; max-width: min(460px, calc(100vw - 36px)); z-index: 20;
        background: #17201b; color: #fff; border-radius: 8px; padding: 12px 14px; box-shadow: var(--shadow);
        font-size: 13px; line-height: 1.45; display: none; white-space: pre-wrap;
      }
      .toast.show { display: block; }
      .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; }
      .toolbar h3 { margin: 0; font-size: 16px; }
      .divider { height: 1px; background: var(--border); margin: 16px 0; }
      @media (max-width: 980px) {
        .app { grid-template-columns: 1fr; }
        .sidebar { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--border); }
        .nav { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .topbar { position: static; align-items: flex-start; flex-direction: column; }
        .session { justify-content: flex-start; }
        .session input { width: min(100%, 420px); }
        .grid.two, .grid.three { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        .content { padding: 16px 14px 34px; }
        .form-grid { grid-template-columns: 1fr; }
        .nav { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <h1>team-llm-gateway</h1>
          <p>Operational control plane for LiteLLM keys, providers, aliases, and usage.</p>
        </div>
        <nav class="nav" aria-label="Dashboard sections">
          <button data-tab="overview" aria-selected="true"><span class="icon">◆</span>Overview</button>
          <button data-tab="keys" aria-selected="false"><span class="icon">⌘</span>Users & Keys</button>
          <button data-tab="providers" aria-selected="false"><span class="icon">●</span>Providers</button>
          <button data-tab="aliases" aria-selected="false"><span class="icon">⇄</span>Model Aliases</button>
          <button data-tab="usage" aria-selected="false"><span class="icon">▦</span>Usage</button>
          <button data-tab="settings" aria-selected="false"><span class="icon">⚙</span>Settings</button>
        </nav>
      </aside>
      <div class="shell">
        <header class="topbar">
          <div class="title">
            <h2 id="pageTitle">Overview</h2>
            <p id="pageSubtitle">System health, routing status, and operator actions.</p>
          </div>
          <div class="session">
            <span id="sessionBadge" class="badge warn">Locked</span>
            <input id="adminToken" type="password" placeholder="ADMIN_TOKEN" autocomplete="off" aria-label="Admin token" />
            <button id="saveToken" class="primary">Unlock</button>
            <button id="clearToken" class="secondary">Clear</button>
            <button id="refresh" class="secondary">Refresh</button>
          </div>
        </header>

        <main class="content">
          <section id="overview" class="section active">
            <div class="grid three">
              <div class="card metric">
                <div><div id="metricProviders" class="value">—</div><div class="label">Enabled providers</div></div>
                <span id="providerHealthBadge" class="badge off">Unknown</span>
              </div>
              <div class="card metric">
                <div><div id="metricAliases" class="value">—</div><div class="label">Enabled model aliases</div></div>
                <span class="badge info">LiteLLM routes</span>
              </div>
              <div class="card metric">
                <div><div id="metricKeys" class="value">—</div><div class="label">Active user keys</div></div>
                <span class="badge ok">Virtual keys</span>
              </div>
            </div>
            <div class="grid two" style="margin-top:16px">
              <div class="card">
                <h3>Gateway Status</h3>
                <p class="sub">A quick read on whether the admin console can reach the control-plane data.</p>
                <div id="overviewStatus" class="grid"></div>
              </div>
              <div class="card">
                <h3>Recommended Setup</h3>
                <p class="sub">Follow this order for the lowest-risk rollout.</p>
                <div class="callout info">
                  1. Add provider and run health check.<br />
                  2. Create model aliases and sync them to LiteLLM.<br />
                  3. Create developer user and personal LiteLLM key.<br />
                  4. Test Codex against <span class="mono">code-premium</span>.
                </div>
              </div>
            </div>
          </section>

          <section id="keys" class="section">
            <div class="grid two">
              <div class="card">
                <h3>Invite Developer</h3>
                <p class="sub">Create a user first, then issue a personal LiteLLM virtual key.</p>
                <div class="form-grid">
                  <div><label for="userEmail">Email</label><input id="userEmail" placeholder="dev@example.com" /></div>
                  <div><label for="userName">Name</label><input id="userName" placeholder="Dev Example" /></div>
                  <div><label for="teamSlug">Team Slug</label><input id="teamSlug" placeholder="engineering" /></div>
                  <div><label for="teamName">Team Name</label><input id="teamName" placeholder="Engineering" /></div>
                </div>
                <div class="actions"><button id="createUser" class="primary">Create User</button></div>
              </div>
              <div class="card">
                <h3>Issue Personal Key</h3>
                <p class="sub">The plaintext key is returned once. Store it in the developer's secret manager.</p>
                <div class="form-grid">
                  <div class="full"><label for="keyUser">User</label><select id="keyUser"></select></div>
                  <div><label for="keyName">Key Name</label><input id="keyName" value="codex" /></div>
                  <div><label for="keyModels">Model Access</label><input id="keyModels" value="code-premium,code-balanced,code-fallback" /></div>
                </div>
                <div class="actions"><button id="createKey" class="primary">Create Key</button></div>
                <div id="newKey" class="secret" style="display:none"></div>
              </div>
            </div>
            <div class="card" style="margin-top:16px">
              <div class="toolbar"><h3>Keys</h3><span class="hint">Revoke from the table when a key leaks or a user leaves.</span></div>
              <div id="keysTable"></div>
            </div>
          </section>

          <section id="providers" class="section">
            <div class="grid two">
              <div class="card">
                <h3>Add Provider</h3>
                <p class="sub">Use an OpenAI-compatible <span class="mono">/v1</span> endpoint. Provider secrets are encrypted at rest.</p>
                <div class="form-grid">
                  <div><label for="providerSlug">Slug</label><input id="providerSlug" placeholder="9router" /></div>
                  <div><label for="providerName">Name</label><input id="providerName" placeholder="9Router Local" /></div>
                  <div class="full"><label for="providerBaseUrl">Base URL</label><input id="providerBaseUrl" placeholder="http://9router:20128/v1" /></div>
                  <div class="full"><label for="providerApiKey">API Key</label><input id="providerApiKey" type="password" placeholder="provider token if required" /></div>
                </div>
                <div class="actions"><button id="createProvider" class="primary">Create Provider</button></div>
              </div>
              <div class="card">
                <h3>Provider Rules</h3>
                <p class="sub">Keep upstreams private and stable. Developers should never call them directly.</p>
                <div class="callout warn">
                  Browser sessions, shared personal subscriptions, and cookies are not valid provider credentials.
                  Use OpenAI-compatible APIs, local 9Router, or local model servers.
                </div>
                <div class="divider"></div>
                <p class="hint">Run health checks after creating or rotating a provider. A healthy provider should respond to <span class="mono">GET /v1/models</span>.</p>
              </div>
            </div>
            <div class="card" style="margin-top:16px">
              <div class="toolbar"><h3>Providers</h3><span class="hint">Health checks and rotations are operator actions.</span></div>
              <div id="providersTable"></div>
            </div>
          </section>

          <section id="aliases" class="section">
            <div class="grid two">
              <div class="card">
                <h3>Create Model Alias</h3>
                <p class="sub">Aliases are stable public names developers use from Codex/Cursor/Cline.</p>
                <div class="form-grid">
                  <div><label for="aliasName">Alias</label><input id="aliasName" value="code-premium" /></div>
                  <div><label for="aliasProvider">Provider</label><select id="aliasProvider"></select></div>
                  <div class="full"><label for="upstreamModel">Upstream Model</label><input id="upstreamModel" value="openai/gemini-2.5-pro" /></div>
                </div>
                <div class="actions"><button id="createAlias" class="primary">Create + Sync</button></div>
              </div>
              <div class="card">
                <h3>Routing Preview</h3>
                <p class="sub">Developers see aliases. Operators control provider and upstream model mapping.</p>
                <div class="callout info"><span class="mono">Codex -> LiteLLM key -> code-premium -> provider -> upstream model</span></div>
              </div>
            </div>
            <div class="card" style="margin-top:16px">
              <div class="toolbar"><h3>Model Aliases</h3><span class="hint">Sync after changing provider credentials or upstream model IDs.</span></div>
              <div id="aliasesTable"></div>
            </div>
          </section>

          <section id="usage" class="section">
            <div class="grid three">
              <div class="card metric"><div><div id="usageRequests" class="value">—</div><div class="label">Requests</div></div></div>
              <div class="card metric"><div><div id="usageTokens" class="value">—</div><div class="label">Total tokens</div></div></div>
              <div class="card metric"><div><div id="usageCost" class="value">—</div><div class="label">Estimated cost</div></div></div>
            </div>
            <div class="card" style="margin-top:16px">
              <div class="toolbar"><h3>Usage Snapshot</h3><span class="hint">Source defaults to LiteLLM spend logs.</span></div>
              <div id="usageTables"></div>
            </div>
          </section>

          <section id="settings" class="section">
            <div class="grid two">
              <div class="card">
                <h3>Codex Configuration</h3>
                <p class="sub">Give each developer their own LiteLLM virtual key.</p>
                <div class="callout info mono">
OPENAI_BASE_URL=https://llm.apps.anggaprytn.com/v1<br />
OPENAI_API_KEY=&lt;personal_litellm_key&gt;<br />
OPENAI_MODEL=code-premium
                </div>
              </div>
              <div class="card">
                <h3>Security Baseline</h3>
                <p class="sub">This dashboard is admin-only and should remain behind VPN or access control.</p>
                <div class="actions">
                  <button id="copyCodex" class="secondary">Copy Codex Env</button>
                  <button id="clearSession" class="danger">Clear Admin Session</button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <script>
      const $ = (id) => document.getElementById(id);
      const state = { users: [], providers: [], aliases: [], keys: [], usage: null };
      const titles = {
        overview: ['Overview', 'System health, routing status, and operator actions.'],
        keys: ['Users & Keys', 'Create developers and issue personal LiteLLM virtual keys.'],
        providers: ['Providers', 'Manage OpenAI-compatible upstream providers and credentials.'],
        aliases: ['Model Aliases', 'Map stable public model names to upstream providers.'],
        usage: ['Usage', 'Monitor request volume, token usage, cost, and attribution.'],
        settings: ['Settings', 'Operator notes, client configuration, and session controls.']
      };
      $('adminToken').value = localStorage.getItem('tlg_admin_token') || '';
      updateSessionBadge();

      document.querySelectorAll('.nav button').forEach((button) => {
        button.onclick = () => switchTab(button.dataset.tab);
      });
      $('saveToken').onclick = () => { persistToken(); updateSessionBadge(); notify('Admin token saved.'); refresh(); };
      $('clearToken').onclick = clearSession;
      $('clearSession').onclick = clearSession;
      $('refresh').onclick = refresh;

      async function api(path, options = {}) {
        const token = $('adminToken').value || localStorage.getItem('tlg_admin_token');
        if (token) localStorage.setItem('tlg_admin_token', token);
        const res = await fetch('/admin' + path, {
          ...options,
          headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(options.headers || {}) }
        });
        const text = await res.text();
        const body = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(readableError(body));
        return body;
      }
      function readableError(body) {
        if (!body) return 'Request failed.';
        if (body.error) return body.error + (body.details ? ': ' + JSON.stringify(body.details) : '');
        return JSON.stringify(body);
      }
      function persistToken() {
        if ($('adminToken').value) localStorage.setItem('tlg_admin_token', $('adminToken').value);
      }
      function clearSession() {
        localStorage.removeItem('tlg_admin_token');
        $('adminToken').value = '';
        updateSessionBadge();
        notify('Admin token cleared.');
      }
      function updateSessionBadge() {
        const active = Boolean($('adminToken').value || localStorage.getItem('tlg_admin_token'));
        $('sessionBadge').textContent = active ? 'Admin session' : 'Locked';
        $('sessionBadge').className = 'badge ' + (active ? 'ok' : 'warn');
      }
      function switchTab(tab) {
        document.querySelectorAll('.nav button').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
        document.querySelectorAll('.section').forEach((section) => section.classList.toggle('active', section.id === tab));
        $('pageTitle').textContent = titles[tab][0];
        $('pageSubtitle').textContent = titles[tab][1];
      }
      function notify(message) {
        const toast = $('toast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
      }
      function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      }
      function fmtNumber(value) {
        const n = Number(value ?? 0);
        return Number.isFinite(n) ? new Intl.NumberFormat().format(n) : '0';
      }

      async function refresh() {
        persistToken();
        updateSessionBadge();
        setLoading();
        const results = await Promise.allSettled([api('/users'), api('/providers'), api('/model-aliases'), api('/keys'), api('/usage')]);
        const [users, providers, aliases, keys, usage] = results;
        if (users.status === 'fulfilled') state.users = users.value;
        if (providers.status === 'fulfilled') state.providers = providers.value;
        if (aliases.status === 'fulfilled') state.aliases = aliases.value;
        if (keys.status === 'fulfilled') state.keys = keys.value;
        if (usage.status === 'fulfilled') state.usage = usage.value;
        renderAll();
        const failures = results.filter((result) => result.status === 'rejected');
        notify(failures.length ? failures.map((failure) => failure.reason.message).join('\\n') : 'Dashboard refreshed.');
      }

      function setLoading() {
        for (const id of ['providersTable', 'aliasesTable', 'keysTable', 'usageTables']) {
          if (!$(id).innerHTML) $(id).innerHTML = '<div class="empty">Loading data...</div>';
        }
      }
      function renderAll() {
        renderOverview();
        renderSelects();
        renderProviders();
        renderAliases();
        renderKeys();
        renderUsage();
      }
      function renderOverview() {
        const enabledProviders = state.providers.filter((p) => p.enabled).length;
        const enabledAliases = state.aliases.filter((a) => a.enabled).length;
        const activeKeys = state.keys.filter((k) => k.status === 'active').length;
        $('metricProviders').textContent = fmtNumber(enabledProviders);
        $('metricAliases').textContent = fmtNumber(enabledAliases);
        $('metricKeys').textContent = fmtNumber(activeKeys);
        const providerHealth = state.providers.some((p) => p.healthStatus === 'healthy') ? 'Healthy' : state.providers.length ? 'Needs check' : 'No provider';
        $('providerHealthBadge').textContent = providerHealth;
        $('providerHealthBadge').className = 'badge ' + (providerHealth === 'Healthy' ? 'ok' : providerHealth === 'No provider' ? 'warn' : 'info');
        $('overviewStatus').innerHTML = [
          statusLine('Control plane API', 'Connected', 'ok'),
          statusLine('Providers configured', enabledProviders ? enabledProviders + ' enabled' : 'None yet', enabledProviders ? 'ok' : 'warn'),
          statusLine('Model aliases', enabledAliases ? enabledAliases + ' enabled' : 'None yet', enabledAliases ? 'ok' : 'warn'),
          statusLine('User keys', activeKeys ? activeKeys + ' active' : 'No active keys', activeKeys ? 'ok' : 'info')
        ].join('');
      }
      function statusLine(label, value, tone) {
        return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--border);padding:8px 0"><span>' + esc(label) + '</span><span class="badge ' + tone + '">' + esc(value) + '</span></div>';
      }
      function renderSelects() {
        $('keyUser').innerHTML = state.users.length ? state.users.map((u) => '<option value="' + esc(u.id) + '">' + esc(u.email) + '</option>').join('') : '<option value="">Create a user first</option>';
        $('aliasProvider').innerHTML = state.providers.length ? state.providers.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.slug) + '</option>').join('') : '<option value="">Create a provider first</option>';
      }
      function table(headers, rows, empty) {
        if (!rows.length) return '<div class="empty">' + empty + '</div>';
        return '<div class="table-wrap"><table><thead><tr>' + headers.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
      }
      function renderProviders() {
        $('providersTable').innerHTML = table(['Provider', 'Base URL', 'Key', 'Health', 'Actions'], state.providers.map((p) =>
          '<tr><td><strong>' + esc(p.slug) + '</strong><div class="hint">' + esc(p.name) + '</div></td><td class="truncate mono">' + esc(p.baseUrl) + '</td><td>' + esc(p.apiKeyLast4 ? '***' + p.apiKeyLast4 : 'none') + '</td><td>' + providerBadge(p) + '</td><td><div class="row"><button class="secondary" onclick="health(\\'' + esc(p.id) + '\\')">Health</button><button class="secondary" onclick="rotateProvider(\\'' + esc(p.id) + '\\')">Rotate</button><button class="danger" onclick="deleteProvider(\\'' + esc(p.id) + '\\')">Disable</button></div></td></tr>'
        ), 'No providers configured. Add 9Router, ai.company.com, or another OpenAI-compatible upstream.');
      }
      function providerBadge(p) {
        if (!p.enabled) return '<span class="badge off">Disabled</span>';
        if (p.healthStatus === 'healthy') return '<span class="badge ok">Healthy</span>';
        if (p.healthStatus === 'unhealthy') return '<span class="badge danger">Unhealthy</span>';
        return '<span class="badge warn">Unchecked</span>';
      }
      function renderAliases() {
        $('aliasesTable').innerHTML = table(['Alias', 'Provider', 'Upstream Model', 'Status', 'Actions'], state.aliases.map((a) =>
          '<tr><td><strong class="mono">' + esc(a.alias) + '</strong></td><td>' + esc(a.provider?.slug ?? 'unknown') + '</td><td class="truncate mono">' + esc(a.upstreamModel) + '</td><td><span class="badge ' + (a.enabled ? 'ok' : 'off') + '">' + esc(a.enabled ? 'Enabled' : 'Disabled') + '</span></td><td><div class="row"><button class="secondary" onclick="syncAlias(\\'' + esc(a.id) + '\\')">Sync</button><button class="danger" onclick="deleteAlias(\\'' + esc(a.id) + '\\')">Disable</button></div></td></tr>'
        ), 'No model aliases yet. Create stable names like code-premium before issuing developer keys.');
      }
      function renderKeys() {
        $('keysTable').innerHTML = table(['Name', 'Prefix', 'User', 'Team', 'Status', 'Actions'], state.keys.map((k) =>
          '<tr><td><strong>' + esc(k.name) + '</strong><div class="hint mono">' + esc(k.litellmKeyAlias ?? '') + '</div></td><td class="mono">' + esc(k.prefix) + '</td><td class="mono">' + esc(k.userId) + '</td><td class="mono">' + esc(k.teamId ?? '-') + '</td><td><span class="badge ' + (k.status === 'active' ? 'ok' : 'off') + '">' + esc(k.status) + '</span></td><td>' + (k.status === 'active' ? '<button class="danger" onclick="revokeKey(\\'' + esc(k.id) + '\\')">Revoke</button>' : '<span class="hint">No actions</span>') + '</td></tr>'
        ), 'No keys yet. Create a user, then issue a personal LiteLLM virtual key.');
      }
      function renderUsage() {
        const totals = state.usage?.totals ?? {};
        $('usageRequests').textContent = fmtNumber(totals.requests);
        $('usageTokens').textContent = fmtNumber(totals.totalTokens);
        $('usageCost').textContent = '$' + Number(totals.estimatedCost ?? 0).toFixed(4);
        $('usageTables').innerHTML = '<div class="grid two">' + usageGroup('By User', state.usage?.byUser, 'userId') + usageGroup('By Model', state.usage?.byModel, 'model') + '</div>';
      }
      function usageGroup(title, rows = [], key) {
        return '<div>' + '<h3>' + esc(title) + '</h3>' + table([key, 'Requests', 'Tokens', 'Cost'], rows.map((r) =>
          '<tr><td class="mono">' + esc(r[key]) + '</td><td>' + fmtNumber(r.requests) + '</td><td>' + fmtNumber(r.totalTokens) + '</td><td>$' + Number(r.estimatedCost ?? 0).toFixed(4) + '</td></tr>'
        ), 'No usage recorded yet.') + '</div>';
      }

      $('createUser').onclick = async () => {
        const payload = { email: $('userEmail').value, name: $('userName').value };
        if ($('teamSlug').value) payload.team = { slug: $('teamSlug').value, name: $('teamName').value || $('teamSlug').value };
        try { await api('/users', { method: 'POST', body: JSON.stringify(payload) }); notify('User created.'); await refresh(); } catch (e) { notify(e.message); }
      };
      $('createKey').onclick = async () => {
        const payload = { userId: $('keyUser').value, name: $('keyName').value, models: $('keyModels').value.split(',').map((s) => s.trim()).filter(Boolean) };
        try {
          const key = await api('/keys', { method: 'POST', body: JSON.stringify(payload) });
          $('newKey').style.display = 'grid';
          $('newKey').innerHTML = '<strong>Copy this key now. It will not be shown again.</strong><code>' + esc(key.apiKey) + '</code><div class="actions"><button class="secondary" onclick="copyText(\\'' + esc(key.apiKey) + '\\')">Copy Key</button></div>';
          notify('LiteLLM virtual key created.');
          await refresh();
        } catch (e) { notify(e.message); }
      };
      $('createProvider').onclick = async () => {
        const payload = { slug: $('providerSlug').value, name: $('providerName').value, baseUrl: $('providerBaseUrl').value };
        if ($('providerApiKey').value) payload.apiKey = $('providerApiKey').value;
        try { await api('/providers', { method: 'POST', body: JSON.stringify(payload) }); $('providerApiKey').value = ''; notify('Provider created. Run health check next.'); await refresh(); } catch (e) { notify(e.message); }
      };
      $('createAlias').onclick = async () => {
        const payload = { alias: $('aliasName').value, providerId: $('aliasProvider').value, upstreamModel: $('upstreamModel').value };
        try { await api('/model-aliases', { method: 'POST', body: JSON.stringify(payload) }); notify('Alias created and sync requested.'); await refresh(); } catch (e) { notify(e.message); }
      };
      $('copyCodex').onclick = () => copyText('OPENAI_BASE_URL=https://llm.apps.anggaprytn.com/v1\\nOPENAI_API_KEY=<personal_litellm_key>\\nOPENAI_MODEL=code-premium');
      window.copyText = async (value) => { await navigator.clipboard.writeText(value); notify('Copied.'); };
      window.health = async (id) => { try { notify('Checking provider...'); await api('/providers/' + id + '/health'); await refresh(); } catch (e) { notify(e.message); await refresh(); } };
      window.rotateProvider = async (id) => {
        const apiKey = prompt('New provider API key');
        if (!apiKey) return;
        try { await api('/providers/' + id + '/rotate-key', { method: 'POST', body: JSON.stringify({ apiKey, syncAliases: true }) }); notify('Provider key rotated.'); await refresh(); } catch (e) { notify(e.message); }
      };
      window.deleteProvider = async (id) => { if (confirm('Disable provider and aliases?')) { try { await api('/providers/' + id, { method: 'DELETE' }); notify('Provider disabled.'); await refresh(); } catch (e) { notify(e.message); } } };
      window.syncAlias = async (id) => { try { await api('/model-aliases/' + id + '/sync', { method: 'POST' }); notify('Alias synced.'); } catch (e) { notify(e.message); } };
      window.deleteAlias = async (id) => { if (confirm('Disable alias?')) { try { await api('/model-aliases/' + id, { method: 'DELETE' }); notify('Alias disabled.'); await refresh(); } catch (e) { notify(e.message); } } };
      window.revokeKey = async (id) => { if (confirm('Revoke this key? Existing clients using it will fail.')) { try { await api('/keys/' + id + '/revoke', { method: 'POST' }); notify('Key revoked.'); await refresh(); } catch (e) { notify(e.message); } } };
      if ($('adminToken').value) refresh(); else renderAll();
    </script>
  </body>
</html>`;
}

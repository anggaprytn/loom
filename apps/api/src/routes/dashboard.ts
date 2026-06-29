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
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #17201b;
        background: #f7f8f5;
      }
      * { box-sizing: border-box; }
      body { margin: 0; }
      main { max-width: 1180px; margin: 0 auto; padding: 28px 20px 44px; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
      h1 { margin: 0; font-size: 24px; line-height: 1.2; }
      h2 { margin: 0 0 12px; font-size: 16px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .panel { border: 1px solid #d8ded4; border-radius: 8px; background: #ffffff; padding: 16px; }
      .wide { grid-column: 1 / -1; }
      label { display: block; font-size: 12px; font-weight: 650; color: #4f5f55; margin: 10px 0 5px; }
      input, select, textarea {
        width: 100%; height: 38px; border: 1px solid #cbd4ca; border-radius: 6px; padding: 8px 10px;
        font: inherit; background: #fff; color: #17201b;
      }
      textarea { min-height: 92px; resize: vertical; }
      button {
        height: 36px; border: 1px solid #1f5f43; border-radius: 6px; background: #24724f; color: #fff;
        padding: 0 12px; font-weight: 700; cursor: pointer;
      }
      button.secondary { background: #fff; color: #1f5f43; }
      button.danger { background: #9f2d2d; border-color: #8b2424; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .actions { margin-top: 12px; }
      .muted { color: #68756d; font-size: 13px; }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border-bottom: 1px solid #e4e8e1; padding: 8px 6px; text-align: left; vertical-align: top; }
      th { color: #4f5f55; font-size: 12px; }
      @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>team-llm-gateway</h1>
          <div class="muted">Admin console for users, keys, providers, model aliases, and usage.</div>
        </div>
        <div class="row">
          <input id="adminToken" type="password" placeholder="ADMIN_TOKEN" autocomplete="off" style="width: 280px" />
          <button id="saveToken">Save</button>
          <button id="refresh" class="secondary">Refresh</button>
        </div>
      </header>

      <section class="grid">
        <div class="panel">
          <h2>Create User</h2>
          <label>Email</label><input id="userEmail" placeholder="dev@example.com" />
          <label>Name</label><input id="userName" placeholder="Dev Example" />
          <label>Team Slug</label><input id="teamSlug" placeholder="engineering" />
          <label>Team Name</label><input id="teamName" placeholder="Engineering" />
          <div class="actions"><button id="createUser">Create User</button></div>
        </div>

        <div class="panel">
          <h2>Create LiteLLM Key</h2>
          <label>User</label><select id="keyUser"></select>
          <label>Name</label><input id="keyName" value="codex" />
          <label>Models</label><input id="keyModels" value="code-premium,code-balanced,code-fallback" />
          <div class="actions"><button id="createKey">Create Key</button></div>
          <pre id="newKey" class="muted"></pre>
        </div>

        <div class="panel">
          <h2>Create Provider</h2>
          <label>Slug</label><input id="providerSlug" placeholder="9router" />
          <label>Name</label><input id="providerName" placeholder="9Router Local" />
          <label>Base URL</label><input id="providerBaseUrl" placeholder="http://9router:20128/v1" />
          <label>API Key</label><input id="providerApiKey" type="password" placeholder="provider token if required" />
          <div class="actions"><button id="createProvider">Create Provider</button></div>
        </div>

        <div class="panel">
          <h2>Create Model Alias</h2>
          <label>Alias</label><input id="aliasName" value="code-premium" />
          <label>Provider</label><select id="aliasProvider"></select>
          <label>Upstream Model</label><input id="upstreamModel" value="openai/gemini-2.5-pro" />
          <div class="actions"><button id="createAlias">Create + Sync</button></div>
        </div>

        <div class="panel wide">
          <h2>Providers</h2>
          <div id="providers"></div>
        </div>

        <div class="panel wide">
          <h2>Model Aliases</h2>
          <div id="aliases"></div>
        </div>

        <div class="panel wide">
          <h2>Usage</h2>
          <pre id="usage">No data loaded.</pre>
        </div>

        <div class="panel wide">
          <h2>Activity</h2>
          <pre id="activity">Ready.</pre>
        </div>
      </section>
    </main>

    <script>
      const $ = (id) => document.getElementById(id);
      const state = { users: [], providers: [], aliases: [], keys: [] };
      $('adminToken').value = localStorage.getItem('tlg_admin_token') || '';
      $('saveToken').onclick = () => { persistToken(); log('Token saved locally in this browser.'); };
      $('refresh').onclick = refresh;

      async function api(path, options = {}) {
        const token = $('adminToken').value || localStorage.getItem('tlg_admin_token');
        if (token) localStorage.setItem('tlg_admin_token', token);
        const res = await fetch('/admin' + path, {
          ...options,
          headers: {
            authorization: 'Bearer ' + token,
            'content-type': 'application/json',
            ...(options.headers || {})
          }
        });
        const text = await res.text();
        const body = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error(JSON.stringify(body));
        return body;
      }

      function persistToken() {
        if ($('adminToken').value) localStorage.setItem('tlg_admin_token', $('adminToken').value);
      }
      function log(value) { $('activity').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
      function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      }

      async function refresh() {
        persistToken();
        const results = await Promise.allSettled([
          api('/users'), api('/providers'), api('/model-aliases'), api('/keys'), api('/usage')
        ]);
        const [users, providers, aliases, keys, usage] = results;

        if (users.status === 'fulfilled') state.users = users.value;
        if (providers.status === 'fulfilled') state.providers = providers.value;
        if (aliases.status === 'fulfilled') state.aliases = aliases.value;
        if (keys.status === 'fulfilled') state.keys = keys.value;

        if ([users, providers, aliases, keys].some((result) => result.status === 'fulfilled')) {
          renderSelects();
          renderProviders();
          renderAliases();
        }

        if (usage.status === 'fulfilled') {
          $('usage').textContent = JSON.stringify(usage.value.totals || usage.value, null, 2);
        }

        const failures = results.filter((result) => result.status === 'rejected');
        log(failures.length ? failures.map((failure) => failure.reason.message).join('\\n') : 'Refreshed.');
      }

      function renderSelects() {
        $('keyUser').innerHTML = state.users.map((u) => '<option value="' + esc(u.id) + '">' + esc(u.email) + '</option>').join('');
        $('aliasProvider').innerHTML = state.providers.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.slug) + '</option>').join('');
      }

      function renderProviders() {
        $('providers').innerHTML = '<table><thead><tr><th>Slug</th><th>URL</th><th>Key</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
          state.providers.map((p) => '<tr><td>' + esc(p.slug) + '</td><td>' + esc(p.baseUrl) + '</td><td>' + esc(p.apiKeyLast4 ? '***' + p.apiKeyLast4 : 'none') + '</td><td>' + esc(p.enabled ? 'enabled' : 'disabled') + '</td><td class="row"><button class="secondary" onclick="health(\\'' + esc(p.id) + '\\')">Health</button><button class="secondary" onclick="rotateProvider(\\'' + esc(p.id) + '\\')">Rotate</button><button class="danger" onclick="deleteProvider(\\'' + esc(p.id) + '\\')">Disable</button></td></tr>').join('') +
          '</tbody></table>';
      }

      function renderAliases() {
        $('aliases').innerHTML = '<table><thead><tr><th>Alias</th><th>Provider</th><th>Upstream</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
          state.aliases.map((a) => '<tr><td>' + esc(a.alias) + '</td><td>' + esc(a.provider.slug) + '</td><td>' + esc(a.upstreamModel) + '</td><td>' + esc(a.enabled ? 'enabled' : 'disabled') + '</td><td class="row"><button class="secondary" onclick="syncAlias(\\'' + esc(a.id) + '\\')">Sync</button><button class="danger" onclick="deleteAlias(\\'' + esc(a.id) + '\\')">Disable</button></td></tr>').join('') +
          '</tbody></table>';
      }

      $('createUser').onclick = async () => {
        const payload = { email: $('userEmail').value, name: $('userName').value };
        if ($('teamSlug').value) payload.team = { slug: $('teamSlug').value, name: $('teamName').value || $('teamSlug').value };
        try { log(await api('/users', { method: 'POST', body: JSON.stringify(payload) })); await refresh(); } catch (e) { log(e.message); }
      };
      $('createKey').onclick = async () => {
        const payload = { userId: $('keyUser').value, name: $('keyName').value, models: $('keyModels').value.split(',').map((s) => s.trim()).filter(Boolean) };
        try { const key = await api('/keys', { method: 'POST', body: JSON.stringify(payload) }); $('newKey').textContent = 'Copy once: ' + key.apiKey; await refresh(); } catch (e) { log(e.message); }
      };
      $('createProvider').onclick = async () => {
        const payload = { slug: $('providerSlug').value, name: $('providerName').value, baseUrl: $('providerBaseUrl').value };
        if ($('providerApiKey').value) payload.apiKey = $('providerApiKey').value;
        try { log(await api('/providers', { method: 'POST', body: JSON.stringify(payload) })); $('providerApiKey').value = ''; await refresh(); } catch (e) { log(e.message); }
      };
      $('createAlias').onclick = async () => {
        const payload = { alias: $('aliasName').value, providerId: $('aliasProvider').value, upstreamModel: $('upstreamModel').value };
        try { log(await api('/model-aliases', { method: 'POST', body: JSON.stringify(payload) })); await refresh(); } catch (e) { log(e.message); }
      };
      window.health = async (id) => { try { log(await api('/providers/' + id + '/health')); await refresh(); } catch (e) { log(e.message); } };
      window.rotateProvider = async (id) => {
        const apiKey = prompt('New provider API key');
        if (!apiKey) return;
        try { log(await api('/providers/' + id + '/rotate-key', { method: 'POST', body: JSON.stringify({ apiKey, syncAliases: true }) })); await refresh(); } catch (e) { log(e.message); }
      };
      window.deleteProvider = async (id) => { if (confirm('Disable provider and aliases?')) { try { log(await api('/providers/' + id, { method: 'DELETE' })); await refresh(); } catch (e) { log(e.message); } } };
      window.syncAlias = async (id) => { try { log(await api('/model-aliases/' + id + '/sync', { method: 'POST' })); } catch (e) { log(e.message); } };
      window.deleteAlias = async (id) => { if (confirm('Disable alias?')) { try { log(await api('/model-aliases/' + id, { method: 'DELETE' })); await refresh(); } catch (e) { log(e.message); } } };
      if ($('adminToken').value) refresh();
    </script>
  </body>
</html>`;
}

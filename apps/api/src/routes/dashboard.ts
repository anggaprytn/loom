import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const webDistDir = path.resolve(process.cwd(), 'apps/web/dist');
const webIndexPath = path.join(webDistDir, 'index.html');

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    const indexHtml = await readBuiltDashboard();
    if (indexHtml) {
      return reply
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(indexHtml);
    }

    return reply
      .type('text/html; charset=utf-8')
      .header(
        'Content-Security-Policy',
        "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
      )
      .send(renderDashboard());
  });

  app.get('/assets/:file', async (request, reply) => {
    const params = request.params as { file: string };
    const fileName = path.basename(params.file);
    const filePath = path.join(webDistDir, 'assets', fileName);

    try {
      await access(filePath);
    } catch {
      return reply.code(404).send({
        error: {
          code: 'DASHBOARD_ASSET_NOT_FOUND',
          message: 'Dashboard asset was not found.',
        },
      });
    }

    return reply
      .type(contentTypeFor(fileName))
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(createReadStream(filePath));
  });
}

async function readBuiltDashboard() {
  try {
    return await readFile(webIndexPath, 'utf8');
  } catch {
    return null;
  }
}

function contentTypeFor(fileName: string) {
  if (fileName.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (fileName.endsWith('.css')) return 'text/css; charset=utf-8';
  if (fileName.endsWith('.svg')) return 'image/svg+xml';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
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
        --bg: #f5f6f3;
        --surface: #ffffff;
        --surface-subtle: #f8faf7;
        --surface-strong: #f1f4ef;
        --border: #d9dfd6;
        --border-strong: #b8c2b7;
        --text: #17201b;
        --muted: #59685f;
        --faint: #77837b;
        --brand: #1f6f4d;
        --brand-strong: #155239;
        --brand-soft: #e6f2eb;
        --danger: #a33a35;
        --danger-strong: #7f2825;
        --danger-soft: #f9e7e5;
        --warn: #8b641d;
        --warn-soft: #fff3d7;
        --info: #315f9f;
        --info-soft: #e7effb;
        --success: #23724f;
        --success-soft: #e5f3ec;
        --shadow: 0 1px 2px rgba(23, 32, 27, 0.05), 0 10px 28px rgba(23, 32, 27, 0.06);
        --radius: 8px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background: var(--bg);
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      button, input, select, textarea { font: inherit; }
      button {
        min-height: 36px; border: 1px solid transparent; border-radius: 7px; padding: 0 12px;
        font-weight: 750; cursor: pointer; transition: background .12s, border-color .12s, color .12s, opacity .12s;
        display: inline-flex; align-items: center; justify-content: center; gap: 7px; white-space: nowrap;
      }
      button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
        outline: 3px solid rgba(31, 111, 77, .22); outline-offset: 1px;
      }
      button.primary { background: var(--brand); color: #fff; border-color: var(--brand); }
      button.primary:hover { background: var(--brand-strong); }
      button.secondary { background: var(--surface); color: var(--brand); border-color: var(--border-strong); }
      button.secondary:hover { border-color: var(--brand); background: var(--brand-soft); }
      button.ghost { background: transparent; color: var(--muted); border-color: transparent; }
      button.ghost:hover { background: var(--surface-strong); color: var(--text); }
      button.danger { background: var(--danger); color: #fff; border-color: var(--danger); }
      button.danger:hover { background: var(--danger-strong); }
      button.icon-only { width: 36px; padding: 0; }
      button.sort {
        min-height: 28px; padding: 0; border: 0; background: transparent; color: inherit; justify-content: flex-start;
        font-size: 12px; font-weight: 800; width: 100%;
      }
      button:disabled { opacity: .55; cursor: not-allowed; }
      input, select, textarea {
        width: 100%; min-height: 38px; border: 1px solid var(--border); border-radius: 7px;
        padding: 8px 10px; background: var(--surface); color: var(--text);
      }
      textarea { min-height: 92px; resize: vertical; }
      label { display: block; margin: 0 0 6px; font-size: 12px; font-weight: 750; color: var(--muted); }
      .required::after { content: " *"; color: var(--danger); }
      .field-error { margin-top: 5px; color: var(--danger); font-size: 12px; line-height: 1.35; display: none; }
      .invalid input, .invalid select, .invalid textarea { border-color: #d99590; background: #fffafa; }
      .invalid .field-error { display: block; }
      .app { min-height: 100vh; display: grid; grid-template-columns: 252px 1fr; }
      .sidebar {
        position: sticky; top: 0; height: 100vh; padding: 20px 14px; border-right: 1px solid var(--border);
        background: #fbfcfa;
      }
      .brand { padding: 4px 8px 18px; }
      .brand h1 { margin: 0; font-size: 18px; line-height: 1.15; letter-spacing: 0; }
      .brand p { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
      .nav { display: grid; gap: 4px; }
      .nav button {
        width: 100%; justify-content: flex-start; padding: 9px 10px; color: var(--muted);
        background: transparent; border-color: transparent; text-align: left;
      }
      .nav button[aria-selected="true"] { background: var(--brand-soft); color: var(--brand-strong); }
      .icon { width: 18px; height: 18px; flex: 0 0 18px; stroke-width: 1.9; }
      .icon.small { width: 16px; height: 16px; flex-basis: 16px; }
      .shell { min-width: 0; }
      .topbar {
        min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 14px;
        padding: 16px 24px; border-bottom: 1px solid var(--border); background: rgba(245, 246, 243, .94);
        backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 5;
      }
      .title h2 { margin: 0; font-size: 22px; line-height: 1.2; letter-spacing: 0; }
      .title p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
      .session { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .session input { width: min(320px, 42vw); }
      .content { max-width: 1280px; margin: 0 auto; padding: 22px 24px 48px; }
      .section { display: none; }
      .section.active { display: block; }
      .grid { display: grid; gap: 16px; }
      .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .panel, .card {
        background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
        box-shadow: var(--shadow); padding: 16px;
      }
      .panel + .panel, .panel-stack { margin-top: 16px; }
      .card.compact { box-shadow: none; }
      .card h3, .panel h3 { margin: 0 0 10px; font-size: 15px; line-height: 1.25; }
      .sub { margin: -4px 0 14px; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .metric { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-height: 94px; }
      .metric .value { font-size: 28px; font-weight: 780; line-height: 1; font-variant-numeric: tabular-nums; }
      .metric .label { margin-top: 7px; color: var(--muted); font-size: 13px; }
      .badge {
        display: inline-flex; align-items: center; gap: 5px; min-height: 24px; padding: 2px 8px; border-radius: 999px;
        font-size: 12px; font-weight: 750; border: 1px solid transparent; white-space: nowrap;
      }
      .badge.ok { background: var(--success-soft); color: var(--success); border-color: #bfdecf; }
      .badge.warn { background: var(--warn-soft); color: var(--warn); border-color: #ead397; }
      .badge.info { background: var(--info-soft); color: var(--info); border-color: #bfd1ee; }
      .badge.off { background: #eef0ec; color: var(--muted); border-color: var(--border); }
      .badge.danger { background: var(--danger-soft); color: var(--danger); border-color: #efc1bd; }
      .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .form-grid .full { grid-column: 1 / -1; }
      .actions, .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .actions { margin-top: 14px; }
      .row.tight { gap: 6px; flex-wrap: nowrap; }
      .hint { color: var(--muted); font-size: 12px; line-height: 1.45; }
      .table-tools {
        display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; flex-wrap: wrap;
      }
      .table-tools h3 { margin: 0; font-size: 16px; }
      .table-tools .filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .table-tools input, .table-tools select { width: 220px; min-height: 34px; font-size: 13px; }
      .table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
      table { width: 100%; border-collapse: collapse; min-width: 860px; font-size: 13px; }
      th, td { border-bottom: 1px solid #e8ece5; padding: 9px 10px; text-align: left; vertical-align: middle; }
      th { color: var(--muted); background: var(--surface-subtle); font-size: 12px; font-weight: 800; position: sticky; top: 0; z-index: 1; }
      tr:last-child td { border-bottom: 0; }
      tbody tr:hover { background: #fbfcfa; }
      code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .truncate { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .empty, .inline-error {
        border: 1px dashed var(--border-strong); border-radius: var(--radius); padding: 18px; background: var(--surface-subtle);
        color: var(--muted); font-size: 13px; line-height: 1.5;
      }
      .inline-error { border-style: solid; border-color: #efc1bd; background: var(--danger-soft); color: var(--danger); }
      .callout { border-radius: var(--radius); padding: 12px; font-size: 13px; line-height: 1.45; border: 1px solid var(--border); }
      .callout.info { background: var(--info-soft); border-color: #bfd1ee; color: #244977; }
      .callout.warn { background: var(--warn-soft); border-color: #ead397; color: #6f4e18; }
      .secret {
        display: grid; gap: 10px; margin-top: 12px; padding: 12px; border: 1px solid #bfd1ee; border-radius: var(--radius);
        background: var(--info-soft);
      }
      .secret code { word-break: break-all; font-size: 12px; }
      .toast {
        position: fixed; right: 18px; bottom: 18px; max-width: min(460px, calc(100vw - 36px)); z-index: 40;
        background: #17201b; color: #fff; border-radius: var(--radius); padding: 12px 14px; box-shadow: var(--shadow);
        font-size: 13px; line-height: 1.45; display: none; white-space: pre-wrap; border: 1px solid transparent;
      }
      .toast.show { display: block; }
      .toast.ok { background: #153d2d; }
      .toast.warn { background: #493512; }
      .toast.error { background: #531d1b; }
      .divider { height: 1px; background: var(--border); margin: 16px 0; }
      .meta-line { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; margin-top: 10px; flex-wrap: wrap; }
      .modal-backdrop {
        position: fixed; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center;
        padding: 20px; background: rgba(23, 32, 27, .38);
      }
      .modal-backdrop.show { display: flex; }
      .modal {
        width: min(560px, 100%); background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
        box-shadow: 0 18px 70px rgba(23, 32, 27, .24); padding: 18px;
      }
      .modal h3 { margin: 0; font-size: 18px; line-height: 1.25; }
      .modal-body { margin-top: 12px; color: var(--muted); font-size: 13px; line-height: 1.5; }
      .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
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
        .table-tools { align-items: stretch; }
        .table-tools .filters, .table-tools input, .table-tools select { width: 100%; }
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
          <button data-tab="overview" aria-selected="true"><span data-icon="layout-dashboard"></span>Overview</button>
          <button data-tab="keys" aria-selected="false"><span data-icon="key-round"></span>Users & Keys</button>
          <button data-tab="providers" aria-selected="false"><span data-icon="server"></span>Providers</button>
          <button data-tab="aliases" aria-selected="false"><span data-icon="route"></span>Model Aliases</button>
          <button data-tab="usage" aria-selected="false"><span data-icon="bar-chart-3"></span>Usage</button>
          <button data-tab="settings" aria-selected="false"><span data-icon="settings"></span>Settings</button>
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
            <button id="saveToken" class="primary"><span data-icon="unlock"></span>Unlock</button>
            <button id="clearToken" class="secondary"><span data-icon="x"></span>Clear</button>
            <button id="refresh" class="secondary"><span data-icon="refresh-cw"></span>Refresh</button>
          </div>
        </header>

        <main class="content">
          <section id="overview" class="section active">
            <div class="grid three">
              <div class="card metric">
                <div><div id="metricProviders" class="value">-</div><div class="label">Enabled providers</div></div>
                <span id="providerHealthBadge" class="badge off">Unknown</span>
              </div>
              <div class="card metric">
                <div><div id="metricAliases" class="value">-</div><div class="label">Enabled model aliases</div></div>
                <span class="badge info">LiteLLM routes</span>
              </div>
              <div class="card metric">
                <div><div id="metricKeys" class="value">-</div><div class="label">Active user keys</div></div>
                <span class="badge ok">Virtual keys</span>
              </div>
            </div>
            <div class="grid two panel-stack">
              <div class="panel">
                <h3>Gateway Status</h3>
                <p class="sub">A quick read on whether the admin console can reach the control-plane data.</p>
                <div id="overviewStatus" class="grid"></div>
                <div id="refreshMeta" class="meta-line">Last refreshed: never</div>
              </div>
              <div class="panel">
                <h3>Operator Runbook</h3>
                <p class="sub">Shortest path from empty system to working developer access.</p>
                <div class="callout info">
                  1. Add provider and run health check.<br />
                  2. Create model aliases and sync them to LiteLLM.<br />
                  3. Create developer user and personal LiteLLM key.<br />
                  4. Test client tooling against <span class="mono">code-premium</span>.
                </div>
              </div>
            </div>
          </section>

          <section id="keys" class="section">
            <div class="grid two">
              <div class="panel">
                <h3>Invite Developer</h3>
                <p class="sub">Create a user first, then issue a personal LiteLLM virtual key.</p>
                <div class="form-grid">
                  <div data-field="userEmail"><label class="required" for="userEmail">Email</label><input id="userEmail" placeholder="dev@example.com" /><div class="field-error"></div></div>
                  <div data-field="userName"><label class="required" for="userName">Name</label><input id="userName" placeholder="Dev Example" /><div class="field-error"></div></div>
                  <div><label for="teamSlug">Team Slug</label><input id="teamSlug" placeholder="engineering" /></div>
                  <div><label for="teamName">Team Name</label><input id="teamName" placeholder="Engineering" /></div>
                </div>
                <div class="actions"><button id="createUser" class="primary"><span data-icon="user-plus"></span>Create User</button></div>
              </div>
              <div class="panel">
                <h3>Issue Personal Key</h3>
                <p class="sub">The plaintext key is returned once. Store it in the developer's secret manager.</p>
                <div class="form-grid">
                  <div class="full" data-field="keyUser"><label class="required" for="keyUser">User</label><select id="keyUser"></select><div class="field-error"></div></div>
                  <div data-field="keyName"><label class="required" for="keyName">Key Name</label><input id="keyName" value="codex" /><div class="field-error"></div></div>
                  <div data-field="keyModels"><label class="required" for="keyModels">Model Access</label><input id="keyModels" value="code-premium,code-balanced,code-fallback" /><div class="field-error"></div></div>
                </div>
                <div class="actions"><button id="createKey" class="primary"><span data-icon="key-round"></span>Create Key</button></div>
                <div id="newKey" class="secret" style="display:none"></div>
              </div>
            </div>
            <div class="panel panel-stack">
              <div id="keysToolbar"></div>
              <div id="keysTable"></div>
            </div>
          </section>

          <section id="providers" class="section">
            <div class="grid two">
              <div class="panel">
                <h3>Add Provider</h3>
                <p class="sub">Use an OpenAI-compatible <span class="mono">/v1</span> endpoint. Provider secrets are encrypted at rest.</p>
                <div class="form-grid">
                  <div data-field="providerSlug"><label class="required" for="providerSlug">Slug</label><input id="providerSlug" placeholder="9router" /><div class="field-error"></div></div>
                  <div data-field="providerName"><label class="required" for="providerName">Name</label><input id="providerName" placeholder="9Router Local" /><div class="field-error"></div></div>
                  <div class="full" data-field="providerBaseUrl"><label class="required" for="providerBaseUrl">Base URL</label><input id="providerBaseUrl" placeholder="http://9router:20128/v1" /><div class="field-error"></div></div>
                  <div class="full"><label for="providerApiKey">API Key</label><input id="providerApiKey" type="password" placeholder="provider token if required" /></div>
                </div>
                <div class="actions"><button id="createProvider" class="primary"><span data-icon="server"></span>Create Provider</button></div>
              </div>
              <div class="panel">
                <h3>Provider Rules</h3>
                <p class="sub">Keep upstreams private and stable. Developers should never call them directly.</p>
                <div class="callout warn">
                  Browser sessions, shared personal subscriptions, and cookies are not valid provider credentials.
                  Use OpenAI-compatible APIs, local 9Router, or local model servers.
                </div>
                <div class="divider"></div>
                <p class="hint">Run health checks after creating or rotating a provider. Healthy providers should respond to <span class="mono">GET /v1/models</span>.</p>
              </div>
            </div>
            <div class="panel panel-stack">
              <div id="providersToolbar"></div>
              <div id="providersTable"></div>
            </div>
          </section>

          <section id="aliases" class="section">
            <div class="grid two">
              <div class="panel">
                <h3>Create Model Alias</h3>
                <p class="sub">Aliases are stable public names developers use from Codex, Cursor, Cline, and automation.</p>
                <div class="form-grid">
                  <div data-field="aliasName"><label class="required" for="aliasName">Alias</label><input id="aliasName" value="code-premium" /><div class="field-error"></div></div>
                  <div data-field="aliasProvider"><label class="required" for="aliasProvider">Provider</label><select id="aliasProvider"></select><div class="field-error"></div></div>
                  <div class="full" data-field="upstreamModel"><label class="required" for="upstreamModel">Upstream Model</label><input id="upstreamModel" value="openai/gemini-2.5-pro" /><div class="field-error"></div></div>
                </div>
                <div class="actions"><button id="createAlias" class="primary"><span data-icon="route"></span>Create + Sync</button></div>
              </div>
              <div class="panel">
                <h3>Routing Preview</h3>
                <p class="sub">Developers see aliases. Operators control provider and upstream model mapping.</p>
                <div class="callout info"><span class="mono">Codex -> LiteLLM key -> code-premium -> provider -> upstream model</span></div>
              </div>
            </div>
            <div class="panel panel-stack">
              <div id="aliasesToolbar"></div>
              <div id="aliasesTable"></div>
            </div>
          </section>

          <section id="usage" class="section">
            <div class="grid three">
              <div class="card metric"><div><div id="usageRequests" class="value">-</div><div class="label">Requests</div></div></div>
              <div class="card metric"><div><div id="usageTokens" class="value">-</div><div class="label">Total tokens</div></div></div>
              <div class="card metric"><div><div id="usageCost" class="value">-</div><div class="label">Estimated cost</div></div></div>
            </div>
            <div class="panel panel-stack">
              <div id="usageToolbar"></div>
              <div id="usageTables"></div>
            </div>
          </section>

          <section id="settings" class="section">
            <div class="grid two">
              <div class="panel">
                <h3>Codex Configuration</h3>
                <p class="sub">Give each developer their own LiteLLM virtual key.</p>
                <div class="callout info mono">
OPENAI_BASE_URL=https://llm.example.com/v1<br />
OPENAI_API_KEY=&lt;personal_litellm_key&gt;<br />
OPENAI_MODEL=code-premium
                </div>
              </div>
              <div class="panel">
                <h3>Security Baseline</h3>
                <p class="sub">This dashboard is admin-only and should remain behind VPN or access control.</p>
                <div class="actions">
                  <button id="copyCodex" class="secondary"><span data-icon="copy"></span>Copy Codex Env</button>
                  <button id="clearSession" class="danger"><span data-icon="log-out"></span>Clear Admin Session</button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
    <div id="modalRoot" class="modal-backdrop" role="dialog" aria-modal="true" aria-hidden="true"></div>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <script>
      const $ = (id) => document.getElementById(id);
      const state = {
        users: [],
        providers: [],
        aliases: [],
        keys: [],
        usage: null,
        lastRefresh: null,
        errors: {},
        busy: false
      };
      const tableState = {
        keys: { query: '', status: 'all', sort: 'createdAt', dir: 'desc' },
        providers: { query: '', status: 'all', sort: 'slug', dir: 'asc' },
        aliases: { query: '', status: 'all', sort: 'alias', dir: 'asc' },
        usageUser: { query: '', status: 'all', sort: 'requests', dir: 'desc' },
        usageModel: { query: '', status: 'all', sort: 'requests', dir: 'desc' }
      };
      const titles = {
        overview: ['Overview', 'System health, routing status, and operator actions.'],
        keys: ['Users & Keys', 'Create developers and issue personal LiteLLM virtual keys.'],
        providers: ['Providers', 'Manage OpenAI-compatible upstream providers and credentials.'],
        aliases: ['Model Aliases', 'Map stable public model names to upstream providers.'],
        usage: ['Usage', 'Monitor request volume, token usage, cost, and attribution.'],
        settings: ['Settings', 'Operator notes, client configuration, and session controls.']
      };
      const icons = {
        'layout-dashboard': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
        'key-round': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 18v3h3l9.5-9.5"/><circle cx="16" cy="8" r="6"/><path d="m15 9 2-2"/></svg>',
        'server': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>',
        'route': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="6" cy="19" r="3"/><path d="M9 19h8a3 3 0 0 0 0-6H7a3 3 0 0 1 0-6h8"/><circle cx="18" cy="5" r="3"/></svg>',
        'bar-chart-3': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
        'settings': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>',
        'unlock': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
        'x': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        'refresh-cw': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
        'user-plus': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
        'copy': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        'log-out': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
        'chevron': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg>',
        'alert-triangle': '<svg class="icon small" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg>'
      };

      function hydrateIcons(root = document) {
        root.querySelectorAll('[data-icon]').forEach((node) => {
          node.innerHTML = icons[node.dataset.icon] || '';
        });
      }

      $('adminToken').value = localStorage.getItem('tlg_admin_token') || '';
      hydrateIcons();
      updateSessionBadge();
      renderAll();

      document.querySelectorAll('.nav button').forEach((button) => {
        button.onclick = () => switchTab(button.dataset.tab);
      });
      $('saveToken').onclick = () => { persistToken(); updateSessionBadge(); notify('Admin token saved.', 'ok'); refresh(); };
      $('clearToken').onclick = clearSession;
      $('clearSession').onclick = clearSession;
      $('refresh').onclick = refresh;
      $('copyCodex').onclick = () => copyText('OPENAI_BASE_URL=https://llm.example.com/v1\\nOPENAI_API_KEY=<personal_litellm_key>\\nOPENAI_MODEL=code-premium');

      async function api(path, options = {}) {
        const token = $('adminToken').value || localStorage.getItem('tlg_admin_token');
        if (token) localStorage.setItem('tlg_admin_token', token);
        const res = await fetch('/admin' + path, {
          ...options,
          headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(options.headers || {}) }
        });
        const text = await res.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (_) { body = { error: text || 'Request failed.' }; }
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
        state.errors = {};
        updateSessionBadge();
        renderAll();
        notify('Admin token cleared.', 'warn');
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
      function notify(message, tone = 'ok') {
        const toast = $('toast');
        toast.textContent = message;
        toast.className = 'toast show ' + tone;
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
      function fmtDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
      }
      function lower(value) { return String(value ?? '').toLowerCase(); }
      function includesQuery(row, keys, query) {
        if (!query) return true;
        const q = lower(query);
        return keys.some((key) => lower(typeof key === 'function' ? key(row) : row[key]).includes(q));
      }
      function compareValues(a, b) {
        const aa = a == null ? '' : a;
        const bb = b == null ? '' : b;
        const an = Number(aa);
        const bn = Number(bb);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        return String(aa).localeCompare(String(bb), undefined, { numeric: true, sensitivity: 'base' });
      }
      function sortedRows(rows, tableKey, accessors = {}) {
        const config = tableState[tableKey];
        const getter = accessors[config.sort] || ((row) => row[config.sort]);
        return [...rows].sort((a, b) => compareValues(getter(a), getter(b)) * (config.dir === 'asc' ? 1 : -1));
      }
      function setSort(tableKey, sort) {
        const config = tableState[tableKey];
        if (config.sort === sort) config.dir = config.dir === 'asc' ? 'desc' : 'asc';
        else { config.sort = sort; config.dir = 'asc'; }
        renderAll();
      }
      function sortHeader(tableKey, label, key) {
        const active = tableState[tableKey].sort === key;
        const marker = active ? (tableState[tableKey].dir === 'asc' ? ' ↑' : ' ↓') : '';
        return '<button class="sort" onclick="setSort(\\'' + tableKey + '\\',\\'' + key + '\\')" aria-sort="' + (active ? tableState[tableKey].dir : 'none') + '">' + esc(label + marker) + '</button>';
      }
      window.setSort = setSort;
      window.setTableQuery = (tableKey, value) => { tableState[tableKey].query = value; renderAll(); };
      window.setTableStatus = (tableKey, value) => { tableState[tableKey].status = value; renderAll(); };

      async function withButton(button, label, fn) {
        const original = button.innerHTML;
        button.disabled = true;
        button.textContent = label;
        try { return await fn(); }
        finally { button.disabled = false; button.innerHTML = original; hydrateIcons(button); }
      }

      async function refresh() {
        persistToken();
        updateSessionBadge();
        const token = $('adminToken').value || localStorage.getItem('tlg_admin_token');
        if (!token) {
          notify('Enter the admin token before refreshing.', 'warn');
          renderAll();
          return;
        }
        state.busy = true;
        state.errors = {};
        setLoading();
        renderOverview();
        try {
          const results = await Promise.allSettled([api('/users'), api('/providers'), api('/model-aliases'), api('/keys'), api('/usage')]);
          const names = ['users', 'providers', 'aliases', 'keys', 'usage'];
          results.forEach((result, index) => {
            const name = names[index];
            if (result.status === 'fulfilled') state[name] = result.value;
            else state.errors[name] = result.reason.message;
          });
          state.lastRefresh = new Date();
          renderAll();
          const failures = Object.keys(state.errors);
          notify(failures.length ? 'Refresh completed with ' + failures.length + ' failed section(s).' : 'Dashboard refreshed.', failures.length ? 'warn' : 'ok');
        } finally {
          state.busy = false;
          renderOverview();
        }
      }

      function setLoading() {
        for (const id of ['providersTable', 'aliasesTable', 'keysTable', 'usageTables']) {
          $(id).innerHTML = '<div class="empty">Loading data...</div>';
        }
      }
      function renderAll() {
        renderOverview();
        renderSelects();
        renderProviders();
        renderAliases();
        renderKeys();
        renderUsage();
        hydrateIcons();
      }
      function renderOverview() {
        const enabledProviders = state.providers.filter((p) => p.enabled).length;
        const enabledAliases = state.aliases.filter((a) => a.enabled).length;
        const activeKeys = state.keys.filter((k) => k.status === 'active').length;
        $('metricProviders').textContent = fmtNumber(enabledProviders);
        $('metricAliases').textContent = fmtNumber(enabledAliases);
        $('metricKeys').textContent = fmtNumber(activeKeys);
        const hasUnhealthy = state.providers.some((p) => p.healthStatus === 'unhealthy');
        const providerHealth = hasUnhealthy ? 'Unhealthy' : state.providers.some((p) => p.healthStatus === 'healthy') ? 'Healthy' : state.providers.length ? 'Needs check' : 'No provider';
        $('providerHealthBadge').textContent = providerHealth;
        $('providerHealthBadge').className = 'badge ' + (providerHealth === 'Healthy' ? 'ok' : providerHealth === 'Unhealthy' ? 'danger' : providerHealth === 'No provider' ? 'warn' : 'info');
        $('overviewStatus').innerHTML = [
          statusLine('Control plane API', state.errors.users || state.errors.providers ? 'Partial failure' : 'Connected', state.errors.users || state.errors.providers ? 'warn' : 'ok'),
          statusLine('Providers configured', enabledProviders ? enabledProviders + ' enabled' : 'None yet', enabledProviders ? 'ok' : 'warn'),
          statusLine('Model aliases', enabledAliases ? enabledAliases + ' enabled' : 'None yet', enabledAliases ? 'ok' : 'warn'),
          statusLine('User keys', activeKeys ? activeKeys + ' active' : 'No active keys', activeKeys ? 'ok' : 'info')
        ].join('');
        $('refreshMeta').textContent = state.busy ? 'Refreshing data...' : 'Last refreshed: ' + (state.lastRefresh ? fmtDate(state.lastRefresh) : 'never');
      }
      function statusLine(label, value, tone) {
        return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--border);padding:8px 0"><span>' + esc(label) + '</span><span class="badge ' + tone + '">' + esc(value) + '</span></div>';
      }
      function renderSelects() {
        $('keyUser').innerHTML = state.users.length ? state.users.map((u) => '<option value="' + esc(u.id) + '">' + esc(u.email) + '</option>').join('') : '<option value="">Create a user first</option>';
        $('aliasProvider').innerHTML = state.providers.length ? state.providers.filter((p) => p.enabled).map((p) => '<option value="' + esc(p.id) + '">' + esc(p.slug) + '</option>').join('') : '<option value="">Create a provider first</option>';
      }
      function table(tableKey, headers, rows, empty, minWidth) {
        if (state.errors[tableKey]) return '<div class="inline-error">' + esc(state.errors[tableKey]) + '</div>';
        if (!rows.length) return '<div class="empty">' + esc(empty) + '</div>';
        const style = minWidth ? ' style="min-width:' + esc(minWidth) + 'px"' : '';
        return '<div class="table-wrap"><table' + style + '><thead><tr>' + headers.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
      }
      function toolbar(title, hint, tableKey, statusOptions) {
        const options = statusOptions.map((option) => '<option value="' + esc(option.value) + '"' + (tableState[tableKey].status === option.value ? ' selected' : '') + '>' + esc(option.label) + '</option>').join('');
        return '<div class="table-tools"><div><h3>' + esc(title) + '</h3><div class="hint">' + esc(hint) + '</div></div><div class="filters"><input aria-label="' + esc(title) + ' search" placeholder="Search..." value="' + esc(tableState[tableKey].query) + '" oninput="setTableQuery(\\'' + tableKey + '\\', this.value)" /><select aria-label="' + esc(title) + ' filter" onchange="setTableStatus(\\'' + tableKey + '\\', this.value)">' + options + '</select></div></div>';
      }
      function renderProviders() {
        $('providersToolbar').innerHTML = toolbar('Providers', 'Health checks and rotations are operator actions.', 'providers', [
          { value: 'all', label: 'All statuses' }, { value: 'enabled', label: 'Enabled' }, { value: 'disabled', label: 'Disabled' }, { value: 'healthy', label: 'Healthy' }, { value: 'unhealthy', label: 'Unhealthy' }, { value: 'unchecked', label: 'Unchecked' }
        ]);
        let rows = state.providers.filter((p) => includesQuery(p, ['slug', 'name', 'baseUrl', 'healthStatus'], tableState.providers.query));
        rows = rows.filter((p) => tableState.providers.status === 'all' ||
          (tableState.providers.status === 'enabled' && p.enabled) ||
          (tableState.providers.status === 'disabled' && !p.enabled) ||
          (tableState.providers.status === 'healthy' && p.healthStatus === 'healthy') ||
          (tableState.providers.status === 'unhealthy' && p.healthStatus === 'unhealthy') ||
          (tableState.providers.status === 'unchecked' && p.enabled && !p.healthStatus));
        rows = sortedRows(rows, 'providers');
        $('providersTable').innerHTML = table('providers', [
          sortHeader('providers', 'Provider', 'slug'),
          sortHeader('providers', 'Base URL', 'baseUrl'),
          'Key',
          sortHeader('providers', 'Health', 'healthStatus'),
          sortHeader('providers', 'Last Check', 'lastHealthAt'),
          'Actions'
        ], rows.map((p) =>
          '<tr><td><strong>' + esc(p.slug) + '</strong><div class="hint">' + esc(p.name) + '</div></td><td class="truncate mono" title="' + esc(p.baseUrl) + '">' + esc(p.baseUrl) + '</td><td>' + esc(p.apiKeyLast4 ? '***' + p.apiKeyLast4 : 'none') + '</td><td>' + providerBadge(p) + '</td><td>' + esc(fmtDate(p.lastHealthAt)) + '</td><td><div class="row tight"><button class="secondary" onclick="health(\\'' + esc(p.id) + '\\')">Health</button><button class="secondary" onclick="rotateProvider(\\'' + esc(p.id) + '\\')">Rotate</button><button class="danger" onclick="deleteProvider(\\'' + esc(p.id) + '\\')">Disable</button></div></td></tr>'
        ), 'No providers configured. Add 9Router, ai.example.com, or another OpenAI-compatible upstream.', 1040);
      }
      function providerBadge(p) {
        if (!p.enabled) return '<span class="badge off">Disabled</span>';
        if (p.healthStatus === 'healthy') return '<span class="badge ok">Healthy</span>';
        if (p.healthStatus === 'unhealthy') return '<span class="badge danger">Unhealthy</span>';
        return '<span class="badge warn">Unchecked</span>';
      }
      function renderAliases() {
        $('aliasesToolbar').innerHTML = toolbar('Model Aliases', 'Sync after changing provider credentials or upstream model IDs.', 'aliases', [
          { value: 'all', label: 'All statuses' }, { value: 'enabled', label: 'Enabled' }, { value: 'disabled', label: 'Disabled' }
        ]);
        let rows = state.aliases.filter((a) => includesQuery(a, ['alias', 'upstreamModel', (row) => row.provider?.slug], tableState.aliases.query));
        rows = rows.filter((a) => tableState.aliases.status === 'all' || (tableState.aliases.status === 'enabled' && a.enabled) || (tableState.aliases.status === 'disabled' && !a.enabled));
        rows = sortedRows(rows, 'aliases', { provider: (row) => row.provider?.slug });
        $('aliasesTable').innerHTML = table('aliases', [
          sortHeader('aliases', 'Alias', 'alias'),
          sortHeader('aliases', 'Provider', 'provider'),
          sortHeader('aliases', 'Upstream Model', 'upstreamModel'),
          sortHeader('aliases', 'Status', 'enabled'),
          sortHeader('aliases', 'Updated', 'updatedAt'),
          'Actions'
        ], rows.map((a) =>
          '<tr><td><strong class="mono">' + esc(a.alias) + '</strong></td><td>' + esc(a.provider?.slug ?? 'unknown') + '</td><td class="truncate mono" title="' + esc(a.upstreamModel) + '">' + esc(a.upstreamModel) + '</td><td><span class="badge ' + (a.enabled ? 'ok' : 'off') + '">' + esc(a.enabled ? 'Enabled' : 'Disabled') + '</span></td><td>' + esc(fmtDate(a.updatedAt || a.createdAt)) + '</td><td><div class="row tight"><button class="secondary" onclick="syncAlias(\\'' + esc(a.id) + '\\')">Sync</button><button class="danger" onclick="deleteAlias(\\'' + esc(a.id) + '\\')">Disable</button></div></td></tr>'
        ), 'No model aliases yet. Create stable names like code-premium before issuing developer keys.', 980);
      }
      function renderKeys() {
        $('keysToolbar').innerHTML = toolbar('Keys', 'Revoke from the table when a key leaks or a user leaves.', 'keys', [
          { value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'revoked', label: 'Revoked' }
        ]);
        let rows = state.keys.filter((k) => includesQuery(k, ['name', 'prefix', 'userId', 'teamId', 'litellmKeyAlias', 'status'], tableState.keys.query));
        rows = rows.filter((k) => tableState.keys.status === 'all' || k.status === tableState.keys.status);
        rows = sortedRows(rows, 'keys');
        $('keysTable').innerHTML = table('keys', [
          sortHeader('keys', 'Name', 'name'),
          'Prefix',
          sortHeader('keys', 'User', 'userId'),
          sortHeader('keys', 'Team', 'teamId'),
          sortHeader('keys', 'Status', 'status'),
          sortHeader('keys', 'Created', 'createdAt'),
          sortHeader('keys', 'Last Used', 'lastUsedAt'),
          'Actions'
        ], rows.map((k) =>
          '<tr><td><strong>' + esc(k.name) + '</strong><div class="hint mono">' + esc(k.litellmKeyAlias ?? '') + '</div></td><td class="mono">' + esc(k.prefix) + '</td><td class="mono">' + esc(k.userId) + '</td><td class="mono">' + esc(k.teamId ?? '-') + '</td><td><span class="badge ' + (k.status === 'active' ? 'ok' : 'off') + '">' + esc(k.status) + '</span></td><td>' + esc(fmtDate(k.createdAt)) + '</td><td>' + esc(fmtDate(k.lastUsedAt)) + '</td><td>' + (k.status === 'active' ? '<button class="danger" onclick="revokeKey(\\'' + esc(k.id) + '\\')">Revoke</button>' : '<span class="hint">No actions</span>') + '</td></tr>'
        ), 'No keys yet. Create a user, then issue a personal LiteLLM virtual key.', 1120);
      }
      function renderUsage() {
        const totals = state.usage?.totals ?? {};
        $('usageRequests').textContent = fmtNumber(totals.requests);
        $('usageTokens').textContent = fmtNumber(totals.totalTokens);
        $('usageCost').textContent = '$' + Number(totals.estimatedCost ?? 0).toFixed(4);
        $('usageToolbar').innerHTML = '<div class="table-tools"><div><h3>Usage Snapshot</h3><div class="hint">Source: ' + esc(state.usage?.source ?? 'LiteLLM spend logs') + '</div></div><div class="filters"><input aria-label="Usage search" placeholder="Search user or model..." value="' + esc(tableState.usageUser.query) + '" oninput="tableState.usageUser.query=this.value;tableState.usageModel.query=this.value;renderUsage()" /></div></div>';
        if (state.errors.usage) {
          $('usageTables').innerHTML = '<div class="inline-error">' + esc(state.errors.usage) + '</div>';
          return;
        }
        $('usageTables').innerHTML = '<div class="grid two">' + usageGroup('By User', state.usage?.byUser, 'userId', 'usageUser') + usageGroup('By Model', state.usage?.byModel, 'model', 'usageModel') + '</div>';
      }
      function usageGroup(title, rows = [], key, tableKey) {
        let visible = rows.filter((r) => includesQuery(r, [key], tableState[tableKey].query));
        visible = sortedRows(visible, tableKey);
        return '<div>' + '<h3>' + esc(title) + '</h3>' + table(tableKey, [
          sortHeader(tableKey, key, key),
          sortHeader(tableKey, 'Requests', 'requests'),
          sortHeader(tableKey, 'Tokens', 'totalTokens'),
          sortHeader(tableKey, 'Cost', 'estimatedCost')
        ], visible.map((r) =>
          '<tr><td class="mono">' + esc(r[key] ?? '-') + '</td><td>' + fmtNumber(r.requests) + '</td><td>' + fmtNumber(r.totalTokens) + '</td><td>$' + Number(r.estimatedCost ?? 0).toFixed(4) + '</td></tr>'
        ), 'No usage recorded yet.', 640) + '</div>';
      }

      function clearFieldErrors() {
        document.querySelectorAll('[data-field]').forEach((node) => {
          node.classList.remove('invalid');
          const error = node.querySelector('.field-error');
          if (error) error.textContent = '';
        });
      }
      function fieldError(id, message) {
        const node = document.querySelector('[data-field="' + id + '"]');
        if (!node) return;
        node.classList.add('invalid');
        const error = node.querySelector('.field-error');
        if (error) error.textContent = message;
      }
      function requireValue(id, message) {
        if (!$(id).value.trim()) {
          fieldError(id, message);
          return false;
        }
        return true;
      }
      function validEmail(value) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value); }

      $('createUser').onclick = async () => {
        clearFieldErrors();
        const email = $('userEmail').value.trim();
        let valid = requireValue('userEmail', 'Email is required.') && requireValue('userName', 'Name is required.');
        if (email && !validEmail(email)) { fieldError('userEmail', 'Use a valid email address.'); valid = false; }
        if (!valid) return;
        const payload = { email, name: $('userName').value.trim() };
        if ($('teamSlug').value.trim()) payload.team = { slug: $('teamSlug').value.trim(), name: $('teamName').value.trim() || $('teamSlug').value.trim() };
        await withButton($('createUser'), 'Creating...', async () => {
          try { await api('/users', { method: 'POST', body: JSON.stringify(payload) }); notify('User created.', 'ok'); await refresh(); }
          catch (e) { notify(e.message, 'error'); }
        });
      };
      $('createKey').onclick = async () => {
        clearFieldErrors();
        let valid = requireValue('keyUser', 'Create or select a user first.') && requireValue('keyName', 'Key name is required.') && requireValue('keyModels', 'At least one model alias is required.');
        const models = $('keyModels').value.split(',').map((s) => s.trim()).filter(Boolean);
        if (!models.length) { fieldError('keyModels', 'Use comma-separated model aliases.'); valid = false; }
        if (!valid) return;
        const payload = { userId: $('keyUser').value, name: $('keyName').value.trim(), models };
        await withButton($('createKey'), 'Creating...', async () => {
          try {
            const key = await api('/keys', { method: 'POST', body: JSON.stringify(payload) });
            $('newKey').style.display = 'grid';
            $('newKey').innerHTML = '<strong>Copy this key now. It will not be shown again.</strong><code>' + esc(key.apiKey) + '</code><div class="actions"><button class="secondary" onclick="copyText(\\'' + esc(key.apiKey) + '\\')"><span data-icon="copy"></span>Copy Key</button></div>';
            hydrateIcons($('newKey'));
            notify('LiteLLM virtual key created.', 'ok');
            await refresh();
          } catch (e) { notify(e.message, 'error'); }
        });
      };
      $('createProvider').onclick = async () => {
        clearFieldErrors();
        const valid = requireValue('providerSlug', 'Slug is required.') && requireValue('providerName', 'Name is required.') && requireValue('providerBaseUrl', 'Base URL is required.');
        if (!valid) return;
        const payload = { slug: $('providerSlug').value.trim(), name: $('providerName').value.trim(), baseUrl: $('providerBaseUrl').value.trim() };
        if ($('providerApiKey').value) payload.apiKey = $('providerApiKey').value;
        await withButton($('createProvider'), 'Creating...', async () => {
          try { await api('/providers', { method: 'POST', body: JSON.stringify(payload) }); $('providerApiKey').value = ''; notify('Provider created. Run health check next.', 'ok'); await refresh(); }
          catch (e) { notify(e.message, 'error'); }
        });
      };
      $('createAlias').onclick = async () => {
        clearFieldErrors();
        const valid = requireValue('aliasName', 'Alias is required.') && requireValue('aliasProvider', 'Create or select a provider first.') && requireValue('upstreamModel', 'Upstream model is required.');
        if (!valid) return;
        const payload = { alias: $('aliasName').value.trim(), providerId: $('aliasProvider').value, upstreamModel: $('upstreamModel').value.trim() };
        await withButton($('createAlias'), 'Syncing...', async () => {
          try { await api('/model-aliases', { method: 'POST', body: JSON.stringify(payload) }); notify('Alias created and sync requested.', 'ok'); await refresh(); }
          catch (e) { notify(e.message, 'error'); }
        });
      };

      function closeModal() {
        $('modalRoot').classList.remove('show');
        $('modalRoot').setAttribute('aria-hidden', 'true');
        $('modalRoot').innerHTML = '';
      }
      function openModal(title, body, actionsHtml) {
        $('modalRoot').innerHTML = '<div class="modal"><h3>' + esc(title) + '</h3><div class="modal-body">' + body + '</div><div class="modal-actions">' + actionsHtml + '</div></div>';
        $('modalRoot').classList.add('show');
        $('modalRoot').setAttribute('aria-hidden', 'false');
        hydrateIcons($('modalRoot'));
      }
      function confirmDanger(title, body, confirmLabel, onConfirm) {
        openModal(title, body, '<button class="secondary" onclick="closeModal()">Cancel</button><button id="modalConfirm" class="danger"><span data-icon="alert-triangle"></span>' + esc(confirmLabel) + '</button>');
        $('modalConfirm').onclick = async () => {
          await withButton($('modalConfirm'), 'Working...', async () => {
            try { await onConfirm(); closeModal(); }
            catch (e) { notify(e.message, 'error'); }
          });
        };
      }
      window.closeModal = closeModal;
      $('modalRoot').addEventListener('click', (event) => { if (event.target === $('modalRoot')) closeModal(); });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

      window.copyText = async (value) => { await navigator.clipboard.writeText(value); notify('Copied.', 'ok'); };
      window.health = async (id) => {
        try { notify('Checking provider...', 'warn'); await api('/providers/' + id + '/health'); await refresh(); }
        catch (e) { notify(e.message, 'error'); await refresh(); }
      };
      window.rotateProvider = async (id) => {
        const provider = state.providers.find((p) => p.id === id);
        openModal('Rotate provider key', '<p>This replaces the stored credential for <strong>' + esc(provider?.slug ?? 'provider') + '</strong> and syncs affected aliases. Existing traffic may fail if the new key is invalid.</p><div data-field="rotateApiKey"><label class="required" for="rotateApiKey">New provider API key</label><input id="rotateApiKey" type="password" autocomplete="off" /><div class="field-error"></div></div>', '<button class="secondary" onclick="closeModal()">Cancel</button><button id="rotateConfirm" class="danger">Rotate + Sync</button>');
        $('rotateConfirm').onclick = async () => {
          clearFieldErrors();
          if (!requireValue('rotateApiKey', 'New provider API key is required.')) return;
          await withButton($('rotateConfirm'), 'Rotating...', async () => {
            try { await api('/providers/' + id + '/rotate-key', { method: 'POST', body: JSON.stringify({ apiKey: $('rotateApiKey').value, syncAliases: true }) }); notify('Provider key rotated.', 'ok'); closeModal(); await refresh(); }
            catch (e) { notify(e.message, 'error'); }
          });
        };
      };
      window.deleteProvider = async (id) => {
        const provider = state.providers.find((p) => p.id === id);
        confirmDanger('Disable provider', '<p>Disable <strong>' + esc(provider?.slug ?? 'provider') + '</strong> and its local aliases. This is intentionally disruptive and can affect active model routes.</p>', 'Disable provider', async () => {
          await api('/providers/' + id, { method: 'DELETE' });
          notify('Provider disabled.', 'warn');
          await refresh();
        });
      };
      window.syncAlias = async (id) => {
        try { notify('Syncing alias...', 'warn'); await api('/model-aliases/' + id + '/sync', { method: 'POST' }); notify('Alias synced.', 'ok'); await refresh(); }
        catch (e) { notify(e.message, 'error'); }
      };
      window.deleteAlias = async (id) => {
        const alias = state.aliases.find((a) => a.id === id);
        confirmDanger('Disable alias', '<p>Disable <strong class="mono">' + esc(alias?.alias ?? 'alias') + '</strong>. Clients using this model alias may fail until they switch to another route.</p>', 'Disable alias', async () => {
          await api('/model-aliases/' + id, { method: 'DELETE' });
          notify('Alias disabled.', 'warn');
          await refresh();
        });
      };
      window.revokeKey = async (id) => {
        const key = state.keys.find((k) => k.id === id);
        confirmDanger('Revoke key', '<p>Revoke <strong>' + esc(key?.name ?? 'this key') + '</strong>. Existing clients using prefix <span class="mono">' + esc(key?.prefix ?? '-') + '</span> will fail immediately.</p>', 'Revoke key', async () => {
          await api('/keys/' + id + '/revoke', { method: 'POST' });
          notify('Key revoked.', 'warn');
          await refresh();
        });
      };

      if ($('adminToken').value) refresh();
    </script>
  </body>
</html>`;
}

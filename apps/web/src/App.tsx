import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Copy,
  KeyRound,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Route,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Shuffle,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  api,
  ApiKey,
  ChatTestResult,
  DashboardData,
  ModelAlias,
  Provider,
  SectionKey,
  Usage as UsageResponse,
  UsageGroup,
  User,
} from './api';

type Tab = 'overview' | 'keys' | 'providers' | 'aliases' | 'usage' | 'test' | 'settings';
type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'off';
type SortDir = 'asc' | 'desc';
type SortState = { key: string; dir: SortDir };
type Toast = { tone: Tone; message: string } | null;
type ActivityItem = { id: string; at: Date; tone: Tone; label: string };
type ModalState =
  | null
  | {
      kind: 'danger';
      title: string;
      body: ReactNode;
      label: string;
      confirmText: string;
      action: () => Promise<void>;
    }
  | { kind: 'rotate'; provider: Provider; affectedAliases: number }
  | { kind: 'details'; title: string; body: ReactNode };

const emptyData: DashboardData = { users: [], providers: [], aliases: [], keys: [], usage: null };
const tokenKey = 'tlg_admin_token';

const nav: Array<{ id: Tab; label: string; description: string; icon: ReactNode }> = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'System health, routing status, and operator actions.',
    icon: <LayoutDashboard />,
  },
  {
    id: 'keys',
    label: 'Users & Keys',
    description: 'Create developers and issue personal LiteLLM virtual keys.',
    icon: <KeyRound />,
  },
  {
    id: 'providers',
    label: 'Providers',
    description: 'Manage upstream providers and credentials.',
    icon: <Server />,
  },
  {
    id: 'aliases',
    label: 'Model Aliases',
    description: 'Map stable public model names to upstream providers.',
    icon: <Route />,
  },
  {
    id: 'usage',
    label: 'Usage',
    description: 'Monitor request volume, token usage, cost, and attribution.',
    icon: <BarChart3 />,
  },
  {
    id: 'test',
    label: 'Chat Test',
    description: 'Run a controlled LiteLLM smoke test against a model alias.',
    icon: <Activity />,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Operator notes, client configuration, and session controls.',
    icon: <Settings />,
  },
];

export function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || '');
  const [data, setData] = useState<DashboardData>(emptyData);
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const current = nav.find((item) => item.id === tab)!;

  const addActivity = (label: string, tone: Tone = 'info') => {
    setActivity((items) =>
      [{ id: crypto.randomUUID(), at: new Date(), tone, label }, ...items].slice(0, 8),
    );
  };

  const notify = (message: string, tone: Tone = 'ok') => {
    setToast({ message, tone });
    window.clearTimeout(window.__loomToastTimer);
    window.__loomToastTimer = window.setTimeout(() => setToast(null), 4200);
  };

  const refresh = async () => {
    if (!token.trim()) {
      notify('Enter the admin token before refreshing.', 'warn');
      return;
    }
    setLoading(true);
    localStorage.setItem(tokenKey, token.trim());
    try {
      const result = await api.getDashboard(token.trim());
      setData((previous) => ({
        users: result.errors.users ? previous.users : result.data.users,
        providers: result.errors.providers ? previous.providers : result.data.providers,
        aliases: result.errors.aliases ? previous.aliases : result.data.aliases,
        keys: result.errors.keys ? previous.keys : result.data.keys,
        usage: result.errors.usage ? previous.usage : result.data.usage,
      }));
      setErrors(result.errors);
      setLastRefresh(new Date());
      const failed = Object.keys(result.errors).length;
      notify(
        failed ? `Dashboard refreshed with ${failed} failed section(s).` : 'Dashboard refreshed.',
        failed ? 'warn' : 'ok',
      );
      addActivity(
        failed ? `Refresh completed with ${failed} failed section(s)` : 'Dashboard refreshed',
        failed ? 'warn' : 'ok',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Refresh failed.', 'danger');
      addActivity('Dashboard refresh failed', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const run = async (action: () => Promise<void>, success: string, tone: Tone = 'ok') => {
    try {
      await action();
      notify(success, tone);
      addActivity(success, tone);
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Action failed.', 'danger');
      addActivity(error instanceof Error ? error.message : 'Action failed.', 'danger');
    }
  };

  const clearSession = () => {
    localStorage.removeItem(tokenKey);
    setToken('');
    setData(emptyData);
    setErrors({});
    setLastRefresh(null);
    notify('Admin session cleared.', 'warn');
    addActivity('Admin session cleared', 'warn');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Loom Admin</h1>
          <p>Internal LLM gateway control plane for providers, aliases, keys, and usage.</p>
        </div>
        <nav className="nav" aria-label="Admin sections">
          {nav.map((item) => (
            <button key={item.id} aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="shell">
        <header className="topbar">
          <div className="title">
            <h2>{current.label}</h2>
            <p>{current.description}</p>
          </div>
          <div className="session">
            <Badge tone={token ? 'ok' : 'warn'}>{token ? 'Admin session' : 'Locked'}</Badge>
            <input
              aria-label="Admin token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ADMIN_TOKEN"
              autoComplete="off"
            />
            <Button tone="primary" icon={<Unlock />} onClick={refresh} disabled={loading}>
              Unlock
            </Button>
            <Button icon={<X />} onClick={clearSession}>
              Clear
            </Button>
            <Button icon={<RefreshCw />} onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </header>

        <main className="content">
          {tab === 'overview' && (
            <Overview
              data={data}
              loading={loading}
              lastRefresh={lastRefresh}
              errors={errors}
              activity={activity}
            />
          )}
          {tab === 'keys' && (
            <Keys
              data={data}
              errors={errors}
              token={token}
              run={run}
              notify={notify}
              setModal={setModal}
            />
          )}
          {tab === 'providers' && (
            <Providers data={data} errors={errors} token={token} run={run} setModal={setModal} />
          )}
          {tab === 'aliases' && (
            <Aliases data={data} errors={errors} token={token} run={run} setModal={setModal} />
          )}
          {tab === 'usage' && <Usage data={data} errors={errors} token={token} notify={notify} />}
          {tab === 'test' && (
            <ChatTest data={data} token={token} notify={notify} addActivity={addActivity} />
          )}
          {tab === 'settings' && <SettingsView clearSession={clearSession} notify={notify} />}
        </main>
      </div>

      {modal && <Modal modal={modal} token={token} run={run} close={() => setModal(null)} />}
      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}

function Overview({
  data,
  loading,
  lastRefresh,
  errors,
  activity,
}: {
  data: DashboardData;
  loading: boolean;
  lastRefresh: Date | null;
  errors: Partial<Record<SectionKey, string>>;
  activity: ActivityItem[];
}) {
  const enabledProviders = data.providers.filter((provider) => provider.enabled).length;
  const enabledAliases = data.aliases.filter((alias) => alias.enabled).length;
  const activeKeys = data.keys.filter((key) => key.status === 'active').length;
  const unhealthy = data.providers.some((provider) => provider.healthStatus === 'unhealthy');
  const healthy = data.providers.some((provider) => provider.healthStatus === 'healthy');
  const providerTone: Tone = unhealthy
    ? 'danger'
    : healthy
      ? 'ok'
      : data.providers.length
        ? 'info'
        : 'warn';
  const providerLabel = unhealthy
    ? 'Unhealthy'
    : healthy
      ? 'Healthy'
      : data.providers.length
        ? 'Needs check'
        : 'No provider';
  const failedSections = Object.entries(errors);

  return (
    <>
      {failedSections.length > 0 && (
        <div className="inline-error">
          <strong>Partial data failure</strong>
          {failedSections.map(([section, message]) => (
            <div key={section}>
              {section}: {message}
            </div>
          ))}
        </div>
      )}
      <div className="grid three">
        <Metric
          label="Enabled providers"
          value={enabledProviders}
          badge={<Badge tone={providerTone}>{providerLabel}</Badge>}
        />
        <Metric
          label="Enabled model aliases"
          value={enabledAliases}
          badge={<Badge tone="info">LiteLLM routes</Badge>}
        />
        <Metric
          label="Active user keys"
          value={activeKeys}
          badge={<Badge tone="ok">Virtual keys</Badge>}
        />
      </div>
      <div className="grid two stack">
        <Panel
          title="Gateway Status"
          subtitle="A quick read on whether the admin console can reach the control-plane data."
        >
          <StatusLine
            label="Control plane API"
            value={lastRefresh ? 'Connected' : 'Not loaded'}
            tone={lastRefresh ? 'ok' : 'warn'}
          />
          <StatusLine
            label="Providers configured"
            value={enabledProviders ? `${enabledProviders} enabled` : 'None yet'}
            tone={enabledProviders ? 'ok' : 'warn'}
          />
          <StatusLine
            label="Model aliases"
            value={enabledAliases ? `${enabledAliases} enabled` : 'None yet'}
            tone={enabledAliases ? 'ok' : 'warn'}
          />
          <StatusLine
            label="User keys"
            value={activeKeys ? `${activeKeys} active` : 'No active keys'}
            tone={activeKeys ? 'ok' : 'info'}
          />
          <div className="meta-line">
            {loading
              ? 'Refreshing data...'
              : `Last refreshed: ${lastRefresh ? formatDate(lastRefresh) : 'never'}`}
          </div>
        </Panel>
        <Panel
          title="Operator Runbook"
          subtitle="Shortest path from empty system to working developer access."
        >
          <div className="callout info">
            1. Add provider and run health check.
            <br />
            2. Create model aliases and sync them to LiteLLM.
            <br />
            3. Create developer user and personal LiteLLM key.
            <br />
            4. Test client tooling against <code>code-premium</code>.
          </div>
        </Panel>
      </div>
      <Panel
        className="stack"
        title="Recent Activity"
        subtitle="Session-local operator actions and refresh results."
      >
        {activity.length ? (
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-item" key={item.id}>
                <Badge tone={item.tone}>{item.tone}</Badge>
                <span>{item.label}</span>
                <span className="hint">{formatDate(item.at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No operator activity in this browser session yet.</div>
        )}
      </Panel>
    </>
  );
}

function Keys({
  data,
  errors,
  token,
  run,
  notify,
  setModal,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  run: (action: () => Promise<void>, success: string, tone?: Tone) => Promise<void>;
  notify: (message: string, tone?: Tone) => void;
  setModal: (modal: ModalState) => void;
}) {
  const [filters, setFilters] = useState({ q: '', status: 'all' });
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', dir: 'desc' });
  const rows = useRows(data.keys, filters, sort, [
    'name',
    'prefix',
    'userId',
    'teamId',
    'status',
    'litellmKeyAlias',
  ]);
  const [newKey, setNewKey] = useState('');

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const name = String(form.get('name') || '').trim();
    const teamSlug = String(form.get('teamSlug') || '').trim();
    const teamName = String(form.get('teamName') || '').trim();
    if (!email || !name) return notify('Email and name are required.', 'warn');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return notify('Use a valid email address.', 'warn');
    await run(
      () =>
        api
          .createUser(token, {
            email,
            name,
            team: teamSlug ? { slug: teamSlug, name: teamName || teamSlug } : undefined,
          })
          .then(() => undefined),
      'User created.',
    );
    event.currentTarget.reset();
  };

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const userId = String(form.get('userId') || '');
    const name = String(form.get('name') || '').trim();
    const checkedModels = form.getAll('models').map((model) => String(model).trim());
    const fallbackModels = String(form.get('modelsText') || '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);
    const models = checkedModels.length ? checkedModels : fallbackModels;
    if (!userId || !name || !models.length)
      return notify('User, key name, and model access are required.', 'warn');
    try {
      const key = await api.createKey(token, { userId, name, models });
      setNewKey(key.apiKey);
      notify('LiteLLM virtual key created.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to create key.', 'danger');
    }
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['users', 'keys', 'aliases']} />
      <div className="grid two">
        <Panel
          title="Invite Developer"
          subtitle="Create a user first, then issue a personal LiteLLM virtual key."
        >
          <form className="form-grid" onSubmit={createUser}>
            <Field label="Email" name="email" required placeholder="dev@example.com" />
            <Field label="Name" name="name" required placeholder="Dev Example" />
            <Field label="Team Slug" name="teamSlug" placeholder="engineering" />
            <Field label="Team Name" name="teamName" placeholder="Engineering" />
            <div className="actions full">
              <Button tone="primary" icon={<UserPlus />} type="submit">
                Create User
              </Button>
            </div>
          </form>
        </Panel>
        <Panel
          title="Issue Personal Key"
          subtitle="The plaintext key is returned once. Store it in the developer's secret manager."
        >
          <form className="form-grid" onSubmit={createKey}>
            <label className="field full">
              <span>User *</span>
              <select name="userId" required>
                <option value="">
                  {data.users.length ? 'Select user' : 'Create a user first'}
                </option>
                {data.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Key Name" name="name" required defaultValue="codex" />
            <div className="field full">
              <span>Model Access *</span>
              {data.aliases.filter((alias) => alias.enabled).length ? (
                <div className="check-grid">
                  {data.aliases
                    .filter((alias) => alias.enabled)
                    .map((alias) => (
                      <label key={alias.id} className="check-row">
                        <input name="models" type="checkbox" value={alias.alias} defaultChecked />
                        <span>
                          <strong>{alias.alias}</strong>
                          <small>{alias.provider?.slug || 'unknown provider'}</small>
                        </span>
                      </label>
                    ))}
                </div>
              ) : (
                <input name="modelsText" defaultValue="code-premium,code-balanced,code-fallback" />
              )}
            </div>
            <div className="actions full">
              <Button tone="primary" icon={<KeyRound />} type="submit">
                Create Key
              </Button>
            </div>
          </form>
          {newKey && (
            <div className="secret">
              <strong>Copy this key now. It will not be shown again.</strong>
              <code>{newKey}</code>
              <Button
                icon={<Copy />}
                onClick={() => navigator.clipboard.writeText(newKey).then(() => notify('Copied.'))}
              >
                Copy Key
              </Button>
            </div>
          )}
        </Panel>
      </div>
      <Panel className="stack">
        <TableToolbar
          title="Keys"
          hint="Revoke from the table when a key leaks or a user leaves."
          filters={filters}
          setFilters={setFilters}
          options={['active', 'revoked']}
        />
        <DataTable
          empty="No keys yet. Create a user, then issue a personal LiteLLM virtual key."
          sort={sort}
          setSort={setSort}
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (key: ApiKey) => (
                <>
                  <strong>{key.name}</strong>
                  <div className="hint mono">{key.litellmKeyAlias}</div>
                </>
              ),
            },
            { key: 'prefix', label: 'Prefix', className: 'mono' },
            { key: 'userId', label: 'User', className: 'mono' },
            {
              key: 'teamId',
              label: 'Team',
              render: (key: ApiKey) => <span className="mono">{key.teamId || '-'}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (key: ApiKey) => (
                <Badge tone={key.status === 'active' ? 'ok' : 'off'}>{key.status}</Badge>
              ),
            },
            {
              key: 'createdAt',
              label: 'Created',
              render: (key: ApiKey) => formatDate(key.createdAt),
            },
            {
              key: 'lastUsedAt',
              label: 'Last Used',
              render: (key: ApiKey) => formatDate(key.lastUsedAt),
            },
            {
              key: 'actions',
              label: 'Actions',
              sortable: false,
              render: (key: ApiKey) => (
                <div className="row tight">
                  <Button
                    onClick={() =>
                      setModal({
                        kind: 'details',
                        title: `Key: ${key.name}`,
                        body: <RecordDetails rows={objectRows(key)} />,
                      })
                    }
                  >
                    Details
                  </Button>
                  {key.status === 'active' ? (
                    <Button
                      tone="danger"
                      onClick={() =>
                        setModal({
                          kind: 'danger',
                          title: 'Revoke key',
                          label: 'Revoke key',
                          confirmText: key.prefix,
                          body: (
                            <>
                              Existing clients using prefix <code>{key.prefix}</code> will fail
                              immediately. Type <code>{key.prefix}</code> to confirm.
                            </>
                          ),
                          action: () => api.revokeKey(token, key.id).then(() => undefined),
                        })
                      }
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      </Panel>
    </>
  );
}

function Providers({
  data,
  errors,
  token,
  run,
  setModal,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  run: (action: () => Promise<void>, success: string, tone?: Tone) => Promise<void>;
  setModal: (modal: ModalState) => void;
}) {
  const [filters, setFilters] = useState({ q: '', status: 'all' });
  const [sort, setSort] = useState<SortState>({ key: 'slug', dir: 'asc' });
  const rows = useRows(data.providers, filters, sort, ['slug', 'name', 'baseUrl', 'healthStatus']);

  const createProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slug = String(form.get('slug') || '').trim();
    const name = String(form.get('name') || '').trim();
    const baseUrl = String(form.get('baseUrl') || '').trim();
    const apiKey = String(form.get('apiKey') || '').trim();
    if (!slug || !name || !baseUrl) return;
    await run(
      () =>
        api
          .createProvider(token, { slug, name, baseUrl, apiKey: apiKey || undefined })
          .then(() => undefined),
      'Provider created. Run health check next.',
    );
    event.currentTarget.reset();
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['providers', 'aliases']} />
      <div className="grid two">
        <Panel
          title="Add Provider"
          subtitle="Use an OpenAI-compatible /v1 endpoint. Provider secrets are encrypted at rest."
        >
          <form className="form-grid" onSubmit={createProvider}>
            <Field label="Slug" name="slug" required placeholder="9router" />
            <Field label="Name" name="name" required placeholder="9Router Local" />
            <Field
              label="Base URL"
              name="baseUrl"
              required
              placeholder="http://9router:20128/v1"
              full
            />
            <Field
              label="API Key"
              name="apiKey"
              type="password"
              placeholder="provider token if required"
              full
            />
            <div className="actions full">
              <Button tone="primary" icon={<Server />} type="submit">
                Create Provider
              </Button>
            </div>
          </form>
        </Panel>
        <Panel
          title="Provider Rules"
          subtitle="Keep upstreams private and stable. Developers should never call them directly."
        >
          <div className="callout warn">
            Browser sessions, shared personal subscriptions, and cookies are not valid provider
            credentials. Use OpenAI-compatible APIs, local 9Router, or local model servers.
          </div>
        </Panel>
      </div>
      <Panel className="stack">
        <TableToolbar
          title="Providers"
          hint="Health checks and rotations are operator actions."
          filters={filters}
          setFilters={setFilters}
          options={['enabled', 'disabled', 'healthy', 'unhealthy', 'unchecked']}
        />
        <DataTable
          empty="No providers configured. Add 9Router, ai.company.com, or another OpenAI-compatible upstream."
          sort={sort}
          setSort={setSort}
          columns={[
            {
              key: 'slug',
              label: 'Provider',
              render: (p: Provider) => (
                <>
                  <strong>{p.slug}</strong>
                  <div className="hint">{p.name}</div>
                </>
              ),
            },
            { key: 'baseUrl', label: 'Base URL', className: 'mono truncate' },
            {
              key: 'apiKeyLast4',
              label: 'Key',
              render: (p: Provider) => (p.apiKeyLast4 ? `***${p.apiKeyLast4}` : 'none'),
            },
            { key: 'healthStatus', label: 'Health', render: (p: Provider) => providerBadge(p) },
            {
              key: 'lastHealthAt',
              label: 'Last Check',
              render: (p: Provider) => formatDate(p.lastHealthAt),
            },
            {
              key: 'actions',
              label: 'Actions',
              sortable: false,
              render: (p: Provider) => (
                <div className="row tight">
                  <Button
                    onClick={() =>
                      setModal({
                        kind: 'details',
                        title: `Provider: ${p.slug}`,
                        body: (
                          <RecordDetails
                            rows={[
                              ...objectRows(p),
                              ['Affected aliases', affectedAliases(data.aliases, p.id).toString()],
                            ]}
                          />
                        ),
                      })
                    }
                  >
                    Details
                  </Button>
                  <Button
                    onClick={() =>
                      run(
                        () => api.checkProvider(token, p.id).then(() => undefined),
                        'Provider health checked.',
                      )
                    }
                  >
                    Health
                  </Button>
                  <Button
                    onClick={() =>
                      setModal({
                        kind: 'rotate',
                        provider: p,
                        affectedAliases: affectedAliases(data.aliases, p.id),
                      })
                    }
                  >
                    Rotate
                  </Button>
                  <Button
                    tone="danger"
                    onClick={() =>
                      setModal({
                        kind: 'danger',
                        title: 'Disable provider',
                        label: 'Disable provider',
                        confirmText: p.slug,
                        body: (
                          <>
                            Disable <strong>{p.slug}</strong> and{' '}
                            <strong>{affectedAliases(data.aliases, p.id)}</strong> local aliases.
                            Active routes may fail. Type <code>{p.slug}</code> to confirm.
                          </>
                        ),
                        action: () => api.disableProvider(token, p.id).then(() => undefined),
                      })
                    }
                  >
                    Disable
                  </Button>
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      </Panel>
    </>
  );
}

function Aliases({
  data,
  errors,
  token,
  run,
  setModal,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  run: (action: () => Promise<void>, success: string, tone?: Tone) => Promise<void>;
  setModal: (modal: ModalState) => void;
}) {
  const [filters, setFilters] = useState({ q: '', status: 'all' });
  const [sort, setSort] = useState<SortState>({ key: 'alias', dir: 'asc' });
  const rows = useRows(data.aliases, filters, sort, [
    'alias',
    'upstreamModel',
    (alias) => alias.provider?.slug,
  ]);

  const createAlias = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const alias = String(form.get('alias') || '').trim();
    const providerId = String(form.get('providerId') || '');
    const upstreamModel = String(form.get('upstreamModel') || '').trim();
    if (!alias || !providerId || !upstreamModel) return;
    await run(
      () => api.createAlias(token, { alias, providerId, upstreamModel }).then(() => undefined),
      'Alias created and sync requested.',
    );
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['aliases', 'providers']} />
      <div className="grid two">
        <Panel
          title="Create Model Alias"
          subtitle="Aliases are stable public names developers use from Codex, Cursor, Cline, and automation."
        >
          <form className="form-grid" onSubmit={createAlias}>
            <Field label="Alias" name="alias" required defaultValue="code-premium" />
            <label className="field">
              <span>Provider *</span>
              <select name="providerId" required>
                <option value="">
                  {data.providers.length ? 'Select provider' : 'Create a provider first'}
                </option>
                {data.providers
                  .filter((provider) => provider.enabled)
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.slug}
                    </option>
                  ))}
              </select>
            </label>
            <Field
              label="Upstream Model"
              name="upstreamModel"
              required
              defaultValue="openai/gemini-2.5-pro"
              full
            />
            <div className="actions full">
              <Button tone="primary" icon={<Route />} type="submit">
                Create + Sync
              </Button>
            </div>
          </form>
        </Panel>
        <Panel
          title="Routing Preview"
          subtitle="Developers see aliases. Operators control provider and upstream model mapping."
        >
          <div className="callout info">
            <code>
              Codex -&gt; LiteLLM key -&gt; code-premium -&gt; provider -&gt; upstream model
            </code>
          </div>
        </Panel>
      </div>
      <Panel className="stack">
        <TableToolbar
          title="Model Aliases"
          hint="Sync after changing provider credentials or upstream model IDs."
          filters={filters}
          setFilters={setFilters}
          options={['enabled', 'disabled']}
        />
        <DataTable
          empty="No model aliases yet. Create stable names like code-premium before issuing developer keys."
          sort={sort}
          setSort={setSort}
          columns={[
            { key: 'alias', label: 'Alias', className: 'mono strong' },
            {
              key: 'provider',
              label: 'Provider',
              render: (a: ModelAlias) => a.provider?.slug || 'unknown',
            },
            { key: 'upstreamModel', label: 'Upstream Model', className: 'mono truncate' },
            {
              key: 'enabled',
              label: 'Status',
              render: (a: ModelAlias) => (
                <Badge tone={a.enabled ? 'ok' : 'off'}>{a.enabled ? 'Enabled' : 'Disabled'}</Badge>
              ),
            },
            {
              key: 'updatedAt',
              label: 'Updated',
              render: (a: ModelAlias) => formatDate(a.updatedAt || a.createdAt),
            },
            {
              key: 'actions',
              label: 'Actions',
              sortable: false,
              render: (a: ModelAlias) => (
                <div className="row tight">
                  <Button
                    onClick={() =>
                      setModal({
                        kind: 'details',
                        title: `Alias: ${a.alias}`,
                        body: <RecordDetails rows={objectRows(a)} />,
                      })
                    }
                  >
                    Details
                  </Button>
                  <Button
                    onClick={() =>
                      run(() => api.syncAlias(token, a.id).then(() => undefined), 'Alias synced.')
                    }
                  >
                    Sync
                  </Button>
                  <Button
                    tone="danger"
                    onClick={() =>
                      setModal({
                        kind: 'danger',
                        title: 'Disable alias',
                        label: 'Disable alias',
                        confirmText: a.alias,
                        body: (
                          <>
                            Clients using <code>{a.alias}</code> may fail until they switch routes.
                            Type <code>{a.alias}</code> to confirm.
                          </>
                        ),
                        action: () => api.disableAlias(token, a.id).then(() => undefined),
                      })
                    }
                  >
                    Disable
                  </Button>
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      </Panel>
    </>
  );
}

function Usage({
  data,
  errors,
  token,
  notify,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  notify: (message: string, tone?: Tone) => void;
}) {
  const [usage, setUsage] = useState<UsageResponse | null>(data.usage);
  const [source, setSource] = useState<'litellm' | 'local'>('litellm');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => setUsage(data.usage), [data.usage]);

  const refreshUsage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token.trim()) return notify('Enter the admin token before loading usage.', 'warn');
    setLoading(true);
    try {
      setUsage(await api.getUsage(token, { source, from: from || undefined, to: to || undefined }));
      notify('Usage refreshed.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Usage refresh failed.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['usage']} />
      <div className="grid three">
        <Metric label="Requests" value={usage?.totals.requests || 0} />
        <Metric label="Total tokens" value={usage?.totals.totalTokens || 0} />
        <Metric
          label="Estimated cost"
          value={`$${Number(usage?.totals.estimatedCost || 0).toFixed(4)}`}
        />
      </div>
      <Panel
        className="stack"
        title="Usage Snapshot"
        subtitle={`Source: ${usage?.source || 'LiteLLM spend logs'}`}
      >
        <form className="usage-filters" onSubmit={refreshUsage}>
          <label className="field">
            <span>Source</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as 'litellm' | 'local')}
            >
              <option value="litellm">LiteLLM spend logs</option>
              <option value="local">Local ingest records</option>
            </select>
          </label>
          <label className="field">
            <span>From</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <div className="actions">
            <Button type="submit" icon={<RefreshCw />} disabled={loading}>
              {loading ? 'Loading' : 'Apply'}
            </Button>
          </div>
        </form>
        <div className="grid two">
          <UsageTable title="By User" rows={usage?.byUser || []} rowKey="userId" />
          <UsageTable title="By Model" rows={usage?.byModel || []} rowKey="model" />
        </div>
      </Panel>
    </>
  );
}

function ChatTest({
  data,
  token,
  notify,
  addActivity,
}: {
  data: DashboardData;
  token: string;
  notify: (message: string, tone?: Tone) => void;
  addActivity: (label: string, tone?: Tone) => void;
}) {
  const [model, setModel] = useState('');
  const [message, setMessage] = useState('Say ok and identify the route you used.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatTestResult | null>(null);
  const enabledAliases = data.aliases.filter((alias) => alias.enabled);

  useEffect(() => {
    if (!model && enabledAliases[0]) setModel(enabledAliases[0].alias);
  }, [enabledAliases, model]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token.trim()) return notify('Enter the admin token before running chat test.', 'warn');
    if (!model || !message.trim()) return notify('Model alias and message are required.', 'warn');
    setLoading(true);
    setResult(null);
    try {
      const response = await api.chatTest(token, { model, message: message.trim() });
      setResult(response);
      notify('Chat test completed.');
      addActivity(`Chat test succeeded for ${model} in ${response.latencyMs}ms`, 'ok');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Chat test failed.', 'danger');
      addActivity(`Chat test failed for ${model}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid two">
      <Panel
        title="Chat Test"
        subtitle="Runs an admin-only LiteLLM smoke test against a selected model alias."
      >
        <form className="form-grid" onSubmit={submit}>
          <label className="field full">
            <span>Model alias *</span>
            <select value={model} onChange={(event) => setModel(event.target.value)} required>
              <option value="">
                {enabledAliases.length ? 'Select alias' : 'Create an enabled alias first'}
              </option>
              {enabledAliases.map((alias) => (
                <option key={alias.id} value={alias.alias}>
                  {alias.alias} · {alias.provider?.slug || 'unknown provider'}
                </option>
              ))}
            </select>
          </label>
          <label className="field full">
            <span>Message *</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4000}
            />
          </label>
          <div className="actions full">
            <Button
              tone="primary"
              icon={<Shuffle />}
              type="submit"
              disabled={loading || !enabledAliases.length}
            >
              {loading ? 'Testing' : 'Run Chat Test'}
            </Button>
          </div>
        </form>
      </Panel>
      <Panel
        title="Result"
        subtitle="Response summary from the OpenAI-compatible chat completion call."
      >
        {result ? (
          <div className="result">
            <StatusLine label="Model" value={result.model} tone="ok" />
            <StatusLine label="Latency" value={`${result.latencyMs}ms`} tone="info" />
            <div className="callout info">{result.content || 'No assistant content returned.'}</div>
            {result.usage ? (
              <pre className="raw-json">{JSON.stringify(result.usage, null, 2)}</pre>
            ) : null}
          </div>
        ) : (
          <div className="empty">
            Run a chat test to verify the selected alias routes through LiteLLM.
          </div>
        )}
      </Panel>
    </div>
  );
}

function SettingsView({
  clearSession,
  notify,
}: {
  clearSession: () => void;
  notify: (message: string, tone?: Tone) => void;
}) {
  const env =
    'OPENAI_BASE_URL=https://llm.apps.anggaprytn.com/v1\nOPENAI_API_KEY=<personal_litellm_key>\nOPENAI_MODEL=code-premium';
  return (
    <div className="grid two">
      <Panel
        title="Codex Configuration"
        subtitle="Give each developer their own LiteLLM virtual key."
      >
        <pre className="callout info mono">{env}</pre>
      </Panel>
      <Panel
        title="Security Baseline"
        subtitle="This dashboard is admin-only and should remain behind VPN or access control."
      >
        <div className="actions">
          <Button
            icon={<Copy />}
            onClick={() => navigator.clipboard.writeText(env).then(() => notify('Copied.'))}
          >
            Copy Codex Env
          </Button>
          <Button tone="danger" icon={<LogOut />} onClick={clearSession}>
            Clear Admin Session
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Modal({
  modal,
  token,
  run,
  close,
}: {
  modal: ModalState;
  token: string;
  run: (action: () => Promise<void>, success: string, tone?: Tone) => Promise<void>;
  close: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [confirmation, setConfirmation] = useState('');
  if (!modal) return null;
  const submitRotate = async () => {
    if (modal.kind !== 'rotate' || !apiKey.trim()) return;
    await run(
      () => api.rotateProvider(token, modal.provider.id, apiKey.trim()).then(() => undefined),
      'Provider key rotated.',
    );
    close();
  };
  const submitDanger = async () => {
    if (modal.kind !== 'danger' || confirmation !== modal.confirmText) return;
    await run(modal.action, 'Action completed.', 'warn');
    close();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => event.currentTarget === event.target && close()}
    >
      <div className="modal">
        <h3>{modal.kind === 'rotate' ? 'Rotate provider key' : modal.title}</h3>
        <div className="modal-body">
          {modal.kind === 'details' ? (
            modal.body
          ) : modal.kind === 'rotate' ? (
            <>
              <p>
                This replaces the stored credential for <strong>{modal.provider.slug}</strong> and
                syncs <strong>{modal.affectedAliases}</strong> affected aliases. Existing traffic
                may fail if the new key is invalid.
              </p>
              <label className="field">
                <span>New provider API key *</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                />
              </label>
            </>
          ) : (
            <>
              <p>{modal.body}</p>
              <label className="field">
                <span>
                  Type <code>{modal.confirmText}</code> to confirm
                </span>
                <input
                  autoFocus
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <div className="modal-actions">
          <Button onClick={close}>Cancel</Button>
          {modal.kind === 'details' ? null : (
            <Button
              tone="danger"
              icon={<AlertTriangle />}
              onClick={modal.kind === 'rotate' ? submitRotate : submitDanger}
              disabled={modal.kind === 'danger' && confirmation !== modal.confirmText}
            >
              {modal.kind === 'rotate' ? 'Rotate + Sync' : modal.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageTable({
  title,
  rows,
  rowKey,
}: {
  title: string;
  rows: UsageGroup[];
  rowKey: string;
}) {
  const [sort, setSort] = useState<SortState>({ key: 'requests', dir: 'desc' });
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  return (
    <div>
      <h3>{title}</h3>
      <DataTable
        empty="No usage recorded yet."
        rows={sorted}
        sort={sort}
        setSort={setSort}
        columns={[
          {
            key: rowKey,
            label: rowKey,
            className: 'mono',
            render: (row: UsageGroup) => String(row[rowKey] || '-'),
          },
          { key: 'requests', label: 'Requests' },
          { key: 'totalTokens', label: 'Tokens' },
          {
            key: 'estimatedCost',
            label: 'Cost',
            render: (row: UsageGroup) => `$${Number(row.estimatedCost || 0).toFixed(4)}`,
          },
        ]}
      />
    </div>
  );
}

function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  sort,
  setSort,
  empty,
}: {
  rows: T[];
  columns: Array<{
    key: string;
    label: string;
    className?: string;
    sortable?: boolean;
    render?: (row: T) => ReactNode;
  }>;
  sort: SortState;
  setSort: (sort: SortState) => void;
  empty: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={
                    sort.key === column.key
                      ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  {column.sortable === false ? (
                    column.label
                  ) : (
                    <button
                      className="sort"
                      onClick={() =>
                        setSort(
                          sort.key === column.key
                            ? { key: column.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
                            : { key: column.key, dir: 'asc' },
                        )
                      }
                    >
                      {column.label}
                      {sort.key === column.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={String(row.id || `${index}`)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.render ? column.render(row) : String(row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span className="hint">
          Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, rows.length)} of{' '}
          {rows.length}
        </span>
        <select
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
        >
          <option value={10}>10 rows</option>
          <option value={25}>25 rows</option>
          <option value={50}>50 rows</option>
        </select>
        <Button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>
          Previous
        </Button>
        <Button
          onClick={() => setPage(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
        >
          Next
        </Button>
      </div>
    </>
  );
}

function TableToolbar({
  title,
  hint,
  filters,
  setFilters,
  options,
}: {
  title: string;
  hint: string;
  filters: { q: string; status: string };
  setFilters: (filters: { q: string; status: string }) => void;
  options: string[];
}) {
  return (
    <div className="table-tools">
      <div>
        <h3>{title}</h3>
        <div className="hint">{hint}</div>
      </div>
      <div className="filters">
        <label className="search">
          <Search />
          <input
            aria-label={`${title} search`}
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            placeholder="Search..."
          />
        </label>
        <select
          value={filters.status}
          onChange={(event) => setFilters({ ...filters, status: event.target.value })}
        >
          <option value="all">All statuses</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {titleCase(option)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SectionErrors({
  errors,
  sections,
}: {
  errors: Partial<Record<SectionKey, string>>;
  sections: SectionKey[];
}) {
  const entries = sections
    .map((section) => [section, errors[section]] as const)
    .filter((entry): entry is readonly [SectionKey, string] => Boolean(entry[1]));

  if (!entries.length) return null;

  return (
    <div className="inline-error">
      <strong>Some data could not be loaded.</strong>
      {entries.map(([section, message]) => (
        <div key={section}>
          {section}: {message}
        </div>
      ))}
    </div>
  );
}

function RecordDetails({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <div className="detail-list">
      {rows.map(([label, value]) => (
        <div className="detail-row" key={label}>
          <span>{label}</span>
          <code>{formatDetailValue(value)}</code>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && <h3>{title}</h3>}
      {subtitle && <p className="sub">{subtitle}</p>}
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  badge,
}: {
  label: string;
  value: string | number;
  badge?: ReactNode;
}) {
  return (
    <div className="card metric">
      <div>
        <div className="value">{typeof value === 'number' ? formatNumber(value) : value}</div>
        <div className="label">{label}</div>
      </div>
      {badge}
    </div>
  );
}

function Field({
  label,
  name,
  required,
  full,
  type = 'text',
  ...props
}: {
  label: string;
  name: string;
  required?: boolean;
  full?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <input name={name} required={required} type={type} {...props} />
    </label>
  );
}

function Button({
  children,
  icon,
  tone,
  ...props
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'primary' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={tone || 'secondary'} {...props}>
      {icon}
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="status-line">
      <span>{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function providerBadge(provider: Provider) {
  if (!provider.enabled) return <Badge tone="off">Disabled</Badge>;
  if (provider.healthStatus === 'healthy') return <Badge tone="ok">Healthy</Badge>;
  if (provider.healthStatus === 'unhealthy') return <Badge tone="danger">Unhealthy</Badge>;
  return <Badge tone="warn">Unchecked</Badge>;
}

function affectedAliases(aliases: ModelAlias[], providerId: string) {
  return aliases.filter((alias) => alias.enabled && alias.provider?.id === providerId).length;
}

function objectRows(value: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(value).filter(([, item]) => typeof item !== 'object' || item === null);
}

function formatDetailValue(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function useRows<T extends Record<string, unknown>>(
  rows: T[],
  filters: { q: string; status: string },
  sort: SortState,
  keys: Array<keyof T | ((row: T) => unknown)>,
) {
  return useMemo(() => {
    const q = filters.q.toLowerCase();
    const filtered = rows.filter((row) => {
      const matchesQuery =
        !q ||
        keys.some((key) =>
          String(typeof key === 'function' ? key(row) : row[key] || '')
            .toLowerCase()
            .includes(q),
        );
      const statusValue =
        'status' in row
          ? row.status
          : 'enabled' in row
            ? (row as { enabled?: boolean }).enabled
              ? 'enabled'
              : 'disabled'
            : undefined;
      const healthValue = 'healthStatus' in row ? row.healthStatus || 'unchecked' : undefined;
      const matchesStatus =
        filters.status === 'all' ||
        statusValue === filters.status ||
        healthValue === filters.status;
      return matchesQuery && matchesStatus;
    });
    return sortRows(filtered, sort);
  }, [rows, filters, sort, keys]);
}

function sortRows<T extends Record<string, unknown>>(rows: T[], sort: SortState) {
  return [...rows].sort(
    (a, b) => compare(a[sort.key], b[sort.key]) * (sort.dir === 'asc' ? 1 : -1),
  );
}

function compare(a: unknown, b: unknown) {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

declare global {
  interface Window {
    __loomToastTimer?: number;
  }
}

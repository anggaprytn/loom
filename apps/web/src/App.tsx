import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Route,
  Search,
  Server,
  Settings,
  UserPlus,
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  ApiKey,
  DashboardData,
  ModelAlias,
  Provider,
  SectionKey,
  Usage as UsageResponse,
  UsageGroup,
  User,
} from './api';

type Tab = 'overview' | 'keys' | 'providers' | 'aliases' | 'usage' | 'settings';
type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'off';
type SortDir = 'asc' | 'desc';
type SortState = { key: string; dir: SortDir };
type Toast = { tone: Tone; message: string; persistent?: boolean } | null;
type ActivityItem = { id: string; at: Date; tone: Tone; label: string };
type LoadStatus = 'idle' | 'loading' | 'current' | 'stale' | 'failed';
type SectionState = { status: LoadStatus; lastLoadedAt: Date | null; error?: string };
type SectionStates = Record<SectionKey, SectionState>;
type PendingAction =
  | { kind: 'provider-health'; id: string }
  | { kind: 'provider-rotate'; id: string }
  | { kind: 'provider-disable'; id: string }
  | { kind: 'alias-sync'; id: string }
  | { kind: 'alias-disable'; id: string }
  | { kind: 'key-revoke'; id: string }
  | { kind: 'usage-refresh' };
type ModalState =
  | null
  | {
      kind: 'danger';
      title: string;
      body: ReactNode;
      label: string;
      confirmText: string;
      success: string;
      action: () => Promise<void>;
      pending?: PendingAction;
    }
  | { kind: 'rotate'; provider: Provider; affectedAliases: number }
  | { kind: 'details'; title: string; body: ReactNode };

const emptyData: DashboardData = { users: [], providers: [], aliases: [], keys: [], usage: null };
const tokenKey = 'tlg_admin_token';
const sidebarCollapsedKey = 'tlg_sidebar_collapsed';
const sectionKeys: SectionKey[] = ['users', 'providers', 'aliases', 'keys', 'usage'];
const emptySectionStates = Object.fromEntries(
  sectionKeys.map((section) => [section, { status: 'idle', lastLoadedAt: null }]),
) as SectionStates;

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
    description: 'Create developers and issue developer keys.',
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
    id: 'settings',
    label: 'Settings',
    description: 'Operator notes, client configuration, and session controls.',
    icon: <Settings />,
  },
];

export function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || '');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(sidebarCollapsedKey) === 'true',
  );
  const [data, setData] = useState<DashboardData>(emptyData);
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [sectionStates, setSectionStates] = useState<SectionStates>(emptySectionStates);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const autoLoadStarted = useRef(false);
  const current = nav.find((item) => item.id === tab)!;
  const hasLoaded = Boolean(lastRefresh);
  const hasFailures = Object.keys(errors).length > 0;

  const addActivity = (label: string, tone: Tone = 'info') => {
    setActivity((items) =>
      [{ id: crypto.randomUUID(), at: new Date(), tone, label }, ...items].slice(0, 8),
    );
  };

  const notify = (message: string, tone: Tone = 'ok') => {
    setToast({ message, tone, persistent: tone === 'danger' });
    window.clearTimeout(window.__loomToastTimer);
    if (tone !== 'danger') {
      window.__loomToastTimer = window.setTimeout(
        () => setToast(null),
        tone === 'warn' ? 7000 : 4200,
      );
    }
  };

  const updateToken = (value: string) => {
    setToken(value);
    const trimmed = value.trim();
    if (trimmed) {
      localStorage.setItem(tokenKey, trimmed);
    } else {
      localStorage.removeItem(tokenKey);
    }
  };

  const refresh = async () => {
    if (!token.trim()) {
      notify('Enter the admin token before loading dashboard data.', 'warn');
      return;
    }
    setLoading(true);
    setSectionStates(
      (states) =>
        Object.fromEntries(
          sectionKeys.map((section) => [
            section,
            { ...states[section], status: 'loading', error: undefined },
          ]),
        ) as SectionStates,
    );
    localStorage.setItem(tokenKey, token.trim());
    try {
      const result = await api.getDashboard(token.trim());
      const loadedAt = new Date();
      setData((previous) => ({
        users: result.errors.users ? previous.users : result.data.users,
        providers: result.errors.providers ? previous.providers : result.data.providers,
        aliases: result.errors.aliases ? previous.aliases : result.data.aliases,
        keys: result.errors.keys ? previous.keys : result.data.keys,
        usage: result.errors.usage ? previous.usage : result.data.usage,
      }));
      setSectionStates((previous) => {
        const next = { ...previous };
        sectionKeys.forEach((section) => {
          const message = result.errors[section];
          if (message) {
            next[section] = {
              status: hasSectionData(section, data) ? 'stale' : 'failed',
              lastLoadedAt: previous[section].lastLoadedAt,
              error: message,
            };
          } else {
            next[section] = { status: 'current', lastLoadedAt: loadedAt };
          }
        });
        return next;
      });
      setErrors(result.errors);
      setLastRefresh(loadedAt);
      const failed = Object.keys(result.errors).length;
      notify(
        failed
          ? `Dashboard loaded with ${failed} failed section${failed === 1 ? '' : 's'}.`
          : 'Dashboard loaded.',
        failed ? 'warn' : 'ok',
      );
      addActivity(
        failed
          ? `Dashboard loaded with ${failed} failed section${failed === 1 ? '' : 's'}`
          : 'Dashboard loaded',
        failed ? 'warn' : 'ok',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dashboard load failed.';
      setSectionStates(
        (states) =>
          Object.fromEntries(
            sectionKeys.map((section) => [
              section,
              {
                ...states[section],
                status: hasSectionData(section, data) ? 'stale' : 'failed',
                error: message,
              },
            ]),
          ) as SectionStates,
      );
      notify(`Dashboard load failed. Check the admin API and retry. ${message}`, 'danger');
      addActivity('Dashboard load failed', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoadStarted.current || !token.trim()) return;
    autoLoadStarted.current = true;
    void refresh();
  }, []);

  const run = async (
    action: () => Promise<void>,
    success: string,
    tone: Tone = 'ok',
    pending?: PendingAction,
  ) => {
    if (pending) setPendingAction(pending);
    try {
      await action();
      notify(success, tone);
      addActivity(success, tone);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      notify(
        `${success.replace(/\.$/, '')} failed. Check the object state and retry. ${message}`,
        'danger',
      );
      addActivity(message, 'danger');
    } finally {
      if (pending) setPendingAction(null);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(tokenKey);
    setToken('');
    setData(emptyData);
    setErrors({});
    setSectionStates(emptySectionStates);
    setLastRefresh(null);
    notify('Token cleared. Dashboard data removed from this browser.', 'warn');
    addActivity('Token cleared', 'warn');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem(sidebarCollapsedKey, String(next));
      return next;
    });
  };

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="sidebar-head">
          <div className="brand">
            <h1>Loom Admin</h1>
            <p>Internal LLM gateway control plane for providers, aliases, keys, and usage.</p>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>
        <nav className="nav" aria-label="Admin sections">
          {nav.map((item) => (
            <button
              key={item.id}
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
            >
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
            <DashboardStatusBadge
              token={token}
              loading={loading}
              hasLoaded={hasLoaded}
              hasFailures={hasFailures}
            />
            <input
              aria-label="Admin token"
              type="password"
              value={token}
              onChange={(event) => updateToken(event.target.value)}
              placeholder="ADMIN_TOKEN"
              autoComplete="current-password"
            />
            <Button
              tone="primary"
              icon={<RefreshCw />}
              onClick={refresh}
              disabled={loading}
              loading={loading}
            >
              {loading ? 'Loading dashboard' : hasLoaded ? 'Reload dashboard' : 'Load dashboard'}
            </Button>
            <Button tone="utility" icon={<LogOut />} onClick={clearSession}>
              Clear token
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
              sectionStates={sectionStates}
              onRetry={refresh}
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
              pendingAction={pendingAction}
              onRetry={refresh}
            />
          )}
          {tab === 'providers' && (
            <Providers
              data={data}
              errors={errors}
              token={token}
              run={run}
              setModal={setModal}
              pendingAction={pendingAction}
              onRetry={refresh}
            />
          )}
          {tab === 'aliases' && (
            <Aliases
              data={data}
              errors={errors}
              token={token}
              run={run}
              setModal={setModal}
              pendingAction={pendingAction}
              onRetry={refresh}
            />
          )}
          {tab === 'usage' && (
            <Usage
              data={data}
              errors={errors}
              token={token}
              notify={notify}
              pendingAction={pendingAction}
              setPendingAction={setPendingAction}
              onRetry={refresh}
            />
          )}
          {tab === 'settings' && <SettingsView clearSession={clearSession} notify={notify} />}
        </main>
      </div>

      {modal && <Modal modal={modal} token={token} run={run} close={() => setModal(null)} />}
      {toast && <ToastView toast={toast} close={() => setToast(null)} />}
    </div>
  );
}

function Overview({
  data,
  loading,
  lastRefresh,
  errors,
  sectionStates,
  onRetry,
  activity,
}: {
  data: DashboardData;
  loading: boolean;
  lastRefresh: Date | null;
  errors: Partial<Record<SectionKey, string>>;
  sectionStates: SectionStates;
  onRetry: () => void;
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
        ? 'Unchecked'
        : 'No providers configured';
  const failedSections = Object.entries(errors);

  return (
    <>
      {failedSections.length > 0 && (
        <div className="inline-error">
          <strong>Some dashboard data failed to load.</strong>
          <p>
            Loaded sections may be current, but failed sections are showing stale or missing data.
          </p>
          {failedSections.map(([section, message]) => (
            <div className="error-row" key={section}>
              <span>
                <strong>{titleCase(section)}</strong>: {message}
              </span>
              <Button tone="utility" onClick={onRetry}>
                Retry section
              </Button>
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
          badge={
            <Badge tone={enabledAliases ? 'ok' : 'warn'}>
              {enabledAliases ? 'Enabled' : 'Unchecked'}
            </Badge>
          }
        />
        <Metric
          label="Active developer keys"
          value={activeKeys}
          badge={<Badge tone={activeKeys ? 'ok' : 'off'}>{activeKeys ? 'Active' : 'None'}</Badge>}
        />
      </div>
      <div className="grid two stack">
        <Panel
          title="Gateway Status"
          subtitle="A quick read on whether the admin console can reach the control-plane data."
        >
          <StatusLine
            label="Control plane API"
            value={
              lastRefresh ? (failedSections.length ? 'Some data failed' : 'Current') : 'Not loaded'
            }
            tone={failedSections.length ? 'warn' : lastRefresh ? 'ok' : 'warn'}
          />
          <StatusLine
            label="Providers configured"
            value={enabledProviders ? `${enabledProviders} Enabled` : 'None yet'}
            tone={enabledProviders ? 'ok' : 'warn'}
          />
          <StatusLine
            label="Model aliases"
            value={enabledAliases ? `${enabledAliases} Enabled` : 'None yet'}
            tone={enabledAliases ? 'ok' : 'warn'}
          />
          <StatusLine
            label="Developer keys"
            value={activeKeys ? `${activeKeys} Active` : 'No active keys'}
            tone={activeKeys ? 'ok' : 'info'}
          />
          <div className="section-state-list">
            {sectionKeys.map((section) => (
              <div className="section-state" key={section}>
                <span>{titleCase(section)}</span>
                <Badge tone={sectionTone(sectionStates[section].status)}>
                  {sectionLabel(sectionStates[section].status)}
                </Badge>
              </div>
            ))}
          </div>
          <div className="meta-line">
            {loading
              ? 'Loading dashboard data...'
              : `Last loaded: ${lastRefresh ? formatRelativeDate(lastRefresh) : 'Never'}`}
          </div>
        </Panel>
        <Panel
          title="Operator Runbook"
          subtitle="Shortest path from empty system to working developer access."
        >
          <div className="callout info">
            1. Add provider and run health check.
            <br />
            2. Create model aliases and sync them.
            <br />
            3. Create developer user and issue a developer key.
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
          <div className="empty">No actions recorded in this browser session.</div>
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
  pendingAction,
  onRetry,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  run: (
    action: () => Promise<void>,
    success: string,
    tone?: Tone,
    pending?: PendingAction,
  ) => Promise<void>;
  notify: (message: string, tone?: Tone) => void;
  setModal: (modal: ModalState) => void;
  pendingAction: PendingAction | null;
  onRetry: () => void;
}) {
  const [filters, setFilters] = useState({ q: '', status: 'all' });
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', dir: 'desc' });
  const rows = useRows(data.keys, filters, sort, [
    'name',
    'prefix',
    (key) => key.user?.email || data.users.find((user) => user.id === key.userId)?.email,
    (key) => key.user?.name || data.users.find((user) => user.id === key.userId)?.name,
    (key) => key.team?.name || key.team?.slug,
    'status',
    'litellmKeyAlias',
  ]);
  const [newKey, setNewKey] = useState<{ value: string; developer: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

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
      `Developer created: ${email}.`,
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
      return notify('Developer, key name, and model access are required.', 'warn');
    const developer = data.users.find((user) => user.id === userId);
    try {
      const key = await api.createKey(token, { userId, name, models });
      setNewKey({ value: key.apiKey, developer: developer?.email || userId });
      setCopiedKey(false);
      notify(`Developer key issued for ${developer?.email || userId}.`);
    } catch (error) {
      notify(
        `Developer key issue failed. Check the selected developer and model access, then retry. ${
          error instanceof Error ? error.message : ''
        }`,
        'danger',
      );
    }
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['users', 'keys', 'aliases']} onRetry={onRetry} />
      {newKey && (
        <OneTimeSecretPanel
          value={newKey.value}
          copied={copiedKey}
          setCopied={setCopiedKey}
          notify={notify}
          dismiss={() => setNewKey(null)}
        />
      )}
      <Panel
        title="Issue developer key"
        subtitle="Developer keys are LiteLLM virtual keys. Each key belongs to one developer and should be stored in their secret manager."
      >
        <div className="flow-grid">
          <form className="form-grid flow-card" onSubmit={createUser}>
            <div className="flow-heading full">
              <Badge tone="info">Step 1</Badge>
              <strong>Create developer</strong>
              <span>Use this only when the developer does not already exist.</span>
            </div>
            <Field label="Email" name="email" required placeholder="dev@example.com" />
            <Field label="Name" name="name" required placeholder="Dev Example" />
            <Field label="Team Slug" name="teamSlug" placeholder="engineering" />
            <Field label="Team Name" name="teamName" placeholder="Engineering" />
            <div className="actions full">
              <Button tone="secondary" icon={<UserPlus />} type="submit">
                Create developer
              </Button>
            </div>
          </form>
          <form className="form-grid flow-card primary-flow" onSubmit={createKey}>
            <div className="flow-heading full">
              <Badge tone="info">Step 2</Badge>
              <strong>Issue access</strong>
              <span>Select a developer, choose allowed aliases, then issue the key.</span>
            </div>
            <div className="field full">
              <span>Developer *</span>
              <SearchableSelect
                name="userId"
                placeholder={data.users.length ? 'Select developer' : 'Create a developer first'}
                options={data.users.map((user) => ({
                  value: user.id,
                  label: user.email,
                  description: [user.name, user.team?.name || user.team?.slug]
                    .filter(Boolean)
                    .join(' • '),
                }))}
              />
            </div>
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
                Issue developer key
              </Button>
            </div>
          </form>
        </div>
      </Panel>
      <Panel className={`stack ${newKey ? 'muted-panel' : ''}`}>
        <TableToolbar
          title="Developer Keys"
          hint="Revoke a key only when it leaks or a developer loses access."
          filters={filters}
          setFilters={setFilters}
          options={['active', 'revoked']}
        />
        <DataTable
          empty="No developer keys yet. Select a developer and issue the first key."
          sort={sort}
          setSort={setSort}
          columns={[
            {
              key: 'name',
              label: 'Developer key',
              render: (key: ApiKey) => (
                <>
                  <strong>{key.name}</strong>
                  <div className="hint">Developer key</div>
                </>
              ),
            },
            {
              key: 'userId',
              label: 'Developer',
              render: (key: ApiKey) => {
                const user = key.user || data.users.find((item) => item.id === key.userId);
                return (
                  <>
                    <strong>{user?.email || 'Unknown developer'}</strong>
                    {user?.name && <div className="hint">{user.name}</div>}
                  </>
                );
              },
            },
            {
              key: 'teamId',
              label: 'Team',
              render: (key: ApiKey) => (
                <>
                  <strong>{key.team?.name || key.team?.slug || 'No team'}</strong>
                  {key.team?.slug && key.team.name !== key.team.slug && (
                    <div className="hint">{key.team.slug}</div>
                  )}
                </>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (key: ApiKey) =>
                pendingAction?.kind === 'key-revoke' && pendingAction.id === key.id ? (
                  <PendingBadge>Revoking...</PendingBadge>
                ) : (
                  <Badge tone={key.status === 'active' ? 'ok' : 'off'}>
                    {titleCase(key.status)}
                  </Badge>
                ),
            },
            {
              key: 'createdAt',
              label: 'Created',
              render: (key: ApiKey) => <RelativeTime value={key.createdAt} />,
            },
            {
              key: 'lastUsedAt',
              label: 'Last used',
              render: (key: ApiKey) => <RelativeTime value={key.lastUsedAt} empty="Never" />,
            },
            {
              key: 'actions',
              label: 'Actions',
              sortable: false,
              render: (key: ApiKey) => (
                <ActionMenu
                  label="Key actions"
                  items={[
                    {
                      label: 'View details',
                      onClick: () =>
                        setModal({
                          kind: 'details',
                          title: `Developer key: ${key.name}`,
                          body: <RecordDetails rows={objectRows(key)} />,
                        }),
                    },
                    ...(key.status === 'active'
                      ? [
                          {
                            label: 'Revoke key',
                            danger: true,
                            onClick: () =>
                              setModal({
                                kind: 'danger',
                                title: 'Revoke developer key',
                                label: 'Revoke key',
                                confirmText: key.prefix,
                                success: `Developer key revoked: ${key.prefix}.`,
                                pending: { kind: 'key-revoke', id: key.id },
                                body: (
                                  <>
                                    This revokes key <code>{key.prefix}</code>. Existing clients
                                    using this key will fail immediately. Revocation cannot reveal
                                    the old key again. To recover, issue a new developer key.
                                  </>
                                ),
                                action: () => api.revokeKey(token, key.id).then(() => undefined),
                              }),
                          },
                        ]
                      : []),
                  ]}
                />
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
  pendingAction,
  onRetry,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  run: (
    action: () => Promise<void>,
    success: string,
    tone?: Tone,
    pending?: PendingAction,
  ) => Promise<void>;
  setModal: (modal: ModalState) => void;
  pendingAction: PendingAction | null;
  onRetry: () => void;
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
      `Provider created: ${slug}. Run Check health next.`,
    );
    event.currentTarget.reset();
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['providers', 'aliases']} onRetry={onRetry} />
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
          quiet
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
            { key: 'baseUrl', label: 'Endpoint', className: 'mono truncate' },
            {
              key: 'enabled',
              label: 'Enabled',
              render: (p: Provider) => (
                <Badge tone={p.enabled ? 'ok' : 'off'}>{p.enabled ? 'Enabled' : 'Disabled'}</Badge>
              ),
            },
            {
              key: 'apiKeyLast4',
              label: 'Key',
              render: (p: Provider) => (p.apiKeyLast4 ? `Ending in ${p.apiKeyLast4}` : 'No key'),
            },
            {
              key: 'healthStatus',
              label: 'Health',
              render: (p: Provider) =>
                pendingAction?.kind === 'provider-health' && pendingAction.id === p.id ? (
                  <PendingBadge>Checking...</PendingBadge>
                ) : pendingAction?.kind === 'provider-rotate' && pendingAction.id === p.id ? (
                  <PendingBadge>Rotating key...</PendingBadge>
                ) : pendingAction?.kind === 'provider-disable' && pendingAction.id === p.id ? (
                  <PendingBadge>Disabling...</PendingBadge>
                ) : (
                  providerBadge(p)
                ),
            },
            {
              key: 'lastHealthAt',
              label: 'Last health check',
              render: (p: Provider) => <RelativeTime value={p.lastHealthAt} empty="Never" />,
            },
            {
              key: 'actions',
              label: 'Actions',
              sortable: false,
              render: (p: Provider) => (
                <div className="row tight">
                  <Button
                    loading={pendingAction?.kind === 'provider-health' && pendingAction.id === p.id}
                    onClick={() =>
                      run(
                        () => api.checkProvider(token, p.id).then(() => undefined),
                        `Provider health checked: ${p.slug}.`,
                        'ok',
                        { kind: 'provider-health', id: p.id },
                      )
                    }
                  >
                    Check health
                  </Button>
                  <ActionMenu
                    label="Provider actions"
                    items={[
                      {
                        label: 'View details',
                        onClick: () =>
                          setModal({
                            kind: 'details',
                            title: `Provider: ${p.slug}`,
                            body: (
                              <RecordDetails
                                rows={[
                                  ...objectRows(p),
                                  [
                                    'Affected aliases',
                                    affectedAliases(data.aliases, p.id).toString(),
                                  ],
                                ]}
                              />
                            ),
                          }),
                      },
                      {
                        label: 'Rotate key',
                        onClick: () =>
                          setModal({
                            kind: 'rotate',
                            provider: p,
                            affectedAliases: affectedAliases(data.aliases, p.id),
                          }),
                      },
                      {
                        label: 'Disable provider',
                        danger: true,
                        onClick: () =>
                          setModal({
                            kind: 'danger',
                            title: 'Disable provider',
                            label: 'Disable provider',
                            confirmText: p.slug,
                            success: `Provider disabled: ${p.slug}. ${affectedAliases(
                              data.aliases,
                              p.id,
                            )} aliases were disabled.`,
                            pending: { kind: 'provider-disable', id: p.id },
                            body: (
                              <>
                                This disables provider <strong>{p.slug}</strong> and{' '}
                                <strong>{affectedAliases(data.aliases, p.id)}</strong> enabled
                                aliases that route through it. Traffic using those aliases may fail
                                immediately. Historical usage data is preserved. To recover,
                                re-enable or recreate the provider, then sync affected aliases.
                              </>
                            ),
                            action: () => api.disableProvider(token, p.id).then(() => undefined),
                          }),
                      },
                    ]}
                  />
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
  pendingAction,
  onRetry,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  run: (
    action: () => Promise<void>,
    success: string,
    tone?: Tone,
    pending?: PendingAction,
  ) => Promise<void>;
  setModal: (modal: ModalState) => void;
  pendingAction: PendingAction | null;
  onRetry: () => void;
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
      `Alias created and sync requested: ${alias}.`,
    );
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['aliases', 'providers']} onRetry={onRetry} />
      <div className="grid two">
        <Panel
          title="Create Model Alias"
          subtitle="Aliases are stable public names developers use from Codex, Cursor, Cline, and automation."
        >
          <form className="form-grid" onSubmit={createAlias}>
            <Field label="Alias" name="alias" required defaultValue="code-premium" />
            <div className="field">
              <span>Provider *</span>
              <SearchableSelect
                name="providerId"
                placeholder={data.providers.length ? 'Select provider' : 'Create a provider first'}
                options={data.providers
                  .filter((provider) => provider.enabled)
                  .map((provider) => ({
                    value: provider.id,
                    label: provider.slug,
                    description: provider.name,
                  }))}
              />
            </div>
            <Field
              label="Upstream Model"
              name="upstreamModel"
              required
              defaultValue="openai/gemini-2.5-pro"
              full
            />
            <div className="actions full">
              <Button tone="primary" icon={<Route />} type="submit">
                Create and sync alias
              </Button>
            </div>
          </form>
        </Panel>
        <Panel
          title="Routing Preview"
          subtitle="Developers see aliases. Operators control provider and upstream model mapping."
          quiet
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
            { key: 'upstreamModel', label: 'Upstream model', className: 'mono truncate' },
            {
              key: 'enabled',
              label: 'Enabled',
              render: (a: ModelAlias) =>
                pendingAction?.kind === 'alias-sync' && pendingAction.id === a.id ? (
                  <PendingBadge>Syncing...</PendingBadge>
                ) : pendingAction?.kind === 'alias-disable' && pendingAction.id === a.id ? (
                  <PendingBadge>Disabling...</PendingBadge>
                ) : (
                  <Badge tone={a.enabled ? 'ok' : 'off'}>
                    {a.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                ),
            },
            {
              key: 'lastSyncedAt',
              label: 'Last synced',
              render: (a: ModelAlias) => <RelativeTime value={a.lastSyncedAt} empty="Never" />,
            },
            {
              key: 'actions',
              label: 'Actions',
              sortable: false,
              render: (a: ModelAlias) => (
                <div className="row tight">
                  <Button
                    loading={pendingAction?.kind === 'alias-sync' && pendingAction.id === a.id}
                    onClick={() =>
                      run(
                        () => api.syncAlias(token, a.id).then(() => undefined),
                        `Alias synced: ${a.alias}.`,
                        'ok',
                        { kind: 'alias-sync', id: a.id },
                      )
                    }
                  >
                    Sync alias
                  </Button>
                  <ActionMenu
                    label="Alias actions"
                    items={[
                      {
                        label: 'View details',
                        onClick: () =>
                          setModal({
                            kind: 'details',
                            title: `Alias: ${a.alias}`,
                            body: <RecordDetails rows={objectRows(a)} />,
                          }),
                      },
                      {
                        label: 'Disable alias',
                        danger: true,
                        onClick: () =>
                          setModal({
                            kind: 'danger',
                            title: 'Disable alias',
                            label: 'Disable alias',
                            confirmText: a.alias,
                            success: `Alias disabled: ${a.alias}.`,
                            pending: { kind: 'alias-disable', id: a.id },
                            body: (
                              <>
                                This disables alias <code>{a.alias}</code>. Clients using this model
                                name may fail immediately until they switch routes or the alias is
                                restored. To recover, recreate or re-enable the alias and sync it.
                              </>
                            ),
                            action: () => api.disableAlias(token, a.id).then(() => undefined),
                          }),
                      },
                    ]}
                  />
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
  pendingAction,
  setPendingAction,
  onRetry,
}: {
  data: DashboardData;
  errors: Partial<Record<SectionKey, string>>;
  token: string;
  notify: (message: string, tone?: Tone) => void;
  pendingAction: PendingAction | null;
  setPendingAction: (pending: PendingAction | null) => void;
  onRetry: () => void;
}) {
  const [usage, setUsage] = useState<UsageResponse | null>(data.usage);
  const [source, setSource] = useState<'litellm' | 'local'>('litellm');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState('last7');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  useEffect(() => setUsage(data.usage), [data.usage]);
  const topUsersByCost = usage?.topUsersByCost?.length ? usage.topUsersByCost : usage?.byUser || [];
  const topUsersByTokens = usage?.topUsersByTokens?.length
    ? usage.topUsersByTokens
    : [...(usage?.byUser || [])].sort(
        (a, b) => Number(b.totalTokens || 0) - Number(a.totalTokens || 0),
      );
  const selectedUser =
    (usage?.byUser || []).find((row) => usageUserId(row) === selectedUserId) || null;

  const applyPreset = (value: string) => {
    setPreset(value);
    if (value === 'custom') return;
    const range = usagePresetRange(value);
    setFrom(range.from);
    setTo(range.to);
  };

  const refreshUsage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token.trim()) return notify('Enter the admin token before loading usage.', 'warn');
    setLoading(true);
    setPendingAction({ kind: 'usage-refresh' });
    try {
      setUsage(await api.getUsage(token, { source, from: from || undefined, to: to || undefined }));
      notify(
        `Usage refreshed from ${source === 'litellm' ? 'LiteLLM spend logs' : 'local ingest records'}.`,
      );
    } catch (error) {
      notify(
        `Usage refresh failed. Check ${
          source === 'litellm' ? 'LiteLLM spend logs' : 'local ingest records'
        } and retry. ${error instanceof Error ? error.message : ''}`,
        'danger',
      );
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  return (
    <>
      <SectionErrors errors={errors} sections={['usage']} onRetry={onRetry} />
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
          <div className="field">
            <span>Source</span>
            <SearchableSelect
              value={source}
              onChange={(value) => setSource(value as 'litellm' | 'local')}
              options={[
                { value: 'litellm', label: 'LiteLLM spend logs' },
                { value: 'local', label: 'Local ingest records' },
              ]}
            />
          </div>
          <div className="field">
            <span>Range</span>
            <SearchableSelect
              value={preset}
              onChange={applyPreset}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'last7', label: 'Last 7 days' },
                { value: 'thisMonth', label: 'This month' },
                { value: 'lastMonth', label: 'Last month' },
                { value: 'custom', label: 'Custom range' },
              ]}
            />
          </div>
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setPreset('custom');
                setFrom(event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setPreset('custom');
                setTo(event.target.value);
              }}
            />
          </label>
          <div className="actions">
            <Button
              type="submit"
              icon={<RefreshCw />}
              disabled={loading}
              loading={pendingAction?.kind === 'usage-refresh'}
            >
              {loading ? 'Refreshing usage' : 'Refresh usage'}
            </Button>
          </div>
        </form>
        {pendingAction?.kind === 'usage-refresh' && <PendingBadge>Refreshing...</PendingBadge>}
        <UsageStatus usage={usage} source={source} from={from} to={to} />
        <div className="actions">
          <Button
            type="button"
            tone="utility"
            icon={<Copy />}
            onClick={() => exportUsageCsv('usage-by-user.csv', usage?.byUser || [])}
          >
            Export users CSV
          </Button>
          <Button
            type="button"
            tone="utility"
            icon={<Copy />}
            onClick={() => exportUsageCsv('usage-by-team.csv', usage?.byTeam || [])}
          >
            Export teams CSV
          </Button>
          <Button
            type="button"
            tone="utility"
            icon={<Copy />}
            onClick={() =>
              exportUsageCsv('usage-daily-rollup.csv', usage?.rawDailyRollup || usage?.byDay || [])
            }
          >
            Export daily CSV
          </Button>
        </div>
        {usage?.unknownAttribution && (
          <div className="callout warn">
            <strong>Unknown attribution detected.</strong> {usage.unknownAttribution.requests}{' '}
            requests could not be mapped to a developer key, user, or team.
          </div>
        )}
        <div className="grid two">
          <UserUsageTable
            title="Top users by cost"
            rows={topUsersByCost}
            onSelect={(row) => setSelectedUserId(usageUserId(row))}
          />
          <UserUsageTable
            title="Top users by tokens"
            rows={topUsersByTokens}
            onSelect={(row) => setSelectedUserId(usageUserId(row))}
          />
        </div>
        <div className="grid two">
          <UsageTable title="By Team" rows={usage?.byTeam || []} rowKey="team" />
          <UsageTable title="By Model" rows={usage?.byModel || []} rowKey="model" />
        </div>
        {selectedUser && (
          <UserUsageDetail row={selectedUser} onClose={() => setSelectedUserId(null)} />
        )}
      </Panel>
    </>
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
      <Panel title="Codex Configuration" subtitle="Give each developer their own developer key.">
        <pre className="callout info mono">{env}</pre>
      </Panel>
      <Panel
        title="Security Baseline"
        subtitle="This dashboard is admin-only and should remain behind VPN or access control."
      >
        <div className="actions">
          <Button
            tone="utility"
            icon={<Copy />}
            onClick={() =>
              navigator.clipboard.writeText(env).then(() => notify('Codex config copied.'))
            }
          >
            Copy Codex config
          </Button>
          <Button tone="utility" icon={<LogOut />} onClick={clearSession}>
            Clear token
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
  run: (
    action: () => Promise<void>,
    success: string,
    tone?: Tone,
    pending?: PendingAction,
  ) => Promise<void>;
  close: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [confirmation, setConfirmation] = useState('');
  if (!modal) return null;
  const submitRotate = async () => {
    if (modal.kind !== 'rotate' || !apiKey.trim()) return;
    await run(
      () => api.rotateProvider(token, modal.provider.id, apiKey.trim()).then(() => undefined),
      `Provider key rotated: ${modal.provider.slug}. ${modal.affectedAliases} aliases synced.`,
      'ok',
      { kind: 'provider-rotate', id: modal.provider.id },
    );
    close();
  };
  const submitDanger = async () => {
    if (modal.kind !== 'danger' || confirmation !== modal.confirmText) return;
    await run(modal.action, modal.success, 'warn', modal.pending);
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
                may fail if the new key is invalid. To recover, rotate back to a working key and run
                Check health.
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
              {modal.kind === 'rotate' ? 'Rotate key and sync aliases' : modal.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageStatus({
  usage,
  source,
  from,
  to,
}: {
  usage: UsageResponse | null;
  source: 'litellm' | 'local';
  from: string;
  to: string;
}) {
  if (!usage) {
    return (
      <div className="callout warn">
        <strong>Usage is not loaded.</strong> Refresh usage to check spend logs and attribution.
      </div>
    );
  }
  if (!usage.totals.requests) {
    return (
      <div className="callout info">
        <strong>No usage in selected range.</strong> Source is{' '}
        {source === 'litellm' ? 'LiteLLM spend logs' : 'local ingest records'}.
        {from || to ? ' Adjust the date range if this looks unexpected.' : ''}
      </div>
    );
  }
  return (
    <div className="callout info">
      <strong>Usage loaded.</strong> Showing {usage.totals.requests} requests from{' '}
      {source === 'litellm' ? 'LiteLLM spend logs' : 'local ingest records'}.
    </div>
  );
}

function UserUsageTable({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: UsageGroup[];
  onSelect: (row: UsageGroup) => void;
}) {
  const [sort, setSort] = useState<SortState>({ key: 'estimatedCost', dir: 'desc' });
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  return (
    <div>
      <h3>{title}</h3>
      <DataTable
        empty="No attributed usage in this range."
        rows={sorted}
        sort={sort}
        setSort={setSort}
        columns={[
          {
            key: 'user',
            label: 'User',
            render: (row: UsageGroup) => (
              <button className="link-button" type="button" onClick={() => onSelect(row)}>
                <span className="strong">{usageUserLabel(row)}</span>
                <span className="hint block">{row.team?.name || row.team?.slug || 'No team'}</span>
              </button>
            ),
          },
          { key: 'requests', label: 'Requests' },
          { key: 'totalTokens', label: 'Tokens' },
          {
            key: 'estimatedCost',
            label: 'Cost',
            render: (row: UsageGroup) => formatMoney(row.estimatedCost),
          },
          {
            key: 'lastUsage',
            label: 'Last activity',
            render: (row: UsageGroup) => <RelativeTime value={row.lastUsage} empty="Never" />,
          },
        ]}
      />
    </div>
  );
}

function UserUsageDetail({ row, onClose }: { row: UsageGroup; onClose: () => void }) {
  const costLimit = Number(row.budget?.monthlyCostLimit || 0);
  const tokenLimit = Number(row.budget?.monthlyTokenLimit || 0);
  const costPercent = costLimit
    ? Math.round((Number(row.estimatedCost || 0) / costLimit) * 100)
    : 0;
  const tokenPercent = tokenLimit
    ? Math.round((Number(row.totalTokens || 0) / tokenLimit) * 100)
    : 0;
  return (
    <Panel
      className="stack"
      title={`Usage detail: ${usageUserLabel(row)}`}
      subtitle="Requests, cost, models, keys, activity, and budget risk for the selected range."
    >
      <div className="actions">
        <Button type="button" tone="utility" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="grid four">
        <Metric label="Requests" value={row.requests || 0} />
        <Metric label="Total tokens" value={row.totalTokens || 0} />
        <Metric label="Estimated cost" value={formatMoney(row.estimatedCost)} />
        <Metric
          label="Errors"
          value={row.errors || 0}
          badge={row.errors ? <Badge tone="warn">Review</Badge> : <Badge tone="ok">Clear</Badge>}
        />
      </div>
      <div className="grid two">
        <Panel title="Budget status" subtitle="Warning starts at 80%; hard stop target is 100%.">
          {row.budget ? (
            <div className="stack small">
              <div className="row spread">
                <span>Cost budget</span>
                <Badge tone={costPercent >= 100 ? 'danger' : costPercent >= 80 ? 'warn' : 'ok'}>
                  {costPercent || 0}%
                </Badge>
              </div>
              <div className="hint">
                {formatMoney(row.estimatedCost)} of {formatMoney(row.budget.monthlyCostLimit || 0)}
              </div>
              <div className="row spread">
                <span>Token budget</span>
                <Badge tone={tokenPercent >= 100 ? 'danger' : tokenPercent >= 80 ? 'warn' : 'ok'}>
                  {tokenPercent || 0}%
                </Badge>
              </div>
              <div className="hint">
                {row.totalTokens || 0} of {row.budget.monthlyTokenLimit || 0} tokens
              </div>
            </div>
          ) : (
            <div className="empty">
              No active user budget. Set a budget to make this operational.
            </div>
          )}
        </Panel>
        <Panel title="Anomalies" subtitle="Simple rule-based signals for operational review.">
          {row.anomalies?.length ? (
            <ul className="compact-list">
              {row.anomalies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <div className="empty">No anomaly detected in this range.</div>
          )}
        </Panel>
      </div>
      <div className="grid two">
        <UsageTable title="Cost by model" rows={row.modelBreakdown || []} rowKey="name" />
        <UsageTable title="Cost by developer key" rows={row.keyBreakdown || []} rowKey="name" />
      </div>
      <UsageTable title="Daily trend" rows={row.daily || []} rowKey="date" />
    </Panel>
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
            render: (row: UsageGroup) => usageGroupLabel(row, rowKey),
          },
          { key: 'requests', label: 'Requests' },
          { key: 'totalTokens', label: 'Tokens' },
          {
            key: 'estimatedCost',
            label: 'Cost',
            render: (row: UsageGroup) => formatMoney(row.estimatedCost),
          },
        ]}
      />
    </div>
  );
}

function SearchableSelect({
  name,
  value,
  defaultValue = '',
  onChange,
  options,
  placeholder = 'Select option',
  className = '',
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: Array<{ value: string; label: string; description?: string }>;
  placeholder?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const filtered = options.filter((option) =>
    `${option.label} ${option.description || ''} ${option.value}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const choose = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
    setQuery('');
    setOpen(false);
  };

  return (
    <div
      className={`searchable-select ${className}`}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
    >
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        type="button"
        className="searchable-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
      >
        <span>
          {selected?.label || placeholder}
          {selected?.description && <small>{selected.description}</small>}
        </span>
      </button>
      {open && (
        <div className="searchable-select-popover">
          <label className="search compact">
            <Search />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
            />
          </label>
          <div className="searchable-select-list" role="listbox">
            {filtered.length ? (
              filtered.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={option.value === selectedValue}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </button>
              ))
            ) : (
              <div className="empty compact">No options match.</div>
            )}
          </div>
        </div>
      )}
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
        <SearchableSelect
          className="page-size-select"
          value={String(pageSize)}
          onChange={(value) => {
            setPageSize(Number(value));
            setPage(1);
          }}
          options={[
            { value: '10', label: '10 rows' },
            { value: '25', label: '25 rows' },
            { value: '50', label: '50 rows' },
          ]}
        />
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
            placeholder={`Search ${title.toLowerCase()}`}
          />
        </label>
        <SearchableSelect
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value })}
          options={[
            { value: 'all', label: 'All statuses' },
            ...options.map((option) => ({ value: option, label: titleCase(option) })),
          ]}
        />
      </div>
    </div>
  );
}

function SectionErrors({
  errors,
  sections,
  onRetry,
}: {
  errors: Partial<Record<SectionKey, string>>;
  sections: SectionKey[];
  onRetry?: () => void;
}) {
  const entries = sections
    .map((section) => [section, errors[section]] as const)
    .filter((entry): entry is readonly [SectionKey, string] => Boolean(entry[1]));

  if (!entries.length) return null;

  return (
    <div className="inline-error">
      <strong>Some dashboard data failed to load.</strong>
      <p>Check the admin API, then retry the failed section.</p>
      {entries.map(([section, message]) => (
        <div className="error-row" key={section}>
          <span>
            <strong>{titleCase(section)}</strong>: {message}
          </span>
          {onRetry && (
            <Button tone="utility" onClick={onRetry}>
              Retry section
            </Button>
          )}
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
  quiet,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  quiet?: boolean;
}) {
  return (
    <section className={`panel ${quiet ? 'quiet' : ''} ${className}`}>
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

function DashboardStatusBadge({
  token,
  loading,
  hasLoaded,
  hasFailures,
}: {
  token: string;
  loading: boolean;
  hasLoaded: boolean;
  hasFailures: boolean;
}) {
  if (loading) return <Badge tone="info">Loading dashboard</Badge>;
  if (!token.trim()) return <Badge tone="warn">Token required</Badge>;
  if (hasFailures) return <Badge tone="warn">Some data failed</Badge>;
  if (hasLoaded) return <Badge tone="ok">Current</Badge>;
  return <Badge tone="info">Token loaded</Badge>;
}

function ToastView({ toast, close }: { toast: Exclude<Toast, null>; close: () => void }) {
  return (
    <div className={`toast ${toast.tone}`} role={toast.tone === 'danger' ? 'alert' : 'status'}>
      <span>{toast.message}</span>
      {toast.persistent && (
        <button className="toast-close" onClick={close} aria-label="Dismiss notification">
          Dismiss
        </button>
      )}
    </div>
  );
}

function PendingBadge({ children }: { children: ReactNode }) {
  return (
    <Badge tone="info">
      <Loader2 className="spin tiny" />
      {children}
    </Badge>
  );
}

function ActionMenu({
  label,
  items,
}: {
  label: string;
  items: Array<{ label: string; onClick: () => void; danger?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="action-menu">
      <Button
        tone="utility"
        icon={<MoreHorizontal />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="visually-hidden">{label}</span>
      </Button>
      {open && (
        <div className="action-menu-popover" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              className={item.danger ? 'danger-item' : ''}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RelativeTime({
  value,
  empty = 'Never',
}: {
  value?: string | Date | null;
  empty?: string;
}) {
  if (!value) return <span className="hint">{empty}</span>;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="hint">{empty}</span>;
  return (
    <span title={formatDate(date)}>
      {formatRelativeDate(date)}
      <span className="hint block">{formatDate(date)}</span>
    </span>
  );
}

function usageUserId(row: UsageGroup) {
  return row.user?.id || (typeof row.userId === 'string' ? row.userId : 'unknown');
}

function usageUserLabel(row: UsageGroup) {
  if (row.user) return `${row.user.name} <${row.user.email}>`;
  if (row.userId && row.userId !== 'unknown') return String(row.userId);
  return 'Unknown attribution';
}

function usageGroupLabel(row: UsageGroup, key: string) {
  if (key === 'team') return row.team?.name || row.team?.slug || 'Unknown team';
  if (key === 'name') return String(row.name || 'Unknown');
  return String(row[key] || 'Unknown');
}

function formatMoney(value: unknown) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function usagePresetRange(value: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  if (value === 'today') return { from: iso(today), to: iso(addDays(today, 1)) };
  if (value === 'yesterday') return { from: iso(addDays(today, -1)), to: iso(today) };
  if (value === 'thisMonth') {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: iso(addDays(today, 1)),
    };
  }
  if (value === 'lastMonth') {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    };
  }
  return { from: iso(addDays(today, -6)), to: iso(addDays(today, 1)) };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function exportUsageCsv(filename: string, rows: UsageGroup[]) {
  const headers = ['name', 'requests', 'totalTokens', 'estimatedCost', 'errors', 'lastUsage'];
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => csvCell(header === 'name' ? usageExportName(row) : row[header]))
        .join(','),
    ),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function usageExportName(row: UsageGroup) {
  return (
    row.user?.email ||
    row.team?.name ||
    row.key?.name ||
    row.name ||
    row.model ||
    row.date ||
    'Unknown'
  );
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function OneTimeSecretPanel({
  value,
  copied,
  setCopied,
  notify,
  dismiss,
}: {
  value: string;
  copied: boolean;
  setCopied: (copied: boolean) => void;
  notify: (message: string, tone?: Tone) => void;
  dismiss: () => void;
}) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    notify('Developer key copied.');
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="secret one-time-secret">
      <div>
        <strong>Developer key created</strong>
        <p>Copy this key now. It will not be shown again.</p>
      </div>
      <code>{value}</code>
      <div className="actions">
        <Button tone="primary" icon={copied ? <Check /> : <Copy />} onClick={copy}>
          {copied ? 'Copied' : 'Copy key'}
        </Button>
        <Button tone="utility" onClick={dismiss}>
          I saved this key
        </Button>
      </div>
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
  loading,
  ...props
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'primary' | 'secondary' | 'utility' | 'danger' | 'danger-ghost';
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={tone || 'secondary'} {...props}>
      {loading ? <Loader2 className="spin" /> : icon}
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

function sectionTone(status: LoadStatus): Tone {
  if (status === 'current') return 'ok';
  if (status === 'stale' || status === 'loading') return 'warn';
  if (status === 'failed') return 'danger';
  return 'off';
}

function sectionLabel(status: LoadStatus) {
  if (status === 'idle') return 'Not loaded';
  if (status === 'loading') return 'Loading';
  return titleCase(status);
}

function hasSectionData(section: SectionKey, data: DashboardData) {
  if (section === 'usage') return Boolean(data.usage);
  return data[section].length > 0;
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

function formatRelativeDate(value?: string | Date | null) {
  if (!value) return 'Never';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < minute) return 'Just now';
  if (abs < hour) return rtf.format(Math.round(-diff / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(-diff / hour), 'hour');
  return rtf.format(Math.round(-diff / day), 'day');
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

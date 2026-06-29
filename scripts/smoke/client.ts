import { createServer, type Server } from 'node:http';

export type SmokeContext = {
  apiUrl: string;
  litellmUrl: string;
  adminToken: string;
  model: string;
};

export function loadSmokeContext(): SmokeContext {
  return {
    apiUrl: env('SMOKE_API_URL', 'http://localhost:3000'),
    litellmUrl: env('SMOKE_LITELLM_URL', 'http://localhost:4000'),
    adminToken: env('ADMIN_TOKEN', 'change-me-admin-token'),
    model: env('SMOKE_MODEL', 'code-premium'),
  };
}

export async function adminFetch<T>(
  ctx: SmokeContext,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${ctx.adminToken}`);
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }

  return jsonFetch<T>(`${ctx.apiUrl}${path}`, {
    ...init,
    headers,
  });
}

export async function liteLlmFetch<T>(
  ctx: SmokeContext,
  path: string,
  key: string,
  init: RequestInit = {},
): Promise<T> {
  return jsonFetch<T>(`${ctx.litellmUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

export async function jsonFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed with ${response.status}: ${text}`);
  }

  return body as T;
}

export async function expectRejected(url: string, key: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  if (response.ok) {
    throw new Error(`Expected revoked key to be rejected by ${url}`);
  }
}

export async function maybeStartMockUpstream(): Promise<Server | null> {
  if (process.env.SMOKE_MOCK_UPSTREAM !== '1') {
    return null;
  }

  const port = Number(env('SMOKE_MOCK_UPSTREAM_PORT', '5055'));
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');

    if (request.url === '/v1/models') {
      response.end(JSON.stringify({ data: [{ id: 'mock-premium', object: 'model' }] }));
      return;
    }

    if (request.url === '/v1/chat/completions') {
      response.end(
        JSON.stringify({
          id: `chatcmpl-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'mock-premium',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.log(`mock upstream listening on http://localhost:${port}/v1`);
  return server;
}

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

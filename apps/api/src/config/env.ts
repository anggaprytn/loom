import { z } from 'zod';

const optionalPositiveNumber = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().positive().optional(),
);

const optionalPositiveInt = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  ADMIN_TOKEN: z.string().min(16),
  API_KEY_PEPPER: z.string().min(16),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REDIS_URL: z.string().url().optional(),
  LITELLM_PROXY_URL: z.string().url(),
  LITELLM_MASTER_KEY: z
    .string()
    .min(8)
    .refine((value) => value.startsWith('sk-'), {
      message: 'must start with sk-',
    }),
  DEFAULT_KEY_MAX_BUDGET: optionalPositiveNumber,
  DEFAULT_KEY_BUDGET_DURATION: z.string().min(1).default('30d'),
  DEFAULT_KEY_TPM_LIMIT: optionalPositiveInt,
  DEFAULT_KEY_RPM_LIMIT: optionalPositiveInt,
  ROUTER_BASE_URL: z.string().url().optional(),
  ROUTER_API_KEY: z.string().min(1).optional(),
  NINE_ROUTER_BASE_URL: z.string().url().optional(),
  NINE_ROUTER_API_KEY: z.string().min(1).optional(),
  ROUTER_PREMIUM_MODEL: z.string().min(1),
  ROUTER_BALANCED_MODEL: z.string().min(1),
  ROUTER_FAST_MODEL: z.string().min(1),
  ROUTER_FALLBACK_MODEL: z.string().min(1),
  ROUTER_AGENT_PREMIUM_MODEL: z.string().min(1),
  ROUTER_AGENT_CHEAP_MODEL: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  if (!parsed.data.ROUTER_BASE_URL && !parsed.data.NINE_ROUTER_BASE_URL) {
    throw new Error('Invalid environment: ROUTER_BASE_URL or NINE_ROUTER_BASE_URL is required');
  }

  if (!parsed.data.ROUTER_API_KEY && !parsed.data.NINE_ROUTER_API_KEY) {
    throw new Error('Invalid environment: ROUTER_API_KEY or NINE_ROUTER_API_KEY is required');
  }

  return parsed.data;
}

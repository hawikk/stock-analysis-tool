import OpenAI, { APIConnectionError, APIError } from "openai";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export type ProviderId = "openrouter" | "gemini" | "groq" | "custom" | "openai";

/**
 * Free OpenRouter models tried in order. Free promos come and go, so the list mixes upstream labs
 * (MiniMax, NVIDIA, Thinking Machines, Google) and ends with OpenRouter's own free-model router.
 * Override with AI_MODEL / AI_FALLBACK_MODELS without a code change.
 */
export const OPENROUTER_FREE_MODELS = [
  "minimax/minimax-m3.1-flash:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "thinkingmachines/inkling:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
];

type ProviderDef = { label: string; keys: string[]; baseURL?: string; models: string[] };

const PROVIDERS: Record<ProviderId, ProviderDef> = {
  openrouter: { label: "OpenRouter", keys: ["OPENROUTER_API_KEY"], baseURL: "https://openrouter.ai/api/v1", models: OPENROUTER_FREE_MODELS },
  gemini: {
    label: "Google Gemini",
    keys: ["GEMINI_API_KEY"],
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    models: ["gemini-flash-latest", "gemini-flash-lite-latest"],
  },
  groq: { label: "Groq", keys: ["GROQ_API_KEY"], baseURL: "https://api.groq.com/openai/v1", models: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"] },
  custom: { label: "Custom endpoint", keys: ["AI_API_KEY"], models: [] },
  openai: { label: "OpenAI", keys: ["OPENAI_API_KEY"], baseURL: "https://api.openai.com/v1", models: ["gpt-5-mini"] },
};

const ORDER: ProviderId[] = ["openrouter", "gemini", "groq", "custom", "openai"];

type Provider = { id: ProviderId; label: string; client: OpenAI; models: string[] };
export type AiTarget = { provider: ProviderId; label: string; model: string };

function list(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isProviderId(v: string): v is ProviderId {
  return v in PROVIDERS;
}

let providers: Provider[] | undefined;

/**
 * Every configured provider, primary first. AI_PROVIDER picks the primary when several keys are set;
 * otherwise OpenRouter wins. AI_MODEL (preferred models) and AI_FALLBACK_MODELS (replaces the built-in
 * fallback list) apply to the primary provider; the other providers keep their defaults.
 */
function configuredProviders(): Provider[] {
  if (providers) return providers;
  const env = process.env;
  const requested = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  const order = isProviderId(requested) ? [requested, ...ORDER.filter((p) => p !== requested)] : ORDER;
  const out: Provider[] = [];
  for (const id of order) {
    const def = PROVIDERS[id];
    const apiKey = def.keys.map((k) => env[k]).find(Boolean);
    if (!apiKey) continue;
    const baseURL = id === "custom" ? env.AI_BASE_URL : def.baseURL;
    if (id === "custom" && !baseURL) continue;
    let models = id === "custom" ? list(env.AI_MODEL) : def.models;
    if (out.length === 0 && id !== "custom") {
      const fallback = env.AI_FALLBACK_MODELS !== undefined ? list(env.AI_FALLBACK_MODELS) : models;
      models = [...new Set([...list(env.AI_MODEL), ...fallback])];
    }
    if (models.length === 0) continue;
    const headers: Record<string, string> = id === "openrouter" ? { "HTTP-Referer": SITE_URL, "X-Title": SITE_NAME } : {};
    out.push({
      id,
      label: id === "custom" && baseURL ? new URL(baseURL).hostname : def.label,
      models,
      client: new OpenAI({ apiKey, baseURL, maxRetries: 0, defaultHeaders: headers }),
    });
  }
  providers = out;
  return out;
}

export function aiEnabled(): boolean {
  return configuredProviders().length > 0;
}

export function aiChain(): AiTarget[] {
  return configuredProviders().flatMap((p) => p.models.map((model) => ({ provider: p.id, label: p.label, model })));
}

type Cooldown = { until: number; reason: string };
type LastCall = { target: string; ok: boolean; at: string; error?: string };

const globalForAi = globalThis as unknown as { __aiCooldowns?: Map<string, Cooldown>; __aiLast?: LastCall };
const cooldowns: Map<string, Cooldown> = globalForAi.__aiCooldowns ?? (globalForAi.__aiCooldowns = new Map());

const targetKey = (provider: ProviderId, model: string) => `${provider}/${model}`;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function coolingDown(key: string): Cooldown | undefined {
  const c = cooldowns.get(key);
  if (c && c.until > Date.now()) return c;
  if (c) cooldowns.delete(key);
  return undefined;
}

function retryAfterMs(err: APIError): number | null {
  const ra = err.headers?.get("retry-after");
  if (ra && Number.isFinite(Number(ra))) return Number(ra) * SECOND;
  const reset = Number(err.headers?.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > Date.now()) return reset - Date.now();
  return null;
}

type Failure = { cooldownMs: number; scope: "model" | "free-models" | "provider"; reason: string };

/** Maps an error to how long the failing model (or its whole provider) should be skipped. */
function classify(err: unknown): Failure {
  if (err instanceof APIConnectionError) return { cooldownMs: 2 * MINUTE, scope: "model", reason: err instanceof Error ? err.message : "connection error" };
  if (err instanceof APIError) {
    const msg = err.message;
    const status = err.status ?? 0;
    if (status === 429) {
      if (/per-day|daily/i.test(err.message)) return { cooldownMs: retryAfterMs(err) ?? HOUR, scope: "free-models", reason: `daily free-model limit: ${msg}` };
      return { cooldownMs: Math.min(retryAfterMs(err) ?? MINUTE, 10 * MINUTE), scope: "model", reason: `rate limited: ${msg}` };
    }
    // Some providers (Gemini) report a bad key as 400 rather than 401.
    if (status === 401 || status === 402 || status === 403 || /api[ _-]?key|credential|unauthori[sz]ed/i.test(msg)) return { cooldownMs: HOUR, scope: "provider", reason: msg };
    if (status === 400 || status === 404 || status === 410 || status === 422) return { cooldownMs: 6 * HOUR, scope: "model", reason: msg };
    return { cooldownMs: 2 * MINUTE, scope: "model", reason: msg };
  }
  const reason = err instanceof Error ? (err.name === "ZodError" ? "response did not match the expected JSON shape" : err.message.split("\n")[0]) : String(err);
  return { cooldownMs: 5 * MINUTE, scope: "model", reason };
}

function applyCooldown(provider: Provider, model: string, f: Failure) {
  const entry = { until: Date.now() + f.cooldownMs, reason: f.reason };
  const pause = (m: string) => {
    const key = targetKey(provider.id, m);
    if ((cooldowns.get(key)?.until ?? 0) < entry.until) cooldowns.set(key, entry);
  };
  switch (f.scope) {
    case "model":
      pause(model);
      break;
    case "free-models":
      for (const m of provider.models) if (m.endsWith(":free") || m === "openrouter/free") pause(m);
      pause(model);
      break;
    case "provider":
      for (const m of provider.models) pause(m);
      break;
    default: {
      const never: never = f.scope;
      throw new Error(`unhandled scope ${String(never)}`);
    }
  }
}

export function extractJson(content: string): unknown {
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model returned no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

export type AiStatus = {
  enabled: boolean;
  chain: (AiTarget & { coolingUntil?: string; reason?: string })[];
  last?: LastCall;
};

export function aiStatus(): AiStatus {
  return {
    enabled: aiEnabled(),
    chain: aiChain().map((t) => {
      const c = coolingDown(targetKey(t.provider, t.model));
      return c ? { ...t, coolingUntil: new Date(c.until).toISOString(), reason: c.reason } : t;
    }),
    last: globalForAi.__aiLast,
  };
}

const ATTEMPT_TIMEOUT_MS = 45_000;

/**
 * Walks the provider/model chain until one returns JSON that passes `parse`. Models that fail are
 * cooled down (rate limits briefly, removed models for hours) so later requests skip them. Throws
 * when the chain or the time budget is exhausted; callers fall back to the rules engine.
 */
export async function completeJson<T>(
  system: string,
  user: string,
  parse: (json: unknown) => T,
  { budgetMs = 100_000 }: { budgetMs?: number } = {},
): Promise<{ value: T; model: string }> {
  const chain = configuredProviders();
  if (chain.length === 0) throw new Error("No AI provider configured");
  const deadline = Date.now() + budgetMs;
  const errors: string[] = [];
  for (const provider of chain) {
    for (const model of provider.models) {
      const key = targetKey(provider.id, model);
      if (coolingDown(key)) continue;
      const remaining = deadline - Date.now();
      if (remaining < 5_000) throw new Error(`AI time budget exhausted after: ${errors.join(" | ") || "no attempts"}`);
      try {
        const res = await provider.client.chat.completions.create(
          {
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
            ...(provider.id === "openrouter" ? { reasoning: { effort: "low", exclude: true } } : {}),
          },
          { timeout: Math.min(ATTEMPT_TIMEOUT_MS, remaining) },
        );
        const value = parse(extractJson(res.choices[0]?.message?.content ?? ""));
        const served = res.model && res.model !== model ? `${model} → ${res.model}` : model;
        globalForAi.__aiLast = { target: `${provider.id}/${served}`, ok: true, at: new Date().toISOString() };
        return { value, model: `${provider.id}/${res.model || model}` };
      } catch (err) {
        const failure = classify(err);
        applyCooldown(provider, model, failure);
        errors.push(`${key}: ${failure.reason.slice(0, 160)}`);
        globalForAi.__aiLast = { target: key, ok: false, at: new Date().toISOString(), error: failure.reason.slice(0, 300) };
        console.warn(`[ai] ${key} failed (${failure.scope}, cooldown ${Math.round(failure.cooldownMs / 1000)}s): ${failure.reason.slice(0, 200)}`);
      }
    }
  }
  throw new Error(`All AI models failed or are cooling down: ${errors.join(" | ") || "every model is cooling down"}`);
}

import OpenAI from "openai";

export type AiConfig = { provider: string; model: string; client: OpenAI };

let cached: AiConfig | null | undefined;

/**
 * Any OpenAI-compatible chat-completions endpoint works. Resolution order:
 * AI_API_KEY / OPENAI_API_KEY (optionally with AI_BASE_URL) → GEMINI_API_KEY → GROQ_API_KEY → OPENROUTER_API_KEY.
 */
export function aiConfig(): AiConfig | null {
  if (cached !== undefined) return cached;
  const env = process.env;
  const generic = env.AI_API_KEY || env.OPENAI_API_KEY;
  if (generic) {
    cached = {
      provider: env.AI_BASE_URL ? new URL(env.AI_BASE_URL).hostname : "openai",
      model: env.AI_MODEL || "gpt-5-mini",
      client: new OpenAI({ apiKey: generic, baseURL: env.AI_BASE_URL || undefined }),
    };
  } else if (env.GEMINI_API_KEY) {
    cached = {
      provider: "gemini",
      model: env.AI_MODEL || "gemini-2.5-flash",
      client: new OpenAI({ apiKey: env.GEMINI_API_KEY, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" }),
    };
  } else if (env.GROQ_API_KEY) {
    cached = {
      provider: "groq",
      model: env.AI_MODEL || "llama-3.3-70b-versatile",
      client: new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" }),
    };
  } else if (env.OPENROUTER_API_KEY) {
    cached = {
      provider: "openrouter",
      model: env.AI_MODEL || "google/gemini-2.5-flash",
      client: new OpenAI({ apiKey: env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" }),
    };
  } else {
    cached = null;
  }
  return cached;
}

export async function completeJson(system: string, user: string): Promise<{ json: unknown; model: string }> {
  const cfg = aiConfig();
  if (!cfg) throw new Error("No AI provider configured");
  const res = await cfg.client.chat.completions.create(
    {
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    },
    { timeout: 90_000 },
  );
  const content = res.choices[0]?.message?.content ?? "";
  const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  return { json: JSON.parse(jsonText), model: `${cfg.provider}/${cfg.model}` };
}

import Anthropic from '@anthropic-ai/sdk';
import type { ModelId } from './constants.js';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeOptions {
  model?: ModelId;
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  /** If true, signals intent to cache the system prompt (prompt caching).
   *  Anthropic charges ~25% more per cached input token but saves ~75% on
   *  cache hits. Set to true for large, stable system prompts (e.g. ontology). */
  cacheSystemPrompt?: boolean;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-6';

/**
 * Call Claude with a structured prompt. Returns raw text content and token counts.
 */
export async function callClaude(opts: ClaudeOptions): Promise<ClaudeResponse> {
  const client = getClient();
  const model = opts.model ?? DEFAULT_MODEL;

  const response = await client.messages.create({
    model,
    system: opts.system,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0,
  });

  const content = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  };
}

/**
 * Call Claude and parse the response using an optional parser function.
 *
 * Two call signatures:
 *   callClaudeJSON(opts)          → parses response as JSON via JSON.parse
 *   callClaudeJSON(opts, parser)  → passes raw response string to parser function
 *
 * The two-argument form is preferred when you want Zod validation.
 */
export async function callClaudeJSON<T>(opts: ClaudeOptions, parser?: (raw: string) => T): Promise<T> {
  const response = await callClaude(opts);

  // Strip markdown code fences if present (Claude sometimes wraps JSON in ```json)
  const raw = response.content
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  if (parser) {
    return parser(raw);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `Claude returned invalid JSON from model ${opts.model ?? DEFAULT_MODEL}.\n` +
        `Raw response:\n${response.content}`
    );
  }
}

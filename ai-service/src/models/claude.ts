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
  model: ModelId;
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Call Claude with a structured prompt. Returns text content and token counts.
 * For JSON responses, parse the returned content string yourself.
 */
export async function callClaude(opts: ClaudeOptions): Promise<ClaudeResponse> {
  const client = getClient();

  const response = await client.messages.create({
    model: opts.model,
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
 * Call Claude and parse the response as JSON.
 * Strips markdown code fences if present.
 */
export async function callClaudeJSON<T>(opts: ClaudeOptions): Promise<T> {
  const response = await callClaude(opts);

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const raw = response.content
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `Claude returned invalid JSON from model ${opts.model}.\n` +
        `Raw response:\n${response.content}`
    );
  }
}

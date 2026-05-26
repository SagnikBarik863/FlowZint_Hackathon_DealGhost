import Groq from 'groq-sdk';

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    _client = new Groq({ apiKey });
  }
  return _client;
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqOptions {
  model: string;
  messages: GroqMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface GroqResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Call Groq (used for fast/cheap tasks where Groq models are preferred).
 * Currently not used in the main pipeline but available for future use.
 */
export async function callGroq(opts: GroqOptions): Promise<GroqResponse> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0,
  });

  const content = response.choices[0]?.message?.content ?? '';
  const usage = response.usage;

  return {
    content,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    model: response.model,
  };
}

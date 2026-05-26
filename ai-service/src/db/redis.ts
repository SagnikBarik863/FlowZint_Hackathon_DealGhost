import Redis from 'ioredis';

let _client: Redis | null = null;

export function getRedis(): Redis {
  if (!_client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL is not set');

    _client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
    });

    _client.on('error', (err) => {
      console.error('[Redis] connection error:', err.message);
    });
  }
  return _client;
}

// TTL for project state in seconds (7 days)
const STATE_TTL = 60 * 60 * 24 * 7;

/**
 * Store a value under a namespaced key with 7-day TTL.
 */
export async function redisSet(key: string, value: unknown): Promise<void> {
  const redis = getRedis();
  await redis.setex(`dealghost:${key}`, STATE_TTL, JSON.stringify(value));
}

/**
 * Retrieve and parse a value by namespaced key.
 * Returns null if key doesn't exist.
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const raw = await redis.get(`dealghost:${key}`);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

/**
 * Delete a key.
 */
export async function redisDel(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`dealghost:${key}`);
}

// ── Typed state helpers ────────────────────────────────────────────────────

import type { ProjectRequirementState } from '@dealghost/shared';

/**
 * Load a ProjectRequirementState by conversationId.
 * Returns null if no state is found (new conversation).
 */
export async function loadState(conversationId: string): Promise<ProjectRequirementState | null> {
  return redisGet<ProjectRequirementState>(`state:${conversationId}`);
}

/**
 * Persist a ProjectRequirementState by conversationId with 7-day TTL.
 */
export async function saveState(conversationId: string, state: ProjectRequirementState): Promise<void> {
  await redisSet(`state:${conversationId}`, state);
}

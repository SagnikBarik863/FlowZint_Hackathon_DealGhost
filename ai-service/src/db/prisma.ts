import { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

let _client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    const adapter = new PrismaPg({ connectionString });
    _client = new PrismaClient({ adapter });
  }
  return _client;
}

/**
 * Named singleton — use `import { prisma }` for convenience.
 * Matches the pattern used by seed scripts and layer files.
 */
export const prisma = getPrisma();

/**
 * Graceful shutdown — call this on process exit.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

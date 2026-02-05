import { db } from './client';
import { providers } from './schema';
import { eq } from 'drizzle-orm';

/**
 * Seed initial data for development
 */
export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  // Seed Claude provider
  const existingClaude = await db
    .select()
    .from(providers)
    .where(eq(providers.id, 'claude'))
    .limit(1);

  if (existingClaude.length === 0) {
    await db.insert(providers).values({
      id: 'claude',
      name: 'Claude Code',
      configPath: '~/.claude',
      installed: true,
      costPerInputToken: 0.000003, // $3 per million input tokens (Claude 3.5 Sonnet)
      costPerOutputToken: 0.000015, // $15 per million output tokens
    });
    console.log('✓ Seeded Claude provider');
  }

  // Placeholder for future providers
  const existingCopilot = await db
    .select()
    .from(providers)
    .where(eq(providers.id, 'copilot'))
    .limit(1);

  if (existingCopilot.length === 0) {
    await db.insert(providers).values({
      id: 'copilot',
      name: 'GitHub Copilot',
      configPath: '~/.copilot',
      installed: false,
      costPerInputToken: 0, // TBD
      costPerOutputToken: 0,
    });
    console.log('✓ Seeded Copilot provider (placeholder)');
  }

  console.log('✓ Database seeding completed');
}

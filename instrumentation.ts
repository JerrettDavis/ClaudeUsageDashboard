export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabase, db } = await import('@/lib/db/client');
    const { providers } = await import('@/lib/db/schema');
    const os = await import('os');
    const path = await import('path');
    const { eq } = await import('drizzle-orm');
    
    // Run migrations
    initializeDatabase();
    
    // Auto-register Claude provider if not exists
    const existing = await db.select().from(providers).where(eq(providers.id, 'claude')).limit(1);
    if (existing.length === 0) {
      const configPath = path.join(os.homedir(), '.claude');
      await db.insert(providers).values({
        id: 'claude',
        name: 'Claude Code',
        configPath: configPath,
        installed: true,
      });
      console.log('✓ Claude provider registered');
    }
  }
}

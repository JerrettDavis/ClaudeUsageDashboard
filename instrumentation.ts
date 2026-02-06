export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabase, db } = await import('@/lib/db/client');
    const { providers } = await import('@/lib/db/schema');
    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs');
    const { eq } = await import('drizzle-orm');
    
    // Run migrations
    initializeDatabase();
    
    // Auto-register Claude provider if not exists
    const existingClaude = await db.select().from(providers).where(eq(providers.id, 'claude')).limit(1);
    if (existingClaude.length === 0) {
      const configPath = path.join(os.homedir(), '.claude');
      const installed = fs.existsSync(configPath);
      await db.insert(providers).values({
        id: 'claude',
        name: 'Claude Code',
        configPath: configPath,
        installed: installed,
      });
      console.log('✓ Claude provider registered');
    }
    
    // Auto-register Clawdbot provider if not exists
    const existingClawdbot = await db.select().from(providers).where(eq(providers.id, 'clawdbot')).limit(1);
    if (existingClawdbot.length === 0) {
      const configPath = path.join(os.homedir(), '.clawdbot');
      const installed = fs.existsSync(configPath);
      await db.insert(providers).values({
        id: 'clawdbot',
        name: 'Clawdbot / OpenClaw',
        configPath: configPath,
        installed: installed,
      });
      console.log('✓ Clawdbot provider registered');
    }
  }
}

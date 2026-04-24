export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabase, db } = await import('@/lib/db/client');
    const { providers } = await import('@/lib/db/schema');
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const { eq } = await import('drizzle-orm');
    const { detectOpenClawInstallation, OPENCLAW_PROVIDER_NAME, resolveOpenClawStateDir } =
      await import('@/lib/providers/openclaw-paths');

    // Run migrations
    initializeDatabase();

    // Auto-register Claude provider if not exists
    const existingClaude = await db
      .select()
      .from(providers)
      .where(eq(providers.id, 'claude'))
      .limit(1);
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

    // Auto-register OpenClaw provider if not exists
    const existingClawdbot = await db
      .select()
      .from(providers)
      .where(eq(providers.id, 'clawdbot'))
      .limit(1);
    const configPath = resolveOpenClawStateDir(os.homedir());
    const installed = detectOpenClawInstallation(os.homedir());
    if (existingClawdbot.length === 0) {
      await db.insert(providers).values({
        id: 'clawdbot',
        name: OPENCLAW_PROVIDER_NAME,
        configPath: configPath,
        installed: installed,
      });
      console.log('✓ OpenClaw provider registered');
    } else {
      await db
        .update(providers)
        .set({
          name: OPENCLAW_PROVIDER_NAME,
          configPath,
          installed,
        })
        .where(eq(providers.id, 'clawdbot'));
    }
  }
}

#!/usr/bin/env tsx
import { claudeProvider } from '../lib/providers/claude/index.js';
import { syncService } from '../lib/services/sync.js';
import { initializeDatabase } from '../lib/db/client.js';
import { seedDatabase } from '../lib/db/seed.js';

async function main() {
  console.log('🔄 Claude Usage Dashboard - Sync Tool\n');
  try {
    console.log('📊 Initializing database...');
    initializeDatabase();
    try { await seedDatabase(); } catch (error) { }
    console.log('\n🔍 Checking provider installations...');
    const installations = await syncService.checkInstallations();
    for (const { providerId, installed } of installations) {
      console.log(`  ${installed ? '✓' : '✗'} ${providerId}: ${installed ? 'Installed' : 'Not found'}`);
    }
    const claudeInstalled = installations.find((i) => i.providerId === 'claude')?.installed;
    if (!claudeInstalled) {
      console.log('\n⚠️  Claude not found at ~/.claude');
      process.exit(1);
    }
    console.log('\n🚀 Starting Claude session sync...');
    const result = await syncService.syncProvider('claude');
    console.log('\n✅ Sync complete!');
    console.log(`   Sessions processed: ${result.sessionsProcessed}`);
    console.log(`   Errors: ${result.errors}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    await claudeProvider.terminate();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}
main();

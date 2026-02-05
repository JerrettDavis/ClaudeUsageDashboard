import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.HOME = process.env.HOME || process.env.USERPROFILE || '/tmp';

// Ensure data directory exists and initialize database BEFORE any tests
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database with migrations
import { initializeDatabase } from '@/lib/db/client';

try {
  initializeDatabase();
} catch (error) {
  console.warn('Database initialization warning:', error);
}

// Mock fs for tests that need fixtures
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
  };
});

// Ensure fixtures directory exists
const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.HOME = process.env.HOME || process.env.USERPROFILE || '/tmp';

// Mock fs for tests that need fixtures
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
  };
});

// Ensure fixtures directory exists
import fs from 'node:fs';
import path from 'node:path';

const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

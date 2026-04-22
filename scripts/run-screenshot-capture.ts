import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  CAPTURE_PRODUCT_SCREENSHOTS: '1',
};

const result =
  process.platform === 'win32'
    ? spawnSync(
        'cmd.exe',
        ['/d', '/s', '/c', 'npm exec -- playwright test tests/e2e/screenshots.spec.ts --project=chromium'],
        {
          stdio: 'inherit',
          env,
        }
      )
    : spawnSync(
        'npm',
        ['exec', '--', 'playwright', 'test', 'tests/e2e/screenshots.spec.ts', '--project=chromium'],
        {
          stdio: 'inherit',
          env,
        }
      );

if (result.error) {
  console.error('Failed to start screenshot capture:', result.error);
}

if (result.status !== 0) {
  console.error(`Screenshot capture exited with status ${result.status ?? 'unknown'}.`);
}

process.exit(result.status ?? 1);

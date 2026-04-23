import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const conflictMarkerPattern = /^(<<<<<<<|=======|>>>>>>>)( .+)?$/m;

function getStagedFiles(): string[] {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const conflictedFiles = getStagedFiles().filter((filePath) => {
  if (!existsSync(filePath)) {
    return false;
  }

  const fileContents = readFileSync(filePath, 'utf8');
  return conflictMarkerPattern.test(fileContents);
});

if (conflictedFiles.length > 0) {
  console.error('Commit blocked: staged files still contain merge conflict markers.');
  for (const filePath of conflictedFiles) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.log('No staged merge conflict markers found.');

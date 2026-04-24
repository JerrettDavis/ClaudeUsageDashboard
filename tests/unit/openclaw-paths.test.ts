import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildOpenClawSessionId,
  detectOpenClawInstallation,
  getOpenClawAgentsPaths,
  getOpenClawStateDirCandidates,
  resolveOpenClawStateDir,
} from '@/lib/providers/openclaw-paths';

const tempRoots: string[] = [];

describe('openclaw-paths', () => {
  afterEach(() => {
    for (const tempRoot of tempRoots.splice(0)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('prefers the new .openclaw state dir when it exists', () => {
    const homeDir = createTempHome();
    fs.mkdirSync(path.join(homeDir, '.openclaw', 'agents'), { recursive: true });
    fs.mkdirSync(path.join(homeDir, '.clawdbot', 'agents'), { recursive: true });

    expect(resolveOpenClawStateDir(homeDir)).toBe(path.join(homeDir, '.openclaw'));
    expect(detectOpenClawInstallation(homeDir)).toBe(true);
  });

  it('falls back to the legacy .clawdbot dir when the new state dir is absent', () => {
    const homeDir = createTempHome();
    fs.mkdirSync(path.join(homeDir, '.clawdbot', 'agents'), { recursive: true });

    expect(resolveOpenClawStateDir(homeDir)).toBe(path.join(homeDir, '.clawdbot'));
    expect(getOpenClawAgentsPaths(homeDir)).toEqual([
      path.join(homeDir, '.openclaw', 'agents'),
      path.join(homeDir, '.clawdbot', 'agents'),
    ]);
  });

  it('respects OPENCLAW_STATE_DIR style overrides first', () => {
    const homeDir = createTempHome();
    const overrideDir = path.join(homeDir, 'custom-openclaw-home');
    fs.mkdirSync(overrideDir, { recursive: true });

    expect(getOpenClawStateDirCandidates(homeDir, overrideDir)[0]).toBe(overrideDir);
    expect(resolveOpenClawStateDir(homeDir, overrideDir)).toBe(overrideDir);
  });

  it('builds stable OpenClaw session ids without breaking legacy prefixes', () => {
    expect(buildOpenClawSessionId('main', 'session-123')).toBe('clawdbot-main-session-123');
  });
});

function createTempHome() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-paths-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

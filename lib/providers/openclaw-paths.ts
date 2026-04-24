import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const OPENCLAW_PROVIDER_ID = 'clawdbot';
export const OPENCLAW_PROVIDER_NAME = 'OpenClaw';
export const OPENCLAW_SESSION_PREFIX = 'clawdbot';

const OPENCLAW_STATE_DIRNAME = '.openclaw';
const LEGACY_CLAWDBOT_STATE_DIRNAME = '.clawdbot';

export function getOpenClawStateDirCandidates(
  homeDir: string = os.homedir(),
  stateDirOverride: string | undefined = process.env.OPENCLAW_STATE_DIR
): string[] {
  const candidates = [
    stateDirOverride?.trim(),
    path.join(homeDir, OPENCLAW_STATE_DIRNAME),
    path.join(homeDir, LEGACY_CLAWDBOT_STATE_DIRNAME),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(candidates));
}

export function resolveOpenClawStateDir(
  homeDir: string = os.homedir(),
  stateDirOverride: string | undefined = process.env.OPENCLAW_STATE_DIR
): string {
  const candidates = getOpenClawStateDirCandidates(homeDir, stateDirOverride);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export function detectOpenClawInstallation(
  homeDir: string = os.homedir(),
  stateDirOverride: string | undefined = process.env.OPENCLAW_STATE_DIR
): boolean {
  return getOpenClawStateDirCandidates(homeDir, stateDirOverride).some((candidate) =>
    fs.existsSync(candidate)
  );
}

export function getOpenClawAgentsPaths(
  homeDir: string = os.homedir(),
  stateDirOverride: string | undefined = process.env.OPENCLAW_STATE_DIR
): string[] {
  return getOpenClawStateDirCandidates(homeDir, stateDirOverride).map((stateDir) =>
    path.join(stateDir, 'agents')
  );
}

export function buildOpenClawSessionId(agent: string, sessionId: string): string {
  return `${OPENCLAW_SESSION_PREFIX}-${agent}-${sessionId}`;
}

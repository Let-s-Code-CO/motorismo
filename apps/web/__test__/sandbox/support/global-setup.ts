import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

export type SandboxConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
  mailpitUrl: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    sandbox: SandboxConfig;
  }
}

/** Reads URLs and keys from the running local Supabase; fails with the fix if it is not up. */
export default function setup(project: TestProject) {
  const supabaseDir = fileURLToPath(new URL('../../../../../packages/supabase', import.meta.url));
  let raw: string;
  try {
    raw = execFileSync('./node_modules/.bin/supabase', ['status', '-o', 'json'], {
      cwd: supabaseDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error('Local Supabase is not running. Start it with: pnpm db:start');
  }
  const status = JSON.parse(raw.slice(raw.indexOf('{')));

  project.provide('sandbox', {
    url: status.API_URL,
    publishableKey: status.PUBLISHABLE_KEY,
    secretKey: status.SECRET_KEY,
    mailpitUrl: status.MAILPIT_URL ?? 'http://127.0.0.1:54324',
  });
}

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_ROUTING = Object.freeze({
  VITE_API_BASE: 'https://xenya.tail6504c1.ts.net/prism',
  VITE_VOICE_TOKEN_ENDPOINT: 'http://100.113.109.60:3010/api/voice/token',
  VITE_LIVEKIT_URL: 'ws://100.113.109.60:7880',
});

const ROUTING_KEYS = Object.keys(PRODUCTION_ROUTING);
const TAILSCALE_IPV4_ROUTE = /\b(?:https?|wss?):\/\/100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;
const STALE_MAGICDNS_VOICE_ROUTES = [
  'http://xenya.tail6504c1.ts.net:3010',
  'ws://xenya.tail6504c1.ts.net:7880',
];

export function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

export function verifyProductionEnv(values) {
  for (const key of ROUTING_KEYS) {
    const expected = PRODUCTION_ROUTING[key];
    if (values[key] !== expected) {
      throw new Error(`${key} must be ${expected}; received ${values[key] || '<missing>'}`);
    }
  }
  return true;
}

export function verifyCompiledRouting(bundle, label = 'compiled bundle') {
  for (const [key, expected] of Object.entries(PRODUCTION_ROUTING)) {
    if (!bundle.includes(expected)) {
      throw new Error(`${label} is missing production ${key}: ${expected}`);
    }
  }
  if (!bundle.includes('/api/v1/sync')) {
    throw new Error(`${label} is missing the canonical /api/v1/sync route`);
  }
  for (const route of STALE_MAGICDNS_VOICE_ROUTES) {
    if (bundle.includes(route)) {
      throw new Error(`${label} contains a stale MagicDNS Voice route: ${route}`);
    }
  }
  const voiceRoutesRemoved = [
    PRODUCTION_ROUTING.VITE_VOICE_TOKEN_ENDPOINT,
    PRODUCTION_ROUTING.VITE_LIVEKIT_URL,
  ].reduce((contents, route) => contents.split(route).join(''), bundle);
  const privateRoute = voiceRoutesRemoved.match(TAILSCALE_IPV4_ROUTE)?.[0];
  if (privateRoute) {
    throw new Error(`${label} contains a non-canonical private Tailnet route: ${privateRoute}`);
  }
  return true;
}

async function collectBundleFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectBundleFiles(target));
    else if (/\.(?:html|js)$/i.test(entry.name)) files.push(target);
  }
  return files;
}

export async function verifyBundleDirectory(directory) {
  const files = await collectBundleFiles(directory);
  if (!files.length) throw new Error(`${directory} contains no compiled HTML or JavaScript assets`);
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  verifyCompiledRouting(contents.join('\n'), directory);
  return { directory, files: files.length };
}

export async function verifyMobileRouting(targets, projectRoot = process.cwd()) {
  const envPath = path.join(projectRoot, '.env.production');
  verifyProductionEnv(parseEnv(await readFile(envPath, 'utf8')));
  return Promise.all(targets.map((target) => verifyBundleDirectory(path.resolve(projectRoot, target))));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const targets = process.argv.slice(2);
  if (!targets.length) targets.push('dist');
  try {
    const results = await verifyMobileRouting(targets);
    console.log(JSON.stringify({ ok: true, routing: PRODUCTION_ROUTING, targets: results }, null, 2));
  } catch (error) {
    console.error(`[mobile-routing] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

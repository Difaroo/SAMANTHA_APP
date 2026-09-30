import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PRODUCTION_ROUTING,
  parseEnv,
  verifyCompiledRouting,
  verifyProductionEnv,
} from '../scripts/verify-mobile-routing.mjs';

const productionBundle = [
  ...Object.values(PRODUCTION_ROUTING),
  '/api/v1/sync',
].join('\n');

test('checked-in production env defines the canonical mobile routes', async () => {
  const env = parseEnv(await readFile(new URL('../.env.production', import.meta.url), 'utf8'));
  assert.equal(verifyProductionEnv(env), true);
});

test('Android 10 keyboard resize is not double-applied by Capacitor SystemBars', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const viewport = html.match(/<meta\s+name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
  assert.ok(viewport, 'index.html must define the mobile viewport');
  assert.doesNotMatch(viewport[1], /viewport-fit\s*=\s*cover/i);
});

test('compiled production routing accepts the canonical endpoints', () => {
  assert.equal(verifyCompiledRouting(productionBundle), true);
});

test('compiled routing rejects a non-canonical private Tailnet endpoint', () => {
  assert.throws(
    () => verifyCompiledRouting(`${productionBundle}\nhttp://100.113.109.60:3333`),
    /non-canonical private Tailnet route/,
  );
});

test('compiled routing rejects the stale MagicDNS Voice endpoint', () => {
  assert.throws(
    () => verifyCompiledRouting(`${productionBundle}\nhttp://xenya.tail6504c1.ts.net:3010/api/voice/token`),
    /stale MagicDNS Voice route/,
  );
});

test('compiled routing rejects a missing production PRISM base', () => {
  assert.throws(
    () => verifyCompiledRouting(productionBundle.replace(PRODUCTION_ROUTING.VITE_API_BASE, '')),
    /missing production VITE_API_BASE/,
  );
});

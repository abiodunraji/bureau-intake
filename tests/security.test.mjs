// The security floor, stated as what must be true of the site we ship.
//
// On 25 Sep 2026 main carried 37 open Dependabot alerts and `npm audit`
// reported 15 vulnerable packages, one of them CRITICAL: GHSA-26w7-cxv4-gfx2,
// remote code execution through Astro's AVIF image optimisation, fixed only in
// astro 7.2.8. So:
//   (a) no package the lockfile installs sits inside the vulnerable range of
//       any advisory that was open that day. The table is copied from GitHub's
//       Dependabot alerts for this repo. It is a floor that stops a rollback,
//       not a scanner: advisories published later are `npm audit`'s job.
//   (b) the upgrade must not bring back the July deploy failure. The deploy
//       config the build generates must ask Cloudflare for no account
//       resources (no KV namespace, no Images binding, ...): the account has
//       none, and Workers Builds fails the deploy when asked for one. A local
//       build and `wrangler deploy --dry-run` both pass in that state, which is
//       why this reads the generated config instead of trusting either.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { ROOT } from './built-site.mjs';

// [advisory, package, vulnerable range] as Dependabot listed them, 25 Sep 2026.
const ADVISORIES = [
  ['GHSA-26w7-cxv4-gfx2', 'astro', '< 7.2.8'], // critical: RCE through AVIF optimisation
  ['GHSA-vj59-8hwv-xxmv', 'astro', '>= 6.4.7, < 6.4.8'],
  ['GHSA-376h-93r7-7g6f', 'astro', '<= 7.2.3'],
  ['GHSA-4g3v-8h47-v7g6', 'astro', '>= 2.9.0, <= 7.0.9'],
  ['GHSA-7pw4-f3q4-r2p2', 'astro', '>= 3.10.0, < 7.0.4'],
  ['GHSA-f48w-9m4c-m7f5', 'astro', '< 7.0.6'],
  ['GHSA-8j5q-mfj2-5q9q', '@astrojs/rss', '>= 1.0.0, < 4.0.19'], // builds our /rss.xml
  ['GHSA-9rgm-9g3h-6x36', 'devalue', '< 5.9.1'],
  ['GHSA-52cp-r559-cp3m', 'js-yaml', '>= 4.0.0, < 4.3.0'],
  ['GHSA-5p4m-2wfm-xmqj', 'js-yaml', '>= 4.0.0, < 4.3.1'],
  ['GHSA-2883-xcg3-v3hh', 'js-yaml', '>= 4.0.0, < 4.3.2'],
  ['GHSA-xwg4-73v4-xw9w', 'nanoid', '< 3.3.12'],
  ['GHSA-28wg-ghj8-5hjv', 'nanoid', '< 3.3.16'],
  ['GHSA-2v37-7h3g-55p8', 'nanoid', '< 3.3.18'],
  ['GHSA-r28c-9q8g-f849', 'postcss', '<= 8.5.17'],
  ['GHSA-fxqj-rqcc-2cmp', 'postcss', '<= 8.5.22'],
  ['GHSA-f88m-g3jw-g9cj', 'sharp', '< 0.35.0'],
  ['GHSA-rgj7-g3m4-5g8c', 'sharp', '< 0.35.4'],
  ['GHSA-7w5x-hrqm-74c2', 'smol-toml', '<= 1.7.0'],
  ['GHSA-2p49-hgcm-8545', 'svgo', '>= 4.0.0, < 4.0.2'],
  ['GHSA-w27v-7q3p-w38r', 'svgo', '>= 4.0.0, < 4.1.0'],
  ['GHSA-4vpr-x523-8j87', 'svgo', '>= 4.0.0, < 4.1.0'],
  ['GHSA-vmh5-mc38-953g', 'undici', '>= 7.23.0, < 7.28.0'],
  ['GHSA-hm92-r4w5-c3mj', 'undici', '>= 7.23.0, < 7.28.0'],
  ['GHSA-vxpw-j846-p89q', 'undici', '>= 7.0.0, < 7.28.0'],
  ['GHSA-35p6-xmwp-9g52', 'undici', '>= 7.0.0, < 7.28.0'],
  ['GHSA-g8m3-5g58-fq7m', 'undici', '>= 7.0.0, < 7.28.0'],
  ['GHSA-p88m-4jfj-68fv', 'undici', '>= 7.0.0, < 7.28.0'],
  ['GHSA-pr7r-676h-xcf6', 'undici', '>= 7.0.0, < 7.28.0'],
  ['GHSA-4cwx-7wf7-3272', 'undici', '>= 7.0.0, < 7.29.0'],
  ['GHSA-8xcm-r25x-g524', 'undici', '>= 7.0.0, < 7.29.0'],
  ['GHSA-jr45-8vmc-qm54', 'undici', '>= 7.0.0, < 7.29.0'],
  ['GHSA-m8rv-5g2x-5cg5', 'undici', '>= 7.0.0, < 7.29.0'],
  ['GHSA-v3r7-h72x-cjcm', 'undici', '>= 7.0.0, < 7.29.0'],
  ['GHSA-fx2h-pf6j-xcff', 'vite', '>= 7.0.0, <= 7.3.4'],
  ['GHSA-v6wh-96g9-6wx3', 'vite', '>= 7.0.0, <= 7.3.4'],
  ['GHSA-96hv-2xvq-fx4p', 'ws', '>= 8.0.0, < 8.21.0'],
];

/** "1.2.3" or "1.2.3-rc.1" -> [1, 2, 3, isRelease]; a prerelease sorts before its release. */
function parse(version) {
  const m = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?/);
  if (!m) throw new Error(`Not a semver version: ${version}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? 0 : 1];
}

function compare(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** Dependabot's range syntax: comparators joined by commas, all must hold. */
function inRange(version, range) {
  return range.split(',').every((part) => {
    const m = part.trim().match(/^(<=|>=|<|>|=)\s*(\S+)$/);
    if (!m) throw new Error(`Unreadable range: ${range}`);
    const c = compare(version, m[2]);
    return { '<': c < 0, '<=': c <= 0, '>': c > 0, '>=': c >= 0, '=': c === 0 }[m[1]];
  });
}

/** Every package the lockfile installs, as { name, version, where }. */
function lockedPackages() {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const out = [];
  for (const [where, meta] of Object.entries(lock.packages ?? {})) {
    if (!where || !meta.version) continue;
    const name = where.slice(where.lastIndexOf('node_modules/') + 'node_modules/'.length);
    out.push({ name, version: meta.version, where });
  }
  return out;
}

describe('(a) nothing we install is inside a known-vulnerable range', () => {
  test('the range reader agrees with the advisory ranges it will be trusted on', () => {
    assert.equal(inRange('6.4.7', '< 7.2.8'), true);
    assert.equal(inRange('7.2.8', '< 7.2.8'), false);
    assert.equal(inRange('7.3.4', '>= 7.0.0, <= 7.3.4'), true);
    assert.equal(inRange('8.0.0', '>= 7.0.0, <= 7.3.4'), false);
    assert.equal(inRange('6.29.0', '>= 7.0.0, < 7.29.0'), false);
    assert.equal(inRange('7.2.8-beta.1', '< 7.2.8'), true);
  });

  test('no package in package-lock.json falls inside any advisory open on 25 Sep 2026', () => {
    const installed = lockedPackages();
    assert.ok(installed.some((p) => p.name === 'astro'), 'package-lock.json lists no astro; is this the right lockfile?');
    const hits = [];
    for (const [ghsa, name, range] of ADVISORIES) {
      for (const p of installed) {
        if (p.name === name && inRange(p.version, range)) hits.push(`${ghsa}  ${name}@${p.version}  (${range})  at ${p.where}`);
      }
    }
    assert.deepEqual(hits, [], `vulnerable packages in the lockfile:\n  ${hits.join('\n  ')}`);
  });
});

describe('(b) the deploy asks Cloudflare for nothing the account does not have', () => {
  // `astro build` writes .wrangler/deploy/config.json, which points `wrangler deploy`
  // (and so Workers Builds) at the config it generated. Read that one, not a guess.
  const redirect = join(ROOT, '.wrangler', 'deploy', 'config.json');

  function deployConfig() {
    assert.ok(existsSync(redirect), `no ${redirect}; run the build first (npm test does)`);
    const { configPath } = JSON.parse(readFileSync(redirect, 'utf8'));
    return JSON.parse(readFileSync(resolve(dirname(redirect), configPath), 'utf8'));
  }

  test('no binding that needs an account resource (KV, Images, D1, R2, Durable Objects, queues, ...)', () => {
    const cfg = deployConfig();
    const wanted = [];
    for (const key of [
      'kv_namespaces', 'd1_databases', 'r2_buckets', 'vectorize', 'hyperdrive', 'services',
      'analytics_engine_datasets', 'dispatch_namespaces', 'mtls_certificates', 'pipelines',
      'secrets_store_secrets', 'workflows', 'send_email',
    ]) {
      if ((cfg[key] ?? []).length) wanted.push(`${key}: ${JSON.stringify(cfg[key])}`);
    }
    if ((cfg.durable_objects?.bindings ?? []).length) wanted.push(`durable_objects: ${JSON.stringify(cfg.durable_objects)}`);
    if ((cfg.queues?.producers ?? []).length || (cfg.queues?.consumers ?? []).length) wanted.push(`queues: ${JSON.stringify(cfg.queues)}`);
    for (const key of ['images', 'ai', 'browser']) if (cfg[key]) wanted.push(`${key}: ${JSON.stringify(cfg[key])}`);
    assert.deepEqual(wanted, [], `the generated deploy config asks for:\n  ${wanted.join('\n  ')}`);
  });
});

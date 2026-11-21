/**
 * ShipCheck sample projects — three realistic releases, one for each
 * verdict band, so anyone can see the scorer work without a GitHub repo.
 *
 * The `signals` objects use the same shape `computeReadiness()` expects,
 * so the samples are also the engine's fixtures in scoring.test.mjs.
 */
'use strict';

const SAMPLES = [
  {
    id: 'northwind',
    name: 'Northwind API',
    version: 'v2.4.0',
    tagline: 'A clean release: green CI, one stale PR, everything else in place.',
    signals: {
      openCriticalBugs: { count: 0, items: [] },
      stalePRs: {
        count: 1,
        items: [{ key: '#214', url: 'https://github.com/example/northwind/pull/214', summary: 'Refactor auth middleware' }],
      },
      unreviewedPRs: { count: 0, items: [] },
      ci: 'success',
      readme: true,
      changelog: true,
      releaseNotes: true,
      hasRelease: true,
      lastCommitDaysAgo: 1,
      rollback: true,
    },
  },
  {
    id: 'acme',
    name: 'Acme Dashboard',
    version: 'v1.8.0',
    tagline: 'Almost there: one critical bug, a couple of stale PRs, no changelog.',
    signals: {
      openCriticalBugs: {
        count: 1,
        items: [{ key: '#118', url: 'https://github.com/example/acme/issues/118', summary: 'Export crashes on large CSVs' }],
      },
      stalePRs: {
        count: 2,
        items: [
          { key: '#96', url: 'https://github.com/example/acme/pull/96', summary: 'Dark mode toggle' },
          { key: '#101', url: 'https://github.com/example/acme/pull/101', summary: 'Upgrade chart library' },
        ],
      },
      unreviewedPRs: {
        count: 1,
        items: [{ key: '#104', url: 'https://github.com/example/acme/pull/104', summary: 'Fix date picker timezone' }],
      },
      ci: 'success',
      readme: true,
      changelog: false,
      releaseNotes: true,
      hasRelease: true,
      lastCommitDaysAgo: 3,
      rollback: true,
    },
  },
  {
    id: 'beta',
    name: 'Beta Mobile',
    version: 'v0.9.0',
    tagline: 'Do not ship: red CI, critical bugs, no docs, no release, no rollback plan.',
    signals: {
      openCriticalBugs: {
        count: 2,
        items: [
          { key: '#42', url: 'https://github.com/example/beta/issues/42', summary: 'Login loop on Android 14' },
          { key: '#57', url: 'https://github.com/example/beta/issues/57', summary: 'Data loss on offline sync' },
        ],
      },
      stalePRs: {
        count: 2,
        items: [
          { key: '#31', url: 'https://github.com/example/beta/pull/31', summary: 'New onboarding flow' },
          { key: '#38', url: 'https://github.com/example/beta/pull/38', summary: 'Push notification rework' },
        ],
      },
      unreviewedPRs: {
        count: 1,
        items: [{ key: '#44', url: 'https://github.com/example/beta/pull/44', summary: 'Fix crash on startup' }],
      },
      ci: 'failure',
      readme: false,
      changelog: false,
      releaseNotes: false,
      hasRelease: false,
      lastCommitDaysAgo: 45,
      rollback: false,
    },
  },
];

// UMD export: browser global + Node module.
const ShipCheckSamples = { SAMPLES };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShipCheckSamples;
}
if (typeof window !== 'undefined') {
  window.ShipCheckSamples = ShipCheckSamples;
}

/**
 * ShipCheck scoring tests — plain node:test, no dependencies.
 *
 * Run:  node --test scoring.test.mjs
 *
 * Covers: the three sample projects land in the expected bands with the
 * expected scores, band boundaries, per-signal caps, clamping, and the
 * rule-based briefing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeReadiness, bandFor, buildBriefing } = require('./scoring.js');
const { SAMPLES } = require('./samples.js');

test('sample: Northwind API v2.4 is READY at 95', () => {
  const s = SAMPLES.find((x) => x.id === 'northwind');
  const r = computeReadiness(s.signals);
  assert.equal(r.score, 95);
  assert.equal(r.band.key, 'READY');
  assert.equal(r.gaps.length, 1); // one stale PR
  assert.equal(r.gaps[0].severity, 'major');
  assert.equal(r.unavailable.length, 0);
});

test('sample: Acme Dashboard v1.8 is CAUTION at 74', () => {
  const s = SAMPLES.find((x) => x.id === 'acme');
  const r = computeReadiness(s.signals);
  assert.equal(r.score, 74);
  assert.equal(r.band.key, 'CAUTION');
  // 1 critical bug + 2 stale PRs + 1 unreviewed PR + missing changelog
  assert.equal(r.gaps.length, 4);
  assert.equal(r.gaps[0].severity, 'critical');
  const dims = Object.fromEntries(r.dimensions.map((d) => [d.key, d.score]));
  assert.equal(dims.bugs, 75);
  assert.equal(dims.prs, 61);
  assert.equal(dims.docs, 67);
});

test('sample: Beta Mobile v0.9 is NO-GO at 23', () => {
  const s = SAMPLES.find((x) => x.id === 'beta');
  const r = computeReadiness(s.signals);
  assert.equal(r.score, 23);
  assert.equal(r.band.key, 'NO-GO');
  assert.ok(r.gaps.length >= 8);
  assert.equal(r.gaps[0].severity, 'critical');
  const dims = Object.fromEntries(r.dimensions.map((d) => [d.key, d.score]));
  assert.equal(dims.ci, 0);
  assert.equal(dims.docs, 0);
  assert.equal(dims.release, 0);
});

test('band boundaries', () => {
  assert.equal(bandFor(100).key, 'READY');
  assert.equal(bandFor(90).key, 'READY');
  assert.equal(bandFor(89).key, 'CAUTION');
  assert.equal(bandFor(70).key, 'CAUTION');
  assert.equal(bandFor(69).key, 'HOLD');
  assert.equal(bandFor(50).key, 'HOLD');
  assert.equal(bandFor(49).key, 'NO-GO');
  assert.equal(bandFor(0).key, 'NO-GO');
});

test('per-signal caps: many critical bugs cannot zero the score alone', () => {
  const r = computeReadiness({
    openCriticalBugs: { count: 20, items: [] },
    stalePRs: { count: 0, items: [] },
    unreviewedPRs: { count: 0, items: [] },
    ci: 'success',
    readme: true, changelog: true, releaseNotes: true,
    hasRelease: true, lastCommitDaysAgo: 1, rollback: true,
  });
  // 20 bugs * 8 = 160, capped at 32 -> score 68 (HOLD, not 0)
  assert.equal(r.score, 68);
  assert.equal(r.band.key, 'HOLD');
});

test('clamping: everything broken still bottoms at 0', () => {
  const r = computeReadiness({
    openCriticalBugs: { count: 10, items: [] },
    stalePRs: { count: 10, items: [] },
    unreviewedPRs: { count: 10, items: [] },
    ci: 'failure',
    readme: false, changelog: false, releaseNotes: false,
    hasRelease: false, lastCommitDaysAgo: 90, rollback: false,
  });
  assert.equal(r.score, 0);
  assert.equal(r.band.key, 'NO-GO');
});

test('degraded mode: unknown CI and rollback add no penalty but are reported', () => {
  const r = computeReadiness({
    openCriticalBugs: { count: 0, items: [] },
    stalePRs: { count: 0, items: [] },
    unreviewedPRs: { count: 0, items: [] },
    ci: 'unknown',
    readme: true, changelog: true, releaseNotes: true,
    hasRelease: true, lastCommitDaysAgo: 2, rollback: null,
  });
  // Only the CI-unknown flat penalty (8) applies; rollback unknown adds 0.
  assert.equal(r.score, 92);
  assert.equal(r.band.key, 'READY');
  assert.ok(r.unavailable.some((u) => u.includes('Rollback')));
  assert.ok(r.unavailable.some((u) => u.includes('CI')));
});

test('briefing: READY project gets a ship headline and no actions', () => {
  const s = SAMPLES.find((x) => x.id === 'northwind');
  const r = computeReadiness(s.signals);
  const b = buildBriefing(r, 'Northwind API v2.4.0');
  assert.match(b.headline, /ready to ship/);
  assert.equal(b.topActions.length, 1); // the one stale PR
});

test('briefing: NO-GO project lists concrete actions', () => {
  const s = SAMPLES.find((x) => x.id === 'beta');
  const r = computeReadiness(s.signals);
  const b = buildBriefing(r, 'Beta Mobile v0.9.0');
  assert.match(b.headline, /not ready to ship/);
  assert.equal(b.topActions.length, 3);
  assert.match(b.note, /Weakest area/);
});

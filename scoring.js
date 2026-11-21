/**
 * ShipCheck scoring engine — DETERMINISTIC, pure JavaScript.
 *
 * No DOM, no network, no framework. The same module runs in the browser
 * (window.ShipCheckScoring) and in Node (module.exports), so the scoring
 * model is unit-tested with plain `node --test` and behaves identically
 * everywhere.
 *
 * Model (adapted from the ShipReady concept: penalty-based, capped):
 *   score = clamp(100 - sum(penalties), 0, 100)
 *
 * Each signal contributes a per-item penalty, capped per signal, so no
 * single broken area can zero the score on its own. Every penalty
 * produces a "gap" — a blocking item with evidence and the concrete
 * action that would close it.
 *
 * A source that could not be checked (e.g. no CI status on the repo, or
 * the rollback plan is not visible from the GitHub API) is reported in
 * `unavailable` (degraded mode) instead of silently pretending all is
 * well. Unknown signals add no penalty — the score only reflects what
 * was actually observed.
 */

'use strict';

const BANDS = [
  { min: 90, key: 'READY', label: 'READY — Ship it', tone: 'success' },
  { min: 70, key: 'CAUTION', label: 'CAUTION — Ship with care', tone: 'warning' },
  { min: 50, key: 'HOLD', label: 'HOLD — Fix blockers first', tone: 'warning' },
  { min: 0, key: 'NO-GO', label: 'NO-GO — Do not ship', tone: 'danger' },
];

// Penalty rules. `perItem` signals scale with the count (capped);
// `flat` signals are all-or-nothing.
const PENALTIES = {
  openCriticalBugs: { perItem: 8, cap: 32 },
  stalePRs: { perItem: 5, cap: 20 },
  unreviewedPRs: { perItem: 4, cap: 16 },
  ciFailing: { flat: 15 },
  ciPending: { flat: 5 },
  ciUnknown: { flat: 8 },
  missingReadme: { flat: 6 },
  missingChangelog: { flat: 4 },
  missingReleaseNotes: { flat: 2 },
  noRelease: { flat: 8 },
  inactivity: { flat: 6 },
  missingRollback: { flat: 6 },
};

// Dashboard dimensions. `cap` is the sum of the max penalties of its
// signals; a dimension score is 100 * (1 - penalty / cap).
const DIMENSIONS = [
  { key: 'ci', label: 'Tests & CI', cap: 15, signals: ['ciFailing', 'ciPending', 'ciUnknown'] },
  { key: 'bugs', label: 'Bugs', cap: 32, signals: ['openCriticalBugs'] },
  { key: 'prs', label: 'Pull Requests', cap: 36, signals: ['stalePRs', 'unreviewedPRs'] },
  { key: 'docs', label: 'Documentation', cap: 12, signals: ['missingReadme', 'missingChangelog', 'missingReleaseNotes'] },
  { key: 'release', label: 'Release Hygiene', cap: 20, signals: ['noRelease', 'inactivity', 'missingRollback'] },
];

function bandFor(score) {
  return BANDS.find((b) => score >= b.min);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Normalise raw signal counts into the shape the scorer needs.
 * `signals` may omit sources that were unavailable (degraded mode).
 *
 * @param {object} signals
 *   {
 *     openCriticalBugs: { count, items: [{key, url, summary}] },
 *     stalePRs:         { count, items: [{key, url, summary}] },
 *     unreviewedPRs:    { count, items: [{key, url, summary}] },
 *     ci: 'success' | 'failure' | 'pending' | 'unknown',
 *     readme: boolean, changelog: boolean, releaseNotes: boolean,
 *     hasRelease: boolean, lastCommitDaysAgo: number | null,
 *     rollback: boolean | null,   // null = could not be checked
 *   }
 * @returns {{ score:number, band:object, gaps:Array, dimensions:Array,
 *             penalties:Array, unavailable:Array }}
 */
function computeReadiness(signals) {
  const s = signals || {};
  const penalties = []; // { signal, label, count, penalty, items }
  const gaps = []; // { severity, title, evidence, action, url }
  const unavailable = [];

  function addPenalty(signal, label, count, items, gap) {
    const rule = PENALTIES[signal];
    let penalty = 0;
    if (rule.perItem != null) {
      penalty = Math.min(count * rule.perItem, rule.cap);
    } else {
      penalty = rule.flat;
    }
    if (penalty > 0) {
      penalties.push({ signal, label, count, penalty, items: items || [] });
      if (gap) gaps.push(gap);
    }
    return penalty;
  }

  // --- Bugs ---------------------------------------------------------------
  const bugs = s.openCriticalBugs || { count: 0, items: [] };
  addPenalty('openCriticalBugs', 'Open critical bugs', bugs.count, bugs.items, {
    severity: 'critical',
    title: bugs.count + ' open critical bug' + (bugs.count === 1 ? '' : 's'),
    evidence: (bugs.items || []).slice(0, 3).map((i) => i.key).join(', ') || 'see issue list',
    action: 'Fix or explicitly defer every critical bug before shipping.',
    url: (bugs.items && bugs.items[0] && bugs.items[0].url) || null,
  });

  // --- Pull requests --------------------------------------------------------
  const stale = s.stalePRs || { count: 0, items: [] };
  addPenalty('stalePRs', 'Stale pull requests', stale.count, stale.items, {
    severity: 'major',
    title: stale.count + ' pull request' + (stale.count === 1 ? '' : 's') + ' open for over 14 days',
    evidence: (stale.items || []).slice(0, 3).map((i) => i.key).join(', ') || 'see pull requests',
    action: 'Merge, close, or review the stale PRs — stale code rots fast.',
    url: (stale.items && stale.items[0] && stale.items[0].url) || null,
  });

  const unrev = s.unreviewedPRs || { count: 0, items: [] };
  addPenalty('unreviewedPRs', 'Unreviewed pull requests', unrev.count, unrev.items, {
    severity: 'major',
    title: unrev.count + ' pull request' + (unrev.count === 1 ? '' : 's') + ' with no review',
    evidence: (unrev.items || []).slice(0, 3).map((i) => i.key).join(', ') || 'see pull requests',
    action: 'Get at least one review on every open PR before the release.',
    url: (unrev.items && unrev.items[0] && unrev.items[0].url) || null,
  });

  // --- Tests & CI ------------------------------------------------------------
  const ci = s.ci || 'unknown';
  if (ci === 'failure') {
    addPenalty('ciFailing', 'CI failing', 1, [], {
      severity: 'critical',
      title: 'CI is failing on the latest commit',
      evidence: 'Latest commit status: failure / error',
      action: 'Fix the failing build first — a red CI means the release is untested.',
      url: null,
    });
  } else if (ci === 'pending') {
    addPenalty('ciPending', 'CI pending', 1, [], {
      severity: 'major',
      title: 'CI is still running on the latest commit',
      evidence: 'Latest commit status: pending',
      action: 'Wait for CI to finish and confirm it is green before shipping.',
      url: null,
    });
  } else if (ci === 'unknown') {
    addPenalty('ciUnknown', 'No CI status found', 1, [], {
      severity: 'minor',
      title: 'No CI status found for the latest commit',
      evidence: 'No status checks reported',
      action: 'Set up CI (or a status check) so every release is verified automatically.',
      url: null,
    });
    unavailable.push('CI status (no checks reported on the latest commit)');
  }

  // --- Documentation ---------------------------------------------------------
  if (s.readme === false) {
    addPenalty('missingReadme', 'README missing', 1, [], {
      severity: 'minor',
      title: 'No README found',
      evidence: 'Repository root has no README',
      action: 'Add a README that explains what this release is and how to run it.',
      url: null,
    });
  }
  if (s.changelog === false) {
    addPenalty('missingChangelog', 'CHANGELOG missing', 1, [], {
      severity: 'minor',
      title: 'No CHANGELOG found',
      evidence: 'Repository root has no CHANGELOG',
      action: 'Write a short changelog so users know what changed in this release.',
      url: null,
    });
  }
  if (s.releaseNotes === false) {
    addPenalty('missingReleaseNotes', 'No release notes', 1, [], {
      severity: 'minor',
      title: 'No release notes for this release',
      evidence: 'No release body found',
      action: 'Write release notes — a one-paragraph summary of what ships and what changed.',
      url: null,
    });
  }

  // --- Release hygiene --------------------------------------------------------
  if (s.hasRelease === false) {
    addPenalty('noRelease', 'No release or tag', 1, [], {
      severity: 'major',
      title: 'No release or version tag found',
      evidence: 'No releases or tags on the repository',
      action: 'Cut a tagged release (e.g. v1.2.0) so this version is reproducible.',
      url: null,
    });
  }
  const days = s.lastCommitDaysAgo;
  if (days == null) {
    unavailable.push('Recent activity (no commits found)');
  } else if (days > 30) {
    addPenalty('inactivity', 'No commits in 30 days', 1, [], {
      severity: 'minor',
      title: 'No commits in the last 30 days',
      evidence: 'Last commit ' + days + ' days ago',
      action: 'Confirm this release is still the right snapshot — or ship a fresh one.',
      url: null,
    });
  }
  if (s.rollback === false) {
    addPenalty('missingRollback', 'No rollback plan', 1, [], {
      severity: 'major',
      title: 'No rollback plan for this release',
      evidence: 'Rollback plan not confirmed',
      action: 'Write down how to roll back (previous version, database, flags) before shipping.',
      url: null,
    });
  } else if (s.rollback == null) {
    unavailable.push('Rollback plan (not visible from the repository)');
  }

  // --- Score ------------------------------------------------------------------
  const totalPenalty = penalties.reduce((sum, p) => sum + p.penalty, 0);
  const score = clamp(100 - totalPenalty, 0, 100);

  // --- Dimension breakdown ----------------------------------------------------
  const bySignal = {};
  penalties.forEach((p) => { bySignal[p.signal] = p.penalty; });
  const dimensions = DIMENSIONS.map((d) => {
    const pen = d.signals.reduce((sum, sig) => sum + (bySignal[sig] || 0), 0);
    return {
      key: d.key,
      label: d.label,
      penalty: pen,
      cap: d.cap,
      score: Math.round(100 * (1 - pen / d.cap)),
    };
  });

  // Gaps sorted: critical first, then by penalty.
  const severityRank = { critical: 0, major: 1, minor: 2 };
  gaps.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    score,
    band: bandFor(score),
    gaps,
    dimensions,
    penalties,
    unavailable,
  };
}

/**
 * Build a plain-English release briefing from a computed result.
 * RULE-BASED (template + data) — no model, no network. It composes the
 * verdict, the worst gaps, and the top actions into a short go / no-go
 * summary a team can paste into a release thread.
 *
 * @param {object} result  the object returned by computeReadiness
 * @param {string} projectName
 * @returns {{ headline:string, summary:string, topActions:Array<string>, note:string }}
 */
function buildBriefing(result, projectName) {
  const name = projectName || 'This release';
  const headline = result.band.key === 'READY'
    ? name + ' is ready to ship.'
    : result.band.key === 'CAUTION'
      ? name + ' can ship with care — fix the big items first.'
      : result.band.key === 'HOLD'
        ? name + ' should wait — fix the blockers first.'
        : name + ' is not ready to ship.';
  const top = result.gaps.slice(0, 3);
  const summary = top.length === 0
    ? 'No blockers were found. The score is ' + result.score + '/100 (' + result.band.label + ').'
    : 'Score ' + result.score + '/100 (' + result.band.label + '). The biggest blockers are: ' +
      top.map((g) => g.title.toLowerCase()).join('; ') + '.';
  const topActions = top.map((g) => g.action);
  const weakest = result.dimensions.slice().sort((a, b) => a.score - b.score)[0];
  const note = weakest && weakest.score < 100
    ? 'Weakest area: ' + weakest.label + ' (' + weakest.score + '/100).'
    : 'All areas look healthy.';
  return { headline, summary, topActions, note };
}

// UMD export: browser global + Node module.
const ShipCheckScoring = {
  BANDS, PENALTIES, DIMENSIONS, bandFor, computeReadiness, buildBriefing,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShipCheckScoring;
}
if (typeof window !== 'undefined') {
  window.ShipCheckScoring = ShipCheckScoring;
}

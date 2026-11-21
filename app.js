/**
 * ShipCheck app — UI, sample loading, GitHub analysis, checklist.
 *
 * Everything runs in the browser. The only network calls are to the
 * public GitHub API (no token, no sign-in, nothing stored). The scoring
 * model lives in scoring.js (pure, unit-tested).
 */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const CIRCUMFERENCE = 427.25; // 2 * PI * 68
  const STALE_PR_DAYS = 14;
  const INACTIVE_DAYS = 30;
  const MAX_REVIEW_CHECKS = 10;

  let lastResult = null;
  let lastProjectLabel = '';
  let apiCallsUsed = 0;

  // ---------------------------------------------------------------- tabs
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      $('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  function switchTab(name) {
    document.querySelector('.tab[data-tab="' + name + '"]').click();
  }

  // ------------------------------------------------------------- samples
  function renderSamples() {
    const grid = $('sampleGrid');
    grid.innerHTML = '';
    window.ShipCheckSamples.SAMPLES.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'sample-card';
      const h = document.createElement('h3');
      h.textContent = s.name;
      const v = document.createElement('span');
      v.className = 'version';
      v.textContent = s.version;
      const p = document.createElement('p');
      p.textContent = s.tagline;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = 'Check this release';
      btn.addEventListener('click', () => analyzeSample(s.id));
      card.append(h, v, p, btn);
      grid.appendChild(card);
    });
  }

  function analyzeSample(id) {
    const s = window.ShipCheckSamples.SAMPLES.find((x) => x.id === id);
    if (!s) return;
    const result = window.ShipCheckScoring.computeReadiness(s.signals);
    showResult(result, s.name + ' ' + s.version, 'Sample project · ' + s.tagline);
    try { history.replaceState(null, '', '#sample=' + id); } catch (e) { /* ignore */ }
  }

  // -------------------------------------------------------------- result
  function bandColor(tone) {
    return tone === 'success' ? '#15803d' : tone === 'warning' ? '#d97706' : '#b91c1c';
  }

  function showResult(result, projectLabel, meta) {
    lastResult = result;
    lastProjectLabel = projectLabel;
    const section = $('results');
    section.hidden = false;

    $('resultTitle').textContent = projectLabel;
    $('resultMeta').textContent = meta || '';
    $('resultEyebrow').textContent = 'Readiness report';

    // Gauge
    $('gaugeScore').textContent = result.score;
    const fill = $('gaugeFill');
    fill.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - result.score / 100));
    fill.style.stroke = bandColor(result.band.tone);
    $('gauge').setAttribute('aria-label', 'Readiness score ' + result.score + ' out of 100, ' + result.band.label);

    // Verdict
    const badge = $('verdictBadge');
    badge.textContent = result.band.label + ' · ' + result.score + '/100';
    badge.className = 'verdict ' + result.band.tone;

    // Degraded banner
    const deg = $('degradedBanner');
    if (result.unavailable.length > 0) {
      deg.hidden = false;
      deg.textContent = 'Not checked (no penalty added): ' + result.unavailable.join(' · ') + '.';
    } else {
      deg.hidden = true;
      deg.textContent = '';
    }

    // Dimensions
    const dims = $('dimensions');
    dims.innerHTML = '';
    result.dimensions.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'dim';
      const label = document.createElement('span');
      label.className = 'dim-label';
      label.textContent = d.label;
      const bar = document.createElement('div');
      bar.className = 'dim-bar';
      const fillEl = document.createElement('div');
      fillEl.className = 'dim-fill' + (d.score < 50 ? ' low' : d.score < 80 ? ' mid' : '');
      fillEl.style.width = d.score + '%';
      bar.appendChild(fillEl);
      const score = document.createElement('span');
      score.className = 'dim-score';
      score.textContent = d.score;
      row.append(label, bar, score);
      dims.appendChild(row);
    });

    // Gaps / blockers
    const gapsEl = $('gaps');
    gapsEl.innerHTML = '';
    $('blockerCount').textContent = result.gaps.length > 0 ? '(' + result.gaps.length + ')' : '';
    if (result.gaps.length === 0) {
      const ok = document.createElement('div');
      ok.className = 'no-gaps';
      ok.textContent = 'No blockers found — nothing stands between this release and shipping.';
      gapsEl.appendChild(ok);
    } else {
      result.gaps.forEach((g) => {
        const card = document.createElement('div');
        card.className = 'gap sev-' + g.severity;
        const top = document.createElement('div');
        top.className = 'gap-top';
        const sev = document.createElement('span');
        sev.className = 'sev sev-' + g.severity;
        sev.textContent = g.severity;
        const title = document.createElement('span');
        title.className = 'gap-title';
        title.textContent = g.title;
        top.append(sev, title);
        const ev = document.createElement('p');
        ev.className = 'gap-evidence';
        ev.textContent = 'Evidence: ' + g.evidence;
        if (g.url) {
          const a = document.createElement('a');
          a.href = g.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = ' (open first item)';
          ev.appendChild(a);
        }
        const act = document.createElement('p');
        act.className = 'gap-action';
        const strong = document.createElement('strong');
        strong.textContent = 'Next step: ';
        act.append(strong, document.createTextNode(g.action));
        card.append(top, ev, act);
        gapsEl.appendChild(card);
      });
    }

    // Briefing (rule-based)
    const b = window.ShipCheckScoring.buildBriefing(result, projectLabel);
    const brief = $('briefing');
    brief.innerHTML = '';
    const h = document.createElement('h4');
    h.textContent = b.headline;
    const sum = document.createElement('p');
    sum.textContent = b.summary;
    brief.append(h, sum);
    if (b.topActions.length > 0) {
      const ol = document.createElement('ol');
      b.topActions.forEach((a) => {
        const li = document.createElement('li');
        li.textContent = a;
        ol.appendChild(li);
      });
      brief.appendChild(ol);
    }
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = b.note;
    brief.appendChild(note);

    $('copyStatus').textContent = '';
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // -------------------------------------------------------------- GitHub
  // Base URL for the public GitHub API. Dev/testing override: add
  // `#api=<base-url>` to the page hash to point the app at a mock API
  // (e.g. http://localhost:4199) — see README. Default is the real API.
  let GH = 'https://api.github.com';

  async function ghFetch(path) {
    apiCallsUsed += 1;
    const res = await fetch(GH + path, { headers: { Accept: 'application/vnd.github+json' } });
    if (res.status === 404) return { status: 404, data: null };
    if (!res.ok) {
      const err = new Error('GitHub API error ' + res.status);
      err.status = res.status;
      err.reset = res.headers.get('x-ratelimit-reset');
      throw err;
    }
    return { status: res.status, data: await res.json() };
  }

  function daysAgo(isoDate) {
    const then = new Date(isoDate).getTime();
    return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
  }

  function isCriticalIssue(issue) {
    if (issue.pull_request) return false;
    const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
    if (labels.some((n) => /bug|critical|blocker/.test(n))) return true;
    return /critical|blocker/i.test(issue.title || '');
  }

  async function analyzeRepo(fullName) {
    const statusEl = $('githubStatus');
    const btn = $('analyzeBtn');
    const parts = fullName.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) {
      statusEl.className = 'status error';
      statusEl.textContent = 'Use the format owner/repo — for example Aleshaolshop29/make-fun-guide.';
      return;
    }
    const owner = parts[0];
    const repo = parts[1];
    apiCallsUsed = 0;
    btn.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = 'Reading ' + owner + '/' + repo + ' from the public GitHub API…';

    try {
      const repoRes = await ghFetch('/repos/' + owner + '/' + repo);
      if (repoRes.status === 404 || !repoRes.data) {
        throw Object.assign(new Error('not-found'), { status: 404 });
      }
      const repoData = repoRes.data;
      const branch = repoData.default_branch || 'main';

      const [issuesRes, releasesRes, tagsRes, commitsRes, readmeRes, changelogRes] =
        await Promise.all([
          ghFetch('/repos/' + owner + '/' + repo + '/issues?state=open&per_page=100'),
          ghFetch('/repos/' + owner + '/' + repo + '/releases?per_page=5'),
          ghFetch('/repos/' + owner + '/' + repo + '/tags?per_page=1'),
          ghFetch('/repos/' + owner + '/' + repo + '/commits?per_page=1&sha=' + encodeURIComponent(branch)),
          ghFetch('/repos/' + owner + '/' + repo + '/readme'),
          ghFetch('/repos/' + owner + '/' + repo + '/contents/CHANGELOG.md'),
        ]);

      const issues = (issuesRes.data || []);
      const releases = (releasesRes.data || []);
      const tags = (tagsRes.data || []);
      const commits = (commitsRes.data || []);

      // CI status from the latest commit.
      let ci = 'unknown';
      let lastCommitDaysAgo = null;
      if (commits.length > 0) {
        const sha = commits[0].sha;
        const commitInfo = commits[0].commit || {};
        const date = (commitInfo.author && commitInfo.author.date) ||
          (commitInfo.committer && commitInfo.committer.date);
        lastCommitDaysAgo = date ? daysAgo(date) : null;
        try {
          const st = await ghFetch('/repos/' + owner + '/' + repo + '/commits/' + sha + '/status');
          const statuses = (st.data && st.data.statuses) || [];
          if (statuses.length === 0) {
            ci = 'unknown';
          } else if (st.data.state === 'success') {
            ci = 'success';
          } else if (st.data.state === 'failure' || st.data.state === 'error') {
            ci = 'failure';
          } else {
            ci = 'pending';
          }
        } catch (e) {
          ci = 'unknown';
        }
      }

      // Critical bugs (issues only, not PRs).
      const bugItems = issues.filter(isCriticalIssue).map((i) => ({
        key: '#' + i.number,
        url: i.html_url,
        summary: i.title,
      }));
      // Stale PRs (open > 14 days) and unreviewed PRs.
      const prs = issues.filter((i) => !!i.pull_request);
      const staleItems = prs
        .filter((p) => daysAgo(p.created_at) > STALE_PR_DAYS)
        .map((p) => ({ key: '#' + p.number, url: p.html_url, summary: p.title }));
      let unreviewedItems = [];
      const prsToCheck = prs.slice(0, MAX_REVIEW_CHECKS);
      if (prsToCheck.length > 0) {
        const reviews = await Promise.all(prsToCheck.map(async (p) => {
          try {
            const r = await ghFetch('/repos/' + owner + '/' + repo + '/pulls/' + p.number + '/reviews');
            return { pr: p, count: (r.data || []).length };
          } catch (e) {
            return { pr: p, count: null }; // could not check — do not count it
          }
        }));
        unreviewedItems = reviews
          .filter((r) => r.count === 0)
          .map((r) => ({ key: '#' + r.pr.number, url: r.pr.html_url, summary: r.pr.title }));
      }

      const signals = {
        openCriticalBugs: { count: bugItems.length, items: bugItems },
        stalePRs: { count: staleItems.length, items: staleItems },
        unreviewedPRs: { count: unreviewedItems.length, items: unreviewedItems },
        ci,
        readme: readmeRes.status !== 404,
        changelog: changelogRes.status !== 404,
        releaseNotes: releases.length > 0 && !!(releases[0].body && releases[0].body.trim()),
        hasRelease: releases.length > 0 || tags.length > 0,
        lastCommitDaysAgo,
        rollback: null, // not visible from the public API
      };

      const result = window.ShipCheckScoring.computeReadiness(signals);
      const label = repoData.full_name + (repoData.description ? ' — ' + repoData.description : '');
      const meta = 'Live GitHub analysis · ' + apiCallsUsed + ' API calls (unauthenticated limit: 60/hour) · ' +
        issues.length + ' open issues/PRs · ' + prs.length + ' open PRs · ' +
        (prs.length > MAX_REVIEW_CHECKS ? 'reviews checked for first ' + MAX_REVIEW_CHECKS + ' PRs · ' : '') +
        'last commit ' + (lastCommitDaysAgo == null ? 'unknown' : lastCommitDaysAgo + ' day' + (lastCommitDaysAgo === 1 ? '' : 's') + ' ago');
      statusEl.className = 'status ok';
      statusEl.textContent = 'Done — scored ' + repoData.full_name + ' in ' + apiCallsUsed + ' API calls.';
      showResult(result, repoData.full_name, meta);
      void label;
    } catch (e) {
      statusEl.className = 'status error';
      if (e.status === 404) {
        statusEl.textContent = 'Repository not found — check the owner/repo name, or the repo is private.';
      } else if (e.status === 403) {
        const reset = e.reset ? new Date(Number(e.reset) * 1000).toLocaleTimeString() : 'later';
        statusEl.textContent = 'GitHub API rate limit reached (60 requests/hour without a token). Try again after ' + reset + '.';
      } else {
        statusEl.textContent = 'Could not reach GitHub (' + (e.message || 'network error') + '). Check your connection and try again.';
      }
    } finally {
      btn.disabled = false;
    }
  }

  $('githubForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    analyzeRepo($('repoInput').value);
  });
  document.querySelectorAll('[data-repo]').forEach((b) => {
    b.addEventListener('click', () => {
      $('repoInput').value = b.dataset.repo;
      analyzeRepo(b.dataset.repo);
    });
  });

  // ------------------------------------------------------------ checklist
  function checklistItems(count, kind) {
    const items = [];
    for (let i = 0; i < count; i += 1) {
      items.push({ key: kind + ' ' + (i + 1), url: null, summary: kind + ' ' + (i + 1) + ' (from checklist)' });
    }
    return items;
  }

  $('checklistForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const val = (id) => $(id).value;
    const bugs = Number(val('q-bugs'));
    const stale = Number(val('q-stale'));
    const unrev = Number(val('q-unrev'));
    const signals = {
      openCriticalBugs: { count: bugs, items: checklistItems(bugs, 'critical bug') },
      stalePRs: { count: stale, items: checklistItems(stale, 'stale PR') },
      unreviewedPRs: { count: unrev, items: checklistItems(unrev, 'unreviewed PR') },
      ci: val('q-ci'),
      readme: val('q-readme') === 'yes',
      changelog: val('q-changelog') === 'yes',
      releaseNotes: val('q-changelog') === 'yes',
      hasRelease: val('q-release') === 'yes',
      lastCommitDaysAgo: null, // not asked — reported as not checked
      rollback: val('q-rollback') === 'yes' ? true : val('q-rollback') === 'no' ? false : null,
    };
    // lastCommitDaysAgo is null -> the engine reports recent activity as
    // not checked; that is honest for a checklist with no repo attached.
    const result = window.ShipCheckScoring.computeReadiness(signals);
    showResult(result, 'Quick checklist result', 'Answered from your checklist — no repository attached.');
  });

  // ---------------------------------------------------------- copy summary
  $('copyBtn').addEventListener('click', async () => {
    if (!lastResult) return;
    const lines = [];
    lines.push('ShipCheck — ' + lastProjectLabel);
    lines.push('Score: ' + lastResult.score + '/100 — ' + lastResult.band.label);
    if (lastResult.gaps.length === 0) {
      lines.push('Blockers: none.');
    } else {
      lines.push('Top blockers:');
      lastResult.gaps.slice(0, 5).forEach((g) => lines.push('- ' + g.title + ' → ' + g.action));
    }
    const weakest = lastResult.dimensions.slice().sort((a, b) => a.score - b.score)[0];
    if (weakest) lines.push('Weakest area: ' + weakest.label + ' (' + weakest.score + '/100).');
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      $('copyStatus').textContent = 'Copied to clipboard.';
    } catch (e) {
      // Fallback for browsers without clipboard permission.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); $('copyStatus').textContent = 'Copied to clipboard.'; }
      catch (e2) { $('copyStatus').textContent = 'Copy failed — select the text manually.'; }
      ta.remove();
    }
  });

  // --------------------------------------------------------------- init
  renderSamples();
  // Decode first: a shared link may carry %2F for the "/" in owner/repo.
  const hash = (() => { try { return decodeURIComponent(location.hash || ''); } catch (e) { return location.hash || ''; } })();
  const m = hash.match(/#sample=([a-z0-9-]+)/i);
  const rm = hash.match(/#repo=([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/);
  const am = hash.match(/[#&]api=(https?:\/\/[^\s#&]+)/);
  if (am) {
    GH = am[1].replace(/\/$/, '');
  }
  if (m) {
    analyzeSample(m[1]);
  } else if (rm) {
    switchTab('github');
    $('repoInput').value = rm[1];
    analyzeRepo(rm[1]);
  }
})();

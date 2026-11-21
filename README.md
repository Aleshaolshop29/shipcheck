# ShipCheck — Is your release ready to ship?

**SLAY HACKS 2026** · solo · Beginner · target: **Best Beginner ($500)**

> ShipCheck tells you in seconds whether a software release is ready to ship — a 0–100 readiness score, the blockers, and the next steps, from any public GitHub repo or a 2-minute checklist. No install, no account, no data leaves your browser.

## Why this exists

Every team shipping software asks the same question before a release: *are we ready?* The answer usually lives in five different places — CI, the bug tracker, open PRs, the docs, and someone's head. ShipCheck pulls those signals together into one number, one verdict, and a concrete to-do list.

The scoring model is adapted from the [ShipReady](https://github.com/Aleshaolshop29) release-readiness concept (a Codegeist 2026 project by the same author): a deterministic, penalty-based score where every problem is capped so no single broken area can zero the score, every penalty becomes a blocker with evidence and an action, and a signal that could not be checked is reported (degraded mode) instead of silently ignored.

## Run it

No build step, no dependencies, no server required.

```sh
# Option A — just open it
open index.html            # or double-click it in your file manager

# Option B — serve it (recommended for the demo video)
node server.mjs            # http://localhost:4173
node server.mjs 8080       # http://localhost:8080
```

Requirements: any modern browser. Node 18+ only if you want the local server or the tests.

## Use it

1. **Sample project** — three realistic releases, one per verdict band. One click each:
   - *Northwind API v2.4.0* → **95 · READY**
   - *Acme Dashboard v1.8.0* → **74 · CAUTION**
   - *Beta Mobile v0.9.0* → **23 · NO-GO**
2. **GitHub repo** — type any public `owner/repo` (try `Aleshaolshop29/make-fun-guide`) and hit **Analyse repo**. ShipCheck reads open issues, PRs, CI status, README/CHANGELOG, releases and recent commits through the public GitHub API. No token, no sign-in, nothing stored. Unauthenticated limit: 60 requests/hour; one analysis uses ~8–18 calls.
3. **Quick checklist** — no GitHub? Answer 8 questions and get the same score.

Every result shows: the score gauge + verdict, a per-area breakdown (Tests & CI, Bugs, Pull Requests, Documentation, Release Hygiene), every blocker with severity, evidence and a concrete next step, and a plain-English **release briefing** (rule-based) you can copy into a release thread.

## How the score works

`score = clamp(100 − sum(penalties), 0, 100)`

| Area | What counts | Penalty |
|---|---|---|
| Tests & CI | CI failing / pending / no status found | 15 / 5 / 8 |
| Bugs | Open critical / blocker bugs | 8 each, max 32 |
| Pull Requests | PRs open > 14 days; PRs with no review | 5 / 4 each, max 36 |
| Documentation | Missing README / CHANGELOG / release notes | 6 / 4 / 2 |
| Release Hygiene | No release or tag; no commits in 30 days; no rollback plan | 8 / 6 / 6 |

Verdict bands: **90–100 READY — Ship it** · **70–89 CAUTION — Ship with care** · **50–69 HOLD — Fix blockers first** · **0–49 NO-GO — Do not ship**.

## Project layout

```
index.html          UI (tabs: samples / GitHub / checklist, results, scoring model)
styles.css          Self-contained styles (system fonts, no CDN)
scoring.js          Pure deterministic scoring engine (browser global + Node module)
samples.js          The three sample releases (also the test fixtures)
app.js              UI logic + GitHub API analysis + checklist + copy summary
server.mjs          Tiny zero-dependency static server (optional)
scoring.test.mjs    Unit tests for the scoring engine
DEMO.md             2–4 minute demo video shotlist
```

## Tests

```sh
node --test scoring.test.mjs
```

9 tests, all passing: the three sample scores/bands, band boundaries, per-signal caps, clamping at 0, degraded mode (unknown CI / rollback), and the rule-based briefing.

## Deep links (for demos & testing)

- `index.html#sample=northwind` (or `acme`, `beta`) — auto-load a sample project.
- `index.html#repo=owner/repo` — auto-analyse a public repo on load.
- `index.html#repo=owner/repo&api=http://localhost:4199` — point the GitHub calls at a mock API instead of api.github.com (dev/testing only; useful where the real API is unreachable).

## Judging alignment

- **Innovation (25%)** — one decision-ready number from scattered repo signals, with every penalty mapped to a concrete action. The "score never depends on a single source" rule (borrowed from ShipReady) plus honest degraded mode.
- **Technical (25%)** — real GitHub API integration on public data, a transparent deterministic scoring model with unit tests, zero dependencies, works offline from a file.
- **Impact (20%)** — every team that ships software faces the "are we ready?" question; a bad release costs users. ShipCheck makes the answer checkable in seconds.
- **AI (15%)** — the release briefing composes a plain-English go/no-go summary from the scored data (rule-based, clearly labelled as such — no fake "AI" claims).
- **UX (15%)** — one-click samples, a single repo field, an 8-question checklist, a clear gauge, blockers with next steps, copy-to-clipboard summary. Works on mobile.

## What it is not

- Not a CI replacement and not a test runner — it reads the signals your tools already produce.
- The rollback plan is not visible from the public GitHub API, so for repo analyses it is reported as "not checked" (no penalty) instead of guessed.
- No private repos (the public API cannot see them without a token), no data is stored anywhere.

## Author

Built solo by Muhammad Iqbal Al Farisy for SLAY HACKS 2026 (registered as aleshaolshop29 on Devpost). GitHub: https://github.com/Aleshaolshop29

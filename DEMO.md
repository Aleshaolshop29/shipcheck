# ShipCheck — demo video shotlist (2–4 minutes)

Target length: **~3 minutes**. Record the screen at 1920×1080, narrate in English.
Start the app first: `node server.mjs` → http://localhost:4173

## 0:00–0:20 — Hook
- Show the ShipCheck header + tagline.
- Say: "Every team asks the same question before a release: are we ready to ship? ShipCheck answers it in seconds — one score, the blockers, and what to fix."

## 0:20–0:55 — Sample: a clean release (READY)
- Click the **Sample project** tab → **Northwind API v2.4.0** → "Check this release".
- Point at the gauge: **95 / READY — Ship it**.
- Scroll the breakdown: all areas green, one blocker (a stale PR) with its next step.
- Say: "One stale PR, everything else clean — that's a 95, and the one thing to fix is right there."

## 0:55–1:35 — Sample: a release that must wait (NO-GO)
- Click **Beta Mobile v0.9.0** → "Check this release".
- Point at the gauge: **23 / NO-GO — Do not ship**.
- Scroll the blockers: red CI, 2 critical bugs, no README, no changelog, no release, no rollback plan — each with evidence and a concrete action.
- Show the **release briefing**: the plain-English summary + top 3 actions.
- Say: "Same tool, same model — this one is a 23. The briefing tells the team exactly what to fix first."

## 1:35–2:20 — Real data: a live GitHub repo
- Click the **GitHub repo** tab. The field already shows `Aleshaolshop29/make-fun-guide` — click **Analyse repo**.
- While it loads: "No token, no sign-in — it reads the public GitHub API."
- Point at the result: the live score, the breakdown, and the blockers found in the real repo (missing CHANGELOG, no release yet).
- Say: "This is real data from a real repo — not a mockup."

## 2:20–2:50 — No GitHub? The checklist
- Click the **Quick checklist** tab. Answer 2–3 questions differently (e.g. set CI to "Failing", critical bugs to "1") and click **Calculate my score**.
- Show the score change and the new blockers.
- Say: "No repo handy? Eight questions, same score."

## 2:50–3:10 — Wrap-up
- Click **Copy summary** (show the "Copied" confirmation).
- Say: "ShipCheck — a readiness score, the blockers, and the next steps, in seconds. Built for SLAY HACKS 2026. Link in the description."

## B-roll / screenshots to capture (for the Devpost page)
1. Northwind result (gauge 95, READY, green).
2. Beta Mobile blockers list (red NO-GO, several blockers).
3. GitHub analysis of `Aleshaolshop29/make-fun-guide` (live score).
4. The "How the score works" table (transparency).
5. The checklist tab (8 questions).

## Notes for the presenter
- Keep the narration to what is on screen; do not claim an AI model — the briefing is rule-based and the page says so.
- If the GitHub API rate limit (60/hour, no token) is hit during recording, use a sample project instead and mention it.
- The app works from a double-clicked `index.html` too, but the local server (`node server.mjs`) is the smoother recording setup.

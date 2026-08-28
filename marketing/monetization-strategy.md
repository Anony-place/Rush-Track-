# Rush Track — Monetization Strategy ("high earning source")

Two engines, one rule: **the game must always be winnable with coins you
earned**. Monetization sells convenience and cosmetics of the wallet, never
the skill.

## Ad inventory (AdMob, mobile-adapted)

| Format | Where | Why there | Config knob |
|---|---|---|---|
| **Banner** | Lobby bottom strip only | Never during a run — a banner mid-physics is a rage-quit | `admob.banner_unit` |
| **Interstitial** | After a *completed* run (results screen), and on stage unlock — never on crash | Player is in a reward state; 75 s hard cooldown | `interstitial.on_events`, `min_interval_seconds` |
| **Rewarded** | Results: **2X COINS** (once/run) · In-run: **REFUEL +35** (max 3/run) | Highest eCPV format; user-initiated = high fill & completion | `rewarded.*` |

Expected mix at maturity: rewarded ≈ 55% of ad revenue, interstitial ≈ 35%,
banner ≈ 10%.

## IAP design (Play Billing)

| Product | ID | Price | Role |
|---|---|---|---|
| Remove Ads | `remove_ads` | $2.99 | Removes banner + interstitial; rewarded stays (it's a *feature*) |
| 5,000 coins | `coins_small` | $0.99 | Entry impulse; ≈ 2–3 days of earning |
| 25,000 coins | `coins_mega` | $2.99 | Anchor value (best $/coin) — drives most coin revenue |
| 60,000 coins | `coins_premium` | $4.99 | Whale top-up; ≈ a full garage + upgrades |

Coin economy (per run, calibrated in `game_state.gd` / terrain density):
- Earned: pickups (~8–14/run), passive 1/25 m, flip bonuses 40/120/300,
  new-best bonus.
- Spent: vehicle unlocks (10,000 / 25,000) + upgrade pips
  (180·(lvl+1)^1.85 · track-base).
- **Target:** a skilled free player can own all 3 vehicles + 3 pips on every
  track in ~10–14 days. Packs must feel like 1–2 day time-savers, not
  requirement.

## Revenue model (per 1k installs, conservative)

| Stream | Assumption | $/k installs |
|---|---|---|
| Interstitial | 1.2 shows/DAU, eCPV $4, DAU k=30% | $1.44 |
| Rewarded | 0.6 watches/DAU, eCPV $7, 25% opt-in | $0.32 |
| Banner | 0.8 shows/DAU, eCPM $6 | $0.14 |
| IAP | 1.5% × $1.8 avg | $2.70 |
| **Total D30 ARPU** | | **≈ $0.09–0.12** |

Levers, in order of impact: (1) D1 retention ×2 beats any ad frequency;
(2) Remove Ads attach rate (target 3–5% of D30 cohort); (3) rewarded
frequency cap 3→4 on high-retention geos; (4) mega-pack share via price
anchor.

## Fair-play guardrails (enforced in code, not just policy)

- No IAP grants a vehicle or upgrade directly — only coins.
- Interstitial suppressed for 75 s and never on crash (Monetization
  `can_show_interstitial()` + results screen flow).
- Rewarded double-coins capped at 1/run, refuel at 3/run.
- "Remove Ads" keeps rewarded ads available (documented in shop UI) —
  standard, transparent, keeps eCPV revenue from the segment.

## Ops checklist for going live

1. Replace test AdMob IDs in `game/assets/monetization_config.json`.
2. Add AdMob + IAP add-ons under `game/addons/` (paths already probed by
   `Monetization._probe_backends()` — the game auto-switches mock→real).
3. Create the 4 billing products with the exact IDs.
4. Declare ads + billing in Play Console; pass the safety scan with the
   privacy policy from `privacy-policy.md`.
5. Staged rollout; watch AdMob diagnostics for policy violations day 1.

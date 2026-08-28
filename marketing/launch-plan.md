# Rush Track — Launch & Traffic Plan

Goal: acquire **organic-dominant** traffic (cheapest and most durable for
casual racing) with paid social as the ignition, tuned by a simple funnel:

```
impressions → installs → D1 retention → (ads + IAP) → LTV
```

KPI targets (casual racing benchmarks): D1 ≥ 35%, D7 ≥ 12%, install CTR
(feature graphic) ≥ 15%, eCPV $3–8 (interstitial), ARPU/D30 ≥ $0.10.

## Phase 0 — Pre-launch (T-21 → T-0)

| Task | Detail |
|---|---|
| Pre-registration | Turn on Play pre-reg with the feature graphic; every pre-reg is a guaranteed launch-day notification audience. |
| Closed test | 50–200 testers (friends + one Facebook/rG group). Fix crash + OOM (low-end Pixel 4a / Galaxy A-class is the reference device). |
| Store assets | Full set per `store-listing.md` + `capture-guide.md`. |
| Privacy + billing | Privacy URL live; 4 IAP products created in Play Console with the exact IDs from `game/assets/monetization_config.json`. |
| AdMob | Create real app id + 3 unit ids, replace the test IDs in the config, re-export. |
| Analytics | Play App Performance is enough at this scale; add Firebase Analytics events: `run_started`, `run_ended` (reason: crash/fuel/done, distance, coins), `ad_rewarded` (id), `iap_purchase` (id). |
| Trailer | 30 s vertical video per capture guide. |

## Phase 1 — Soft launch (T+0 → T+14, one small geo)

- Geo: one mid-size market with stable ad markets (e.g. **NZ or CL**) —
  big enough for signal, small enough to experiment cheaply.
- **Week 1:** no paid spend. Measure baseline D1, run duration, coins earned
  vs. spent per upgrade.
- **Experiments (one at a time, ≥10k impressions each):**
  1. Feature graphic: car close-up vs. full scene.
  2. Title: "Hill Racing Stunts" vs. "Hill Climb Stunt Drive".
  3. First-time offer: "2X coins for your first 3 runs" (rewarded) vs. none.
- **Monetization tuning loop:** if D1 < 35%, cut interstitial frequency
  (config `min_interval_seconds` 75→120); if ARPU is low, raise coin pack
  value 10–20% (price anchoring) — changes are config-only
  (`monetization_config.json`), no code, ship via Play staged rollout.

## Phase 2 — Global launch (T+14)

- 10% → 50% → 100% staged rollout over 3 days.
- **Paid social ignition (48–72 h window):** $5–15/day on Meta + TikTok for
  7 days, targeting 18–44, interests: Hill Climb Racing, Asphalt, Crazy
  Cars, offroad. Creative: the 30 s store video + a 9 s flip-only cut.
  Kill any ad set with CTR < 1% or CPI > $1.50 after $20 spend.
- **Influencer seeding (ongoing, low cost):** send the APK (or pre-reg link)
  to 20–50 mid-tier mobile gamers (20k–300k subs) on YouTube/TikTok; ask
  for a "can you beat my 4,300m run?" challenge clip. A 60-second
  "Rush Track world record" clip is the whole funnel.
- **Community (compounding, free):** create the Discord + one
  r/HillClimbGames-flavored subreddit presence; post the leaderboard
  screenshot every time a world-record distance falls. The game's distance
  metric makes organic FOMO easy: every new record is a post.

## Phase 3 — Operating the game (ongoing)

- **Weekly:** check crash rate (<0.1%), ANRs, eCPV by geography; A/B one
  store asset.
- **Monthly:** one content drop — a new stage variant or vehicle skin
  (all stages/vehicles are data-driven in `game_state.gd`, a new stage is
  ~30 lines of data + palette). Content drops re-trigger store refresh +
  a "what's new" video.
- **Quarterly:** pricing review of the coin packs against the earned-coins
  curve (average coins per DAU per day). Keep the Remove Ads pass at the
  25–30% of cohort ARPU-equivalent (the sweet spot for casual).

## Traffic source summary (ranked by expected ROI)

1. **ASO / organic** — the store listing *is* the conversion surface; all
   experiments compound. (0% of CPI, biggest long-term share: 50–70%)
2. **Creator/challenge clips** — one viral 30-second flip clip > $5k of ads.
3. **Paid social (Meta/TikTok)** — ignition + retargeting of pre-regs.
4. **Community records + Discord** — retention flywheel that also feeds
   ASO (reviews).
5. **Cross-promo** — with other small racing developers once both apps are
   live (rewarded cross-promo inside the 2X-coins slot).

## Anti-patterns we avoid

- No interstitial on the crash screen (rage-quit moment) — only after a
  *completed* run or on stage unlock (config: `on_events`).
- No fake countdowns, no dark patterns, no pay-to-win (config + code
  enforce: upgrades are coin-gated only).
- No ad frequency > 1/75 s and no rewarded prompt more than 3× per run.

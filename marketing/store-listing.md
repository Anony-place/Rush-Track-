# Rush Track — Google Play Store Listing

> Package: `com.rushtrack.game` · Category: Racing (Casual) · Content rating: Everyone
> Target: Android 7.0 (API 24)+, arm64-v8a (+armeabi-v7a), landscape, touch-first.

## Title (30 chars max)

**Rush Track: Hill Racing Stunts**

*(28 chars — brand + category keywords "hill racing" and "stunts")*

## Short description (80 chars max)

**Flip, crash & upgrade your buggy across 4 wild worlds. The hill racer you can't put down.**

*(80 chars)*

## Long description

```
REV IT. RIDE IT. ROLL IT.

Rush Track is a turbo-charged hill racing stunt adventure. Gas, brake, and
air control are all you need to carve four wildly different worlds — Sunny
Meadows, Dust Canyon, Neon Harbor and Frostbite Ridge — and chase the best
distance in every one.

★ THREE VEHICLES, ONE GARAGE
Scout Buggy, Dune Mauler and the rally-born Vortex GT. Every car has its
own stat sheet: power, grip, tank, air torque and suspension — and every
one of them upgrades five levels deep.

★ REAL HILL-CLIMB PHYSICS
Independent spring suspension, a driver who can (and will) get bonked,
fuel you have to manage, and 360° flips that pay out coin bonuses.

★ FUEL, COINS, MILESTONES
Grab fuel cans, sweep up coins every 25 meters, and smash milestone gates
for pennant pops. Run out of fuel, bonk your driver, and the run is over —
then upgrade and go again.

★ PLAY ANYWHERE, ANY TIME
One-thumb, big-button, landscape controls built for phones. Sessions last
90 seconds. Perfect between everything else.

FREE TO PLAY. Optional coins and an ad-free pass — zero pay-to-win:
upgrades cost coins you earn by driving.
```

## Keywords (100 chars, comma separated)

hill climb,racing,stunt,buggy,offroad,arcade,physics,flip,casual,drift

## Graphics & screenshots

Use the in-game capture pass (see `marketing/capture-guide.md` — boot each
stage, autopilot a 30 m run, screenshot the HUD on). Order:

1. **Screenshot 1 (phone)** — Sunny Meadows mid-run, coin burst, big "1,240m"
   distance readout. *This is the thumbnail candidate: highest contrast.*
2. **Screenshot 2 (phone)** — Garage with all stat bars visible, Vortex GT
   highlighted (shows depth of progression).
3. **Screenshot 3 (tablet)** — Neon Harbor at "night" (shows art variety).
4. **Screenshot 4 (tablet)** — Results screen with NEW BEST badge + 2X coins
   (shows the monetization value prop honestly).
5. **Feature graphic** — Vortex GT drifting off a Dust Canyon crest, checkered
   flag corner badge, "RUSH TRACK" wordmark top-left. 1024×500.

Store icon: `game/icon.png` (already 512², round-masked safe).

## App Bundle / Play requirements

| Item | Value |
|---|---|
| App Bundle (AAB) | required — export via Godot 4.3 `export/Android/RushTrack.aab` |
| Min SDK | 24 (Android 7.0) |
| Target SDK | 34 |
| Native CPU | arm64-v8a, armeabi-v7a |
| Data safety | **No data collected.** Save file is on-device only. Ads (AdMob) collect device-ID-class data per Google policy — disclose "Advertising" purpose only when live. |
| Privacy policy URL | required before launch — template in `marketing/privacy-policy.md` |
| Ads declaration | Interstitial + Rewarded + Banner; declare all three in Play Console. |
| In-app products | 4 (remove_ads, coins_small, coins_mega, coins_premium) — IDs must match `game/assets/monetization_config.json` exactly. |
| Content rating | Everyone (cartoon/action — no blood, no realistic violence). |
| Game announcement | optional; run a 2-week pre-registration to seed the queue. |

## ASO iteration plan (first 90 days)

- Week 1–2: title A/B (Play Store Listing Experiments): `Rush Track: Hill Racing Stunts` vs `Rush Track — Hill Climb Racing Stunts`.
- Week 3–4: feature graphic A/B (car vs landscape).
- Ongoing: keyword swap in long description every 2 weeks from search-term
  report ("hill climb" family → "stunt drive" family → "offroad" family).
- Never change the title's first two words once ranked (brand lock-in).

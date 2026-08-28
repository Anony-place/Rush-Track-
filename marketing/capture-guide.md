# Screenshot & Video Capture Guide (store assets)

All assets for the Play listing are produced **from the shipped game** — no
external artwork, so the store always matches the product.

## In-game capture mode

Every scene is rendered at a fixed 1920×1080 design resolution, so captures
on any device are pixel-consistent:

1. **Phone shots (1080×1920 portrait crop of the 16:9 frame):**
   On a device, enable `DevTools → Remote Debug → Textures → Save frame`
   (or a screen recorder) and:
   - Boot → lobby: capture the logo + coin pill (use for the "what is this"
     card).
   - PLAY → let the run reach ~120 m on Sunny Meadows, coins bursting, then
     save the frame. Crop the center band to 1080×1920.
2. **Garage shot:** unlock all 3 vehicles in a throwaway save
   (cheat: `SaveManager` dev console), select Vortex GT, capture at the
   stat bars.
3. **Results shot:** finish a run that sets a new best → capture the
   NEW BEST badge + 2X COINS button visible (this shot advertises the
   rewarded ad honestly).
4. **Feature graphic:** Vortex GT crest-jump in Dust Canyon; composite the
   wordmark (`game/assets/ui/logo.png`) top-left and a checkered-flag badge
   bottom-right at 1024×500.

## Play Store video (30 s, 1080×1920 vertical or 16:9)

Cut order (capture each segment with an on-device recorder, edit in any
free NLE):

| s   | Shot | Caption |
|-----|------|---------|
| 0–4  | Logo splash → lobby | — |
| 4–10 | Sunny Meadows run, coin bursts, a 360 flip | "FLIP = COINS" |
| 10–16| Crash slow-mo → results, NEW BEST | "90-second runs" |
| 16–22| Garage: stat bars + upgrade pip filling | "5 upgrade tracks per car" |
| 22–27| Neon Harbor drift → frost ice drift | "4 worlds" |
| 27–30| Logo + "FREE ON PLAY" | CTA |

Keep total size < 100 MB, MP4 H.264, add English subtitles (store video
plays muted for most impressions).

## Refresh cadence

- Pre-launch: full set per `store-listing.md`.
- Each season (new stage/vehicle drop): new screenshot 1 + 5-second video
  teaser to existing users via the Play "What's new" + community post.

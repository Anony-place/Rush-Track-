# 🏁 RUSH TRACK

**Turbo-charged 2D hill-racing stunt adventure for Android** — built with
**Godot 4.3** (GL Compatibility, landscape, touch-first). Flip, crash and
upgrade your rig across four hand-crafted worlds.

![Rush Track icon](game/icon.png)

- **Physics hill-climb**: independent spring suspension, a driver who can (and
  will) get bonked, 360° flips that pay coin bonuses, fuel you must manage.
- **4 stages** — Sunny Meadows, Dust Canyon, Neon Harbor, Frostbite Ridge —
  each with its own palette, parallax skyline, props, weather and ambience.
  Ice patches in Frostbite genuinely cut your grip.
- **3 vehicles × 5 upgrade tracks** (Engine, Suspension, Tires, Fuel Tank,
  Air) × 5 levels — every pip changes the physics.
- **Full lobby**: animated menu, stage select with world previews, garage
  with live stat bars, shop, settings, pause, results screen with animated
  counters.
- **Monetization built in**: banner (lobby only), interstitial (post-run,
  75 s cooldown), rewarded (2× coins / refuel) and 4 IAPs (Remove Ads + 3
  coin packs) — see [marketing/monetization-strategy.md](marketing/monetization-strategy.md).
  Ships in **mock mode** with the complete player loop; drop in the AdMob /
  IAP add-ons and the game auto-switches to the real backends.
- **Production polish**: 55+ generated audio cues (2 music themes, 4 biome
  ambience beds, per-event SFX), vibration haptics, slow-mo crash, screen
  shake, particles, milestone pennants, portrait "rotate" hint, onboarding
  toasts.

## Repository layout

```
game/                      ← the Android game (Godot 4.3 project)
  project.godot            1920×1080 design resolution, landscape, 6 autoloads
  export_presets.cfg       Android export (arm64-v8a + armeabi-v7a)
  scenes/                  boot, lobby, stages, garage, run, results, shop, settings
  scripts/autoload/        EventBus, SaveManager, GameState, AudioManager,
                           Monetization, Haptics
  scripts/core/            terrain (procedural chunks), vehicle (RigidBody2D +
                           sprung wheels + driver), pickups, parallax, weather,
                           milestone gates, run controller (incl. smoke autopilot)
  scripts/ui/              UIKit design system + all screens (code-built UI)
  assets/                  generated art (PNG), fonts, audio (WAV→OGG),
                           monetization_config.json
tools/
  make_assets.py           Pillow art pipeline (logo, vehicles, driver, icons)
  gen_audio.py             pure-python 16-bit WAV synth (music, ambience, SFX)
marketing/                 store listing, launch/traffic plan, monetization
                           strategy, privacy policy, capture guide
src/, index.html, …        legacy browser build (same art direction, kept
                           as an instant-play web version)
```

## Building the Android APK

Prereqs: **Godot 4.3** (editor) + its **Android export templates**,
**Android SDK** (platform 34, build-tools) + **JDK 17**.

1. Open `game/project.godot` in the Godot editor.
2. Editor → Manage Export Templates → install the 4.3 templates.
3. Editor → Project → Export: the **Android** preset is preconfigured
   (`export/Android/RushTrack.apk`, package `com.rushtrack.game`,
   ARM64 + ARMv7). Set your debug/release keystore fields.
4. Export → pick a device (USB, USB-debug) or export the AAB for Play.

> **Play Store:** upload the AAB, create the 4 billing products with the
> exact IDs from `game/assets/monetization_config.json`, set the AdMob app
> id, point the privacy policy at
> [marketing/privacy-policy.md](marketing/privacy-policy.md).

## Development

```bash
# Headless CI smoke test (drives an autopilot run, exits 0 on PASS):
godot --headless --path game --smoke 60 res://scenes/run.tscn

# Regenerate all art (Pillow) / all audio (pure-python synth):
python3 tools/make_assets.py
python3 tools/gen_audio.py
```

Autoloads boot before any scene, so every screen can be opened directly
for capture or testing.

## Monetization setup (mock → live)

The game runs in **mock mode** when the `addons/godot-plugin-admob` and
`addons/godot-plugin-iap` scripts are absent: ad cards are simulated 2.2 s
timers, IAP is a simulated 1.8 s flow, entitlements persist in the save
file. To go live: add both add-ons, replace the test unit IDs in
`game/assets/monetization_config.json` with yours, and re-export.
`Monetization._probe_backends()` switches at boot with zero code changes.

## Legacy browser build

`index.html` + `src/` (13 ES modules, zero dependencies) is the original
web build — same game, same art direction, runs by opening the file. Kept
for instant web play and as a visual reference for the Godot port.

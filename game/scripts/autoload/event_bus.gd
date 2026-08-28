extends Node
## Central typed signal bus. Keeps decoupled modules from referencing each other.

# --- Economy -------------------------------------------------------------
signal coins_changed(total: int)
signal coins_spent(amount: int)

# --- Run lifecycle ---------------------------------------------------------
signal run_started(stage_index: int, vehicle_index: int)
signal run_ended(run_result: Dictionary)      # {distance, coins, flips, top_speed, crashed, stage, new_best, stage_unlocked}
signal fuel_changed(frac: float)
signal fuel_pickup(amount: float)
signal out_of_fuel()
signal crash_detected()
signal flip_landed(flips: int, bonus: int)
signal coin_collected(value: int)
signal distance_milestone(meters: int)

# --- Meta / progression ----------------------------------------------------
signal vehicle_unlocked(index: int)
signal stage_unlocked(stage_index: int)
signal new_best_record(stage_index: int, distance: int)
signal settings_changed(key: String)
signal toasts(text: String, kind: String)

# --- Navigation ------------------------------------------------------------
signal navigate_to(scene_name: String)        # "lobby" | "stages" | "garage" | "run"

# --- Ads / IAP ---------------------------------------------------------------
signal rewarded_complete(reward_id: String)
signal interstitial_showing()
signal interstitial_finished()
signal purchase_complete(product_id: String, success: bool)

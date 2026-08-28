extends Node
## Monetization facade — one API over two production backends:
##   1. AdMob   — "godot-plugin-admob" addon (see docs/ADMOB_SETUP.md)
##   2. Play IAP— "godot-plugin-iap" addon (bitbrain, see docs/IAP_SETUP.md)
## When the add-ons are absent (dev / CI / smoke tests) a mock backend answers
## with realistic latency, so every flow (interstitial cadence, rewarded,
## IAP entitlements) is testable end-to-end and the game never hard-fails.
##
## Real unit / product ids live in res://assets/monetization_config.json.

const CONFIG_PATH := "res://assets/monetization_config.json"

var config: Dictionary = {}
var backend_admob: bool = false
var backend_iap: bool = false
var app_id: String = ""
var banner_unit: String = ""
var interstitial_unit: String = ""
var rewarded_unit: String = ""
var banner_node: Control = null       # lobby banner strip (mock + native host)
var _last_interstitial_ms: int = 0
var _interstitial_cooldown_ms: int = 75_000  # max 1 interstitial per 75 s
var _reward_in_flight: bool = false
var _interstitial_in_flight: bool = false
var _rewarded_cb: Callable
var _rewarded_id: String = ""
var _mock: bool = true
var _admob: GDScript = null
var _iap: Node = null

func _ready() -> void:
	process_mode = ProcessMode.PROCESS_MODE_ALWAYS
	_load_config()
	_probe_backends()

func _load_config() -> void:
	if not FileAccess.file_exists(CONFIG_PATH):
		push_warning("Monetization: no config at %s — mock ids only" % CONFIG_PATH)
		config = {}
		return
	var f := FileAccess.open(CONFIG_PATH, FileAccess.READ)
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	f.close()
	if typeof(parsed) == TYPE_DICTIONARY:
		config = parsed

func _probe_backends() -> void:
	backend_admob = ResourceLoader.exists("res://addons/godot-plugin-admob/AdMob.gd")
	backend_iap = ResourceLoader.exists("res://addons/godot-plugin-iap/iap.gd")
	_mock = not (backend_admob or backend_iap)
	if backend_admob:
		_admob = load("res://addons/godot-plugin-admob/AdMob.gd")
		app_id = str(config.get("admob", {}).get("app_id", ""))
		banner_unit = str(config.get("admob", {}).get("banner_unit", ""))
		interstitial_unit = str(config.get("admob", {}).get("interstitial_unit", ""))
		rewarded_unit = str(config.get("admob", {}).get("rewarded_unit", ""))
		_admob.init(app_id)
		_admob.interstitial_callback.connect(_on_interstitial_callback)
		_admob.rewarded_ad_callback.connect(_on_rewarded_callback)
		_admob.create_interstitial(interstitial_unit)
		_admob.create_rewarded(rewarded_unit)
		_admob.request_interstitial()
		_admob.request_rewarded()
	if backend_iap:
		_iap = load("res://addons/godot-plugin-iap/iap.gd").new()
		add_child(_iap)
		_iap.connect("purchased", _on_iap_purchased)
		_iap.connect("restored", _on_iap_restored)
		_refresh_iap_products()

# -------------------------------------------------------------------- ads
func has_removed_ads() -> bool:
	return SaveManager.read("entitlements.remove_ads", false)

func can_show_interstitial() -> bool:
	if has_removed_ads() or _interstitial_in_flight:
		return false
	return int(Time.get_ticks_msec()) - _last_interstitial_ms >= _interstitial_cooldown_ms

## Show an interstitial (run-end moment). No callback — signals are used.
func show_interstitial() -> void:
	if not can_show_interstitial():
		return
	_interstitial_in_flight = true
	_last_interstitial_ms = int(Time.get_ticks_msec())
	EventBus.interstitial_showing.emit()
	if not _mock and _admob != null and is_instance_valid(_admob):
		_admob.show_interstitial()
		return
	_emit_mock_toast("MOCK INTERSTITIAL (dev)")
	await get_tree().create_timer(2.2).timeout
	_interstitial_in_flight = false
	EventBus.interstitial_finished.emit()

func _on_interstitial_callback(status: String) -> void:
	if status == "dismissed":
		_interstitial_in_flight = false
		EventBus.interstitial_finished.emit()

func _on_rewarded_callback(status: String) -> void:
	_reward_in_flight = false
	var ok: bool = status == "completed"
	if ok and not _rewarded_id.is_empty():
		EventBus.rewarded_complete.emit(_rewarded_id)
	if _rewarded_cb.is_valid():
		_rewarded_cb.call(ok)

## Rewarded ads. reward_id: "double_coins" | "refuel" | "sticker".
func show_rewarded(reward_id: String, cb: Callable) -> void:
	if _reward_in_flight:
		cb.call(false)
		return
	_reward_in_flight = true
	_rewarded_cb = cb
	_rewarded_id = reward_id
	if not _mock and _admob != null and is_instance_valid(_admob):
		_admob.show_rewarded()
		return
	_emit_mock_toast("MOCK REWARDED: %s (dev)" % reward_id)
	await get_tree().create_timer(2.2).timeout
	_reward_in_flight = false
	cb.call(true)

# --------------------------------------------------------------------- IAP
func product_ids() -> Array[String]:
	var ids: Array[String] = []
	for p in config.get("iap_products", []):
		ids.append(str((p as Dictionary).get("id", "")))
	return ids

func product_price_label(product_id: String) -> String:
	for p in config.get("iap_products", []):
		if str((p as Dictionary).get("id", "")) == product_id:
			return str((p as Dictionary).get("price", ""))
	return ""

func purchase(product_id: String) -> void:
	if not _mock and backend_iap and _iap != null and is_instance_valid(_iap):
		_iap.request_product_purchase(product_id)
		return
	_emit_mock_toast("MOCK IAP: %s (dev)" % product_id)
	await get_tree().create_timer(1.8).timeout
	_grant_product(product_id)

func restore_purchases() -> void:
	if not _mock and backend_iap and _iap != null and is_instance_valid(_iap):
		_iap.restore_purchases()
		return
	# Mock: re-apply the entitlements already stored (no-op but honest).
	EventBus.toasts.emit("No purchases to restore", "info")

func _on_iap_purchased(product_id: String, _receipt: String, _signature: String) -> void:
	_grant_product(product_id)

func _on_iap_restored(purchases: Array) -> void:
	for p in purchases:
		if typeof(p) == TYPE_DICTIONARY:
			_grant_product(str((p as Dictionary).get("product_id", "")))

func _refresh_iap_products() -> void:
	if _iap == null:
		return
	for pid in product_ids():
		_iap.register_product(pid, 0)

func _grant_product(product_id: String) -> void:
	match product_id:
		"remove_ads":
			SaveManager.write("entitlements.remove_ads", true)
			EventBus.toasts.emit("Ads removed — enjoy!", "success")
		"coins_small":
			SaveManager.add_coins(5000)
			EventBus.toasts.emit("+5,000 coins", "success")
		"coins_mega":
			SaveManager.add_coins(25000)
			EventBus.toasts.emit("+25,000 coins", "success")
		"coins_premium":
			SaveManager.add_coins(60000)
			EventBus.toasts.emit("+60,000 coins", "success")
		_:
			push_warning("Monetization: unknown product id '%s'" % product_id)
			return
	AudioManager.play_sfx("cash")
	EventBus.purchase_complete.emit(product_id, true)
	SaveManager.flush()

# ----------------------------------------------------------------- banner
func show_banner() -> void:
	if not _mock and _admob != null and is_instance_valid(_admob) and not has_removed_ads():
		if banner_unit.is_empty():
			_admob.create_banner(banner_node, banner_unit, 0, 0)
		_admob.show_banner()
	elif not has_removed_ads() and banner_node != null and is_instance_valid(banner_node):
		banner_node.visible = true
	elif banner_node != null and is_instance_valid(banner_node):
		banner_node.visible = false

func hide_banner() -> void:
	if not _mock and _admob != null and is_instance_valid(_admob):
		_admob.hide_banner()
	elif banner_node != null and is_instance_valid(banner_node):
		banner_node.visible = false

func _emit_mock_toast(text: String) -> void:
	EventBus.toasts.emit(text, "info")
	push_warning("Monetization(mock): %s" % text)

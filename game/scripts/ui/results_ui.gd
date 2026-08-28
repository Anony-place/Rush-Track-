extends Control
## Post-run results: animated counters, best badge, unlock banner, 2x coins
## rewarded ad, and navigation. Interstitial (if allowed) shows on exit.

const BG: GDScript = preload("res://scripts/ui/lobby_bg.gd")

var _result: Dictionary = {}
var _dist_label: Label
var _coin_label: Label
var _flip_label: Label
var _speed_label: Label
var _double_btn: Button
var _new_best_badge: Label
var _unlock_banner: Label
var _leaving: bool = false

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UIKit.make_theme()
	_result = GameState.last_result.duplicate()
	if _result.is_empty():
		_result = {"stage": 0, "vehicle": 0, "distance": 0, "coins": 0, "flips": 0,
			"top_speed": 0, "crashed": false, "fuel_out": false, "new_best": false,
			"stage_unlocked": false, "best": 0}
	_build()
	_animate()

func _build() -> void:
	var bg: Node2D = BG.new()
	bg.z_index = -100
	add_child(bg)
	var s: Variant = GameState.stage(int(_result.stage))
	var crashed: bool = _result.crashed
	var headline := "WRECKED!" if crashed else ("OUT OF FUEL" if _result.fuel_out else "RUN COMPLETE")
	var headline_color := Color(1, 0.35, 0.3) if crashed else (Color(1, 0.6, 0.3) if _result.fuel_out else Color(0.5, 1, 0.6))
	var title := UIKit.outlined_label(headline, 84, headline_color, UIKit.font_display())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(460, 36)
	title.size = Vector2(1000, 120)
	add_child(title)
	var world := Label.new()
	world.text = s.name.to_upper()
	world.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	world.position = Vector2(460, 150)
	world.size = Vector2(1000, 40)
	world.add_theme_font_size_override("font_size", 28)
	world.add_theme_color_override("font_color", Color(1, 1, 1, 0.65))
	add_child(world)
	# --- Center panel.
	var panel := UIKit.panel(28)
	panel.position = Vector2(480, 210)
	panel.size = Vector2(960, 560)
	add_child(panel)
	_new_best_badge = UIKit.outlined_label("NEW BEST!", 54, UIKit.C_GOLD, UIKit.font_display())
	_new_best_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_new_best_badge.position = Vector2(480, 226)
	_new_best_badge.size = Vector2(960, 70)
	_new_best_badge.pivot_offset = Vector2(480, 35)
	_new_best_badge.modulate.a = 0.0
	_new_best_badge.visible = bool(_result.new_best)
	add_child(_new_best_badge)
	# Distance (hero number).
	var dl := Label.new()
	dl.text = "0m"
	dl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dl.position = Vector2(480, 292)
	dl.size = Vector2(960, 150)
	dl.add_theme_font_override("font", UIKit.font_display())
	dl.add_theme_font_size_override("font_size", 130)
	dl.add_theme_color_override("font_color", Color.WHITE)
	add_child(dl)
	_dist_label = dl
	var dcap := _cap("DISTANCE")
	dcap.position = Vector2(480, 440)
	add_child(dcap)
	# Row: coins / flips / top speed.
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 60)
	row.position = Vector2(560, 500)
	row.size = Vector2(800, 130)
	add_child(row)
	_coin_label = _stat_box(row, "COINS", "0", UIKit.C_GOLD)
	_flip_label = _stat_box(row, "FLIPS", "0", Color(0.55, 0.85, 1.0))
	_speed_label = _stat_box(row, "TOP SPEED", "0 km/h", Color(0.9, 0.9, 0.95))
	# Best line.
	var best_lb := Label.new()
	best_lb.text = "Best on %s:  %dm" % [s.name, int(_result.best)]
	best_lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	best_lb.position = Vector2(480, 660)
	best_lb.size = Vector2(960, 40)
	best_lb.add_theme_font_size_override("font_size", 28)
	best_lb.add_theme_color_override("font_color", Color(1, 1, 1, 0.7))
	add_child(best_lb)
	# --- Reward: 2x coins (rewarded ad).
	_double_btn = UIKit.chunk_button("2X COINS  (WATCH AD)", "gold")
	_double_btn.custom_minimum_size = Vector2(520, 84)
	_double_btn.add_theme_font_size_override("font_size", 32)
	_double_btn.position = Vector2(960 - 260, 788)
	_double_btn.visible = not Monetization.has_removed_ads()
	_double_btn.pressed.connect(_on_double)
	add_child(_double_btn)
	# --- Navigation.
	var nav := HBoxContainer.new()
	nav.alignment = BoxContainer.ALIGNMENT_CENTER
	nav.add_theme_constant_override("separation", 36)
	nav.position = Vector2(460, 896)
	nav.size = Vector2(1000, 104)
	add_child(nav)
	var again := UIKit.chunk_button("PLAY AGAIN", "good")
	again.custom_minimum_size = Vector2(300, 96)
	again.add_theme_font_size_override("font_size", 38)
	again.pressed.connect(func() -> void: _leave("run"))
	nav.add_child(again)
	var garage := UIKit.chunk_button("GARAGE")
	garage.custom_minimum_size = Vector2(300, 96)
	garage.add_theme_font_size_override("font_size", 38)
	garage.pressed.connect(func() -> void: _leave("garage"))
	nav.add_child(garage)
	var home := UIKit.chunk_button("HOME", "dim")
	home.custom_minimum_size = Vector2(300, 96)
	home.add_theme_font_size_override("font_size", 38)
	home.pressed.connect(func() -> void: _leave("lobby"))
	nav.add_child(home)
	# Unlock banner.
	_unlock_banner = UIKit.outlined_label("", 44, Color(0.7, 1.0, 0.7), UIKit.font_display())
	_unlock_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_unlock_banner.position = Vector2(460, 1010)
	_unlock_banner.size = Vector2(1000, 60)
	_unlock_banner.pivot_offset = Vector2(500, 30)
	_unlock_banner.modulate.a = 0.0
	if bool(_result.stage_unlocked):
		_unlock_banner.text = "NEW WORLD UNLOCKED: %s!" % GameState.stage(int(_result.stage) + 1).name
	elif bool(_result.new_best):
		_unlock_banner.text = ""

func _cap(t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size = Vector2(960, 34)
	l.add_theme_font_size_override("font_size", 26)
	l.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	return l

func _stat_box(parent: Control, caption: String, value: String, color: Color) -> Label:
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 4)
	parent.add_child(col)
	var c := Label.new()
	c.text = caption
	c.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	c.add_theme_font_size_override("font_size", 24)
	c.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	col.add_child(c)
	var v := Label.new()
	v.text = value
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_theme_font_override("font", UIKit.font_display())
	v.add_theme_font_size_override("font_size", 54)
	v.add_theme_color_override("font_color", color)
	col.add_child(v)
	return v

# ----------------------------------------------------------------- animate
func _animate() -> void:
	var target_dist: int = int(_result.distance)
	var target_coins: int = int(_result.coins)
	var target_flips: int = int(_result.flips)
	var target_speed: int = int(_result.top_speed)
	# Counters: tween_method drives a 0..1 progress we ease ourselves.
	var counter := create_tween()
	counter.tween_method(_update_counters.bind(target_dist, target_coins, target_flips, target_speed), 0.0, 1.0, 1.4)
	# Badges.
	if bool(_result.new_best):
		var b := create_tween()
		b.tween_property(_new_best_badge, "modulate:a", 1.0, 0.01)
		b.tween_property(_new_best_badge, "scale", Vector2(1.3, 1.3), 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		b.tween_property(_new_best_badge, "scale", Vector2(1.0, 1.0), 0.15)
		AudioManager.play_sfx("best")
	if not _unlock_banner.text.is_empty():
		var u := create_tween()
		u.tween_property(_unlock_banner, "modulate:a", 1.0, 0.4).set_delay(0.6)
		AudioManager.play_sfx("unlock")

func _update_counters(k: float, d: int, c: int, f: int, s: int) -> void:
	var e := 1.0 - pow(1.0 - clampf(k, 0.0, 1.0), 3.0)
	_dist_label.text = "%dm" % int(d * e)
	_coin_label.text = str(int(c * e))
	_flip_label.text = str(int(f * e))
	_speed_label.text = "%d km/h" % int(s * e)

# ------------------------------------------------------------------- leave
func _on_double() -> void:
	_leaving = false
	_double_btn.disabled = true
	Monetization.show_rewarded("double_coins", func(ok: bool) -> void:
		_double_btn.disabled = false
		if ok:
			var coins: int = int(_result.coins)
			SaveManager.add_coins(coins)
			_coin_label.text = str(int(_result.coins) * 2)
			AudioManager.play_sfx("cash")
			EventBus.toasts.emit("Coins doubled!", "success")
		else:
			EventBus.toasts.emit("Watch the full ad to double coins", "info")
	)

func _leave(scene: String) -> void:
	if _leaving:
		return
	_leaving = true
	var go := func() -> void:
		SaveManager.flush()
		get_tree().change_scene_to_file("res://scenes/%s.tscn" % scene)
	if Monetization.can_show_interstitial():
		var done := false
		var proceed := func() -> void:
			if not done:
				done = true
				go.call()
		Monetization.show_interstitial()
		EventBus.interstitial_finished.connect(proceed, CONNECT_ONE_SHOT)
		# Safety: never hold the player for more than 12s.
		await get_tree().create_timer(12.0).timeout
		proceed.call()
	else:
		go.call()

extends Control
## Garage: pick a vehicle, buy locked ones, spend coins on 5 upgrade tracks.

const BG: GDScript = preload("res://scripts/ui/lobby_bg.gd")

var _vehicle_cards: Array = []
var _preview: Sprite2D
var _stat_labels: Dictionary = {}
var _coin_label: Label

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UIKit.make_theme()
	_build()
	_refresh()
	EventBus.coins_changed.connect(func(_v: int) -> void:
		_coin_label.text = str(SaveManager.get_coins())
	)

func _build() -> void:
	var bg: Node2D = BG.new()
	bg.z_index = -100
	add_child(bg)
	var title := UIKit.outlined_label("GARAGE", 74, Color.WHITE, UIKit.font_display())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(460, 24)
	title.size = Vector2(1000, 96)
	add_child(title)
	# Coins top-right.
	var coin_box := HBoxContainer.new()
	coin_box.position = Vector2(1560, 28)
	coin_box.add_theme_constant_override("separation", 10)
	var ci := UIKit.coin_icon(0.55)
	coin_box.add_child(ci)
	_coin_label = Label.new()
	_coin_label.text = str(SaveManager.get_coins())
	_coin_label.add_theme_font_override("font", UIKit.font_display())
	_coin_label.add_theme_font_size_override("font_size", 42)
	_coin_label.add_theme_color_override("font_color", Color.WHITE)
	coin_box.add_child(_coin_label)
	add_child(coin_box)
	# --- Preview area (left).
	var preview_panel := Panel.new()
	preview_panel.add_theme_stylebox_override("panel", UIKit.panel_style(Color(0.08, 0.1, 0.18, 0.85), Color(0.2, 0.26, 0.42), 26))
	preview_panel.position = Vector2(60, 150)
	preview_panel.size = Vector2(720, 560)
	add_child(preview_panel)
	_preview = Sprite2D.new()
	_preview.position = Vector2(420, 400)
	_preview.scale = Vector2(7.0, 7.0)
	add_child(_preview)
	var vname := Label.new()
	vname.position = Vector2(90, 180)
	vname.add_theme_font_override("font", UIKit.font_display())
	vname.add_theme_font_size_override("font_size", 54)
	vname.add_theme_color_override("font_color", Color.WHITE)
	add_child(vname)
	vname.name = "VName"
	var vtag := Label.new()
	vtag.position = Vector2(92, 250)
	vtag.add_theme_font_size_override("font_size", 26)
	vtag.add_theme_color_override("font_color", Color(1, 1, 1, 0.65))
	add_child(vtag)
	vtag.name = "VTag"
	var vbuy := UIKit.chunk_button("UNLOCK", "gold")
	vbuy.position = Vector2(92, 300)
	vbuy.custom_minimum_size = Vector2(280, 70)
	add_child(vbuy)
	vbuy.name = "VBuy"
	# Stat bars (bottom-left of preview).
	var stats := VBoxContainer.new()
	stats.position = Vector2(92, 420)
	stats.add_theme_constant_override("separation", 10)
	add_child(stats)
	for key in ["power", "grip", "tank", "air_torque", "spring_k"]:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		stats.add_child(row)
		var lb := Label.new()
		lb.text = key.to_upper().replace("_", " ")
		lb.custom_minimum_size = Vector2(170, 0)
		lb.add_theme_font_size_override("font_size", 22)
		lb.add_theme_color_override("font_color", Color(1, 1, 1, 0.75))
		row.add_child(lb)
		var bar := ColorRect.new()
		bar.custom_minimum_size = Vector2(30, 20)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(bar)
		_stat_labels[key] = bar
	# --- Vehicle cards (top-right).
	var vlist := VBoxContainer.new()
	vlist.position = Vector2(860, 150)
	vlist.add_theme_constant_override("separation", 16)
	add_child(vlist)
	for i in 3:
		var card := _vehicle_card(i)
		vlist.add_child(card)
		_vehicle_cards.append(card)
	# --- Upgrade tracks (right column below cards).
	var upg_title := Label.new()
	upg_title.text = "UPGRADES"
	upg_title.position = Vector2(862, 500)
	upg_title.add_theme_font_override("font", UIKit.font_display())
	upg_title.add_theme_font_size_override("font_size", 38)
	upg_title.add_theme_color_override("font_color", Color(1, 1, 1, 0.9))
	add_child(upg_title)
	var upg := VBoxContainer.new()
	upg.position = Vector2(860, 556)
	upg.add_theme_constant_override("separation", 12)
	add_child(upg)
	for track in GameState.UPGRADE_TRACKS:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		upg.add_child(row)
		var tname := Label.new()
		tname.text = GameState.UPGRADE_NAMES[track]
		tname.custom_minimum_size = Vector2(240, 0)
		tname.add_theme_font_size_override("font_size", 27)
		tname.add_theme_color_override("font_color", Color.WHITE)
		row.add_child(tname)
		var pips := UIKit.stat_bar(0)
		row.add_child(pips)
		row.set_meta("pips_%s" % track, pips)
		var btn := Button.new()
		btn.custom_minimum_size = Vector2(220, 54)
		btn.focus_mode = Control.FOCUS_NONE
		btn.add_theme_font_override("font", UIKit.font_body_bold())
		btn.add_theme_font_size_override("font_size", 26)
		btn.add_theme_stylebox_override("normal", UIKit.panel_style(Color(0.29, 0.87, 0.5), Color(0.16, 0.62, 0.34), 16))
		btn.add_theme_stylebox_override("hover", UIKit.panel_style(Color(0.35, 0.92, 0.55), Color(0.16, 0.62, 0.34), 16))
		btn.add_theme_stylebox_override("pressed", UIKit.panel_style(Color(0.16, 0.62, 0.34), Color(0.16, 0.62, 0.34), 16))
		btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		btn.add_theme_color_override("font_color", Color.WHITE)
		btn.pressed.connect(func() -> void: _buy_upgrade(track))
		row.add_child(btn)
		row.set_meta("btn_%s" % track, btn)
	# Back.
	var back := UIKit.chunk_button("BACK", "dim")
	back.custom_minimum_size = Vector2(300, 84)
	back.add_theme_font_size_override("font_size", 36)
	back.position = Vector2(810, 950)
	back.pressed.connect(func() -> void:
		AudioManager.play_sfx("click")
		get_tree().change_scene_to_file("res://scenes/lobby.tscn")
	)
	add_child(back)

func _vehicle_card(i: int) -> Control:
	var v: Variant = GameState.vehicles()[i]
	var root := Panel.new()
	root.custom_minimum_size = Vector2(700, 104)
	root.add_theme_stylebox_override("panel", UIKit.panel_style(Color(0.1, 0.12, 0.2, 0.9), Color(0.22, 0.28, 0.44), 18))
	var h := HBoxContainer.new()
	h.position = Vector2(18, 12)
	h.size = Vector2(664, 80)
	h.add_theme_constant_override("separation", 18)
	root.add_child(h)
	var spr := Sprite2D.new()
	spr.texture = v.body_texture
	spr.scale = Vector2(2.2, 2.2)
	spr.position = Vector2(70, 40)
	h.add_child(spr)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 2)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(col)
	var name := Label.new()
	name.text = v.name
	name.add_theme_font_override("font", UIKit.font_body_bold())
	name.add_theme_font_size_override("font_size", 32)
	name.add_theme_color_override("font_color", Color.WHITE)
	col.add_child(name)
	var status := Label.new()
	status.add_theme_font_size_override("font_size", 23)
	col.add_child(status)
	h.set_meta("status", status)
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(170, 64)
	btn.focus_mode = Control.FOCUS_NONE
	btn.add_theme_font_override("font", UIKit.font_body_bold())
	btn.add_theme_font_size_override("font_size", 26)
	btn.add_theme_color_override("font_color", Color.WHITE)
	btn.pressed.connect(func() -> void: _select_vehicle(i, status, btn))
	h.add_child(btn)
	root.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventScreenTouch and ev.pressed:
			_select_vehicle(i, status, btn)
	)
	return root

func _select_vehicle(i: int, _status: Label, _btn: Button) -> void:
	var v: Variant = GameState.vehicles()[i]
	if SaveManager.is_vehicle_unlocked(i) and i == GameState.get_selected_vehicle():
		return
	if not SaveManager.is_vehicle_unlocked(i):
		if SaveManager.get_coins() >= v.price:
			if SaveManager.spend_coins(v.price):
				SaveManager.unlock_vehicle(i)
				AudioManager.play_sfx("unlock")
				EventBus.toasts.emit("%s unlocked!" % v.name, "success")
			else:
				AudioManager.play_sfx("denied")
				_shake()
		else:
			AudioManager.play_sfx("denied")
			EventBus.toasts.emit("Need %s coins for %s" % [_fmt(v.price), v.name], "info")
			_shake()
		_refresh()
		return
	GameState.set_selected_vehicle(i)
	AudioManager.play_sfx("click")
	_refresh()

func _buy_upgrade(track: String) -> void:
	var vi: int = GameState.get_selected_vehicle()
	if SaveManager.buy_upgrade(vi, track):
		AudioManager.play_sfx("pop")
		_refresh()
	else:
		var cost := SaveManager.upgrade_cost(vi, track)
		if cost < 0:
			AudioManager.play_sfx("denied")
		else:
			AudioManager.play_sfx("denied")
			EventBus.toasts.emit("Need %s coins" % _fmt(cost), "info")
		_shake()

func _shake() -> void:
	var tw := create_tween()
	tw.tween_property(self, "position:x", 8.0, 0.04)
	tw.tween_property(self, "position:x", 0.0, 0.2).set_trans(Tween.TRANS_BACK)

func _fmt(n: int) -> String:
	var s := str(n)
	var out := ""
	var count := 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		count += 1
		if count % 3 == 0 and i > 0:
			out = "," + out
	return out

# ---------------------------------------------------------------- refresh
func _refresh() -> void:
	var vi: int = GameState.get_selected_vehicle()
	var v: Variant = GameState.vehicles()[vi]
	var stats: Dictionary = GameState.vehicle_stats(vi)
	($VName as Label).text = v.name
	($VTag as Label).text = v.tagline
	_preview.texture = v.body_texture
	var buy: Button = $VBuy
	if SaveManager.is_vehicle_unlocked(vi):
		buy.visible = false
	else:
		buy.visible = true
		buy.text = "UNLOCK  %s" % _fmt(v.price)
	# Stat bars (normalized across the fleet).
	var max_power := 0.0
	var max_tank := 0.0
	for i in 3:
		var st: Dictionary = GameState.vehicle_stats(i)
		max_power = maxf(max_power, st["power"])
		max_tank = maxf(max_tank, st["tank"])
	_stat_labels["power"].size = Vector2(330.0 * clampf(stats["power"] / (max_power * 1.25), 0.05, 1.0), 20)
	_stat_labels["power"].color = UIKit.C_ACCENT
	_stat_labels["grip"].size = Vector2(330.0 * clampf(stats["grip"] / 1.5, 0.05, 1.0), 20)
	_stat_labels["grip"].color = UIKit.C_GOOD
	_stat_labels["tank"].size = Vector2(330.0 * clampf(stats["tank"] / (max_tank * 1.2), 0.05, 1.0), 20)
	_stat_labels["tank"].color = UIKit.C_GOLD
	_stat_labels["air_torque"].size = Vector2(330.0 * clampf(stats["air_torque"] / 2.2, 0.05, 1.0), 20)
	_stat_labels["air_torque"].color = Color(0.5, 0.8, 1.0)
	_stat_labels["spring_k"].size = Vector2(330.0 * clampf(stats["spring_k"] / 1100.0, 0.05, 1.0), 20)
	_stat_labels["spring_k"].color = Color(0.8, 0.6, 1.0)
	# ColorRects inside HBox: enforce width via minimum too.
	for key in _stat_labels:
		var b: ColorRect = _stat_labels[key]
		b.custom_minimum_size = b.size
	# Vehicle cards state.
	for i in _vehicle_cards.size():
		var card: Control = _vehicle_cards[i]
		var h: HBoxContainer = card.get_child(0)
		var status: Label = h.get_meta("status")
		var btn: Button = h.get_child(h.get_child_count() - 1)
		var vd: Variant = GameState.vehicles()[i]
		var owned: bool = SaveManager.is_vehicle_unlocked(i)
		var selected: bool = i == vi
		if selected:
			card.add_theme_stylebox_override("panel", _ring(UIKit.C_ACCENT, Color(0.1, 0.12, 0.2, 0.95)))
		else:
			card.add_theme_stylebox_override("panel", _ring(Color(1, 1, 1, 0.18), Color(0.1, 0.12, 0.2, 0.9)))
		if owned:
			status.text = "OWNED" + ("  •  SELECTED" if selected else "")
			status.add_theme_color_override("font_color", UIKit.C_GOOD if selected else Color(1, 1, 1, 0.55))
			btn.text = "SELECT" if not selected else "DRIVING"
			btn.disabled = selected
		else:
			status.text = "LOCKED"
			status.add_theme_color_override("font_color", Color(1, 0.6, 0.5))
			btn.text = "%s" % _fmt(vd.price)
			btn.disabled = false
	# Upgrade rows.
	for track in GameState.UPGRADE_TRACKS:
		var row: HBoxContainer = _find_row(track)
		if row == null:
			continue
		var pips: HBoxContainer = row.get_meta("pips_%s" % track)
		var btn: Button = row.get_meta("btn_%s" % track)
		var lvl: int = SaveManager.upgrade_level(vi, track)
		for i in 5:
			var c: ColorRect = pips.get_child(i)
			c.color = UIKit.C_GOOD if i < lvl else Color(0.22, 0.26, 0.38)
		var cost := SaveManager.upgrade_cost(vi, track)
		if cost < 0:
			btn.text = "MAX"
			btn.disabled = true
			btn.add_theme_stylebox_override("normal", UIKit.panel_style(Color(0.4, 0.44, 0.56), Color(0.25, 0.28, 0.38), 16))
		else:
			btn.text = "%s" % _fmt(cost)
			btn.disabled = false
			btn.add_theme_stylebox_override("normal", UIKit.panel_style(Color(0.29, 0.87, 0.5), Color(0.16, 0.62, 0.34), 16))

func _find_row(track: String) -> HBoxContainer:
	# Upgrade rows live in the last VBox before BACK; locate by meta.
	var upg: VBoxContainer = null
	for c in get_children():
		if c is VBoxContainer and c.position.y == 556:
			upg = c
			break
	if upg == null:
		return null
	for row in upg.get_children():
		if row is HBoxContainer and row.has_meta("pips_%s" % track):
			return row
	return null

func _ring(border: Color, bg: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(18)
	s.border_width_left = 4
	s.border_width_right = 4
	s.border_width_top = 4
	s.border_width_bottom = 4
	s.border_color = border
	return s

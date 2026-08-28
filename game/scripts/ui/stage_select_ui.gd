extends Control
## Stage (world) selection: four biome cards with best distance, lock state
## and unlock requirements.

const BG: GDScript = preload("res://scripts/ui/lobby_bg.gd")

var _cards: Array = []

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UIKit.make_theme()
	_build()
	_refresh()

func _build() -> void:
	var bg: Node2D = BG.new()
	bg.z_index = -100
	add_child(bg)
	var title := UIKit.outlined_label("CHOOSE WORLD", 74, Color.WHITE, UIKit.font_display())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(460, 40)
	title.size = Vector2(1000, 100)
	add_child(title)
	var sub := Label.new()
	sub.text = "Each world has its own terrain, weather and risks."
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.position = Vector2(460, 132)
	sub.size = Vector2(1000, 40)
	sub.add_theme_font_size_override("font_size", 26)
	sub.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	add_child(sub)
	# 2x2 card grid.
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 36)
	grid.add_theme_constant_override("v_separation", 36)
	grid.position = Vector2(300, 200)
	grid.size = Vector2(1320, 640)
	add_child(grid)
	for i in 4:
		var card := _make_card(i)
		grid.add_child(card)
		_cards.append(card)
	var back := UIKit.chunk_button("BACK", "dim")
	back.custom_minimum_size = Vector2(300, 90)
	back.add_theme_font_size_override("font_size", 38)
	back.position = Vector2(810, 890)
	back.pressed.connect(_back)
	add_child(back)

func _make_card(i: int) -> Control:
	var s: Variant = GameState.stage(i)
	var root := Panel.new()
	root.custom_minimum_size = Vector2(630, 290)
	var grad := Gradient.new()
	grad.set_color(0, s.sky_top.darkened(0.25))
	grad.set_color(1, s.ground_mid.darkened(0.35))
	var gtx := GradientTexture2D.new()
	gtx.gradient = grad
	gtx.fill_from = Vector2(0, 0)
	gtx.fill_to = Vector2(0, 1)
	var tex := TextureRect.new()
	tex.texture = gtx
	tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex.stretch_mode = TextureRect.STRETCH_SCALE
	tex.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(tex)
	var frame := Panel.new()
	frame.add_theme_stylebox_override("panel", _box(Color(0.05, 0.06, 0.12, 0.55), 18))
	frame.position = Vector2(14, 14)
	frame.size = Vector2(602, 262)
	root.add_child(frame)
	var v := VBoxContainer.new()
	v.position = Vector2(34, 30)
	v.size = Vector2(560, 230)
	v.add_theme_constant_override("separation", 8)
	frame.add_child(v)
	var name_lb := Label.new()
	name_lb.text = s.name.to_upper()
	name_lb.add_theme_font_override("font", UIKit.font_display())
	name_lb.add_theme_font_size_override("font_size", 46)
	name_lb.add_theme_color_override("font_color", Color.WHITE)
	v.add_child(name_lb)
	var tag := Label.new()
	tag.text = s.tagline
	tag.add_theme_font_size_override("font_size", 24)
	tag.add_theme_color_override("font_color", Color(1, 1, 1, 0.72))
	tag.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tag.custom_minimum_size = Vector2(540, 0)
	v.add_child(tag)
	var meta := HBoxContainer.new()
	meta.add_theme_constant_override("separation", 16)
	v.add_child(meta)
	var best := Label.new()
	best.text = "BEST  %dm" % SaveManager.best_distance(i)
	best.add_theme_font_size_override("font_size", 26)
	best.add_theme_color_override("font_color", UIKit.C_GOLD)
	meta.add_child(best)
	var lock_lb := Label.new()
	lock_lb.text = ""
	lock_lb.add_theme_font_size_override("font_size", 24)
	lock_lb.add_theme_color_override("font_color", Color(1, 0.6, 0.5))
	meta.add_child(lock_lb)
	# Selection ring + tint.
	var ring := Panel.new()
	ring.add_theme_stylebox_override("panel", _box(Color.TRANSPARENT, 6))
	ring.position = Vector2(8, 8)
	ring.size = Vector2(614, 274)
	root.add_child(ring)
	root.set_meta("ring", ring)
	root.set_meta("best", best)
	root.set_meta("lock", lock_lb)
	root.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventScreenTouch and ev.pressed:
			_select(i)
	)
	# Hover cursor hint.
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	return root

func _box(bg: Color, radius: int) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	if bg.a > 0.0:
		s.border_width_left = 2
		s.border_width_right = 2
		s.border_width_top = 2
		s.border_width_bottom = 2
		s.border_color = Color(1, 1, 1, 0.2)
	return s

func _refresh() -> void:
	var sel: int = GameState.get_selected_stage()
	for i in _cards.size():
		var card: Control = _cards[i]
		var ring: Panel = card.get_meta("ring")
		var best: Label = card.get_meta("best")
		var lock: Label = card.get_meta("lock")
		var s: Variant = GameState.stage(i)
		best.text = "BEST  %dm" % SaveManager.best_distance(i)
		if SaveManager.is_stage_unlocked(i):
			lock.text = ""
		else:
			var req: int = int({1: 400, 2: 900, 3: 1600}.get(i, 0))
			lock.text = "LOCKED — reach %dm in any world" % req
		if i == sel:
			ring.add_theme_stylebox_override("panel", _ring_box(UIKit.C_ACCENT))
		else:
			ring.add_theme_stylebox_override("panel", _ring_box(Color(1, 1, 1, 0.25)))

func _ring_box(color: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.set_corner_radius_all(20)
	s.border_width_left = 5
	s.border_width_right = 5
	s.border_width_top = 5
	s.border_width_bottom = 5
	s.border_color = color
	return s

func _select(i: int) -> void:
	if not SaveManager.is_stage_unlocked(i):
		AudioManager.play_sfx("denied")
		var tw := create_tween()
		tw.tween_property(self, "position:x", 10.0, 0.05)
		tw.tween_property(self, "position:x", 0.0, 0.25).set_trans(Tween.TRANS_BACK)
		return
	AudioManager.play_sfx("click")
	GameState.set_selected_stage(i)
	_refresh()

func _back() -> void:
	AudioManager.play_sfx("click")
	get_tree().change_scene_to_file("res://scenes/lobby.tscn")

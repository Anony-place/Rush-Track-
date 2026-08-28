extends Control
## Main lobby: logo, PLAY, navigation, coins, version. Animated entrance.

const BG: GDScript = preload("res://scripts/ui/lobby_bg.gd")

var _coin_label: Label
var _vehicle_card: Label
var _stage_card: Label
var _logo: TextureRect
var _vehicle_sprite: Sprite2D
var _toast_root: Control = null

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UIKit.make_theme()
	_build()
	_refresh_meta()
	_animate_in()
	EventBus.coins_changed.connect(func(_v: int) -> void:
		_coin_label.text = str(SaveManager.get_coins())
	)
	# Mock/backend toasts (ads, IAP).
	EventBus.toasts.connect(_on_toast)
	# Show the lobby banner (hidden if remove-ads owned).
	Monetization.banner_node = _make_banner()
	Monetization.show_banner()

func _exit_tree() -> void:
	Monetization.hide_banner()
	Monetization.banner_node = null

# ------------------------------------------------------------------ build
func _build() -> void:
	var bg: Node2D = BG.new()
	bg.z_index = -100
	add_child(bg)
	# --- Top bar: coins + shop + settings.
	var top := HBoxContainer.new()
	top.position = Vector2(28, 18)
	top.size = Vector2(1864, 92)
	top.add_theme_constant_override("separation", 18)
	add_child(top)
	var coin_box := HBoxContainer.new()
	coin_box.add_theme_constant_override("separation", 12)
	var ci := UIKit.coin_icon(0.62)
	coin_box.add_child(ci)
	_coin_label = Label.new()
	_coin_label.text = str(SaveManager.get_coins())
	_coin_label.add_theme_font_override("font", UIKit.font_display())
	_coin_label.add_theme_font_size_override("font_size", 46)
	_coin_label.add_theme_color_override("font_color", Color.WHITE)
	_coin_label.add_theme_color_override("font_outline_color", Color(0.05, 0.06, 0.12))
	_coin_label.add_theme_constant_override("outline_size", 8)
	coin_box.add_child(_coin_label)
	var coin_panel := Panel.new()
	coin_panel.add_theme_stylebox_override("panel", _pill(Color(0.1, 0.12, 0.2, 0.72), 30))
	coin_panel.custom_minimum_size = Vector2(230, 76)
	coin_panel.add_child(coin_box)
	coin_box.position = Vector2(24, 12)
	top.add_child(coin_panel)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(spacer)
	var shop_btn := UIKit.chunk_button("SHOP", "gold")
	shop_btn.custom_minimum_size = Vector2(190, 74)
	shop_btn.pressed.connect(func() -> void: _nav("shop"))
	top.add_child(shop_btn)
	var set_btn := UIKit.chunk_button("SETTINGS", "dim")
	set_btn.custom_minimum_size = Vector2(220, 74)
	set_btn.pressed.connect(func() -> void: _nav("settings"))
	top.add_child(set_btn)
	# --- Logo.
	_logo = TextureRect.new()
	_logo.texture = load("res://assets/ui/logo.png")
	_logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_logo.custom_minimum_size = Vector2(760, 240)
	_logo.position = Vector2(960 - 380, 150)
	_logo.pivot_offset = Vector2(380, 120)
	add_child(_logo)
	# --- PLAY.
	var play := UIKit.chunk_button("PLAY", "good")
	play.custom_minimum_size = Vector2(460, 118)
	play.add_theme_font_size_override("font_size", 58)
	play.position = Vector2(960 - 230, 452)
	play.pressed.connect(_start_run)
	add_child(play)
	# --- Nav row: stages / garage.
	var nav := HBoxContainer.new()
	nav.add_theme_constant_override("separation", 40)
	nav.alignment = BoxContainer.ALIGNMENT_CENTER
	nav.position = Vector2(460, 610)
	nav.size = Vector2(1000, 100)
	add_child(nav)
	var stages_btn := UIKit.chunk_button("STAGES")
	stages_btn.custom_minimum_size = Vector2(300, 92)
	stages_btn.add_theme_font_size_override("font_size", 40)
	stages_btn.pressed.connect(func() -> void: _nav("stages"))
	nav.add_child(stages_btn)
	var garage_btn := UIKit.chunk_button("GARAGE")
	garage_btn.custom_minimum_size = Vector2(300, 92)
	garage_btn.add_theme_font_size_override("font_size", 40)
	garage_btn.pressed.connect(func() -> void: _nav("garage"))
	nav.add_child(garage_btn)
	# --- Selected vehicle / stage line.
	_vehicle_card = UIKit.outlined_label("", 30, Color(1, 1, 1, 0.9), UIKit.font_body_bold())
	_vehicle_card.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_vehicle_card.position = Vector2(460, 740)
	_vehicle_card.size = Vector2(1000, 50)
	add_child(_vehicle_card)
	_stage_card = UIKit.outlined_label("", 26, Color(1, 1, 1, 0.65), UIKit.font_body())
	_stage_card.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_stage_card.position = Vector2(460, 790)
	_stage_card.size = Vector2(1000, 44)
	add_child(_stage_card)
	# --- Idle vehicle on the grass.
	_vehicle_sprite = Sprite2D.new()
	_vehicle_sprite.position = Vector2(1560, 830)
	_vehicle_sprite.scale = Vector2(2.6, 2.6)
	add_child(_vehicle_sprite)
	# --- Version.
	var ver := Label.new()
	ver.text = "v%s  •  RUSH TRACK" % str(Engine.get_version_info()["string"])
	ver.position = Vector2(28, 1032)
	ver.add_theme_font_size_override("font_size", 22)
	ver.add_theme_color_override("font_color", Color(1, 1, 1, 0.45))
	add_child(ver)
	# Toasts.
	_toast_root = Control.new()
	_toast_root.position = Vector2(460, 140)
	_toast_root.size = Vector2(1000, 120)
	add_child(_toast_root)


func _make_banner() -> Control:
	# Mock banner strip (hidden unless mock ads are active).
	var b := Panel.new()
	b.add_theme_stylebox_override("panel", _pill(Color(0.14, 0.16, 0.26, 0.92), 18))
	b.position = Vector2(560, 986)
	b.size = Vector2(800, 74)
	b.visible = false
	var lb := Label.new()
	lb.text = "AD  •  Mock banner (install AdMob add-on for live ads)"
	lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lb.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lb.set_anchors_preset(Control.PRESET_FULL_RECT)
	lb.add_theme_font_size_override("font_size", 24)
	lb.add_theme_color_override("font_color", Color(0.8, 0.85, 0.95))
	b.add_child(lb)
	add_child(b)
	return b

# ------------------------------------------------------------------ logic
func _refresh_meta() -> void:
	var v: Variant = GameState.vehicles()[GameState.get_selected_vehicle()]
	var s: Variant = GameState.stage(GameState.get_selected_stage())
	_vehicle_card.text = "%s   —   %s" % [v.name, v.tagline]
	_stage_card.text = "Riding in: %s" % s.name
	_vehicle_sprite.texture = v.body_texture

func _start_run() -> void:
	AudioManager.play_sfx("go")
	SaveManager.flush()
	get_tree().change_scene_to_file("res://scenes/run.tscn")

func _nav(scene: String) -> void:
	AudioManager.play_sfx("click")
	get_tree().change_scene_to_file("res://scenes/%s.tscn" % scene)

func _on_toast(text: String, kind: String) -> void:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", _pill(Color(0.13, 0.15, 0.25, 0.95), 22))
	p.size = Vector2(640, 64)
	p.position = Vector2(960 - 320, _toast_root.position.y + 20)
	var lb := Label.new()
	lb.text = text
	lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lb.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lb.set_anchors_preset(Control.PRESET_FULL_RECT)
	lb.add_theme_font_size_override("font_size", 26)
	var color := Color(1, 1, 1)
	if kind == "success":
		color = Color(0.6, 1.0, 0.7)
	elif kind == "info":
		color = Color(0.75, 0.85, 1.0)
	lb.add_theme_color_override("font_color", color)
	p.add_child(lb)
	_toast_root.add_child(p)
	p.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(p, "modulate:a", 1.0, 0.2)
	tw.tween_property(p, "modulate:a", 1.0, 1.6)
	tw.tween_property(p, "modulate:a", 0.0, 0.4)
	tw.tween_callback(p.queue_free)

func _pill(bg: Color, radius: int) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.border_width_left = 2
	s.border_width_right = 2
	s.border_width_top = 2
	s.border_width_bottom = 2
	s.border_color = Color(1, 1, 1, 0.18)
	return s

# -------------------------------------------------------------- animation
func _animate_in() -> void:
	# Logo: drop + settle.
	_logo.modulate.a = 0.0
	_logo.position.y -= 60
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(_logo, "modulate:a", 1.0, 0.4)
	tw.tween_property(_logo, "position:y", 150.0, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# Gentle perpetual logo pulse.
	var pulse := create_tween().set_loops()
	pulse.tween_property(_logo, "scale", Vector2(1.02, 1.02), 1.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	pulse.tween_property(_logo, "scale", Vector2(1.0, 1.0), 1.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	# Idle vehicle bob.
	var bob := create_tween().set_loops()
	bob.tween_property(_vehicle_sprite, "position:y", 822.0, 0.9).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	bob.tween_property(_vehicle_sprite, "position:y", 830.0, 0.9).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

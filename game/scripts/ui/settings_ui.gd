extends Control
## Settings: audio volumes, vibration, particle quality, reset save, credits.

const BG: GDScript = preload("res://scripts/ui/lobby_bg.gd")

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UIKit.make_theme()
	_build()

func _build() -> void:
	var bg: Node2D = BG.new()
	bg.z_index = -100
	add_child(bg)
	var title := UIKit.outlined_label("SETTINGS", 74, Color.WHITE, UIKit.font_display())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(460, 36)
	title.size = Vector2(1000, 100)
	add_child(title)
	var panel := UIKit.panel(28)
	panel.position = Vector2(560, 160)
	panel.size = Vector2(800, 620)
	add_child(panel)
	var v := VBoxContainer.new()
	v.position = Vector2(96, 196)
	v.add_theme_constant_override("separation", 26)
	panel.add_child(v)
	# Volume sliders.
	for key in ["music_volume", "sfx_volume", "engine_volume"]:
		var names := {"music_volume": "MUSIC", "sfx_volume": "SFX", "engine_volume": "ENGINE"}
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 24)
		v.add_child(row)
		var lb := Label.new()
		lb.text = names[key]
		lb.custom_minimum_size = Vector2(220, 0)
		lb.add_theme_font_size_override("font_size", 28)
		lb.add_theme_color_override("font_color", Color.WHITE)
		row.add_child(lb)
		var sl := HSlider.new()
		sl.custom_minimum_size = Vector2(420, 34)
		sl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sl.min_value = 0.0
		sl.max_value = 1.0
		sl.step = 0.05
		sl.value = float(SaveManager.read("settings.%s" % key, 0.8))
		sl.value_changed.connect(func(val: float) -> void:
			SaveManager.write("settings.%s" % key, val)
		)
		row.add_child(sl)
	# Toggles.
	v.add_child(_toggle_row("VIBRATION", "settings.vibration", true))
	v.add_child(_toggle_row("HIGH PARTICLES", "settings.particle_quality", true, ["high", "low"]))
	# Reset save.
	var reset := UIKit.chunk_button("RESET ALL PROGRESS", "bad")
	reset.custom_minimum_size = Vector2(420, 74)
	reset.add_theme_font_size_override("font_size", 28)
	reset.pressed.connect(_confirm_reset)
	v.add_child(reset)
	# Credits.
	var credits := Label.new()
	credits.text = "RUSH TRACK v1.0.0 — built with Godot 4\nMade for Android. Drive far. Flip harder."
	credits.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	credits.add_theme_font_size_override("font_size", 22)
	credits.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
	v.add_child(credits)
	# Back.
	var back := UIKit.chunk_button("BACK", "dim")
	back.custom_minimum_size = Vector2(300, 84)
	back.add_theme_font_size_override("font_size", 36)
	back.position = Vector2(810, 940)
	back.pressed.connect(func() -> void:
		AudioManager.play_sfx("click")
		SaveManager.flush()
		get_tree().change_scene_to_file("res://scenes/lobby.tscn")
	)
	add_child(back)

func _toggle_row(label: String, path: String, default: bool, options: Array = []) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	var lb := Label.new()
	lb.text = label
	lb.custom_minimum_size = Vector2(220, 0)
	lb.add_theme_font_size_override("font_size", 28)
	lb.add_theme_color_override("font_color", Color.WHITE)
	row.add_child(lb)
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(220, 56)
	btn.focus_mode = Control.FOCUS_NONE
	btn.add_theme_font_override("font", UIKit.font_body_bold())
	btn.add_theme_font_size_override("font_size", 26)
	btn.add_theme_color_override("font_color", Color.WHITE)
	var refresh := func() -> void:
		if options.is_empty():
			var on: bool = bool(SaveManager.read(path, default))
			btn.text = "ON" if on else "OFF"
			btn.add_theme_stylebox_override("normal", UIKit.panel_style(
				Color(0.29, 0.87, 0.5) if on else Color(0.3, 0.36, 0.5),
				Color(0.16, 0.62, 0.34) if on else Color(0.2, 0.25, 0.36), 16))
		else:
			var val: String = str(SaveManager.read(path, options[0]))
			btn.text = val.to_upper()
			btn.add_theme_stylebox_override("normal", UIKit.panel_style(
				Color(0.45, 0.6, 0.95), Color(0.28, 0.4, 0.7), 16))
	refresh.call()
	btn.pressed.connect(func() -> void:
		if options.is_empty():
			SaveManager.write(path, not bool(SaveManager.read(path, default)))
		else:
			var cur: String = str(SaveManager.read(path, options[0]))
			var next: String = options[(options.find(cur) + 1) % options.size()]
			SaveManager.write(path, next)
		AudioManager.play_sfx("click")
		refresh.call()
	)
	row.add_child(btn)
	return row

func _confirm_reset() -> void:
	var dlg := ConfirmationDialog.new()
	dlg.dialog_text = "Reset ALL progress? Coins, vehicles, upgrades and records will be lost. This cannot be undone."
	dlg.ok_button_text = "RESET"
	dlg.cancel_button_text = "KEEP MY STUFF"
	dlg.position = Vector2(560, 400)
	dlg.size = Vector2(800, 280)
	add_child(dlg)
	dlg.confirmed.connect(func() -> void:
		SaveManager._data = SaveManager.default_data()
		SaveManager.save()
		SaveManager.flush()
		AudioManager.play_sfx("sad")
		get_tree().change_scene_to_file("res://scenes/lobby.tscn")
	)
	dlg.popup_centered()

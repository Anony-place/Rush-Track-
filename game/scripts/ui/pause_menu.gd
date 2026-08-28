extends CanvasLayer
## Pause overlay. Shown when the run is paused; dim background + panel with
## Resume / Restart / Quit, quick sound toggles and volume sliders.


var _layer: Control
var _visible: bool = false
var stage_index: int = 0
var vehicle_index: int = 0

func setup(st: int, v: int) -> void:
	stage_index = st
	vehicle_index = v
	_build()

func _ready() -> void:
	layer = 50
	process_mode = ProcessMode.PROCESS_MODE_ALWAYS
	if not _layer:
		_build()

func _build() -> void:
	_layer = Control.new()
	_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.visible = false
	add_child(_layer)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.03, 0.08, 0.62)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(center)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(640, 0)
	box.add_theme_constant_override("separation", 22)
	center.add_child(box)
	var title := UIKit.outlined_label("PAUSED", 72, Color.WHITE, UIKit.font_display())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	var stage_lb := Label.new()
	stage_lb.text = "%s  •  %s" % [GameState.stage(stage_index).name, GameState.vehicles()[vehicle_index].name]
	stage_lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stage_lb.add_theme_font_size_override("font_size", 28)
	stage_lb.add_theme_color_override("font_color", UIKit.C_TEXT_DIM)
	box.add_child(stage_lb)
	box.add_child(UIKit.chunk_button("RESUME", "good"))
	box.get_child(box.get_child_count() - 1).pressed.connect(_resume)
	box.add_child(UIKit.chunk_button("RESTART RUN", "accent"))
	box.get_child(box.get_child_count() - 1).pressed.connect(_restart)
	box.add_child(UIKit.chunk_button("QUIT TO LOBBY", "dim"))
	box.get_child(box.get_child_count() - 1).pressed.connect(_quit)
	# Quick volume sliders.
	var slider_row := HBoxContainer.new()
	slider_row.add_theme_constant_override("separation", 40)
	slider_row.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_child(slider_row)
	for key in ["music_volume", "sfx_volume", "engine_volume"]:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 2)
		slider_row.add_child(col)
		var cap := Label.new()
		var names := {"music_volume": "MUSIC", "sfx_volume": "SFX", "engine_volume": "ENGINE"}
		cap.text = names.get(key, key)
		cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cap.add_theme_font_size_override("font_size", 22)
		cap.add_theme_color_override("font_color", UIKit.C_TEXT_DIM)
		col.add_child(cap)
		var sl := HSlider.new()
		sl.custom_minimum_size = Vector2(170, 30)
		sl.min_value = 0.0
		sl.max_value = 1.0
		sl.step = 0.05
		sl.value = float(SaveManager.read("settings.%s" % key, 0.8))
		sl.value_changed.connect(func(v: float) -> void:
			SaveManager.write("settings.%s" % key, v)
		)
		col.add_child(sl)
	# Pause via action.
	EventBus.settings_changed.connect(_noop)

func _noop(_k: String) -> void:
	pass

func _unhandled_input(event: InputEvent) -> void:
	if _visible and (event.is_action_pressed("pause") or event.is_action_pressed("ui_cancel")):
		_resume()

func show_menu() -> void:
	_visible = true
	_layer.visible = true
	var tw := create_tween()
	tw.tween_property(_layer, "modulate:a", 1.0, 0.15)

func _resume() -> void:
	_visible = false
	_layer.visible = false
	get_tree().paused = false

func _restart() -> void:
	get_tree().paused = false
	AudioManager.play_sfx("whoosh")
	get_tree().change_scene_to_file("res://scenes/run.tscn")

func _quit() -> void:
	get_tree().paused = false
	SaveManager.flush()
	AudioManager.play_theme("menu_theme")
	get_tree().change_scene_to_file("res://scenes/lobby.tscn")

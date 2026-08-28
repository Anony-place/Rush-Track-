extends Control
## One touch pedal (gas / brake). Large invisible input area + a chunky
## plate that depresses while held. Feeds the engine input map via
## Input.action_press / Input.action_release so touch and keyboard share
## one code path.

var action: String = "gas"
var plate_color: Color = Color(1.0, 0.54, 0.05)
var edge_color: Color = Color(0.85, 0.38, 0.0)
var icon: String = "GAS"

var _plate: Panel
var _held: bool = false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	gui_input.connect(_on_gui)
	_plate = Panel.new()
	_plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_plate.add_theme_stylebox_override("panel", _make_style(plate_color.darkened(0.12)))
	_plate.set_anchors_preset(Control.PRESET_FULL_RECT)
	_plate.offset_left = 18
	_plate.offset_top = 18
	_plate.offset_right = -18
	_plate.offset_bottom = -18
	add_child(_plate)
	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 4)
	_plate.add_child(v)
	var chev := Label.new()
	chev.text = "▲▲▲"
	chev.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	chev.add_theme_font_size_override("font_size", 34)
	chev.add_theme_color_override("font_color", Color(1, 1, 1, 0.55))
	v.add_child(chev)
	var txt := Label.new()
	txt.text = icon
	txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	txt.add_theme_font_override("font", load("res://assets/fonts/Nunito-Black.ttf"))
	txt.add_theme_font_size_override("font_size", 64)
	txt.add_theme_color_override("font_color", Color(1, 1, 1, 0.85))
	v.add_child(txt)

func _make_style(bg: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(28)
	s.border_width_bottom = 12
	s.border_color = edge_color
	return s

func _on_gui(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_set_held(event.pressed)
	elif event is InputEventScreenDrag and _held:
		if not _in_plate(event.position):
			_set_held(false)

func _in_plate(p: Vector2) -> bool:
	return Rect2(Vector2(10, 10), size - Vector2(20, 20)).has_point(p)

func _set_held(h: bool) -> void:
	if h == _held:
		return
	_held = h
	if h:
		Input.action_press(action)
	else:
		Input.action_release(action)
	_plate.add_theme_stylebox_override("panel", _make_style(plate_color if h else plate_color.darkened(0.12)))
	var tw := create_tween()
	tw.tween_property(_plate, "position:y", 8.0 if h else 0.0, 0.06)

func release() -> void:
	_set_held(false)

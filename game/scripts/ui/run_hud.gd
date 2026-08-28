extends CanvasLayer
## In-run HUD: distance, fuel, coins, pedals, popups, countdown, pause.
## Screen-space; built in code with the ui_kit design system.

const PEDAL: GDScript = preload("res://scripts/ui/pedal.gd")

signal pause_requested

var _root: Control
var _run: Node = null
var _stage: Variant = null
var _dist: Label
var _best: Label
var _coin: Label
var _coin_box: HBoxContainer
var _fuel_panel: Panel
var _fuel_fill: ColorRect
var _pedal_gas: Control
var _pedal_brake: Control
var _popup: Label
var _countdown: Label
var _banner: Label
var _tip: Panel

func setup(st: Variant, stage_index: int, vehicle_index: int) -> void:
	_stage = st
	_run = get_parent()
	_build()
	if not SaveManager.read("seen.first_run_tip", false):
		_show_tip("Hold GAS to drive — flip in the air for big coin bonuses!")

# ------------------------------------------------------------------ build
func _build() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	var safe := Rect2(0, 14, 1920, 1066)
	# --- Distance (top-left).
	_dist = UIKit.outlined_label("0m", 64, Color.WHITE, UIKit.font_display())
	_dist.position = safe.position + Vector2(24, 18)
	_root.add_child(_dist)
	_best = UIKit.outlined_label("BEST 0m", 26, Color(1, 1, 1, 0.75), UIKit.font_body_bold())
	_best.position = safe.position + Vector2(28, 96)
	_root.add_child(_best)
	# --- Coins (top-right).
	_coin_box = HBoxContainer.new()
	_coin_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_coin_box.add_theme_constant_override("separation", 12)
	var cicon := UIKit.coin_icon(0.55)
	_coin_box.add_child(cicon)
	_coin = Label.new()
	_coin.text = str(SaveManager.get_coins())
	_coin.add_theme_font_override("font", UIKit.font_display())
	_coin.add_theme_font_size_override("font_size", 44)
	_coin.add_theme_color_override("font_color", Color.WHITE)
	_coin.add_theme_color_override("font_outline_color", Color(0.05, 0.06, 0.12))
	_coin.add_theme_constant_override("outline_size", 8)
	_coin_box.add_child(_coin)
	_coin_box.position = Vector2(1560, 26)
	_root.add_child(_coin_box)
	# --- Fuel gauge (top-center).
	_fuel_panel = Panel.new()
	_fuel_panel.add_theme_stylebox_override("panel", _bar_style(Color(0.1, 0.12, 0.2, 0.8), 14))
	_fuel_panel.custom_minimum_size = Vector2(360, 46)
	_fuel_panel.position = Vector2(780, 22)
	_root.add_child(_fuel_panel)
	var fuel_icon := TextureRect.new()
	fuel_icon.texture = load("res://assets/ui/icon_fuel.png")
	fuel_icon.custom_minimum_size = Vector2(36, 36)
	fuel_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	fuel_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	fuel_icon.position = Vector2(-46, 5)
	_fuel_panel.add_child(fuel_icon)
	_fuel_fill = ColorRect.new()
	_fuel_fill.color = Color(0.98, 0.78, 0.2)
	_fuel_fill.position = Vector2(6, 6)
	_fuel_fill.size = Vector2(348, 34)
	_fuel_fill.pivot_offset = Vector2(174, 17)
	_fuel_panel.add_child(_fuel_fill)
	# --- Pause button (top-right corner).
	var pause_btn := Button.new()
	pause_btn.text = "II"
	pause_btn.custom_minimum_size = Vector2(84, 72)
	pause_btn.position = Vector2(1816, 16)
	pause_btn.focus_mode = Control.FOCUS_NONE
	pause_btn.add_theme_font_override("font", UIKit.font_body_bold())
	pause_btn.add_theme_font_size_override("font_size", 34)
	pause_btn.add_theme_stylebox_override("normal", _bar_style(Color(0.1, 0.12, 0.2, 0.75), 18))
	pause_btn.add_theme_stylebox_override("hover", _bar_style(Color(0.16, 0.2, 0.32, 0.9), 18))
	pause_btn.add_theme_stylebox_override("pressed", _bar_style(Color(0.1, 0.12, 0.2, 0.95), 18))
	pause_btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	pause_btn.add_theme_color_override("font_color", Color.WHITE)
	pause_btn.pressed.connect(_on_pause_pressed)
	_root.add_child(pause_btn)
	# --- Pedals (bottom corners).
	_pedal_brake = PEDAL.new()
	_pedal_brake.action = "brake"
	_pedal_brake.icon = "BRAKE"
	_pedal_brake.plate_color = Color(0.86, 0.3, 0.3)
	_pedal_brake.edge_color = Color(0.6, 0.16, 0.18)
	_pedal_brake.position = Vector2(26, 890)
	_pedal_brake.size = Vector2(330, 168)
	_root.add_child(_pedal_brake)
	_pedal_gas = PEDAL.new()
	_pedal_gas.action = "gas"
	_pedal_gas.icon = "GAS"
	_pedal_gas.position = Vector2(1564, 890)
	_pedal_gas.size = Vector2(330, 168)
	_root.add_child(_pedal_gas)
	# --- Center popups.
	_popup = UIKit.outlined_label("", 58, Color(1, 0.85, 0.25), UIKit.font_display())
	_popup.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_popup.position = Vector2(460, 300)
	_popup.size = Vector2(1000, 90)
	_popup.pivot_offset = Vector2(500, 45)
	_popup.modulate.a = 0.0
	_root.add_child(_popup)
	_countdown = UIKit.outlined_label("", 180, Color.WHITE, UIKit.font_display())
	_countdown.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_countdown.position = Vector2(660, 410)
	_countdown.size = Vector2(600, 260)
	_countdown.pivot_offset = Vector2(300, 130)
	_countdown.modulate.a = 0.0
	_root.add_child(_countdown)
	_banner = UIKit.outlined_label("", 46, Color.WHITE, UIKit.font_display())
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.position = Vector2(460, 420)
	_banner.size = Vector2(1000, 80)
	_banner.pivot_offset = Vector2(500, 40)
	_banner.modulate.a = 0.0
	_root.add_child(_banner)
	# --- Live signals.
	EventBus.fuel_changed.connect(_on_fuel_changed)
	EventBus.coins_changed.connect(func(v: int) -> void:
		_coin.text = str(v)
		_pulse(_coin_box)
	)

func _pulse(node: Control) -> void:
	var tw := create_tween()
	tw.tween_property(node, "scale", Vector2(1.18, 1.18), 0.07)
	tw.tween_property(node, "scale", Vector2(1, 1), 0.12)

func _bar_style(bg: Color, radius: int) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.border_width_left = 2
	s.border_width_right = 2
	s.border_width_top = 2
	s.border_width_bottom = 2
	s.border_color = Color(1, 1, 1, 0.25)
	return s

# ---------------------------------------------------------------- display
func _process(_delta: float) -> void:
	if _stage == null or _run == null:
		return
	_dist.text = "%dm" % int(_run.distance_m)
	_best.text = "BEST %dm" % SaveManager.best_distance(_stage.index)

func pulse_coins() -> void:
	_pulse(_coin_box)

func pulse_fuel() -> void:
	var tw := create_tween()
	tw.tween_property(_fuel_fill, "modulate", Color(1.5, 1.5, 1.5), 0.1)
	tw.tween_property(_fuel_fill, "modulate", Color.WHITE, 0.3)

func _on_fuel_changed(frac: float) -> void:
	_fuel_fill.size.x = 348.0 * clampf(frac, 0.0, 1.0)
	if frac < 0.25:
		_fuel_fill.color = Color(1.0, 0.35, 0.25, 0.55 + 0.45 * absf(sin(Time.get_ticks_msec() / 180.0)))
	elif frac < 0.5:
		_fuel_fill.color = Color(1.0, 0.6, 0.2)
	else:
		_fuel_fill.color = Color(0.98, 0.78, 0.2)

func show_countdown(n: int) -> void:
	_countdown.text = "GO!" if n < 0 else str(n)
	_countdown.modulate.a = 1.0
	_countdown.scale = Vector2(1.7, 1.7)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(_countdown, "scale", Vector2(1, 1), 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if n >= 0:
		tw.parallel().tween_property(_countdown, "modulate:a", 0.0, 0.25).set_delay(0.4)

func show_flip_popup(text: String) -> void:
	_popup.text = text
	_popup.modulate.a = 1.0
	_popup.scale = Vector2(0.6, 0.6)
	var tw := create_tween()
	tw.tween_property(_popup, "scale", Vector2(1.15, 1.15), 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(_popup, "scale", Vector2(1.0, 1.0), 0.1)
	tw.parallel().tween_property(_popup, "modulate:a", 0.0, 0.3).set_delay(0.9)

func show_milestone(m: int) -> void:
	_banner.text = "%d m — KEEP GOING!" % m
	_banner.add_theme_color_override("font_color", Color(1, 1, 1))
	_banner.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_property(_banner, "modulate:a", 1.0, 0.7)
	tw.tween_property(_banner, "modulate:a", 0.0, 0.4)

func show_out_of_fuel() -> void:
	_banner.text = "OUT OF FUEL!"
	_banner.add_theme_color_override("font_color", Color(1, 0.4, 0.3))
	_banner.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_property(_banner, "modulate:a", 1.0, 1.4)
	tw.tween_property(_banner, "modulate:a", 0.0, 0.5)

func _show_tip(text: String) -> void:
	_tip = Panel.new()
	_tip.add_theme_stylebox_override("panel", UIKit.panel_style(Color(0.11, 0.14, 0.24, 0.96), Color(0.2, 0.26, 0.42), 20))
	_tip.position = Vector2(460, 380)
	_tip.size = Vector2(1000, 110)
	var lb := Label.new()
	lb.text = "TIP:  " + text
	lb.add_theme_font_size_override("font_size", 30)
	lb.add_theme_color_override("font_color", Color(0.95, 0.95, 1))
	lb.set_anchors_preset(Control.PRESET_FULL_RECT)
	lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lb.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_tip.add_child(lb)
	add_child(_tip)
	var tw := create_tween()
	tw.tween_property(_tip, "modulate:a", 1.0, 0.4)
	tw.tween_property(_tip, "modulate:a", 0.0, 0.6).set_delay(4.2)
	tw.tween_callback(_tip.queue_free)

func _on_pause_pressed() -> void:
	if _pedal_gas != null:
		_pedal_gas.release()
	if _pedal_brake != null:
		_pedal_brake.release()
	pause_requested.emit()

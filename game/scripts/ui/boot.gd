extends Node2D
## Splash: branded loading moment, then straight into the lobby.
## Also handles the (rare) portrait-window rotate hint.

var _t: float = 0.0

func _ready() -> void:
	AudioManager.play_theme("menu_theme")
	# Ensure audio buses exist early.
	await get_tree().process_frame

func _process(delta: float) -> void:
	_t += delta
	queue_redraw()
	if _t > 1.6:
		_t = -1.0
		SaveManager.flush()
		get_tree().change_scene_to_file("res://scenes/lobby.tscn")

func _draw() -> void:
	var w: float = get_viewport().get_visible_rect().size.x
	var h: float = get_viewport().get_visible_rect().size.y
	# Background.
	var grad := Gradient.new()
	grad.set_color(0, Color(0.05, 0.07, 0.14))
	grad.set_color(1, Color(0.12, 0.16, 0.3))
	var bands := 12
	for i in bands:
		var c := grad.get_color(i / float(bands - 1))
		draw_rect(Rect2(0, h * i / bands, w, h / bands + 2.0), c)
	# Logo with fade-in + scale.
	var k: float = clampf(_t / 0.6, 0.0, 1.0)
	var logo: Texture2D = load("res://assets/ui/logo.png")
	if logo:
		var scale_base: float = minf(w / 1920.0, h / 1080.0) * (0.9 + 0.1 * (1.0 - k))
		var sz := logo.get_size() * scale_base
		var pos := Vector2(w / 2.0 - sz.x / 2.0, h / 2.0 - sz.y / 2.0 - 40.0 * scale_base)
		# Fade via a black overlay is easier than modulating a texture draw.
		draw_texture_rect(logo, Rect2(pos, sz), false)
		if k < 1.0:
			draw_rect(Rect2(0, 0, w, h), Color(0.05, 0.07, 0.14, 1.0 - k))
	# Tagline.
	var tag := "TURBO HILL RACING"
	var f := ThemeDB.fallback_font
	var ts := f.get_string_size(tag, HORIZONTAL_ALIGNMENT_CENTER, -1, 30)
	draw_string(f, Vector2(w / 2.0 - ts.x / 2.0, h / 2.0 + 120.0), tag,
		HORIZONTAL_ALIGNMENT_CENTER, -1, 30, Color(1, 1, 1, 0.5 * k))
	# Loading bar.
	var bw := 300.0
	var bx := w / 2.0 - bw / 2.0
	var by := h / 2.0 + 170.0
	draw_rect(Rect2(bx, by, bw, 10.0), Color(1, 1, 1, 0.12))
	draw_rect(Rect2(bx, by, bw * clampf(_t / 1.2, 0.0, 1.0), 10.0), Color(1.0, 0.54, 0.05))
	# Portrait hint.
	if h > w:
		draw_rect(Rect2(0, 0, w, h), Color(0, 0, 0, 0.7))
		var rt := "ROTATE YOUR DEVICE"
		var rts := f.get_string_size(rt, HORIZONTAL_ALIGNMENT_CENTER, -1, 44)
		draw_string(f, Vector2(w / 2.0 - rts.x / 2.0, h / 2.0), rt,
			HORIZONTAL_ALIGNMENT_CENTER, -1, 44, Color.WHITE)

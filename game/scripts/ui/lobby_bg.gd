extends Node2D
## Animated lobby backdrop: day sky gradient, sun with glow, drifting clouds,
## two scrolling hill layers and a grass strip. Pure vector, auto-scrolls.

var _t: float = 0.0
const W := 1920.0
const H := 1080.0

func _process(delta: float) -> void:
	_t += delta
	queue_redraw()

func _draw() -> void:
	# Sky gradient bands.
	var top := Color(0.33, 0.66, 0.95)
	var bottom := Color(0.8, 0.93, 0.98)
	var bands := 10
	for i in bands:
		var c := top.lerp(bottom, i / float(bands - 1))
		var y0: float = H * i / bands
		draw_rect(Rect2(0, y0, W, H / bands + 2.0), c)
	# Sun.
	var sun := Vector2(1560, 190)
	draw_circle(sun + Vector2(0, 0), 130.0, Color(1, 0.9, 0.5, 0.18))
	draw_circle(sun, 84.0, Color(1, 0.93, 0.55, 0.95))
	# Clouds (drift slowly, wrap).
	for i in 4:
		var speed := 14.0 + float(i) * 5.0
		var cx := fposmod(float(i) * 520.0 + _t * speed, W + 400.0) - 200.0
		var cy: float = 120.0 + float(i % 3) * 70.0
		_cloud(Vector2(cx, cy), 1.0 + float(i % 2) * 0.5)
	# Far hills (slow).
	_hills(0.0, 560.0, 90.0, Color(0.42, 0.72, 0.55, 0.75), 26.0)
	# Near hills (faster).
	_hills(1.0, 700.0, 70.0, Color(0.3, 0.62, 0.42), 54.0)
	# Grass strip.
	draw_rect(Rect2(0, 860, W, 220), Color(0.24, 0.55, 0.32))
	draw_rect(Rect2(0, 860, W, 14), Color(0.3, 0.66, 0.38))
	# Grass tufts scrolling with the near layer.
	var off := fposmod(_t * 54.0, 160.0)
	var x := -off
	while x < W + 160.0:
		_tuft(Vector2(x, 872.0))
		x += 160.0

func _cloud(p: Vector2, s: float) -> void:
	var c := Color(1, 1, 1, 0.85)
	draw_circle(p + Vector2(-40 * s, 0), 34 * s, c)
	draw_circle(p + Vector2(0, -14 * s), 44 * s, c)
	draw_circle(p + Vector2(44 * s, 0), 36 * s, c)
	draw_circle(p + Vector2(10 * s, 10 * s), 40 * s, c)

func _hills(layer: float, base: float, amp: float, color: Color, speed: float) -> void:
	var pts: PackedVector2Array = PackedVector2Array()
	var scroll := _t * speed + layer * 999.0
	var x: float = 0.0
	while x <= W + 60.0:
		var u: float = (x + scroll) * 0.004
		var y: float = base - amp * (0.6 * sin(u) + 0.4 * sin(u * 2.7 + 1.3))
		pts.append(Vector2(x, y))
		x += 60.0
	pts.append(Vector2(W, H))
	pts.append(Vector2(0, H))
	draw_colored_polygon(pts, color)

func _tuft(p: Vector2) -> void:
	var c := Color(0.36, 0.72, 0.42)
	for i in 3:
		var a := -PI / 2.0 + (i - 1) * 0.5
		draw_line(p, p + Vector2(cos(a), sin(a)) * 26.0, c, 4.0)

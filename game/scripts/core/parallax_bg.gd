extends Node2D
## Layered parallax backdrop. The node is centered on the camera every frame
## and draws far ridges, mid silhouettes (hills / mesas / city skyline) and
## near dressing props in local space. Parallax law: a feature at layer
## coordinate u is drawn at local_x = u - cam_x * f  (f=1 world speed, f=0
## screen-locked). All vector math, no textures, infinite in both directions.

var stage: Variant = null
var cam: Camera2D = null

const W := 1250.0   # half-window drawn each frame (px)

func setup(st_index: int) -> void:
	stage = GameState.stage(st_index)

func _process(_delta: float) -> void:
	if cam != null and is_instance_valid(cam):
		global_position = cam.global_position
		queue_redraw()

func _draw() -> void:
	if stage == null:
		return
	var C: float = global_position.x
	var s: Variant = stage
	# Far ridge (slowest).
	_draw_ridge(0.06, 330.0, 120.0, _mix(s.fog, s.sky_top, 0.55), 1.0, 0.0)
	# Mid silhouette (varies per biome).
	match s.index:
		2:
			_draw_city(0.2, C)
		1:
			_draw_mesas(0.2, C)
		_:
			_draw_ridge(0.2, 240.0, 80.0, _mix(s.fog, s.ground_mid, 0.35), 1.4, 900.0)
	# Near dressing props.
	_draw_near_props(0.45, C)

func _mix(a: Color, b: Color, t: float) -> Color:
	return a.lerp(b, t)

## Deterministic ridge line: y offset (px, up = negative) at layer coord u.
func _ridge_y(u: float, amp: float, freq: float, seed_shift: float) -> float:
	return -(
		amp * 0.6 * sin(u * 0.0016 * freq + seed_shift)
		+ amp * 0.3 * sin(u * 0.0047 * freq + seed_shift + 2.1)
		+ amp * 0.12 * sin(u * 0.013 * freq + seed_shift + 4.7)
	)

func _draw_ridge(factor: float, base: float, amp: float, color: Color, freq: float, seed_shift: float) -> void:
	var C: float = global_position.x
	var pts: PackedVector2Array = PackedVector2Array()
	var step := 40.0
	var x: float = -W
	while x <= W + step:
		var u: float = x + C * factor   # local -> layer coordinate
		var y: float = base + _ridge_y(u, amp, freq, seed_shift)
		pts.append(Vector2(x, y))
		x += step
	pts.append(Vector2(W + step, 2200.0))
	pts.append(Vector2(-W, 2200.0))
	draw_colored_polygon(pts, color)

func _draw_mesas(factor: float, C: float) -> void:
	var color: Color = _mix(stage.fog, stage.ground_mid, 0.45)
	var step := 300.0
	var u0: float = C * factor - W
	var u1: float = C * factor + W
	var i0 := int(floor(u0 / step))
	var i1 := int(ceil(u1 / step))
	for i in range(i0, i1 + 1):
		var u_i: float = i * step
		var x: float = u_i - C * factor
		var h := 150.0 + _hash01(i * 13 + 7) * 170.0
		var w := 95.0 + _hash01(i * 31 + 3) * 95.0
		var poly := PackedVector2Array([
			Vector2(x - w, 700.0),
			Vector2(x - w * 0.7, 700.0 - h),
			Vector2(x + w * 0.7, 700.0 - h),
			Vector2(x + w, 700.0),
		])
		draw_colored_polygon(poly, color)

func _draw_city(factor: float, C: float) -> void:
	var base_col: Color = _mix(stage.fog, stage.sky_top, 0.35).darkened(0.25)
	var win_col := Color(1.0, 0.85, 0.35, 0.8)
	var step := 150.0
	var u0: float = C * factor - W
	var u1: float = C * factor + W
	var i0 := int(floor(u0 / step))
	var i1 := int(ceil(u1 / step))
	for i in range(i0, i1 + 1):
		var u_i: float = i * step
		var x: float = u_i - C * factor
		var h := 220.0 + _hash01(i * 17 + 5) * 300.0
		var w := 70.0 + _hash01(i * 7 + 1) * 60.0
		var rect := Rect2(x - w / 2.0, 680.0 - h, w, h + 260.0)
		draw_rect(rect, base_col)
		# Lit windows (night).
		var wy := rect.position.y + 18.0
		while wy < rect.end.y - 40.0:
			var wx := rect.position.x + 8.0
			while wx < rect.end.x - 12.0:
				if _hash01(int(wy) * 31 + int(wx) * 7 + i * 101) > 0.55:
					draw_rect(Rect2(wx, wy, 6.0, 9.0), win_col)
				wx += 16.0
			wy += 22.0
		# Roof detail.
		if _hash01(i * 3 + 9) > 0.6:
			draw_line(Vector2(x, rect.position.y), Vector2(x, rect.position.y - 34.0), base_col, 3.0)
			draw_circle(Vector2(x, rect.position.y - 36.0), 4.0, Color(1.0, 0.3, 0.3, 0.9))

func _draw_near_props(factor: float, C: float) -> void:
	var step := 180.0
	var u0: float = C * factor - W
	var u1: float = C * factor + W
	var i0 := int(floor(u0 / step))
	var i1 := int(ceil(u1 / step))
	for i in range(i0, i1 + 1):
		var u_i: float = i * step
		var x: float = u_i - C * factor
		var h1 := _hash01(i * 11 + 3)
		if h1 < 0.35:
			continue  # sparse
		var px := x + (_hash01(i * 19 + 2) - 0.5) * 90.0
		var scale: float = 0.8 + _hash01(i * 5 + 1) * 0.7
		var py: float = 340.0 + _hash01(i * 13 + 9) * 46.0
		var kind := int(_hash01(i * 29 + 4) * 3.0)
		_draw_near_prop(stage.index, kind, Vector2(px, py), scale)

func _draw_near_prop(biome: int, kind: int, pos: Vector2, s: float) -> void:
	var px := 20.0
	match biome:
		0:
			if kind == 0:
				draw_circle(pos + Vector2(0, -0.6 * px * s), 0.7 * px * s, Color(0.2, 0.5, 0.24, 0.9))
				draw_circle(pos + Vector2(0.5 * px * s, -0.3 * px * s), 0.5 * px * s, Color(0.24, 0.55, 0.27, 0.9))
			elif kind == 1:
				draw_rect(Rect2(pos.x - 0.12 * px * s, pos.y - 1.2 * px * s, 0.24 * px * s, 1.2 * px * s), Color(0.45, 0.3, 0.18, 0.9))
				draw_circle(pos + Vector2(0, -1.4 * px * s), 1.0 * px * s, Color(0.18, 0.45, 0.22, 0.9))
			else:
				draw_circle(pos + Vector2(0, -0.4 * px * s), 0.45 * px * s, Color(0.25, 0.52, 0.26, 0.9))
		1:
			if kind == 0:
				draw_rect(Rect2(pos.x - 0.14 * px * s, pos.y - 1.1 * px * s, 0.28 * px * s, 1.1 * px * s), Color(0.28, 0.5, 0.28, 0.9))
				draw_rect(Rect2(pos.x + 0.06 * px * s, pos.y - 0.85 * px * s, 0.5 * px * s, 0.16 * px * s), Color(0.28, 0.5, 0.28, 0.9))
			else:
				draw_circle(pos + Vector2(0, -0.35 * px * s), 0.55 * px * s, Color(0.48, 0.3, 0.2, 0.9))
		2:
			if kind == 0:
				draw_line(pos, pos + Vector2(0, -2.0 * px * s), Color(0.25, 0.25, 0.3, 0.9), 3.0)
				draw_circle(pos + Vector2(0, -2.05 * px * s), 0.25 * px * s, Color(1.0, 0.8, 0.35, 0.95))
			else:
				draw_rect(Rect2(pos.x - 0.9 * px * s, pos.y - 0.8 * px * s, 1.8 * px * s, 0.8 * px * s), Color(0.6, 0.25, 0.3, 0.9))
		3:
			for k in 3:
				var yy := pos.y - (0.3 + k * 0.4) * px * s
				draw_colored_polygon(PackedVector2Array([
					Vector2(pos.x, yy - 0.6 * px * s),
					Vector2(pos.x - 0.6 * px * s, yy),
					Vector2(pos.x + 0.6 * px * s, yy),
				]), Color(0.15, 0.35, 0.4, 0.9))
			if kind == 2:
				draw_circle(pos + Vector2(0.8 * px * s, -0.3 * px * s), 0.4 * px * s, Color(0.95, 0.97, 1.0, 0.9))

func _hash01(i: int) -> float:
	var v := sin(float(i) * 127.1 + 311.7) * 43758.5453
	return v - floor(v)

extends Node2D
## Draws one terrain chunk: stratified fill, surface grass line, biome
## dressing (props), ice overlays and the best-distance pennant.
## Everything is drawn with CanvasItem primitives — no per-chunk textures.

var surf_points: PackedVector2Array
var stage: Variant = null
var chunk_id: int = 0
var seed: int = 0
var ice_bands: Array = []
var best_flag_m: float = 0.0

const DEPTH_M := 250.0

func _draw() -> void:
	if surf_points.size() < 2 or stage == null:
		return
	var px_per_m := GameState.PX_PER_M
	var x0_m: float = chunk_id * 30.0
	# Stratified fill: mid earth everywhere, dark stratum from 6 m down.
	var full: PackedVector2Array = surf_points.duplicate()
	full.append(Vector2(surf_points.back().x, DEPTH_M * px_per_m))
	full.append(Vector2(surf_points[0].x, DEPTH_M * px_per_m))
	draw_colored_polygon(full, stage.ground_mid)
	var deep: PackedVector2Array = PackedVector2Array()
	for p in surf_points:
		deep.append(p + Vector2(0, 6.0 * px_per_m))
	deep.append(Vector2(surf_points.back().x, DEPTH_M * px_per_m))
	deep.append(Vector2(surf_points[0].x, DEPTH_M * px_per_m))
	draw_colored_polygon(deep, stage.ground_dark)
	# Surface line.
	var line: PackedVector2Array = surf_points
	draw_polyline(line, stage.ground_top, 6.0, true)
	# Subtle top highlight.
	var hl: PackedVector2Array = PackedVector2Array()
	for p in line:
		hl.append(p + Vector2(0, -2.0))
	draw_polyline(hl, _lighten(stage.ground_top, 0.25), 2.0, true)
	# Ice overlays.
	for b in ice_bands:
		var bx0: float = float(b.x0)
		var bx1: float = float(b.x1)
		var ix0: float = maxf(bx0, x0_m)
		var ix1: float = minf(bx1, x0_m + 30.0)
		if ix1 <= ix0:
			continue
		var ice: PackedVector2Array = PackedVector2Array()
		var step := 0.5
		var xm := ix0
		while xm <= ix1 + 0.001:
			ice.append(Vector2(xm * px_per_m, -_h_m(xm) * px_per_m))
			xm += step
		draw_polyline(ice, Color(0.85, 0.95, 1.0, 0.85), 7.0, true)
	# Best-distance pennant.
	if best_flag_m >= x0_m and best_flag_m < x0_m + 30.0 and best_flag_m > 5.0:
		_draw_pennant(best_flag_m, px_per_m)
	# Dressing props.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed * 7919 + chunk_id * 104729
	_props(rng, px_per_m, x0_m)

func _h_m(xm: float) -> float:
	# Local approximation for ice/pennant placement: query nothing heavy;
	# the painter is positioned by chunk so we approximate with the chunk's
	# own surface samples when available.
	if surf_points.size() > 0:
		var local_m: float = clampf(xm - float(chunk_id) * 30.0, 0.0, 30.0)
		var idx := int(floor(local_m / 0.5))
		idx = clampi(idx, 0, surf_points.size() - 1)
		return surf_points[idx].y / GameState.PX_PER_M * -1.0
	return 0.0

func _lighten(c: Color, amt: float) -> Color:
	return Color(
		clampf(c.r + amt, 0.0, 1.0),
		clampf(c.g + amt, 0.0, 1.0),
		clampf(c.b + amt, 0.0, 1.0),
		c.a
	)

func _draw_pennant(xm: float, px_per_m: float) -> void:
	var base := Vector2(xm * px_per_m, -_h_m(xm) * px_per_m)
	var pole_top := base + Vector2(0, -2.2 * px_per_m)
	draw_line(base, pole_top, Color(0.9, 0.9, 0.92), 3.0)
	# Pennant triangle.
	var tri := PackedVector2Array([
		pole_top,
		pole_top + Vector2(1.4 * px_per_m, 0.35 * px_per_m),
		pole_top + Vector2(0, 0.8 * px_per_m),
	])
	draw_colored_polygon(tri, Color(0.95, 0.3, 0.35))

func _props(rng: RandomNumberGenerator, px_per_m: float, x0_m: float) -> void:
	var count := 3 + rng.randi_range(0, 3)
	var idx := _prop_index(stage.index if stage.index != null else 0)
	for i in count:
		var xm: float = x0_m + 2.0 + rng.randf() * 26.0
		var y := Vector2(xm * px_per_m, -_h_m(xm) * px_per_m)
		var s := 0.7 + rng.randf() * 0.8
		var flip: bool = rng.randf() < 0.15
		_draw_prop(idx, i, y, s, flip, px_per_m, rng)

func _prop_index(st: int) -> int:
	return st

func _draw_prop(idx: int, i: int, pos: Vector2, s: float, flip: bool, px: float, rng: RandomNumberGenerator) -> void:
	# Vector props per biome (kept small & readable at zoom).
	var kind := rng.randi_range(0, 2)
	match idx:
		0:  # meadow: bushes, flowers, tree
			if kind == 0:
				draw_circle(pos + Vector2(0, -0.5 * px * s), 0.55 * px * s, Color(0.22, 0.5, 0.2))
				draw_circle(pos + Vector2(0.25 * px * s, -0.35 * px * s), 0.4 * px * s, Color(0.26, 0.56, 0.24))
			elif kind == 1:
				draw_line(pos, pos + Vector2(0, -0.7 * px * s), Color(0.3, 0.45, 0.2), 2.0)
				draw_circle(pos + Vector2(0, -0.75 * px * s), 0.18 * px * s, Color(0.98, 0.85, 0.3))
			else:
				draw_rect(Rect2(pos.x - 0.1 * px, pos.y - 1.1 * px * s, 0.2 * px, 1.1 * px * s), Color(0.45, 0.3, 0.18))
				draw_circle(pos + Vector2(0, -1.2 * px * s), 0.8 * px * s, Color(0.2, 0.48, 0.22))
		1:  # canyon: cactus, rock, dead tree
			if kind == 0:
				draw_rect(Rect2(pos.x - 0.12 * px, pos.y - 1.0 * px * s, 0.24 * px, 1.0 * px * s), Color(0.3, 0.55, 0.3))
				draw_rect(Rect2(pos.x + 0.05 * px, pos.y - 0.8 * px * s, 0.4 * px * s, 0.14 * px), Color(0.3, 0.55, 0.3))
			elif kind == 1:
				draw_circle(pos + Vector2(0, -0.3 * px * s), 0.5 * px * s, Color(0.5, 0.32, 0.22))
			else:
				draw_line(pos, pos + Vector2(0.1 * px, -1.2 * px * s), Color(0.4, 0.28, 0.2), 3.0)
		2:  # harbor: lamp, container, antenna
			if kind == 0:
				draw_line(pos, pos + Vector2(0, -1.6 * px * s), Color(0.3, 0.3, 0.35), 3.0)
				draw_circle(pos + Vector2(0, -1.65 * px * s), 0.22 * px * s, Color(1.0, 0.85, 0.4, 0.9))
			elif kind == 1:
				draw_rect(Rect2(pos.x - 0.8 * px * s, pos.y - 0.7 * px * s, 1.6 * px * s, 0.7 * px * s), Color(0.75, 0.3, 0.35))
				draw_rect(Rect2(pos.x - 0.8 * px * s, pos.y - 0.7 * px * s, 1.6 * px * s, 0.7 * px * s), Color(0.0, 0.0, 0.0, 0.15), true)
			else:
				draw_line(pos, pos + Vector2(0, -2.0 * px * s), Color(0.4, 0.4, 0.5), 2.0)
				draw_line(pos + Vector2(0.4 * px * s, -0.6 * px * s), pos + Vector2(-0.4 * px * s, -1.4 * px * s), Color(0.4, 0.4, 0.5), 2.0)
		3:  # frost: pine, snowman, crystal
			if kind == 0:
				for k in 3:
					var yy := pos.y - (0.3 + k * 0.35) * px * s
					draw_colored_polygon(PackedVector2Array([
						Vector2(pos.x, yy - 0.5 * px * s),
						Vector2(pos.x - 0.5 * px * s, yy),
						Vector2(pos.x + 0.5 * px * s, yy),
					]), Color(0.18, 0.4, 0.45))
			elif kind == 1:
				draw_circle(pos + Vector2(0, -0.35 * px * s), 0.35 * px * s, Color(0.95, 0.97, 1.0))
				draw_circle(pos + Vector2(0, -0.85 * px * s), 0.25 * px * s, Color(0.95, 0.97, 1.0))
			else:
				draw_colored_polygon(PackedVector2Array([
					pos + Vector2(0, -1.0 * px * s),
					pos + Vector2(0.3 * px * s, 0.0),
					pos + Vector2(-0.3 * px * s, 0.0),
				]), Color(0.5, 0.8, 0.95, 0.9))

extends Node2D
## Procedural infinite terrain. Heightfield = smooth stacked sines whose
## amplitude grows with distance, plus windowed "feature" shapes (ramps, gaps,
## plateaus) and biome dressing. Terrain is chunked (30 m) so we can generate
## ahead of the car and free chunks behind.
##
## World convention: +x = forward, +y = down (Godot). Ground height is stored
## in meters via the m() helper.

const CHUNK_M := 30.0
const STEP_M := 0.5
const DEPTH_M := 250.0

const _ChunkPainter: GDScript = preload("res://scripts/core/chunk_painter.gd")
const COIN_SCRIPT: GDScript = preload("res://scripts/core/coin_pickup.gd")
const FUEL_SCRIPT: GDScript = preload("res://scripts/core/fuel_pickup.gd")
const GATE_SCRIPT: GDScript = preload("res://scripts/core/milestone_gate.gd")

@export var stage_index: int = 0
var stage: Variant = null
var run_seed: int = 0

var _rng := RandomNumberGenerator.new()
var _registered: Dictionary = {}
var _best_flag_m: float = 0.0
var _phase: Array[float] = []
var _chunks: Dictionary = {}          # chunk_id -> Node2D
var _min_chunk: int = 0
var _max_chunk: int = -1
var _features: Array = []             # {x0,x1,kind,depth,width}
var _ice_bands: Array = []            # {x0,x1}
var _next_fuel_x: float = 70.0
var _next_coin_x: float = 18.0
var _milestone_x: float = 250.0
var best_distance: float = 0.0

var terrain_layer: int = 1
var vehicle_layer: int = 2

func m(v: float) -> float:
	return v * GameState.PX_PER_M

func setup(st_index: int, seed: int, best_m: float) -> void:
	stage = GameState.stage(st_index)
	run_seed = seed
	_rng.seed = seed
	_phase = [_rng.randf() * TAU, _rng.randf() * TAU, _rng.randf() * TAU, _rng.randf() * TAU]
	_best_flag_m = best_m
	best_distance = best_m
	generate_around(0.0, 6)

# ------------------------------------------------------------- heightfield
## Ground height in meters (up = positive).
func height_m(x_m: float) -> float:
	var s: Variant = stage
	var t := clampf(x_m / 1200.0, 0.0, 1.0)
	var amp := lerpf(s.slope_start, s.slope_end, t * t)
	var f := s.frequency
	var y := 0.0
	y += 0.55 * sin(x_m * 0.11 * f + _phase[0])
	y += 0.30 * sin(x_m * 0.051 * f + _phase[1])
	y += 0.15 * sin(x_m * 0.27 * f + _phase[2])
	y += 0.07 * sin(x_m * 0.93 * f + _phase[3])
	y *= amp
	# Feature shapes.
	for ft in _features:
		var cx: float = (x_m - ft.x0) / ft.width
		if cx > -0.05 and cx < 1.05:
			match ft.kind:
				"ramp":
					y += ft.depth * _feature_ramp(cx)
				"gap":
					y -= ft.depth * _feature_bowl(cx)
				"plateau":
					y += ft.depth * _feature_plateau(cx)
	return y

func _feature_ramp(cx: float) -> float:
	# Rise over 55%, flat, short drop at the lip.
	if cx < 0:
		return 0.0
	if cx > 1.0:
		return 0.0
	if cx < 0.55:
		return _smoothstep(cx / 0.55)
	if cx > 0.92:
		return 1.0 - 0.35 * _smoothstep((cx - 0.92) / 0.08)
	return 1.0

func _feature_bowl(cx: float) -> float:
	if cx < 0.0 or cx > 1.0:
		return 0.0
	return 0.5 - 0.5 * cos(cx * PI)

func _feature_plateau(cx: float) -> float:
	if cx < 0.0 or cx > 1.0:
		return 0.0
	if cx < 0.18:
		return _smoothstep(cx / 0.18)
	if cx > 0.85:
		return 1.0 - _smoothstep((cx - 0.85) / 0.15)
	return 1.0

func _smoothstep(t: float) -> float:
	t = clampf(t, 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)

## Surface normal (unit) at x (meters).
func normal_at(x_m: float) -> Vector2:
	var e := 0.25
	var y0 := height_m(x_m - e)
	var y1 := height_m(x_m + e)
	var dx := m(2.0 * e)
	var dy := m(y1 - y0)
	var n := Vector2(-dy, -dx)  # perpendicular to tangent, pointing up out of the slope
	return n.normalized()

func is_ice(x_m: float) -> bool:
	for b in _ice_bands:
		if x_m >= b.x0 and x_m <= b.x1:
			return true
	return false

# --------------------------------------------------------------- chunk mgmt
func generate_around(center_x_px: float, radius_chunks: int) -> void:
	var center_chunk := int(floor(center_x_px / m(CHUNK_M)))
	var lo := center_chunk - radius_chunks
	var hi := center_chunk + radius_chunks
	while _min_chunk > lo and _chunks.has(_min_chunk):
		var node: Node2D = _chunks[_min_chunk]
		_min_chunk += 1
		if center_chunk - _min_chunk >= radius_chunks + 1:
			node.queue_free()
			_chunks.erase(_min_chunk)
	while _max_chunk < hi:
		_max_chunk += 1
		_spawn_chunk(_max_chunk)
	_min_chunk = maxi(_min_chunk, lo)

func _spawn_chunk(id: int) -> void:
	if _chunks.has(id):
		return
	var x0_m: float = id * CHUNK_M
	# Register content BEFORE sampling the heightfield so features bake in.
	_register_features_for(id)
	_register_ice_for(id)
	_register_pickups_for(id, x0_m)
	var n_samples := int(CHUNK_M / STEP_M) + 1
	# 1) Physics + visual points.
	var pts: PackedVector2Array = PackedVector2Array()
	var surf: PackedVector2Array = PackedVector2Array()
	for i in n_samples:
		var xm: float = x0_m + i * STEP_M
		var ym := height_m(xm)
		surf.append(Vector2(m(xm), -m(ym)))
		pts.append(Vector2(m(xm), -m(ym)))
	pts.append(Vector2(m(x0_m + CHUNK_M), m(DEPTH_M)))
	pts.append(Vector2(m(x0_m), m(DEPTH_M)))

	var root := Node2D.new()
	root.name = "Chunk%d" % id
	var body := StaticBody2D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	var col := CollisionPolygon2D.new()
	col.polygon = pts
	body.add_child(col)
	root.add_child(body)

	var painter := _ChunkPainter.new()
	painter.surf_points = surf
	painter.stage = stage
	painter.chunk_id = id
	painter.seed = run_seed
	painter.ice_bands = _ice_bands
	painter.best_flag_m = _best_flag_m
	root.add_child(painter)

	add_child(root)
	_chunks[id] = root

func _register_features_for(id: int) -> void:
	if _registered.has(id):
		return
	_registered[id] = true
	var x0_m: float = id * CHUNK_M
	# Difficulty rises with distance.
	var d := clampf(x0_m / 1500.0, 0.0, 1.0)
	var r := _rng.randf()
	if x0_m < 25.0:
		return  # flat launch area
	if r < 0.30:
		var width := 5.0 + _rng.randf() * 5.0
		var depth := lerpf(1.2, 4.5, d) * (0.7 + _rng.randf() * 0.6)
		_features.append({"x0": x0_m + _rng.randf() * (CHUNK_M - width), "width": width, "depth": depth, "kind": "ramp"})
	elif r < 0.52:
		var width := 8.0 + _rng.randf() * 7.0
		var depth := lerpf(2.0, 5.0, d) * (0.7 + _rng.randf() * 0.5)
		_features.append({"x0": x0_m + _rng.randf() * (CHUNK_M - width), "width": width, "depth": depth, "kind": "gap"})
	elif r < 0.66:
		var width := 7.0 + _rng.randf() * 6.0
		var depth := lerpf(1.0, 3.0, d)
		_features.append({"x0": x0_m + _rng.randf() * (CHUNK_M - width), "width": width, "depth": depth, "kind": "plateau"})
	else:
		var width := 6.0 + _rng.randf() * 5.0
		var depth := lerpf(0.8, 3.0, d)
		_features.append({"x0": x0_m + _rng.randf() * (CHUNK_M - width), "width": width, "depth": depth, "kind": "ramp"})
	_features.sort_custom(func(a, b): return float(a.x0) < float(b.x0))

func _register_ice_for(id: int) -> void:
	var s: Variant = stage
	if not s.ice:
		return
	var x0_m: float = id * CHUNK_M
	if _rng.randf() < 0.45:
		var w := 5.0 + _rng.randf() * 9.0
		_ice_bands.append({"x0": x0_m + _rng.randf() * (CHUNK_M - w), "x1": x0_m + (CHUNK_M - w) * 0.4 + w})

func _register_pickups_for(id: int, x0_m: float) -> void:
	var s: Variant = stage
	# Coins: lines of 4-7 every ~12-26 m.
	while _next_coin_x < x0_m + CHUNK_M:
		var n := 4 + _rng.randi_range(0, 3)
		for i in n:
			var xm: float = _next_coin_x + i * 1.1
			if xm >= x0_m and xm < x0_m + CHUNK_M:
				_spawn_coin(xm)
		_next_coin_x += 12.0 + _rng.randf() * 14.0
	# Fuel: every ~90-150 m.
	while _next_fuel_x < x0_m + CHUNK_M:
		_spawn_fuel(_next_fuel_x)
		_next_fuel_x += 90.0 + _rng.randf() * 60.0
	# Milestone gates every 250 m (visual).
	while _milestone_x < x0_m + CHUNK_M:
		_spawn_milestone(_milestone_x)
		_milestone_x += 250.0


func _spawn_coin(xm: float) -> void:
	var item: Area2D = COIN_SCRIPT.new()
	item.position = Vector2(m(xm), -m(height_m(xm)) - m(0.55))
	add_child(item)

func _spawn_fuel(xm: float) -> void:
	var item: Area2D = FUEL_SCRIPT.new()
	item.position = Vector2(m(xm), -m(height_m(xm)) - m(0.6))
	add_child(item)

func _spawn_milestone(xm: float) -> void:
	var gate: Node2D = GATE_SCRIPT.new()
	gate.position = Vector2(m(xm), -m(height_m(xm)))
	(gate as Node2D).set("label", "%dm" % int(xm))
	add_child(gate)

extends Node2D
## One play session: builds terrain + vehicle + camera + weather, runs the
## countdown, tracks fuel/coins/distance/stunts, handles crash & fuel-out
## endings, slow-mo, and hands the result to the results scene.
##
## Debug: run with `--smoke <seconds>` (e.g. `godot --headless --smoke 40`)
## to autopilot the car headlessly and self-report at the end.

const VEHICLE: GDScript = preload("res://scripts/core/vehicle.gd")
const TERRAIN: GDScript = preload("res://scripts/core/terrain.gd")
const PARALLAX: GDScript = preload("res://scripts/core/parallax_bg.gd")
const HUD: GDScript = preload("res://scripts/ui/run_hud.gd")
const PAUSE_MENU: GDScript = preload("res://scripts/ui/pause_menu.gd")
const WEATHER: GDScript = preload("res://scripts/core/weather.gd")

var stage_index: int = 0
var vehicle_index: int = 0
var run_seed: int = 0

var terrain: Node2D
var car: Node2D
var cam_rig: Node2D
var cam: Camera2D
var parallax: Node2D
var hud: Node
var pause_menu: Node
var weather: Node

var fuel: float = 100.0
var fuel_capacity: float = 100.0
var coins_run: int = 0
var flips_run: int = 0
var top_speed_ms: float = 0.0
var distance_m: float = 0.0
var _next_passive_coin_m: float = 25.0
var _out_of_fuel_time: float = 0.0
var _crash_time: float = -1.0
var _ended: bool = false
var _countdown_done: bool = false
var _smoke_seconds: float = 0.0
var _smoke_time: float = 0.0
var _smoke_failures: int = 0
var _trauma: float = 0.0
var _last_milestone: int = 0

func _ready() -> void:
	stage_index = GameState.get_selected_stage()
	vehicle_index = GameState.get_selected_vehicle()
	run_seed = int(Time.get_unix_time_from_system()) ^ (randi() & 0xFFFF)
	_smoke_seconds = _parse_smoke_arg()
	var s: Variant = GameState.stage(stage_index)

	# Parallax backdrop (behind everything).
	parallax = PARALLAX.new()
	parallax.z_index = -20
	add_child(parallax)
	parallax.setup(stage_index)

	# Terrain.
	terrain = TERRAIN.new()
	add_child(terrain)
	terrain.setup(stage_index, run_seed, float(SaveManager.best_distance(stage_index)))

	# Vehicle.
	car = VEHICLE.new()
	add_child(car)
	car.setup(vehicle_index)
	car.terrain_ref = terrain
	car.position = Vector2(20.0, -terrain.height_m(1.0) * 20.0 - 30.0)
	car.flipped_in_air.connect(_on_flipped)

	# Camera.
	cam_rig = Node2D.new()
	add_child(cam_rig)
	cam = Camera2D.new()
	cam.zoom = Vector2(2.0, 2.0)
	cam.position_smoothing_enabled = true
	cam.position_smoothing_speed = 6.0
	cam.limit_left = -1000
	cam.limit_right = 100000000
	cam_rig.add_child(cam)
	parallax.cam = cam
	cam.make_current()

	# Weather.
	weather = WEATHER.new()
	weather.layer = 30
	add_child(weather)
	weather.setup(s.weather)

	# HUD + pause.
	hud = HUD.new()
	add_child(hud)
	pause_menu = PAUSE_MENU.new()
	add_child(pause_menu)
	pause_menu.setup(stage_index, vehicle_index)
	hud.setup(s, stage_index, vehicle_index)
	hud.pause_requested.connect(_on_pause_requested)

	# Audio.
	AudioManager.set_ambience(s.ambience)
	AudioManager.play_theme(s.theme)

	# Signals.
	car.set_meta("is_vehicle", true)
	EventBus.coin_collected.connect(_on_coin)
	EventBus.fuel_pickup.connect(_on_fuel_pickup)
	EventBus.run_started.emit(stage_index, vehicle_index)

	if _smoke_seconds > 0.0:
		_begin_countdown()
	else:
		_run_countdown()

# ----------------------------------------------------------------- smoke
func _parse_smoke_arg() -> float:
	var sources: Array[PackedStringArray] = [OS.get_cmdline_args(), OS.get_cmdline_user_args()]
	for args in sources:
		for i in range(args.size() - 1):
			if args[i] == "--smoke":
				return maxf(5.0, float(args[i + 1]))
	return 0.0

# --------------------------------------------------------------- countdown
func _run_countdown() -> void:
	var t: Array[float] = [3.0, 2.0, 1.0, 0.0]
	for i in t.size():
		AudioManager.play_sfx("beep" if i < 3 else "go")
		hud.show_countdown(int(t[i]) if i < 3 else -1)
		await get_tree().create_timer(0.7)
	_countdown_done = true
	car.controls_enabled = true
	SaveManager.write("seen.first_run_tip", true)

func _begin_countdown() -> void:
	_countdown_done = true
	car.controls_enabled = true

# ------------------------------------------------------------------ update
func _physics_process(delta: float) -> void:
	if _ended:
		return
	if _smoke_seconds > 0.0:
		_smoke_time += delta
		_autopilot(delta)
		if _smoke_time >= _smoke_seconds:
			_finish_smoke()
		return
	var s: Variant = GameState.stage(stage_index)
	if _countdown_done and car.alive:
		# Fuel.
		if not car.is_fuel_dead():
			var drain: float = float(car.stats["drain"])
			if car.throttle > 0.0:
				drain *= 1.15
			fuel -= drain * delta
			if fuel <= 0.0:
				fuel = 0.0
				car.disable_engine()
				EventBus.out_of_fuel.emit()
				AudioManager.play_sfx("sad")
				hud.show_out_of_fuel()
		EventBus.fuel_changed.emit(fuel / fuel_capacity)
		# Fuel-out stall ending.
		if car.is_fuel_dead():
			if car.body.velocity.length() < 8.0:
				_out_of_fuel_time += delta
				if _out_of_fuel_time > 2.5:
					_end_run(false, true)
					return
			else:
				_out_of_fuel_time = 0.0
	# Camera follow (always, even while crashed so the wreck is visible).
	var look: Vector2 = car.body.velocity * 0.30
	var target: Vector2 = car.global_position + look + Vector2(30.0, -40.0)
	cam_rig.global_position = cam_rig.global_position.lerp(target, 1.0 - exp(-6.0 * delta))
	# Camera tilt with speed.
	var speed_ms: float = car.body.velocity.length() / 20.0
	var tilt: float = clampf(speed_ms / 40.0, 0.0, 1.0) * 0.10
	var cam_target_rot: float = tilt * 0.0  # HCR-style: keep horizon, subtle zoom only
	cam.rotation = lerp_angle(cam.rotation, cam_target_rot, 4.0 * delta)
	var target_zoom: float = 2.0 - clampf(speed_ms / 60.0, 0.0, 0.35)
	cam.zoom = cam.zoom.lerp(Vector2(target_zoom, target_zoom), 3.0 * delta)
	# Shake.
	_trauma = maxf(0.0, _trauma - 1.6 * delta)
	if _trauma > 0.01:
		cam.offset = Vector2(
			randf_range(-1.0, 1.0) * 26.0 * _trauma * _trauma,
			randf_range(-1.0, 1.0) * 26.0 * _trauma * _trauma
		)
	else:
		cam.offset = Vector2.ZERO
	# Distance & passive coins.
	var x_m: float = car.global_position.x / 20.0
	distance_m = maxf(distance_m, x_m)
	if distance_m >= _next_passive_coin_m:
		coins_run += 1
		SaveManager.add_coins(1)
		_next_passive_coin_m += 25.0
	var milestone := int(distance_m / 250.0)
	if milestone > _last_milestone and distance_m >= 250.0:
		_last_milestone = milestone
		AudioManager.play_sfx("pennant")
		hud.show_milestone(milestone * 250)
	top_speed_ms = maxf(top_speed_ms, speed_ms)
	# Engine audio.
	AudioManager.set_engine(car.rpm, car.throttle, car.alive and not car.is_fuel_dead() and _countdown_done)
	# Terrain streaming.
	terrain.generate_around(car.global_position.x, 6)
	# Crash slow-mo.
	if _crash_time >= 0.0:
		_crash_time += delta
		Engine.time_scale = lerpf(0.35, 1.0, clampf(_crash_time / 1.2, 0.0, 1.0))
		if _crash_time > 1.9:
			_end_run(true, false)
	# Autopilot idle safety: nudge if the car backs off the start.
	if _countdown_done and car.alive and distance_m < 1.0 and car.body.velocity.x < -5.0:
		car.set_autopilot(true, false)

func _on_pause_requested() -> void:
	get_tree().paused = true
	AudioManager.play_sfx("click")
	pause_menu.show_menu()

# ------------------------------------------------------------------ events
func _on_coin(value: int) -> void:
	coins_run += value
	SaveManager.add_coins(value)
	hud.pulse_coins()
	Haptics.vibrate("tick")

func _on_fuel_pickup(amount: float) -> void:
	fuel = minf(fuel + amount, fuel_capacity)
	hud.pulse_fuel()
	Haptics.vibrate("soft")

func _on_flipped(flips: int, _delta_rad: float) -> void:
	if _ended:
		return
	flips_run += flips
	SaveManager.write("stats.flips", int(SaveManager.read("stats.flips", 0)) + flips)
	var bonus: int = 0
	var text := ""
	match flips:
		1:
			bonus = 40
			text = "FLIP! +40"
		2:
			bonus = 120
			text = "DOUBLE FLIP! +120"
		_:
			bonus = 300
			text = "EPIC x%d FLIPS! +300" % flips
	coins_run += bonus
	SaveManager.add_coins(bonus)
	hud.show_flip_popup(text)
	AudioManager.play_sfx("flip")
	Haptics.vibrate("flip")
	_trauma = maxf(_trauma, 0.5)

func _on_car_crash() -> void:
	pass

# ------------------------------------------------------------------- crash
func _watch_crashes() -> void:
	# polled in _process for cheap crash detection of the car's alive flag
	if car.alive == false and _crash_time < 0.0 and not _ended:
		_trigger_crash()

func _process(_delta: float) -> void:
	_watch_crashes()

func _trigger_crash() -> void:
	_trauma = 1.0
	AudioManager.play_sfx("crash")
	Haptics.vibrate("crash")
	_crash_time = 0.0
	_spawn_debris(car.global_position)
	EventBus.crash_detected.emit()
	SaveManager.write("stats.crashes", int(SaveManager.read("stats.crashes", 0)) + 1)

func _spawn_debris(at: Vector2) -> void:
	var px := CPUParticles2D.new()
	px.amount = 26
	px.lifetime = 1.1
	px.one_shot = true
	px.explosiveness = 1.0
	px.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE
	px.emission_sphere_radius = 8.0
	px.direction = Vector2(0, -1)
	px.spread = 180.0
	px.initial_velocity_min = 260.0
	px.initial_velocity_max = 620.0
	px.gravity = Vector2(0, 900.0)
	px.scale_amount_min = 2.0
	px.scale_amount_max = 6.0
	px.color = Color(0.9, 0.75, 0.5)
	px.position = at
	px.finished.connect(func() -> void: px.queue_free())
	add_child(px)

# ------------------------------------------------------------------- end
func _end_run(crashed: bool, fuel_out: bool) -> void:
	if _ended:
		return
	_ended = true
	Engine.time_scale = 1.0
	var dist := int(distance_m)
	var best := SaveManager.best_distance(stage_index)
	var new_best: bool = dist > best
	if new_best:
		SaveManager.set_best(stage_index, dist)
	var stage_unlocked: bool = false
	var next_stage := stage_index + 1
	if new_best and next_stage < 4 and SaveManager.is_stage_unlocked(next_stage):
		stage_unlocked = true
	SaveManager.write("total_distance", int(SaveManager.read("total_distance", 0)) + dist)
	SaveManager.write("stats.runs", int(SaveManager.read("stats.runs", 0)) + 1)
	SaveManager.write("stats.top_speed", int(maxf(top_speed_ms, float(SaveManager.read("stats.top_speed", 0)))))
	SaveManager.flush()
	AudioManager.set_ambience("")
	var result := {
		"stage": stage_index,
		"vehicle": vehicle_index,
		"distance": dist,
		"coins": coins_run,
		"flips": flips_run,
		"top_speed": int(top_speed_ms),
		"crashed": crashed,
		"fuel_out": fuel_out,
		"new_best": new_best,
		"stage_unlocked": stage_unlocked,
		"best": maxi(best, dist),
	}
	GameState.last_result = result
	EventBus.run_ended.emit(result)
	_navigate("results")

func _navigate(scene_name: String) -> void:
	await get_tree().create_timer(0.05).timeout
	get_tree().change_scene_to_file("res://scenes/%s.tscn" % scene_name)

# ----------------------------------------------------------------- smoke
func _autopilot(delta: float) -> void:
	# Simple but effective policy: hold the gas; in the air, level out.
	if not _countdown_done:
		return
	var car_v: float = car.body.velocity.x
	var gas := true
	var brake := false
	if car.airborne:
		var ang := car._wrap_angle(car.body.rotation)
		if ang > 0.45:
			gas = false
			brake = true   # frontflip input = right-rotate to level out
		elif ang < -0.45:
			gas = true      # backflip input
		else:
			gas = car_v > 20.0
	car.set_autopilot(gas, brake)
	# Steering assist: nudge to stay on track (no reverse needed in smoke).

func _finish_smoke() -> void:
	# Self-report for CI.
	var x_m: float = car.global_position.x / 20.0
	var ok_dist: bool = x_m > 40.0
	var ok_fuel: bool = fuel < fuel_capacity or coins_run >= 0
	var msg := "SMOKE: dist=%.0fm coins=%d flips=%d fuel=%.0f%% alive=%s crashed=%s" % [
		x_m, coins_run, flips_run, fuel / fuel_capacity * 100.0, str(car.alive), str(_crash_time >= 0.0)
	]
	print(msg)
	if ok_dist:
		print("SMOKE_PASS")
	else:
		print("SMOKE_FAIL")
	SaveManager.flush()
	get_tree().quit(0 if ok_dist else 1)

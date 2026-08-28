extends Node2D
## The car: rigid chassis + 2 spring-mounted wheel bodies + ragdoll driver.
## Hill-climb-style drive: wheel ground casts, tangential drive force,
## penalty-spring suspension, air torque, head/roof crash detection.

const PX := GameState.PX_PER_M

var def: Variant = null
var stats: Dictionary = {}
var terrain_ref: Variant = null   # Terrain node (set by run controller)

var body: RigidBody2D
var driver: RigidBody2D
var seat_joint: PinJoint2D
var head_sensor: Area2D
var roof_sensor: Area2D
var wheels: Array = []          # [{body, joint, cast, sprite}]
var wheel_tex: Texture2D = null

var alive: bool = true
var fuel_depleted: bool = false
var controls_enabled: bool = false
var _autopilot_gas: bool = false
var _autopilot_brake: bool = false

# Air / stunt state (read by run controller)
var air_rotation_delta: float = 0.0
var _air_start_rot: float = 0.0
var airborne: bool = false
var grounded_wheels: int = 0
var _upside_down_time: float = 0.0
var rpm: float = 0.0
var throttle: float = 0.0

signal flipped_in_air(flips: int, delta_rad: float)

func setup(v_index: int) -> void:
	def = GameState.vehicles()[v_index]
	stats = GameState.vehicle_stats(v_index)
	wheel_tex = load("res://assets/vehicles/wheel.png")
	_build()
	set_meta("is_vehicle", true)

# ------------------------------------------------------------------- build
func _build() -> void:
	body = RigidBody2D.new()
	body.mass = def.mass
	body.linear_damp = 0.06
	body.angular_damp = 0.9
	body.collision_layer = 2
	body.collision_mask = 1
	body.set_meta("is_vehicle", true)
	var poly := CollisionPolygon2D.new()
	poly.polygon = def.body_polygon
	body.add_child(poly)

	var art := Sprite2D.new()
	art.texture = def.body_texture
	art.scale = Vector2(1.0, 1.0)
	body.add_child(art)
	add_child(body)

	# Driver on a pin joint (seat).
	var seat_local := Vector2(0.02 * PX, 0.02 * PX)
	driver = RigidBody2D.new()
	driver.mass = 26.0
	driver.angular_damp = 2.5
	driver.linear_damp = 0.4
	driver.collision_layer = 4
	driver.collision_mask = 1
	var dshape := CollisionShape2D.new()
	var dcirc := CircleShape2D.new()
	dcirc.radius = 0.30 * PX
	dshape.shape = dcirc
	driver.add_child(dshape)
	var d_art := Sprite2D.new()
	d_art.texture = load("res://assets/characters/driver.png")
	# driver.png: hip at local (24,46); scale to world size, hip at body origin.
	d_art.scale = Vector2(0.45, 0.45)
	d_art.position = Vector2(-24.0, -46.0) * 0.45
	driver.add_child(d_art)

	head_sensor = Area2D.new()
	head_sensor.collision_layer = 0
	head_sensor.collision_mask = 1
	head_sensor.monitoring = true
	var hshape := CollisionShape2D.new()
	var hcirc := CircleShape2D.new()
	hcirc.radius = 0.20 * PX
	hshape.shape = hcirc
	head_sensor.add_child(hshape)
	head_sensor.position = Vector2(0, -12.0)
	driver.add_child(head_sensor)
	head_sensor.body_entered.connect(_on_head_hit)

	body.add_child(driver)
	seat_joint = PinJoint2D.new()
	seat_joint.node_a = body.get_path().get_path()
	seat_joint.node_b = driver.get_path()
	seat_joint.anchor = seat_local
	seat_joint.enabled = true
	body.add_child(seat_joint)

	# Roof crash sensor.
	roof_sensor = Area2D.new()
	roof_sensor.collision_layer = 0
	roof_sensor.collision_mask = 1
	var rshape := CollisionShape2D.new()
	var rcirc := CircleShape2D.new()
	rcirc.radius = 0.18 * PX
	rshape.shape = rcirc
	roof_sensor.add_child(rshape)
	roof_sensor.position = Vector2(0, -0.5 * PX)
	body.add_child(roof_sensor)
	roof_sensor.body_entered.connect(_on_roof_hit)

	# Wheels.
	for i in def.axle_offsets.size():
		var axle_local: Vector2 = def.axle_offsets[i]
		var wbody := RigidBody2D.new()
		wbody.mass = 9.0
		wbody.angular_damp = 0.2
		wbody.linear_damp = 0.0
		wbody.friction = 1.2
		wbody.collision_layer = 2
		wbody.collision_mask = 1
		var wshape := CollisionShape2D.new()
		var wcirc := CircleShape2D.new()
		wcirc.radius = def.wheel_radius
		wshape.shape = wcirc
		wbody.add_child(wshape)
		var w_art := Sprite2D.new()
		w_art.texture = wheel_tex
		# wheel.png tire radius is 61.4 px of image; scale to physics radius.
		var ws: float = def.wheel_radius / 61.4
		w_art.scale = Vector2(ws, ws)
		wbody.add_child(w_art)
		add_child(wbody)

		var joint := PinJoint2D.new()
		joint.node_a = body.get_path()
		joint.node_b = wbody.get_path()
		joint.anchor = axle_local
		body.add_child(joint)

		var cast := RayCast2D.new()
		cast.target = Vector2(0, def.wheel_radius * 2.3)
		cast.collision_mask = 1
		cast.enabled = true
		wbody.add_child(cast)

		wheels.append({
			"body": wbody,
			"joint": joint,
			"cast": cast,
			"sprite": w_art,
			"axle_local": axle_local,
		})
	# Park the wheels at their axles initially.
	for w in wheels:
		(w.body as RigidBody2D).global_position = \
			body.global_position + body.basis * (w.axle_local as Vector2)
	for w in wheels:
		(w.cast as RayCast2D).force_raycast_update()

# ------------------------------------------------------------------ update
func set_autopilot(gas: bool, brake: bool) -> void:
	_autopilot_gas = gas
	_autopilot_brake = brake

func _physics_process(delta: float) -> void:
	if not is_inside_tree():
		return
	var gas := false
	var brake := false
	if controls_enabled:
		if _autopilot_gas:
			gas = true
		elif _autopilot_brake:
			brake = true
		else:
			gas = Input.is_action_pressed("gas")
			brake = Input.is_action_pressed("brake")
	throttle = 1.0 if gas else 0.0

	var power: float = stats["power"]
	var air_torque: float = stats["air_torque"]
	var grip: float = stats["grip"]

	var x_m: float = global_position.x / PX
	var ice := terrain_ref != null and terrain_ref.is_ice(x_m)
	var grip_mult: float = 0.35 if ice else 1.0

	grounded_wheels = 0
	var any_ground := false
	for w in wheels:
		var wbody: RigidBody2D = w.body
		var cast: RayCast2D = w.cast
		# Keep the cast pointing straight down in world space.
		cast.target = wbody.global_transform.basis.inverse() * Vector2(0, def.wheel_radius * 2.3)
		cast.force_raycast_update()
		var hit := cast.is_colliding()
		if hit:
			any_ground = true
			grounded_wheels += 1
			var n: Vector2 = cast.get_normal()
			var t := Vector2(-n.y, n.x)
			if t.dot(Vector2(1, 0)) < 0.0:
				t = -t
				n = -n
			var contact: Vector2 = cast.get_position()
			var f_drive := power * 0.5 * grip_mult
			var v_rel := wbody.velocity - _body_velocity_at(w.axle_local)
			# Kill sinking into the surface.
			var into := -v_rel.dot(n)
			if into > 0.0:
				wbody.velocity -= n * into * 1.0
			if gas:
				wbody.apply_force(t * f_drive, contact)
				# A little extra rolling torque so the wheel visibly spins.
				wbody.apply_torque(f_drive * def.wheel_radius * 0.02)
			if brake:
				var along := wbody.velocity.dot(t)
				if along > 10.0:
					wbody.apply_force(-t * power * 0.55 * grip_mult, contact)
				else:
					wbody.apply_force(-t * power * 0.35 * grip_mult, contact)
	# Suspension springs.
	var k: float = stats["spring_k"]
	var c: float = stats["spring_c"]
	for w in wheels:
		var wbody: RigidBody2D = w.body
		var rest := body.global_position + body.basis * (w.axle_local as Vector2)
		var disp := rest - wbody.global_position
		var v_rel := wbody.velocity - _body_velocity_at(w.axle_local)
		var f_spring := disp * k - v_rel * c
		wbody.apply_central_force(f_spring)
	# Stability assist: align the chassis "up" with the terrain normal.
	if any_ground and terrain_ref != null:
		var target_up: Vector2 = terrain_ref.normal_at(x_m)
		var up_vec: Vector2 = Vector2.UP.rotated(body.rotation)
		var err: float = _wrap_angle(target_up.angle() - up_vec.angle())
		body.apply_torque(err * body.inertia * 0.85)

	# Airborne handling.
	if not any_ground:
		if not airborne:
			airborne = true
			_air_start_rot = body.rotation
		if gas:
			body.apply_torque(-air_torque * body.inertia * 1.0)   # backflip
		elif brake:
			body.apply_torque(air_torque * body.inertia * 0.85)  # frontflip
	else:
		if airborne:
			airborne = false
			var total := _angle_delta(body.rotation - _air_start_rot)
			air_rotation_delta = total
			var flips := int(absf(total) / TAU)
			if flips >= 1:
				flipped_in_air.emit(flips, total)
	# Upside-down guard.
	if any_ground and absf(_wrap_angle(body.rotation)) > 1.7:
		_upside_down_time += delta
		if _upside_down_time > 0.4:
			crash()
	else:
		_upside_down_time = 0.0

	# RPM for audio: speed + throttle.
	var speed_ms: float = body.velocity.length() / PX
	rpm = clampf(speed_ms / 26.0, 0.0, 1.0) * 0.7 + throttle * 0.3
	if fuel_depleted:
		rpm = 0.0

func _body_velocity_at(local: Vector2) -> Vector2:
	return body.velocity + Vector2(
		-body.angular_velocity * local.y,
		 body.angular_velocity * local.x
	)

func _angle_delta(a: float) -> float:
	var d := fposmod(a + PI, TAU) - PI
	return d

func _wrap_angle(a: float) -> float:
	# Rotation relative to upright, wrapped to [-PI, PI].
	return _angle_delta(a)

# -------------------------------------------------------------------- crash
func _on_head_hit(_body: Node2D) -> void:
	_crash_check()

func _on_roof_hit(_body: Node2D) -> void:
	_crash_check()

func _crash_check() -> void:
	if not alive:
		return
	# Give the first moment of the run a grace period.
	if not controls_enabled:
		return
	crash()

func crash() -> void:
	if not alive:
		return
	alive = false
	# Release joints: driver ragdolls, wheels fly free.
	seat_joint.disabled = true
	for w in wheels:
		(w.joint as PinJoint2D).disabled = true
	(w.body as RigidBody2D).apply_impulse(Vector2(randf_range(-1.0, 1.0) * 260.0, -randf_range(280.0, 620.0)), global_position)
	(driver as RigidBody2D).apply_impulse(Vector2(randf_range(-1.0, 1.0) * 220.0, -randf_range(320.0, 700.0)), driver.global_position)
	for w in wheels:
		var wb: RigidBody2D = w.body
		wb.apply_impulse(Vector2(randf_range(-300.0, 300.0), -randf_range(200.0, 600.0)), wb.global_position)

func disable_engine() -> void:
	fuel_depleted = true

func is_fuel_dead() -> bool:
	return fuel_depleted

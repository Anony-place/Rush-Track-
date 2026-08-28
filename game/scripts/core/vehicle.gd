extends Node2D
## The car: rigid chassis body + two free wheel bodies pinned to the axles by
## PinJoint2D (4.3 style: the joint node's own position is the pin point).
## Hill-climb-style drive: engine TORQUE on the wheels, ground friction provides
## traction, axle ground casts for state, air torque, head/roof crash detection.
##
## Why this shape (Godot 4.3):
##  - RigidBody2D.velocity -> linear_velocity; RayCast2D uses target_position /
##    get_collision_point / get_collision_normal; joints have no anchor or
##    disabled properties (queue_free to release).
##  - 4.3 pin joints have no positional correction, so a low-gain "joint
##    keeper" spring re-pins wheels to the axles if the solver lets them drift.
##  - Penalty-suspension springs are NOT used: they fight the joint solver and
##    blow up. The wheel circles ride the terrain directly (rigid axle), which
##    is stable and still reads as suspension at our scale.
##  - A fused single-body chassis wedges (statically indeterminate two-contact
##    drive), and axle force drive wedges too; wheel torque + friction is the
##    statically determinate pattern.

const PX := GameState.PX_PER_M
const JOINT_KEEPER_K := 1400.0    # soft re-pin force for wheel drift
const JOINT_KEEPER_MAX_DIST := 10.0

var def: Variant = null
var stats: Dictionary = {}
var terrain_ref: Variant = null   # Terrain node (set by run controller)

var body: RigidBody2D
var driver_root: Node2D          # visual driver seat pivot
var driver_art: Sprite2D
var head_sensor: Area2D
var roof_sensor: Area2D
var wheels: Array = []           # [{body, joint, cast, sprite, axle_local}]
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

# Crash ragdoll effect (visual driver launched on crash).
var _ragdoll: RigidBody2D = null
var _ragdoll_timer: float = 0.0

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
	body.linear_damp = 0.05
	body.angular_damp = 0.8
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

	# Driver: visual only, leaning with angular velocity.
	var seat_local := Vector2(0.02 * PX, -0.10 * PX)
	driver_root = Node2D.new()
	driver_root.position = seat_local
	driver_art = Sprite2D.new()
	driver_art.texture = load("res://assets/characters/driver.png")
	# driver.png: hip at local (24,46); scale to world size, hip at pivot.
	driver_art.scale = Vector2(0.30, 0.30)
	driver_art.position = Vector2(-24.0, -46.0) * 0.30
	driver_root.add_child(driver_art)
	body.add_child(driver_root)

	# Head crash sensor (driver's head ~12 px above the seat).
	head_sensor = Area2D.new()
	head_sensor.collision_layer = 0
	head_sensor.collision_mask = 1
	head_sensor.monitoring = true
	var hshape := CollisionShape2D.new()
	var hcirc := CircleShape2D.new()
	hcirc.radius = 0.20 * PX
	hshape.shape = hcirc
	head_sensor.add_child(hshape)
	head_sensor.position = Vector2(0.02 * PX, -12.0)
	body.add_child(head_sensor)
	head_sensor.body_entered.connect(_on_head_hit)

	# Roof crash sensor.
	roof_sensor = Area2D.new()
	roof_sensor.collision_layer = 0
	roof_sensor.collision_mask = 1
	var rshape := CollisionShape2D.new()
	var rcirc := CircleShape2D.new()
	rcirc.radius = 0.18 * PX
	rshape.shape = rcirc
	roof_sensor.add_child(rshape)
	roof_sensor.position = Vector2(0.0, -0.5 * PX)
	body.add_child(roof_sensor)
	roof_sensor.body_entered.connect(_on_roof_hit)

	# Wheels: free rigid bodies pinned to the chassis.
	for i in def.axle_offsets.size():
		var axle_local: Vector2 = def.axle_offsets[i]

		var wbody := RigidBody2D.new()
		wbody.mass = 9.0
		wbody.linear_damp = 0.0
		wbody.angular_damp = 0.25
		var wmat := PhysicsMaterial.new()
		wmat.friction = 1.2
		wbody.physics_material_override = wmat
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
		# Park the wheel exactly at its axle BEFORE configuring the joint:
		# the joint bakes its anchors from the bodies' transforms at that moment.
		wbody.global_position = body.global_position + axle_local

		var joint := PinJoint2D.new()
		joint.position = axle_local
		body.add_child(joint)
		joint.node_a = joint.get_path_to(body)
		joint.node_b = joint.get_path_to(wbody)

		var cast := RayCast2D.new()
		cast.target_position = Vector2(0, def.wheel_radius * 1.6)
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

	for w in wheels:
		(w.cast as RayCast2D).force_raycast_update()

# ------------------------------------------------------------------ update
## Vertical distance from the vehicle root (body center) to the lowest wheel point.
func spawn_clearance() -> float:
	var max_c: float = 0.0
	for off in def.axle_offsets:
		max_c = maxf(max_c, off.y + def.wheel_radius)
	return max_c

func set_autopilot(gas: bool, brake: bool) -> void:
	_autopilot_gas = gas
	_autopilot_brake = brake

func _physics_process(delta: float) -> void:
	if not is_inside_tree():
		return
	var gas := false
	var brake := false
	if controls_enabled and alive:
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

	var x_m: float = global_position.x / PX
	var ice: bool = terrain_ref != null and terrain_ref.is_ice(x_m)
	var grip_mult: float = 0.35 if ice else 1.0

	grounded_wheels = 0
	var any_ground := false
	for w in wheels:
		var wbody: RigidBody2D = w.body
		var cast: RayCast2D = w.cast
		# Keep the cast pointing straight down in world space (wheel spins).
		cast.target_position = wbody.global_transform.affine_inverse() * Vector2(0, def.wheel_radius * 1.6)
		cast.force_raycast_update()
		var hit := cast.is_colliding()
		if hit:
			any_ground = true
			grounded_wheels += 1
			var n: Vector2 = cast.get_collision_normal()
			var t := Vector2(-n.y, n.x)
			if t.dot(Vector2(1, 0)) < 0.0:
				t = -t
				n = -n
			# Engine torque: ground friction converts wheel spin into traction.
			var f_drive: float = power * 0.5
			if gas:
				wbody.apply_torque(f_drive * def.wheel_radius * grip_mult)
			if brake:
				var v_at: Vector2 = _body_velocity_at(w.axle_local as Vector2)
				var along: float = v_at.dot(t)
				if along > 10.0:
					wbody.apply_torque(-power * 0.55 * def.wheel_radius * grip_mult)
				else:
					wbody.apply_torque(-power * 0.35 * def.wheel_radius * grip_mult)

	# Joint keeper: 4.3 pin joints have no positional correction, so softly
	# re-pin wheels that the solver let drift away from their axles.
	for w in wheels:
		var wbody: RigidBody2D = w.body
		var axle_w: Vector2 = body.global_position + body.global_transform * (w.axle_local as Vector2)
		var drift: Vector2 = axle_w - wbody.global_position
		var dist: float = drift.length()
		if dist > 1.5:
			var f_keep: float = JOINT_KEEPER_K * minf(dist, JOINT_KEEPER_MAX_DIST)
			wbody.apply_central_force(drift.normalized() * f_keep)
			# Damp the drift velocity to avoid oscillation.
			var v_drift: Vector2 = wbody.linear_velocity - _body_velocity_at(w.axle_local as Vector2)
			wbody.apply_central_force(-v_drift.normalized() * minf(f_keep, v_drift.length() * 90.0))

	# Stability assist: align the chassis "up" with the terrain normal.
	if any_ground and terrain_ref != null and alive:
		var target_up: Vector2 = terrain_ref.normal_at(x_m)
		var up_vec: Vector2 = Vector2.UP.rotated(body.rotation)
		var err: float = _wrap_angle(target_up.angle() - up_vec.angle())
		body.apply_torque(err * body.inertia * 0.55)

	# Airborne handling.
	if not any_ground:
		if not airborne:
			airborne = true
			_air_start_rot = body.rotation
		if alive:
			if gas:
				body.apply_torque(-air_torque * body.inertia * 1.6)   # backflip
			elif brake:
				body.apply_torque(air_torque * body.inertia * 1.6)    # frontflip
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

	# Driver visual: lean with angular velocity.
	if alive and driver_root != null:
		driver_root.rotation = lerp_angle(
			driver_root.rotation,
			clampf(-body.angular_velocity * 0.06, -0.5, 0.5),
			8.0 * delta
		)

	# Ragdoll cleanup.
	if _ragdoll != null:
		_ragdoll_timer -= delta
		if _ragdoll_timer <= 0.0 and is_instance_valid(_ragdoll):
			_ragdoll.queue_free()
			_ragdoll = null

	# RPM for audio: speed + throttle.
	var speed_ms: float = body.linear_velocity.length() / PX
	rpm = clampf(speed_ms / 26.0, 0.0, 1.0) * 0.7 + throttle * 0.3
	if fuel_depleted:
		rpm = 0.0

## Velocity of the chassis at a body-local point (for brake / keeper math).
func _body_velocity_at(local: Vector2) -> Vector2:
	return body.linear_velocity + Vector2(
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
	# Release the joints: the driver ragdolls, the wheels fly free.
	for w in wheels:
		(w.joint as PinJoint2D).queue_free()
		(w.body as RigidBody2D).apply_impulse(
			Vector2(randf_range(-300.0, 300.0), -randf_range(200.0, 600.0)),
			(w.body as RigidBody2D).global_position
		)
	# Launch a visual ragdoll (the driver) so the crash reads on screen.
	if driver_root != null and is_instance_valid(driver_root):
		_ragdoll = RigidBody2D.new()
		_ragdoll.collision_layer = 4
		_ragdoll.collision_mask = 1
		_ragdoll.linear_damp = 0.1
		var ds := CollisionShape2D.new()
		var dc := CircleShape2D.new()
		dc.radius = 0.22 * PX
		ds.shape = dc
		_ragdoll.add_child(ds)
		var rart := Sprite2D.new()
		rart.texture = load("res://assets/characters/driver.png")
		rart.scale = Vector2(0.30, 0.30)
		rart.position = Vector2(-24.0, -46.0) * 0.30
		_ragdoll.add_child(rart)
		_ragdoll.global_position = head_sensor.global_position
		_ragdoll.linear_velocity = body.linear_velocity + Vector2(
			randf_range(-1.0, 1.0) * 60.0,
			-randf_range(180.0, 320.0)
		)
		_ragdoll.angular_velocity = randf_range(-10.0, 10.0)
		add_child(_ragdoll)
		_ragdoll_timer = 4.0
		driver_root.visible = false
	body.linear_velocity *= 0.55

func disable_engine() -> void:
	fuel_depleted = true

func is_fuel_dead() -> bool:
	return fuel_depleted

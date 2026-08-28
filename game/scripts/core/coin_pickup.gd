extends Area2D
## Spinning coin. Collected on contact with the vehicle (or magnetized).

static func tex() -> Texture2D:
	return load("res://assets/ui/icon_coin.png")

var value: int = 1
var collected: bool = false
var _spin_phase: float = 0.0
var _base_y: float = 0.0
var _bob: float = 0.0
var _magnet: bool = false
var _magnet_target: Node2D = null

func _ready() -> void:
	collision_layer = 8
	collision_mask = 2
	body_entered.connect(_on_body_entered)
	var shape := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 14.0
	shape.shape = circ
	add_child(shape)
	var spr := Sprite2D.new()
	spr.texture = tex()
	spr.scale = Vector2(0.6, 0.6)
	spr.name = "Sprite"
	add_child(spr)
	_base_y = position.y
	_spin_phase = randf() * TAU
	_bob = randf() * TAU

func _physics_process(delta: float) -> void:
	if collected:
		return
	if _magnet and _magnet_target != null and is_instance_valid(_magnet_target):
		var to := (_magnet_target as Node2D).global_position - global_position
		var dist := to.length()
		if dist < 6.0:
			_collect()
			return
		global_position += to.normalized() * 600.0 * delta
	else:
		_spin_phase += delta * 4.0
		_bob += delta * 3.0
		var spr := get_node_or_null("Sprite")
		if spr:
			spr.rotation = _spin_phase
		position.y = _base_y + sin(_bob) * 4.0

func start_magnet(target: Node2D) -> void:
	_magnet = true
	_magnet_target = target

func _on_body_entered(body: Node2D) -> void:
	if body.get_meta("is_vehicle", false) and not collected:
		_collect()

func _collect() -> void:
	collected = true
	AudioManager.play_sfx("coin", 0.06)
	var spr := get_node_or_null("Sprite")
	if spr and is_instance_valid(spr):
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(spr, "scale", Vector2(1.6, 1.6), 0.12)
		tw.tween_property(spr, "modulate:a", 0.0, 0.16)
	await get_tree().create_timer(0.18).timeout
	EventBus.coin_collected.emit(value)
	queue_free()

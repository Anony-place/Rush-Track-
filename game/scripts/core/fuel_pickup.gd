extends Area2D
## Fuel canister. Restores fuel; glows softly and bobs.

static func tex() -> Texture2D:
	return load("res://assets/ui/icon_fuel.png")
const FUEL_AMOUNT: float = 35.0

var collected: bool = false
var _bob: float = 0.0

func _ready() -> void:
	collision_layer = 8
	collision_mask = 2
	body_entered.connect(_on_body_entered)
	var shape := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 16.0
	shape.shape = circ
	add_child(shape)
	var spr := Sprite2D.new()
	spr.texture = tex()
	spr.scale = Vector2(0.66, 0.66)
	spr.name = "Sprite"
	add_child(spr)
	_bob = randf() * TAU

func _process(delta: float) -> void:
	if collected:
		return
	_bob += delta * 2.4
	var spr := get_node_or_null("Sprite")
	if spr:
		spr.position.y = sin(_bob) * 5.0

func _on_body_entered(body: Node2D) -> void:
	if body.get_meta("is_vehicle", false) and not collected:
		_collect()

func _collect() -> void:
	collected = true
	AudioManager.play_sfx("fuel")
	var spr := get_node_or_null("Sprite")
	if spr and is_instance_valid(spr):
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(spr, "scale", Vector2(1.5, 1.5), 0.14)
		tw.tween_property(spr, "modulate:a", 0.0, 0.2)
	await get_tree().create_timer(0.2).timeout
	EventBus.fuel_pickup.emit(FUEL_AMOUNT)
	queue_free()

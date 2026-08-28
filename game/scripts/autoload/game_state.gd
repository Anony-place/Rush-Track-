extends Node
## Runtime data model: vehicle & stage definitions, upgrade math, current
## selection. Pure data + derived stats; persistence lives in SaveManager.

const PX_PER_M := 20.0

const UPGRADE_TRACKS: Array[String] = ["engine", "suspension", "tires", "tank", "air"]
const UPGRADE_NAMES: Dictionary = {
	"engine": "Engine",
	"suspension": "Suspension",
	"tires": "Tires",
	"tank": "Fuel Tank",
	"air": "Air Control",
}
const UPGRADE_MAX := 5

# ---------------------------------------------------------------- vehicles
class VehicleDef:
	var index: int
	var name: String
	var tagline: String
	var price: int
	var body_texture: Texture2D
	var color: Color
	var mass: float
	var wheel_radius: float
	var wheelbase: float
	var power: float          # drive force (px units) at level 0
	var air_torque: float     # rad/s^2-ish air control strength
	var grip: float
	var tank_capacity: float
	var fuel_drain: float     # per second at full throttle
	var body_polygon: PackedVector2Array
	var axle_offsets: Array[Vector2]

static func vehicles() -> Array:
	return [
		_buggy(),
		_mauler(),
		_vortex(),
	]

static func _buggy() -> VehicleDef:
	var v := VehicleDef.new()
	v.index = 0
	v.name = "Scout Buggy"
	v.tagline = "Featherweight off-road classic."
	v.price = 0
	v.body_texture = load("res://assets/vehicles/buggy_body.png")
	v.color = Color(0.93, 0.62, 0.12)
	v.mass = 110.0
	v.wheel_radius = 0.42 * PX_PER_M
	v.wheelbase = 1.75 * PX_PER_M
	v.power = 15500.0
	v.air_torque = 1.15
	v.grip = 1.0
	v.tank_capacity = 100.0
	v.fuel_drain = 1.05
	var w := 1.15 * PX_PER_M
	var l := 2.05 * PX_PER_M
	v.body_polygon = PackedVector2Array([
		Vector2(-l/2, 0.18*PX_PER_M), Vector2(-l/2 + 0.25*PX_PER_M, -0.12*PX_PER_M),
		Vector2(-0.35*PX_PER_M, -0.16*PX_PER_M), Vector2(0.42*PX_PER_M, -0.16*PX_PER_M),
		Vector2(l/2, -0.05*PX_PER_M), Vector2(l/2, 0.2*PX_PER_M),
		Vector2(l/2 - 0.15*PX_PER_M, 0.34*PX_PER_M), Vector2(-l/2 + 0.3*PX_PER_M, 0.34*PX_PER_M),
	])
	v.axle_offsets = [Vector2(-0.72*PX_PER_M, 0.42*PX_PER_M), Vector2(0.72*PX_PER_M, 0.42*PX_PER_M)]
	return v

static func _mauler() -> VehicleDef:
	var v := VehicleDef.new()
	v.index = 1
	v.name = "Dune Mauler"
	v.tagline = "Monster truck. Eats ramps."
	v.price = 10000
	v.body_texture = load("res://assets/vehicles/mauler_body.png")
	v.color = Color(0.95, 0.45, 0.15)
	v.mass = 155.0
	v.wheel_radius = 0.55 * PX_PER_M
	v.wheelbase = 1.85 * PX_PER_M
	v.power = 18500.0
	v.air_torque = 0.85
	v.grip = 1.18
	v.tank_capacity = 130.0
	v.fuel_drain = 1.2
	var l := 2.3 * PX_PER_M
	v.body_polygon = PackedVector2Array([
		Vector2(-l/2, 0.0), Vector2(-l/2 + 0.2*PX_PER_M, -0.3*PX_PER_M),
		Vector2(0.3*PX_PER_M, -0.34*PX_PER_M), Vector2(l/2, -0.2*PX_PER_M),
		Vector2(l/2, 0.28*PX_PER_M), Vector2(-l/2 + 0.1*PX_PER_M, 0.28*PX_PER_M),
	])
	v.axle_offsets = [Vector2(-0.85*PX_PER_M, 0.55*PX_PER_M), Vector2(0.85*PX_PER_M, 0.55*PX_PER_M)]
	return v

static func _vortex() -> VehicleDef:
	var v := VehicleDef.new()
	v.index = 2
	v.name = "Vortex GT"
	v.tagline = "Rally prototype. Razor sharp."
	v.price = 25000
	v.body_texture = load("res://assets/vehicles/vortex_body.png")
	v.color = Color(0.2, 0.85, 0.95)
	v.mass = 125.0
	v.wheel_radius = 0.38 * PX_PER_M
	v.wheelbase = 1.9 * PX_PER_M
	v.power = 21500.0
	v.air_torque = 1.35
	v.grip = 0.95
	v.tank_capacity = 110.0
	v.fuel_drain = 1.1
	var l := 2.4 * PX_PER_M
	v.body_polygon = PackedVector2Array([
		Vector2(-l/2, -0.02*PX_PER_M), Vector2(-l/2 + 0.3*PX_PER_M, -0.2*PX_PER_M),
		Vector2(0.1*PX_PER_M, -0.26*PX_PER_M), Vector2(l/2, -0.12*PX_PER_M),
		Vector2(l/2, 0.18*PX_PER_M), Vector2(-l/2 + 0.12*PX_PER_M, 0.2*PX_PER_M),
	])
	v.axle_offsets = [Vector2(-0.8*PX_PER_M, 0.4*PX_PER_M), Vector2(0.8*PX_PER_M, 0.4*PX_PER_M)]
	return v

## Derived stats including upgrade levels (per vehicle).
func vehicle_stats(index: int) -> Dictionary:
	var def: VehicleDef = vehicles()[index]
	var eng := float(SaveManager.upgrade_level(index, "engine"))
	var sus := float(SaveManager.upgrade_level(index, "suspension"))
	var tir := float(SaveManager.upgrade_level(index, "tires"))
	var tank := float(SaveManager.upgrade_level(index, "tank"))
	var air := float(SaveManager.upgrade_level(index, "air"))
	var k: float = (480.0 + 110.0 * sus) * (def.mass / 110.0)
	return {
		"power": def.power * (1.0 + 0.09 * eng),
		"spring_k": k,
		"spring_c": 0.7 * sqrt(k * def.mass * 0.5),
		"grip": def.grip * (1.0 + 0.08 * tir),
		"tank": def.tank_capacity * (1.0 + 0.18 * tank),
		"drain": def.fuel_drain * (1.0 - 0.04 * tank),
		"air_torque": def.air_torque * (1.0 + 0.12 * air),
	}

# ------------------------------------------------------------------ stages
class StageDef:
	var index: int
	var name: String
	var tagline: String = ""
	var sky_top: Color
	var sky_bottom: Color
	var fog: Color
	var ground_dark: Color
	var ground_mid: Color
	var ground_top: Color
	var slope_start: float
	var slope_end: float
	var frequency: float
	var ice: bool = false
	var weather: String = ""      # "" | "snow" | "dust" | "heat"
	var ambience: String = ""     # audio file base name
	var theme: String = ""        # music base name

static func stages() -> Array:
	var s0 := StageDef.new()
	s0.index = 0
	s0.name = "Sunny Meadows"
	s0.tagline = "Rolling green hills. Where legends begin."
	s0.sky_top = Color(0.33, 0.66, 0.95)
	s0.sky_bottom = Color(0.78, 0.92, 0.98)
	s0.fog = Color(0.85, 0.93, 0.95)
	s0.ground_dark = Color(0.36, 0.24, 0.15)
	s0.ground_mid = Color(0.52, 0.35, 0.2)
	s0.ground_top = Color(0.35, 0.72, 0.28)
	s0.slope_start = 2.2
	s0.slope_end = 7.5
	s0.frequency = 1.0
	s0.ambience = "amb_birds"
	s0.theme = "run_theme"

	var s1 := StageDef.new()
	s1.index = 1
	s1.name = "Dust Canyon"
	s1.tagline = "Steep red rock and long, long air."
	s1.sky_top = Color(0.95, 0.55, 0.25)
	s1.sky_bottom = Color(0.99, 0.85, 0.6)
	s1.fog = Color(0.98, 0.82, 0.6)
	s1.ground_dark = Color(0.42, 0.2, 0.12)
	s1.ground_mid = Color(0.66, 0.36, 0.2)
	s1.ground_top = Color(0.85, 0.55, 0.3)
	s1.slope_start = 3.5
	s1.slope_end = 11.0
	s1.frequency = 1.15
	s1.weather = "dust"
	s1.ambience = "amb_wind"
	s1.theme = "run_theme"

	var s2 := StageDef.new()
	s2.index = 2
	s2.name = "Neon Harbor"
	s2.tagline = "After-dark rally streets and mega ramps."
	s2.sky_top = Color(0.05, 0.05, 0.18)
	s2.sky_bottom = Color(0.35, 0.15, 0.5)
	s2.fog = Color(0.16, 0.12, 0.32)
	s2.ground_dark = Color(0.1, 0.1, 0.2)
	s2.ground_mid = Color(0.2, 0.2, 0.36)
	s2.ground_top = Color(0.3, 0.3, 0.55)
	s2.slope_start = 3.0
	s2.slope_end = 9.5
	s2.frequency = 1.05
	s2.weather = "heat"
	s2.ambience = "amb_city"
	s2.theme = "run_theme"

	var s3 := StageDef.new()
	s3.index = 3
	s3.name = "Frostbite Pass"
	s3.tagline = "Ice cuts your grip. Respect the whiteout."
	s3.sky_top = Color(0.55, 0.7, 0.85)
	s3.sky_bottom = Color(0.9, 0.95, 1.0)
	s3.fog = Color(0.9, 0.95, 1.0)
	s3.ground_dark = Color(0.35, 0.45, 0.6)
	s3.ground_mid = Color(0.55, 0.68, 0.82)
	s3.ground_top = Color(0.95, 0.98, 1.0)
	s3.slope_start = 3.0
	s3.slope_end = 9.0
	s3.frequency = 1.0
	s3.ice = true
	s3.weather = "snow"
	s3.ambience = "amb_arctic"
	s3.theme = "run_theme"

	return [s0, s1, s2, s3]

func stage(index: int) -> StageDef:
	return stages()[index]

## Last completed run result (set by run controller, consumed by results UI).
var last_result: Dictionary = {}

# ---------------------------------------------------------------- selection
func get_selected_vehicle() -> int:
	return int(SaveManager.read("selected_vehicle", 0))

func get_selected_stage() -> int:
	return int(SaveManager.read("selected_stage", 0))

func set_selected_vehicle(i: int) -> void:
	SaveManager.write("selected_vehicle", i)
	EventBus.settings_changed.emit("selected_vehicle")

func set_selected_stage(i: int) -> void:
	SaveManager.write("selected_stage", i)
	EventBus.settings_changed.emit("selected_stage")

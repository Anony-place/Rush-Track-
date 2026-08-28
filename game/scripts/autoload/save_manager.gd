extends Node
## Persistent storage: versioned JSON document in user://, atomic writes.
## Writes are debounced (max one file write per second) and forced at
## run-end / scene transitions / app pause.

const SAVE_PATH := "user://rushtrack_save.json"
const SAVE_VERSION := 2

var _data: Dictionary = {}
var _dirty: bool = false
var _save_pending: bool = false

# ---------------------------------------------------------------- lifecycle
func _ready() -> void:
	load_save()
	process_mode = ProcessMode.PROCESS_MODE_ALWAYS

func default_data() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"coins": 0,
		"total_coins_earned": 0,
		"total_distance": 0,
		"play_seconds": 0,
		"selected_vehicle": 0,
		"selected_stage": 0,
		"unlocked_vehicles": [0],
		"best": {0: 0, 1: 0, 2: 0, 3: 0},
		"upgrades": {
			# vehicle -> {track: level 0..5}
			0: {"engine": 0, "suspension": 0, "tires": 0, "tank": 0, "air": 0},
			1: {"engine": 0, "suspension": 0, "tires": 0, "tank": 0, "air": 0},
			2: {"engine": 0, "suspension": 0, "tires": 0, "tank": 0, "air": 0},
		},
		"settings": {
			"music_volume": 0.8,
			"sfx_volume": 1.0,
			"engine_volume": 0.9,
			"vibration": true,
			"particle_quality": "high",
		},
		"entitlements": {
			"remove_ads": false,
		},
		"seen": {
			"first_run_tip": false,
		},
		"stats": {
			"runs": 0,
			"crashes": 0,
			"flips": 0,
			"top_speed": 0,
		},
	}

func load_save() -> void:
	_data = default_data()
	if not FileAccess.file_exists(SAVE_PATH):
		save()
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		push_warning("SaveManager: cannot open save (err %d) — using defaults" % FileAccess.get_open_error())
		save()
		return
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("SaveManager: corrupt save — resetting")
		save()
		return
	# Merge stored values over defaults (schema-tolerant).
	var defaults := default_data()
	_deep_merge(defaults, parsed)
	_data = defaults
	var stored_version: int = int(_data.get("version", 0))
	if stored_version < SAVE_VERSION:
		_migrate(stored_version)
		_data["version"] = SAVE_VERSION
		save()

func _deep_merge(base: Dictionary, overlay: Dictionary) -> void:
	for k in overlay.keys():
		if typeof(overlay[k]) == TYPE_DICTIONARY and typeof(base.get(k)) == TYPE_DICTIONARY:
			_deep_merge(base[k], overlay[k])
		elif typeof(overlay[k]) == TYPE_ARRAY and typeof(base.get(k)) == TYPE_ARRAY:
			base[k] = overlay[k]
		else:
			base[k] = overlay[k]

func _migrate(from_version: int) -> void:
	# v1 -> v2: default_data already provides all new keys after the merge.
	pass

func save() -> void:
	# Atomic: write temp file then copy over, so a crash never truncates the save.
	var tmp := SAVE_PATH + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		push_error("SaveManager: cannot write %s (err %d)" % [tmp, FileAccess.get_open_error()])
		return
	f.store_string(JSON.stringify(_data, "\t"))
	f.close()
	var err := DirAccess.copy_absolute(tmp, SAVE_PATH)
	if err != OK:
		push_error("SaveManager: atomic copy failed (err %d)" % err)
	DirAccess.remove_absolute(tmp)

func _schedule_save() -> void:
	_dirty = true
	if not _save_pending:
		_save_pending = true
		await get_tree().create_timer(1.0).timeout
		_save_pending = false
		if _dirty:
			_dirty = false
			save()

func flush() -> void:
	_save_pending = false
	if _dirty:
		_dirty = false
		save()

func _notification(what: int) -> void:
	if what == NOTIFICATION_PAUSED:
		flush()

# ------------------------------------------------------------------- access
func read(path: String, fallback: Variant = null) -> Variant:
	var cursor: Variant = _data
	for part in path.split("."):
		if typeof(cursor) == TYPE_DICTIONARY and (cursor as Dictionary).has(part):
			cursor = (cursor as Dictionary)[part]
		else:
			return fallback
	return cursor

func write(path: String, value: Variant) -> void:
	var parts := path.split(".")
	var cursor: Dictionary = _data
	for i in range(parts.size() - 1):
		var key: String = parts[i]
		if not cursor.has(key) or typeof(cursor[key]) != TYPE_DICTIONARY:
			cursor[key] = {}
		cursor = cursor[key] as Dictionary
	cursor[parts[parts.size() - 1]] = value
	_schedule_save()

func get_coins() -> int:
	return int(read("coins", 0))

func add_coins(amount: int) -> void:
	var total: int = clampi(get_coins() + amount, 0, 99999999)
	write("coins", total)
	if amount > 0:
		write("total_coins_earned", int(read("total_coins_earned", 0)) + amount)
	EventBus.coins_changed.emit(total)

func spend_coins(amount: int) -> bool:
	if get_coins() < amount:
		return false
	add_coins(-amount)
	EventBus.coins_spent.emit(amount)
	return true

func best_distance(stage_index: int) -> int:
	return int(read("best.%d" % stage_index, 0))

func set_best(stage_index: int, distance: int) -> void:
	write("best.%d" % stage_index, distance)

func best_distance_any() -> int:
	var m := 0
	for i in 4:
		m = maxi(m, best_distance(i))
	return m

func is_stage_unlocked(stage_index: int) -> bool:
	var best_any := best_distance_any()
	match stage_index:
		0: return true
		1: return best_any >= 400
		2: return best_any >= 900
		3: return best_any >= 1600
		_: return false

func is_vehicle_unlocked(index: int) -> bool:
	var arr: Array = read("unlocked_vehicles", [0])
	for v in arr:
		if int(v) == index:
			return true
	return false

func unlock_vehicle(index: int) -> void:
	var arr: Array = read("unlocked_vehicles", [0]).duplicate()
	if not arr.has(index):
		arr.append(index)
		write("unlocked_vehicles", arr)
		EventBus.vehicle_unlocked.emit(index)

func upgrade_level(vehicle_index: int, track: String) -> int:
	return int(read("upgrades.%d.%s" % [vehicle_index, track], 0))

func upgrade_cost(vehicle_index: int, track: String) -> int:
	var level := upgrade_level(vehicle_index, track)
	if level >= 5:
		return -1
	return int(ceil(180.0 * pow(level + 1, 1.85) * _track_base(track)))

func _track_base(track: String) -> float:
	match track:
		"engine": return 1.0
		"suspension": return 0.9
		"tires": return 0.8
		"tank": return 0.7
		"air": return 0.85
		_: return 1.0

func buy_upgrade(vehicle_index: int, track: String) -> bool:
	var cost := upgrade_cost(vehicle_index, track)
	if cost < 0:
		return false
	if not spend_coins(cost):
		return false
	write("upgrades.%d.%s" % [vehicle_index, track], upgrade_level(vehicle_index, track) + 1)
	return true

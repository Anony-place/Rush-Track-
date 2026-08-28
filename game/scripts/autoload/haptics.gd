extends Node
## Haptic feedback for Android. Uses the engine's Java interop singleton
## (JavaClassWrapper) entirely via runtime reflection, so this script parses
## and runs on every platform: off-Android the bridge calls are never made
## and vibration is simply off. Gated by the user's vibration setting.
##
## Note: Godot 4.3 exposes only `JavaClassWrapper.wrap()`; the context is
## obtained through the host app class (com.godot.Godot) where possible, with
## a fallback to the newer `get_context()` shape on 4.4+.

const PATTERNS: Dictionary = {
	"tick": 15,
	"soft": 30,
	"medium": 55,
	"heavy": 90,
	"crash": 220,
	"flip": 45,
}

var _vibrator: Variant = null
var _init_attempted: bool = false
var _wrapper: Variant = null


func _ready() -> void:
	if OS.has_feature("android"):
		_ensure_vibrator()


func _ensure_vibrator() -> void:
	if _init_attempted:
		return
	_init_attempted = true
	if not OS.has_feature("android"):
		return
	_wrapper = Engine.get_singleton("JavaClassWrapper")
	if _wrapper == null:
		push_warning("Haptics: JavaClassWrapper unavailable; vibration disabled.")
		return
	var ctx: Variant = null
	if _wrapper.has_method("get_context"):
		ctx = _wrapper.call("get_context")
	if ctx == null and _wrapper.has_method("get_application_context"):
		ctx = _wrapper.call("get_application_context")
	if ctx == null:
		# 4.3 shape: ask the Godot host app for the application context.
		var godot_cls: Variant = _wrapper.call("wrap", "com.godot.Godot")
		if godot_cls != null and godot_cls.has_method("getApplicationContext"):
			ctx = godot_cls.call("getApplicationContext")
	if ctx == null:
		push_warning("Haptics: could not obtain Android context; vibration disabled.")
		return
	var service: Variant = null
	if ctx.has_method("getSystemService"):
		service = ctx.call("getSystemService", "vibrator")
	if service == null or not service.has_method("getDefaultVibrator"):
		push_warning("Haptics: Vibrator service unavailable; vibration disabled.")
		return
	_vibrator = service.call("getDefaultVibrator")


func enabled() -> bool:
	return bool(SaveManager.read("settings.vibration", true))


func vibrate(pattern: String) -> void:
	if not enabled() or not OS.has_feature("android"):
		return
	if _vibrator == null:
		_ensure_vibrator()
		if _vibrator == null:
			return
	var ms: int = int(PATTERNS.get(pattern, 30))
	# Prefer VibrationEffect (API 26+); fall back to the legacy ms overload.
	if _wrapper != null:
		var effect_cls: Variant = _wrapper.call("wrap", "android.os.VibrationEffect")
		if effect_cls != null and effect_cls.has_method("createOneShot"):
			var effect: Variant = effect_cls.call("createOneShot", ms, 255)
			if effect != null and _vibrator.has_method("vibrate"):
				_vibrator.call("vibrate", effect)
				return
	if _vibrator.has_method("vibrate"):
		_vibrator.call("vibrate", ms)

extends CanvasLayer
## Screen-space weather particles: snow (Frostbite), dust haze (Dust Canyon),
## heat shimmer (Neon Harbor). Cheap CPU particles, respect the quality setting.

var weather_id: String = ""
var _particles: CPUParticles2D = null
var _tint: ColorRect = null
var _quality_high: bool = true

func setup(id: String) -> void:
	clear()
	weather_id = id
	if weather_id.is_empty():
		return
	_quality_high = SaveManager.read("settings.particle_quality", "high") == "high"
	var count := 140 if _quality_high else 60
	var p := CPUParticles2D.new()
	p.amount = count
	p.lifetime = 6.0
	p.preprocess = 6.0
	p.emitting = true
	p.local_coords = false
	match weather_id:
		"snow":
			p.direction = Vector2(0.15, 1)
			p.spread = 12.0
			p.initial_velocity_min = 60.0
			p.initial_velocity_max = 130.0
			p.gravity = Vector2(0, 12.0)
			p.scale_amount_min = 1.5
			p.scale_amount_max = 3.2
			var grad := Gradient.new()
			grad.set_color(0, Color(1, 1, 1, 0.9))
			grad.set_color(1, Color(0.85, 0.92, 1, 0.5))
			var gtx := GradientTexture2D.new()
			gtx.gradient = grad
			gtx.fill_from = Vector2(0.5, 0)
			gtx.fill_to = Vector2(0.5, 1)
			gtx.fill = GradientTexture2D.FILL_RADIAL
			p.texture = gtx
			p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
			p.emission_rect_extents = Vector2(1100, 40)
			p.position = Vector2(960, -60)
		"dust":
			p.direction = Vector2(-1, 0.05)
			p.spread = 25.0
			p.initial_velocity_min = 120.0
			p.initial_velocity_max = 260.0
			p.gravity = Vector2(0, 0)
			p.scale_amount_min = 6.0
			p.scale_amount_max = 14.0
			var grad2 := Gradient.new()
			grad2.set_color(0, Color(0.95, 0.8, 0.55, 0.28))
			grad2.set_color(1, Color(0.9, 0.7, 0.45, 0.05))
			var gtx2 := GradientTexture2D.new()
			gtx2.gradient = grad2
			gtx2.fill_from = Vector2(0.5, 0.5)
			gtx2.fill_to = Vector2(0.9, 0.5)
			gtx2.fill = GradientTexture2D.FILL_LINEAR
			p.texture = gtx2
			p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
			p.emission_rect_extents = Vector2(40, 540)
			p.position = Vector2(1980, 540)
		"heat":
			p.direction = Vector2(0, -1)
			p.spread = 8.0
			p.initial_velocity_min = 30.0
			p.initial_velocity_max = 70.0
			p.gravity = Vector2(0, -6.0)
			p.scale_amount_min = 3.0
			p.scale_amount_max = 7.0
			var grad3 := Gradient.new()
			grad3.set_color(0, Color(1, 0.7, 0.3, 0.10))
			grad3.set_color(1, Color(1, 0.4, 0.6, 0.0))
			var gtx3 := GradientTexture2D.new()
			gtx3.gradient = grad3
			gtx3.fill_from = Vector2(0.5, 0.5)
			gtx3.fill_to = Vector2(0.9, 0.5)
			gtx3.fill = GradientTexture2D.FILL_LINEAR
			p.texture = gtx3
			p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
			p.emission_rect_extents = Vector2(960, 20)
			p.position = Vector2(960, 1120)
	add_child(p)
	_particles = p
	# Subtle full-screen tint for atmosphere.
	match weather_id:
		"snow":
			_tint = ColorRect.new()
			_tint.color = Color(0.85, 0.92, 1.0, 0.10)
			_tint.mouse_filter = Control.MOUSE_FILTER_IGNORE
			_tint.set_anchors_preset(Control.PRESET_FULL_RECT)
			add_child(_tint)
		"heat":
			_tint = ColorRect.new()
			_tint.color = Color(0.5, 0.1, 0.5, 0.08)
			_tint.mouse_filter = Control.MOUSE_FILTER_IGNORE
			_tint.set_anchors_preset(Control.PRESET_FULL_RECT)
			add_child(_tint)

func clear() -> void:
	for c in get_children():
		c.queue_free()
	_particles = null
	_tint = null

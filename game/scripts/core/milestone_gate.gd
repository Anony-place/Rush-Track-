extends Node2D
## 250 m celebration gate: two poles + banner with the distance label.
## Pure _draw — no allocations.

var label: String = "250m"
var base_y: float = 0.0

func _ready() -> void:
	queue_redraw()

func _process(_delta: float) -> void:
	pass

func _draw() -> void:
	var px := 20.0
	var h := 3.4 * px
	var pole_w := 0.22 * px
	var pole_color := Color(0.92, 0.92, 0.95)
	var dark := Color(0.25, 0.22, 0.3)
	for side in [-1.0, 1.0]:
		var x: float = side * 1.15 * px
		draw_rect(Rect2(x - pole_w / 2.0, -h, pole_w, h), pole_color)
		draw_rect(Rect2(x - pole_w / 2.0, -h - 0.15 * px, pole_w, 0.15 * px), dark)
	# Banner.
	var bw := 2.6 * px
	var bh := 0.85 * px
	var banner := Rect2(-bw / 2.0, -h - bh, bw, bh)
	draw_rect(banner, Color(0.95, 0.35, 0.35))
	draw_rect(banner, Color(1.0, 0.85, 0.3), false, 3.0)
	# Checker strip on banner.
	var sq := bh / 4.0
	var col := 0
	while col * sq < bw:
		var sx := banner.position.x + col * sq
		if col % 2 == 0:
			draw_rect(Rect2(sx, banner.position.y, sq, sq), Color(0.1, 0.1, 0.12))
			draw_rect(Rect2(sx, banner.position.y + 2.0 * sq, sq, sq), Color(0.1, 0.1, 0.12))
		else:
			draw_rect(Rect2(sx, banner.position.y + sq, sq, sq), Color(0.98, 0.98, 0.98, 0.9))
		col += 1

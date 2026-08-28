class_name UIKit
extends RefCounted
## Shared UI design system: theme, chunky buttons, outlined labels, panels.
## Mirrors the web build's visual language (Titan One display + Nunito body).

static func font_display() -> Font:
	return load("res://assets/fonts/TitanOne.ttf")


static func font_body() -> Font:
	return load("res://assets/fonts/Nunito-ExtraBold.ttf")


static func font_body_bold() -> Font:
	return load("res://assets/fonts/Nunito-Black.ttf")


static func font_body_ital() -> Font:
	return load("res://assets/fonts/Nunito-ExtraBoldItalic.ttf")

const C_BG := Color(0.07, 0.09, 0.16)
const C_PANEL := Color(0.11, 0.14, 0.24, 0.96)
const C_PANEL_EDGE := Color(0.2, 0.26, 0.42)
const C_ACCENT := Color(1.0, 0.54, 0.05)
const C_ACCENT_DARK := Color(0.85, 0.38, 0.0)
const C_GOOD := Color(0.29, 0.87, 0.5)
const C_GOOD_DARK := Color(0.16, 0.62, 0.34)
const C_BAD := Color(1.0, 0.32, 0.32)
const C_BAD_DARK := Color(0.78, 0.18, 0.2)
const C_GOLD := Color(1.0, 0.82, 0.29)
const C_TEXT := Color(0.97, 0.98, 1.0)
const C_TEXT_DIM := Color(0.72, 0.78, 0.9)

static func make_theme() -> Theme:
	var t := Theme.new()
	t.default_font = font_body()
	t.default_font_size = 26
	var sb := _style(C_PANEL, C_PANEL_EDGE, 22)
	t.set_stylebox("panel", "Panel", sb)
	var btn := Button.new()
	t.set_stylebox("normal", "Button", _btn_style(C_ACCENT, C_ACCENT_DARK))
	t.set_stylebox("hover", "Button", _btn_style(Color(1.0, 0.62, 0.15), C_ACCENT_DARK))
	t.set_stylebox("pressed", "Button", _btn_style(C_ACCENT_DARK, C_ACCENT_DARK, true))
	t.set_stylebox("focus", "Button", _focus())
	t.set_color("font_color", "Button", C_TEXT)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color(1, 1, 1, 0.85))
	t.set_color("font_disabled_color", "Button", Color(0.5, 0.55, 0.65))
	t.set_font_size("font_size", "Button", 30)
	t.set_font("font", "Button", font_body_bold())
	return t

static func _btn_style(base: Color, edge: Color, pressed: bool = false) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = base
	s.set_corner_radius_all(22)
	s.border_width_bottom = 10
	s.border_color = edge
	s.content_margin_left = 26.0
	s.content_margin_right = 26.0
	s.content_margin_top = 14.0
	s.content_margin_bottom = 20.0
	if pressed:
		s.content_margin_top = 22.0
		s.content_margin_bottom = 12.0
	return s

static func _focus() -> StyleBoxEmpty:
	return StyleBoxEmpty.new()

static func _style(bg: Color, edge: Color, radius: int) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.border_width_left = 3
	s.border_width_right = 3
	s.border_width_top = 3
	s.border_width_bottom = 3
	s.border_color = edge
	return s

## Chunky primary button. kind: "accent" | "good" | "bad" | "dim"
static func chunk_button(text: String, kind: String = "accent") -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	var base: Color
	var edge: Color
	match kind:
		"good":
			base = C_GOOD
			edge = C_GOOD_DARK
		"bad":
			base = C_BAD
			edge = C_BAD_DARK
		"dim":
			base = Color(0.3, 0.36, 0.5)
			edge = Color(0.2, 0.25, 0.36)
		"gold":
			base = C_GOLD
			edge = Color(0.8, 0.6, 0.1)
		_:
			base = C_ACCENT
			edge = C_ACCENT_DARK
	var pressed := false
	var s := StyleBoxFlat.new()
	s.bg_color = base
	s.set_corner_radius_all(22)
	s.border_width_bottom = 10
	s.border_color = edge
	s.content_margin_left = 26.0
	s.content_margin_right = 26.0
	s.content_margin_top = 14.0
	s.content_margin_bottom = 20.0
	var s_hover := s.duplicate()
	s_hover.bg_color = base.lightened(0.12)
	var s_press := s.duplicate()
	s_press.bg_color = edge
	s_press.content_margin_top = 22.0
	s_press.content_margin_bottom = 12.0
	b.add_theme_stylebox("normal", "Button", s)
	b.add_theme_stylebox("hover", "Button", s_hover)
	b.add_theme_stylebox("pressed", "Button", s_press)
	b.add_theme_stylebox("focus", "Button", _focus())
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_pressed_color", Color(1, 1, 1, 0.9))
	b.add_theme_font_override("font", font_body_bold())
	b.add_theme_font_size_override("font_size", 30)
	return b

static func outlined_label(text: String, size: int = 40, color: Color = C_TEXT, font: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	if font != null:
		l.add_theme_font_override("font", font)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0.05, 0.06, 0.12))
	l.add_theme_constant_override("outline_size", size / 8 + 4)
	return l

static func panel(radius: int = 24) -> Panel:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", _style(C_PANEL, C_PANEL_EDGE, radius))
	return p

static func panel_style(bg: Color, edge: Color, radius: int) -> StyleBoxFlat:
	return _style(bg, edge, radius)

static func coin_icon(scale: float = 0.5) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = load("res://assets/ui/icon_coin.png")
	s.scale = Vector2(scale, scale)
	return s

static func stat_bar(levels: int, max_levels: int = 5, color: Color = C_GOOD) -> HBoxContainer:
	var box := HBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	for i in max_levels:
		var c := ColorRect.new()
		c.custom_minimum_size = Vector2(34, 18)
		var on: bool = i < levels
		c.color = color if on else Color(0.22, 0.26, 0.38)
		c.pivot_offset = Vector2(17, 9)
		box.add_child(c)
	return box

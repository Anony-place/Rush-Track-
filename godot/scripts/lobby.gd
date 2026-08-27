extends Control

const BG := preload("res://assets/lobby/lobby_backdrop.svg")
const CAR := preload("res://assets/vehicles/player_buggy.svg")
const LOGO := preload("res://assets/ui/rush_track_mark.svg")

var content: Control

func _ready() -> void:
    _build_lobby()

func _build_lobby() -> void:
    content = Control.new()
    content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    add_child(content)

    var backdrop := TextureRect.new()
    backdrop.texture = BG
    backdrop.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    backdrop.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
    backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    content.add_child(backdrop)

    var dim := ColorRect.new()
    dim.color = Color(0.02, 0.03, 0.04, 0.16)
    dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    content.add_child(dim)

    var logo := TextureRect.new()
    logo.texture = LOGO
    logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
    logo.position = Vector2(32, 22)
    logo.size = Vector2(255, 80)
    content.add_child(logo)

    _add_resource_bar()
    _add_side_menu()
    _add_vehicle()
    _add_bottom_cards()
    _add_play_button()

func _add_resource_bar() -> void:
    var panel := Panel.new()
    panel.position = Vector2(320, 22)
    panel.size = Vector2(620, 58)
    panel.add_theme_stylebox_override("panel", _box(Color(0.035,0.045,0.055,0.94), Color(0.22,0.25,0.29), 10))
    content.add_child(panel)

    _label(panel, "FUEL  10/10", Vector2(24, 13), Vector2(190, 30), 24, Color("fff4d6"))
    _label(panel, "●  2,450", Vector2(220, 13), Vector2(180, 30), 22, Color("ffd34a"))
    _label(panel, "◆  125", Vector2(420, 13), Vector2(150, 30), 22, Color("e7c0ff"))

func _add_side_menu() -> void:
    var items := ["GARAGE", "VEHICLES", "UPGRADES", "CUSTOMIZE", "MISSIONS", "DAILY REWARD", "SHOP"]
    var y := 145.0
    for i in items.size():
        var button := Button.new()
        button.text = items[i]
        button.position = Vector2(28, y)
        button.size = Vector2(250, 50)
        button.add_theme_font_size_override("font_size", 19)
        button.alignment = HORIZONTAL_ALIGNMENT_LEFT
        button.add_theme_stylebox_override("normal", _box(Color(0.055,0.07,0.09,0.96), Color(0.20,0.24,0.28), 8))
        button.add_theme_stylebox_override("hover", _box(Color(0.11,0.13,0.15,0.98), Color(1.0,0.72,0.10), 8))
        button.pressed.connect(_menu_pressed.bind(items[i]))
        content.add_child(button)
        y += 58

func _add_vehicle() -> void:
    var car := TextureRect.new()
    car.texture = CAR
    car.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    car.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
    car.position = Vector2(430, 300)
    car.size = Vector2(540, 270)
    content.add_child(car)

    _label(content, "BULL RIDER", Vector2(405, 535), Vector2(240, 42), 28, Color("ffffff"))
    _label(content, "STARTER VEHICLE", Vector2(407, 573), Vector2(210, 28), 15, Color("ffc11b"))

func _add_bottom_cards() -> void:
    var stats := Panel.new()
    stats.position = Vector2(30, 560)
    stats.size = Vector2(275, 125)
    stats.add_theme_stylebox_override("panel", _box(Color(0.035,0.045,0.055,0.94), Color(0.20,0.24,0.28), 10))
    content.add_child(stats)
    _label(stats, "VEHICLE STATS", Vector2(15, 10), Vector2(180, 24), 15, Color("ffc11b"))
    _label(stats, "POWER     ███████░░", Vector2(15, 40), Vector2(230, 24), 16, Color("ffffff"))
    _label(stats, "GRIP        █████░░░░", Vector2(15, 66), Vector2(230, 24), 16, Color("ffffff"))
    _label(stats, "FUEL        ██████░░░", Vector2(15, 92), Vector2(230, 24), 16, Color("ffffff"))

    var track := Panel.new()
    track.position = Vector2(535, 610)
    track.size = Vector2(300, 86)
    track.add_theme_stylebox_override("panel", _box(Color(0.035,0.045,0.055,0.94), Color(0.20,0.24,0.28), 10))
    content.add_child(track)
    _label(track, "NEXT TRACK", Vector2(16, 10), Vector2(120, 22), 14, Color("ffc11b"))
    _label(track, "ALPINE CLIMB", Vector2(16, 31), Vector2(240, 32), 22, Color("ffffff"))
    _label(track, "BEST  1,254 m", Vector2(16, 60), Vector2(220, 20), 14, Color("d7dde3"))

func _add_play_button() -> void:
    var play := Button.new()
    play.text = "PLAY"
    play.position = Vector2(1015, 575)
    play.size = Vector2(230, 110)
    play.add_theme_font_size_override("font_size", 36)
    play.add_theme_color_override("font_color", Color("111111"))
    play.add_theme_stylebox_override("normal", _box(Color("ffc21a"), Color("ffd863"), 14))
    play.add_theme_stylebox_override("hover", _box(Color("ffd34c"), Color("ffffff"), 14))
    play.pressed.connect(_play_pressed)
    content.add_child(play)

func _menu_pressed(name: String) -> void:
    print("Lobby menu: ", name)

func _play_pressed() -> void:
    print("PLAY pressed — race scene will be connected in the next build step.")

func _label(parent: Control, text: String, pos: Vector2, size: Vector2, font_size: int, color: Color) -> void:
    var label := Label.new()
    label.text = text
    label.position = pos
    label.size = size
    label.add_theme_font_size_override("font_size", font_size)
    label.add_theme_color_override("font_color", color)
    parent.add_child(label)

func _box(fill: Color, border: Color, radius: int) -> StyleBoxFlat:
    var box := StyleBoxFlat.new()
    box.bg_color = fill
    box.border_color = border
    box.set_border_width_all(2)
    box.set_corner_radius_all(radius)
    box.content_margin_left = 12
    box.content_margin_right = 12
    return box

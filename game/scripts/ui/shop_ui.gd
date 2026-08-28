extends Control
## Coin shop: IAP packs + remove-ads. Uses the Monetization facade, so this
## works with mock IAP in dev and real Play Billing once the add-on is in.

const BG: GDScript = preload("res://scripts/ui/lobby_bg.gd")

var _coin_label: Label
var _remove_ads_btn: Button

const PRODUCTS: Array = [
	{"id": "coins_small", "coins": "5,000", "desc": "Starter stack", "icon": 0},
	{"id": "coins_mega", "coins": "25,000", "desc": "Best value", "icon": 1},
	{"id": "coins_premium", "coins": "60,000", "desc": "Serious business", "icon": 2},
]

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UIKit.make_theme()
	_build()
	EventBus.coins_changed.connect(func(_v: int) -> void:
		_coin_label.text = str(SaveManager.get_coins())
	)
	EventBus.toasts.connect(_on_toast)

func _build() -> void:
	var bg: Node2D = BG.new()
	bg.z_index = -100
	add_child(bg)
	var title := UIKit.outlined_label("COIN SHOP", 74, Color.WHITE, UIKit.font_display())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(460, 36)
	title.size = Vector2(1000, 100)
	add_child(title)
	var coin_box := HBoxContainer.new()
	coin_box.position = Vector2(1560, 30)
	coin_box.add_theme_constant_override("separation", 10)
	coin_box.add_child(UIKit.coin_icon(0.55))
	_coin_label = Label.new()
	_coin_label.text = str(SaveManager.get_coins())
	_coin_label.add_theme_font_override("font", UIKit.font_display())
	_coin_label.add_theme_font_size_override("font_size", 42)
	_coin_label.add_theme_color_override("font_color", Color.WHITE)
	coin_box.add_child(_coin_label)
	add_child(coin_box)
	# Remove-ads hero card.
	var ads_card := Panel.new()
	ads_card.add_theme_stylebox_override("panel", UIKit.panel_style(Color(0.16, 0.13, 0.06, 0.95), Color(1.0, 0.7, 0.2), 24))
	ads_card.position = Vector2(360, 160)
	ads_card.size = Vector2(1200, 170)
	add_child(ads_card)
	var ads_title := Label.new()
	ads_title.text = "REMOVE ADS — FOREVER"
	ads_title.position = Vector2(40, 26)
	ads_title.add_theme_font_override("font", UIKit.font_display())
	ads_title.add_theme_font_size_override("font_size", 48)
	ads_title.add_theme_color_override("font_color", Color(1, 0.85, 0.4))
	ads_card.add_child(ads_title)
	var ads_sub := Label.new()
	ads_sub.text = "No interstitials, no banners. Just you, your rig and the hills."
	ads_sub.position = Vector2(42, 96)
	ads_sub.add_theme_font_size_override("font_size", 26)
	ads_sub.add_theme_color_override("font_color", Color(1, 1, 1, 0.75))
	ads_card.add_child(ads_sub)
	_remove_ads_btn = UIKit.chunk_button("BUY", "gold")
	_remove_ads_btn.position = Vector2(980, 46)
	_remove_ads_btn.custom_minimum_size = Vector2(170, 80)
	ads_card.add_child(_remove_ads_btn)
	_refresh_remove_ads()
	_remove_ads_btn.pressed.connect(func() -> void: Monetization.purchase("remove_ads"))
	# Coin pack cards.
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 40)
	row.position = Vector2(360, 380)
	row.size = Vector2(1200, 420)
	add_child(row)
	for p in PRODUCTS:
		row.add_child(_pack_card(p))
	# Restore.
	var restore := UIKit.chunk_button("RESTORE PURCHASES", "dim")
	restore.custom_minimum_size = Vector2(360, 70)
	restore.position = Vector2(960 - 180, 840)
	restore.pressed.connect(func() -> void: Monetization.restore_purchases())
	add_child(restore)
	# Back.
	var back := UIKit.chunk_button("BACK", "dim")
	back.custom_minimum_size = Vector2(300, 84)
	back.add_theme_font_size_override("font_size", 36)
	back.position = Vector2(810, 940)
	back.pressed.connect(func() -> void:
		AudioManager.play_sfx("click")
		get_tree().change_scene_to_file("res://scenes/lobby.tscn")
	)
	add_child(back)
	# Toasts.
	_toast_root = Control.new()
	_toast_root.position = Vector2(460, 120)
	_toast_root.size = Vector2(1000, 100)
	add_child(_toast_root)

var _toast_root: Control = null

func _refresh_remove_ads() -> void:
	if SaveManager.read("entitlements.remove_ads", false):
		_remove_ads_btn.text = "OWNED"
		_remove_ads_btn.disabled = true
	else:
		_remove_ads_btn.text = "BUY  •  $2.99"
		_remove_ads_btn.disabled = false

func _pack_card(p: Dictionary) -> Control:
	var card := Panel.new()
	card.add_theme_stylebox_override("panel", UIKit.panel_style(Color(0.1, 0.12, 0.2, 0.92), Color(0.25, 0.3, 0.46), 24))
	card.custom_minimum_size = Vector2(360, 400)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 18)
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.position = Vector2(20, 24)
	v.size = Vector2(320, 352)
	card.add_child(v)
	var icon := Sprite2D.new()
	icon.texture = load("res://assets/ui/icon_coin.png")
	icon.scale = Vector2(1.6 + float(p.icon) * 0.9, 1.6 + float(p.icon) * 0.9)
	v.add_child(icon)
	var coins := Label.new()
	coins.text = p.coins
	coins.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	coins.add_theme_font_override("font", UIKit.font_display())
	coins.add_theme_font_size_override("font_size", 46)
	coins.add_theme_color_override("font_color", UIKit.C_GOLD)
	v.add_child(coins)
	var desc := Label.new()
	desc.text = p.desc
	desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	desc.add_theme_font_size_override("font_size", 24)
	desc.add_theme_color_override("font_color", Color(1, 1, 1, 0.65))
	v.add_child(desc)
	var price := Label.new()
	price.text = {0: "$0.99", 1: "$2.99", 2: "$4.99"}[int(p.icon)]
	price.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	price.add_theme_font_size_override("font_size", 30)
	price.add_theme_color_override("font_color", Color(1, 1, 1, 0.85))
	v.add_child(price)
	var btn := UIKit.chunk_button("BUY", "good")
	btn.custom_minimum_size = Vector2(240, 74)
	btn.add_theme_font_size_override("font_size", 32)
	btn.pressed.connect(func() -> void: Monetization.purchase(str(p.id)))
	v.add_child(btn)
	return card

func _on_toast(text: String, kind: String) -> void:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", UIKit.panel_style(Color(0.13, 0.15, 0.25, 0.95), Color(0.2, 0.26, 0.42), 22))
	p.size = Vector2(640, 64)
	p.position = Vector2(960 - 320, _toast_root.position.y + 20)
	var lb := Label.new()
	lb.text = text
	lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lb.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lb.set_anchors_preset(Control.PRESET_FULL_RECT)
	lb.add_theme_font_size_override("font_size", 26)
	var color := Color(1, 1, 1)
	if kind == "success":
		color = Color(0.6, 1.0, 0.7)
	lb.add_theme_color_override("font_color", color)
	p.add_child(lb)
	_toast_root.add_child(p)
	p.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(p, "modulate:a", 1.0, 0.2)
	tw.tween_property(p, "modulate:a", 1.0, 1.6)
	tw.tween_property(p, "modulate:a", 0.0, 0.4)
	tw.tween_callback(p.queue_free)

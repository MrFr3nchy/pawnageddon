"""UI drawing: title splash, name input, left panel, shop sidebar, menu, promotion,
tooltips, floating messages, deck/hand with icons and flair."""

import math
import time
import pygame
from . import constants as C
from . import render


# ─── Icon system ────────────────────────────────────────────────────────────

TAG_ICONS = {
    "damage": "\u2694", "economy": "\u25C6", "movement": "\u2192",
    "buff": "\u25B2", "debuff": "\u25BC", "board": "\u25A1",
    "chaos": "\u2606", "defense": "\u25C9", "transform": "\u21BB",
    "summon": "+", "area": "\u25CE", "minigame": "?",
    "attack": "\u2694", "trap": "\u25B3", "terrain": "\u25A0",
    "teleport": "\u21AF", "hazard": "\u26A0", "environmental": "\u2600",
    "destruction": "\u2620", "luck": "\u2663", "reaction": "\u26A1",
    "memory": "\u2B50", "trivia": "\u2753", "typing": "\u270D",
    "puzzle": "\u29EB", "weapon": "\u2694", "equipment": "\u25C9",
    "utility": "\u2726", "consumable": "\u2740",
}

RARITY_COLORS = {
    "common": C.TEXT_MUTED,
    "uncommon": (80, 180, 80),
    "rare": (70, 130, 220),
    "epic": (160, 80, 200),
    "legendary": C.ACCENT_GOLD,
}

# Dedicated icon fonts — loaded lazily at various sizes
_icon_font_cache = {}


def _icon_font(size):
    """Get a font that renders Unicode symbols well. Cached by size."""
    if size not in _icon_font_cache:
        for name in ("Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols", "DejaVu Sans"):
            f = pygame.font.SysFont(name, size)
            if f:
                _icon_font_cache[size] = f
                break
        else:
            _icon_font_cache[size] = pygame.font.SysFont(None, size)
    return _icon_font_cache[size]


def _icon_for(tags):
    """Pick the best icon character from a list of tags."""
    for t in tags:
        if t in TAG_ICONS:
            return TAG_ICONS[t]
    return "\u2726"


def _rarity_color(rarity):
    return RARITY_COLORS.get(rarity, C.TEXT_MUTED)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _rounded_rect(screen, color, rect, radius=8, border=0, border_color=None):
    x, y, w, h = int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3])
    try:
        pygame.draw.rect(screen, color, (x, y, w, h), 0, radius)
        if border and border_color:
            pygame.draw.rect(screen, border_color, (x, y, w, h), border, radius)
    except TypeError:
        pygame.draw.rect(screen, color, (x, y, w, h))
        if border and border_color:
            pygame.draw.rect(screen, border_color, (x, y, w, h), border)


def _center_text(screen, font, text, color, cx, cy):
    surf = font.render(text, True, color)
    screen.blit(surf, (cx - surf.get_width() // 2, cy - surf.get_height() // 2))
    return surf


def _draw_button(screen, font, text, rect, mx, my, accent=True):
    x, y, w, h = rect
    hover = x <= mx <= x + w and y <= my <= y + h
    if accent:
        bg = C.ACCENT_HOVER if hover else C.ACCENT_WARM
    else:
        bg = C.PANEL_BG_LIGHTER if hover else C.PANEL_BG
    _rounded_rect(screen, bg, rect, radius=6, border=2, border_color=C.PANEL_BORDER)
    _center_text(screen, font, text, C.TEXT_PRIMARY, x + w // 2, y + h // 2)
    return hover


def _word_wrap(font, text, max_w):
    """Word-wrap text into lines that fit within max_w pixels. Returns list of strings."""
    words = text.split()
    lines = []
    current = ""
    for w in words:
        test = f"{current} {w}".strip()
        if font.size(test)[0] > max_w:
            if current:
                lines.append(current)
            current = w
        else:
            current = test
    if current:
        lines.append(current)
    return lines


# ─── Tooltip ────────────────────────────────────────────────────────────────

def draw_tooltip(screen, title, desc, mx, my, font, font_small, rarity=None, icon=None):
    """Draw a floating tooltip near the cursor. Clamps to screen bounds."""
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    pad = 10
    max_w = 260

    lines = []
    header = f"{icon} {title}" if icon else title
    lines.append(font.render(header, True, _rarity_color(rarity) if rarity else C.TEXT_PRIMARY))
    if rarity:
        lines.append(font_small.render(rarity.capitalize(), True, _rarity_color(rarity)))

    if desc:
        for line in _word_wrap(font_small, desc, max_w - 2 * pad):
            lines.append(font_small.render(line, True, C.TEXT_SECONDARY))

    tip_w = max(s.get_width() for s in lines) + 2 * pad
    tip_h = sum(s.get_height() + 2 for s in lines) + 2 * pad
    tx = min(mx + 16, W - tip_w - 8)
    ty = min(my + 16, H - tip_h - 8)
    tx = max(4, tx)
    ty = max(4, ty)

    surf = pygame.Surface((tip_w, tip_h), pygame.SRCALPHA)
    surf.fill((20, 22, 26, 235))
    screen.blit(surf, (tx, ty))
    _rounded_rect(screen, (20, 22, 26), (tx, ty, tip_w, tip_h), radius=6,
                  border=1, border_color=C.PANEL_BORDER)
    pygame.draw.rect(screen, (20, 22, 26), (tx + 1, ty + 1, tip_w - 2, tip_h - 2))

    cy = ty + pad
    for s in lines:
        screen.blit(s, (tx + pad, cy))
        cy += s.get_height() + 2


# ─── Floating Messages ─────────────────────────────────────────────────────

def draw_floating_messages(screen, messages, board_cx, board_bottom, font):
    """Draw floating notification pills above the board bottom."""
    now = time.time()
    y = board_bottom - 10
    visible = []
    for text, ts in reversed(messages):
        age = now - ts
        if age > 4.0:
            continue
        visible.append((text, age))
    visible = visible[:5]

    for text, age in visible:
        alpha = max(0, min(255, int(255 * (1.0 - age / 4.0))))
        surf = font.render(text, True, C.TEXT_PRIMARY)
        pill_w = surf.get_width() + 20
        pill_h = surf.get_height() + 8
        px = board_cx - pill_w // 2
        y -= pill_h + 4

        bg = pygame.Surface((pill_w, pill_h), pygame.SRCALPHA)
        bg.fill((32, 34, 38, min(200, alpha)))
        screen.blit(bg, (px, y))
        pygame.draw.rect(screen, C.PANEL_BORDER, (px, y, pill_w, pill_h), 1, 6)
        text_surf = font.render(text, True, (*C.TEXT_PRIMARY[:3],))
        text_surf.set_alpha(alpha)
        screen.blit(text_surf, (px + 10, y + 4))


# ─── Title Splash ───────────────────────────────────────────────────────────

def draw_title_splash(screen, title_image, mx, my, font_large, font_small):
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    screen.fill(C.BG_DARKER)

    for i in range(6):
        alpha = 12 - i * 2
        r = int(min(W, H) * 0.5 - i * 30)
        if r > 0:
            surf = pygame.Surface((r * 2, r * 2), pygame.SRCALPHA)
            pygame.draw.circle(surf, (50, 40, 30, alpha), (r, r), r)
            screen.blit(surf, (W // 2 - r, H // 2 - r - 40))

    cx, cy = W // 2, H // 2

    if title_image is not None:
        tw, th = title_image.get_width(), title_image.get_height()
        max_w = min(800, int(W * 0.55))
        max_h = min(400, int(H * 0.38))
        scale = min(max_w / tw, max_h / th, 1.0)
        w, h = int(tw * scale), int(th * scale)
        scaled = pygame.transform.smoothscale(title_image, (w, h))
        screen.blit(scaled, (cx - w // 2, cy - h // 2 - 70))
    else:
        title_font = pygame.font.SysFont('georgia', 52, bold=True)
        _center_text(screen, title_font, "Pawnageddon", C.ACCENT_GOLD, cx, cy - 80)

    tag = font_small.render("A chess game with a chaotic twist", True, C.TEXT_MUTED)
    screen.blit(tag, (cx - tag.get_width() // 2, cy + 60))

    btn_w, btn_h = 240, 56
    btn_rect = (cx - btn_w // 2, H - 180, btn_w, btn_h)
    _draw_button(screen, font_large, "Play", btn_rect, mx, my)

    sub = font_small.render("Click anywhere to continue", True, C.TEXT_MUTED)
    screen.blit(sub, (cx - sub.get_width() // 2, H - 115))


# ─── Name Input ─────────────────────────────────────────────────────────────

def draw_name_input_screen(screen, white_name, black_name, input_focus, mx, my,
                           font_title, font_label, font_input):
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    screen.fill(C.BG_DARKER)
    cx, cy = W // 2, H // 2

    card_w, card_h = 480, 420
    card_x, card_y = cx - card_w // 2, cy - card_h // 2
    pad = 40

    shadow = pygame.Surface((card_w + 12, card_h + 12), pygame.SRCALPHA)
    shadow.fill((0, 0, 0, 40))
    screen.blit(shadow, (card_x - 4, card_y - 2))

    _rounded_rect(screen, C.PANEL_BG, (card_x, card_y, card_w, card_h),
                  radius=12, border=1, border_color=C.PANEL_BORDER)

    y = card_y + 38
    title_surf = font_title.render("New Game", True, C.TEXT_PRIMARY)
    screen.blit(title_surf, (cx - title_surf.get_width() // 2, y))
    y += title_surf.get_height() + 10
    sub = font_label.render("Enter player names to begin", True, C.TEXT_MUTED)
    screen.blit(sub, (cx - sub.get_width() // 2, y))
    y += sub.get_height() + 30

    lbl = font_label.render("White", True, C.TEXT_SECONDARY)
    screen.blit(lbl, (card_x + pad, y))
    y += lbl.get_height() + 8
    input_w, input_h = card_w - 2 * pad, 44
    white_rect = (card_x + pad, y, input_w, input_h)
    _draw_text_input(screen, font_input, white_rect, white_name, "Enter name...",
                     focused=(input_focus == 1))
    y += input_h + 24

    lbl = font_label.render("Black", True, C.TEXT_SECONDARY)
    screen.blit(lbl, (card_x + pad, y))
    y += lbl.get_height() + 8
    black_rect = (card_x + pad, y, input_w, input_h)
    _draw_text_input(screen, font_input, black_rect, black_name, "Enter name...",
                     focused=(input_focus == 2))
    y += input_h + 36

    btn_w, btn_h = 200, 50
    new_game_rect = (cx - btn_w // 2, y, btn_w, btn_h)
    _draw_button(screen, font_title, "Start Game", new_game_rect, mx, my)
    return new_game_rect, white_rect, black_rect


def _draw_text_input(screen, font, rect, value, placeholder, focused=False):
    x, y, w, h = int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3])
    border_col = C.INPUT_FOCUS if focused else C.INPUT_BORDER
    _rounded_rect(screen, C.INPUT_BG, (x, y, w, h), radius=6, border=2, border_color=border_col)
    display = value[:28] if value.strip() else placeholder
    color = C.TEXT_PRIMARY if value.strip() else C.PLACEHOLDER_COLOR
    text_surf = font.render(display, True, color)
    screen.blit(text_surf, (x + 14, y + h // 2 - text_surf.get_height() // 2))
    if focused and int(time.time() * 2) % 2 == 0:
        cursor_x = x + 14 + (text_surf.get_width() + 2 if value.strip() else 0)
        pygame.draw.rect(screen, C.TEXT_PRIMARY, (cursor_x, y + 10, 2, h - 20))


# ─── Text Input Handler ────────────────────────────────────────────────────

def text_input(focus, white_name, black_name, white_rect, black_rect,
               mx, my, clicked, event_key):
    new_focus, new_white, new_black = focus, white_name, black_name
    wx, wy, ww, wh = white_rect
    bx, by, bw, bh = black_rect
    if clicked:
        if wx <= mx <= wx + ww and wy <= my <= wy + wh:
            new_focus = 1
        elif bx <= mx <= bx + bw and by <= my <= by + bh:
            new_focus = 2
        else:
            new_focus = 0
    if event_key is not None:
        if event_key.key == pygame.K_TAB:
            new_focus = 2 if new_focus == 1 else 1
        elif new_focus == 1 and len(new_white) < 20:
            if event_key.key == pygame.K_BACKSPACE:
                new_white = new_white[:-1]
            elif event_key.unicode and event_key.unicode.isprintable():
                new_white += event_key.unicode
        elif new_focus == 2 and len(new_black) < 20:
            if event_key.key == pygame.K_BACKSPACE:
                new_black = new_black[:-1]
            elif event_key.unicode and event_key.unicode.isprintable():
                new_black += event_key.unicode
    return new_focus, new_white, new_black


# ─── Menu (top-right, inside shop header) ───────────────────────────────────

def menu_icon_rect():
    sx = C.WINDOW_WIDTH - C.SHOP_PANEL_W
    return (sx + C.SHOP_PANEL_W - C.MENU_ICON_SIZE - C.MENU_ICON_PAD,
            C.MENU_ICON_PAD, C.MENU_ICON_SIZE, C.MENU_ICON_SIZE)


def draw_menu_icon(screen, mx, my):
    x, y, w, h = menu_icon_rect()
    hover = x <= mx <= x + w and y <= my <= y + h
    col = C.TEXT_PRIMARY if hover else C.TEXT_SECONDARY
    for frac in (0.28, 0.5, 0.72):
        ly = y + h * frac
        pygame.draw.rect(screen, col, (x + 6, ly - 1.5, w - 12, 3))


def menu_hit_test(mx, my, pressed):
    if not pressed:
        return False, False
    ix, iy, iw, ih = menu_icon_rect()
    menu_x = ix + iw - C.MENU_DROPDOWN_W
    menu_y = iy + ih + 4
    new_clicked = (menu_x <= mx <= menu_x + C.MENU_DROPDOWN_W
                   and menu_y <= my <= menu_y + C.MENU_ITEM_H)
    flip_clicked = (menu_x <= mx <= menu_x + C.MENU_DROPDOWN_W
                    and menu_y + C.MENU_ITEM_H <= my <= menu_y + C.MENU_ITEM_H * 2)
    return new_clicked, flip_clicked


def draw_menu(screen, font):
    ix, iy, iw, ih = menu_icon_rect()
    menu_x = ix + iw - C.MENU_DROPDOWN_W
    menu_y = iy + ih + 4
    menu_h = C.MENU_ITEM_H * 2
    _rounded_rect(screen, C.PANEL_BG_LIGHTER, (menu_x, menu_y, C.MENU_DROPDOWN_W, menu_h),
                  radius=6, border=1, border_color=C.PANEL_BORDER)
    for i, label in enumerate(["New game", "Flip board"]):
        ty = menu_y + i * C.MENU_ITEM_H
        text = font.render(label, True, C.TEXT_PRIMARY)
        screen.blit(text, (menu_x + 16, ty + C.MENU_ITEM_H // 2 - text.get_height() // 2))
        if i < 1:
            pygame.draw.line(screen, C.PANEL_BORDER,
                             (menu_x + 8, ty + C.MENU_ITEM_H),
                             (menu_x + C.MENU_DROPDOWN_W - 8, ty + C.MENU_ITEM_H), 1)


# ─── Left Panel ────────────────────────────────────────────────────────────

def draw_left_panel(screen, game, white_name, black_name, board_top, board_bottom,
                    piece_images, scale, font, font_piece):
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    pw = C.LEFT_PANEL_W
    pygame.draw.rect(screen, C.PANEL_BG, (0, 0, pw, H))
    pygame.draw.line(screen, C.PANEL_BORDER, (pw - 1, 0), (pw - 1, H), 1)

    px = C.LEFT_PANEL_PAD
    any_capture = len(game.captured_white) + len(game.captured_black) > 0
    slots_out = []

    section_top = 16
    section_h = board_top - section_top - 8
    if section_h > 50:
        _draw_player_section(screen, game, white_name, True, any_capture,
                             section_top, section_h, px, pw,
                             piece_images, scale, font, font_piece, slots_out)

    section_top_b = board_bottom + 8
    section_h_b = H - section_top_b - 16
    if section_h_b > 50:
        _draw_player_section(screen, game, black_name, False, any_capture,
                             section_top_b, section_h_b, px, pw,
                             piece_images, scale, font, font_piece, slots_out)
    return slots_out


def _draw_player_section(screen, game, name, is_white, any_capture,
                         top, height, px, panel_w, piece_images, scale,
                         font, font_piece, slots_out):
    margin = 10
    inner_x = margin
    inner_w = panel_w - 2 * margin

    _rounded_rect(screen, C.PANEL_BG_LIGHTER, (inner_x, top, inner_w, height),
                  radius=8, border=1, border_color=C.PANEL_BORDER)
    y = top + 12

    name_surf = font.render(name, True, C.TEXT_PRIMARY)
    screen.blit(name_surf, (px, y))
    y += name_surf.get_height() + 10

    captured = game.captured_white if is_white else game.captured_black
    lbl = font.render("Captured", True, C.TEXT_MUTED)
    screen.blit(lbl, (px, y))
    y += lbl.get_height() + 4
    if captured:
        render.draw_captured_pieces(screen, captured, piece_images, px, y, scale, font_piece)
    y += int(scale) + 6

    if any_capture:
        gold = game.white_gold if is_white else game.black_gold
        chaos = game.white_chaos if is_white else game.black_chaos

        g_surf = font.render(f"\u25C6 Gold: {gold}", True, C.ACCENT_GOLD)
        screen.blit(g_surf, (px, y))
        y += g_surf.get_height() + 6

        bar_w = min(C.CHAOS_BAR_W, inner_w - 2 * C.LEFT_PANEL_PAD)
        _rounded_rect(screen, C.CHAOS_BAR_BG, (px, y, bar_w, C.CHAOS_BAR_H), radius=3)
        fill_w = int(min(C.CHAOS_MAX, chaos) / C.CHAOS_MAX * bar_w)
        if fill_w > 0:
            _rounded_rect(screen, C.CHAOS_FILL, (px, y, fill_w, C.CHAOS_BAR_H), radius=3)
        c_lbl = font.render(f"Chaos {chaos}/{C.CHAOS_MAX}", True, C.TEXT_MUTED)
        screen.blit(c_lbl, (px + bar_w + 8, y - 2))
        y += C.CHAOS_BAR_H + 10

        inv_lbl = font.render("Inventory", True, C.TEXT_MUTED)
        screen.blit(inv_lbl, (px, y))
        y += inv_lbl.get_height() + 6
        inv = game.white_inventory if is_white else game.black_inventory
        is_active = (is_white and game.white_to_move) or (not is_white and not game.white_to_move)
        slot_size = C.INVENTORY_SLOT_SIZE
        gap = C.INVENTORY_SLOT_GAP
        cols = max(1, (inner_w - 2 * C.LEFT_PANEL_PAD) // (slot_size + gap))
        for i in range(max(cols, len(inv))):
            sx = px + (i % cols) * (slot_size + gap)
            sy = y + (i // cols) * (slot_size + gap)
            if sy + slot_size > top + height - 4:
                break
            rect = (sx, sy, slot_size, slot_size)
            _rounded_rect(screen, C.INPUT_BG, rect, radius=4, border=1, border_color=C.INPUT_BORDER)
            if i < len(inv):
                it = next((x for x in C.SHOP_ITEMS if x['id'] == inv[i]), None)
                if it:
                    lbl = font.render(it['name'][:2], True, C.TEXT_PRIMARY)
                    screen.blit(lbl, (sx + 4, sy + slot_size // 2 - lbl.get_height() // 2))
                if is_active:
                    slots_out.append((rect, i))


# ─── Turn Counter ───────────────────────────────────────────────────────────

def draw_turn_counter(screen, turn_count, seed, x, y, font):
    t = font.render(f"Turn {turn_count}", True, C.TEXT_PRIMARY)
    screen.blit(t, (x, y))
    s = font.render(f"Seed: {seed}", True, C.TEXT_MUTED)
    screen.blit(s, (x, y + 20))


def draw_status_text(screen, text, x, y, font):
    surf = font.render(text, True, C.TEXT_PRIMARY)
    screen.blit(surf, (x, y))


# ─── Shop Sidebar ──────────────────────────────────────────────────────────

def draw_shop_panel_bg(screen):
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    sx = W - C.SHOP_PANEL_W
    pygame.draw.rect(screen, C.PANEL_BG, (sx, 0, C.SHOP_PANEL_W, H))
    pygame.draw.line(screen, C.PANEL_BORDER, (sx, 0), (sx, H), 1)


def draw_shop_locked(screen, turn_count, font, font_small):
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    sw = C.SHOP_PANEL_W
    sx = W - sw
    cx = sx + sw // 2

    draw_shop_panel_bg(screen)

    lock_font = _icon_font(36)
    lock = lock_font.render("\U0001F512", True, C.TEXT_MUTED)
    screen.blit(lock, (cx - lock.get_width() // 2, H // 2 - 60))

    title = font.render("Shop", True, C.TEXT_MUTED)
    screen.blit(title, (cx - title.get_width() // 2, H // 2 - 10))
    opens = font_small.render(f"Opens on turn {C.SHOP_TURN}", True, C.TEXT_MUTED)
    screen.blit(opens, (cx - opens.get_width() // 2, H // 2 + 16))
    remaining = max(0, C.SHOP_TURN - turn_count)
    if remaining > 0:
        countdown = font_small.render(f"{remaining} turn{'s' if remaining != 1 else ''} remaining", True, C.ACCENT_WARM)
        screen.blit(countdown, (cx - countdown.get_width() // 2, H // 2 + 38))


def draw_shop_sidebar(screen, game, white_to_move, mx, my, mouse_clicked, font, font_small):
    """Returns list of (rect, item_dict) for hit-test and tooltips."""
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    sw = C.SHOP_PANEL_W
    sx = W - sw
    pad = C.SHOP_PANEL_PAD

    draw_shop_panel_bg(screen)
    gold = game.white_gold if white_to_move else game.black_gold

    y = 24
    title = font.render("Shop", True, C.TEXT_PRIMARY)
    screen.blit(title, (sx + pad, y))
    y += title.get_height() + 6
    gold_surf = font_small.render(f"\u25C6 Gold: {gold}", True, C.ACCENT_GOLD)
    screen.blit(gold_surf, (sx + pad, y))
    y += gold_surf.get_height() + 16

    pygame.draw.line(screen, C.PANEL_BORDER, (sx + pad, y), (sx + sw - pad, y), 1)
    y += 12

    ifont = _icon_font(18)
    item_rects = []
    for it in C.SHOP_ITEMS:
        rect = (sx + pad, y, sw - 2 * pad, C.SHOP_ITEM_ROW_H - 4)
        hover = rect[0] <= mx <= rect[0] + rect[2] and rect[1] <= my <= rect[1] + rect[3]
        can_afford = gold >= it['cost']

        bg = C.SHOP_ITEM_HOVER if hover else C.SHOP_ITEM_BG
        border = C.ACCENT_WARM if (hover and can_afford) else C.PANEL_BORDER
        _rounded_rect(screen, bg, rect, radius=6, border=1, border_color=border)

        icon_map = {"dagger": "\u2694", "shield": "\u25C9", "boots": "\u2192",
                    "crown": "\u2606", "potion": "\u2740"}
        icon_char = icon_map.get(it['id'], "\u2726")
        icon_surf = ifont.render(icon_char, True, C.ACCENT_GOLD if can_afford else C.TEXT_MUTED)
        screen.blit(icon_surf, (rect[0] + 8, rect[1] + rect[3] // 2 - icon_surf.get_height() // 2))

        name_color = C.TEXT_PRIMARY if can_afford else C.TEXT_MUTED
        name_surf = font.render(it['name'], True, name_color)
        screen.blit(name_surf, (rect[0] + 28, rect[1] + 6))

        cost_surf = font_small.render(f"{it['cost']}g", True, C.ACCENT_GOLD)
        screen.blit(cost_surf, (rect[0] + rect[2] - cost_surf.get_width() - 10,
                                rect[1] + rect[3] // 2 - cost_surf.get_height() // 2))

        item_rects.append((rect, it))
        y += C.SHOP_ITEM_ROW_H

    return item_rects


# ─── Deck ───────────────────────────────────────────────────────────────────

def draw_deck(screen, game, board_right, board_top, board_bottom, font, font_small):
    """Draw the deck pile with a breathing pulse and draw cost label."""
    shop_left = C.WINDOW_WIDTH - C.SHOP_PANEL_W
    gap_w = shop_left - board_right
    if gap_w < 60:
        return

    cx = board_right + gap_w // 2
    cy = (board_top + board_bottom) // 2

    pulse = 1.0 + 0.03 * math.sin(time.time() * 2.5)
    card_w = int(56 * pulse)
    card_h = int(78 * pulse)

    for offset in (4, 2):
        _rounded_rect(screen, C.PANEL_BORDER,
                      (cx - card_w // 2 + offset, cy - card_h // 2 + offset, card_w, card_h),
                      radius=6)
    _rounded_rect(screen, C.PANEL_BG_LIGHTER, (cx - card_w // 2, cy - card_h // 2, card_w, card_h),
                  radius=6, border=2, border_color=C.ACCENT_WARM)

    ifont = _icon_font(22)
    _center_text(screen, ifont, "\u2726", C.ACCENT_GOLD, cx, cy - 8)
    _center_text(screen, font_small, "Draw", C.TEXT_PRIMARY, cx, cy + 12)

    lbl = font_small.render("Deck", True, C.TEXT_MUTED)
    screen.blit(lbl, (cx - lbl.get_width() // 2, cy - card_h // 2 - 22))

    if game.free_draws_remaining > 0:
        cost_label = "FREE"
        cost_color = (80, 180, 80)
    else:
        cost_label = f"{C.EXTRA_DRAW_COST}g"
        cost_color = C.ACCENT_GOLD
    cost = font_small.render(cost_label, True, cost_color)
    screen.blit(cost, (cx - cost.get_width() // 2, cy + card_h // 2 + 6))

    played_count = len(game.chaos.deck._cooldowns)
    if played_count > 0:
        discard = font_small.render(f"{played_count} played", True, C.TEXT_MUTED)
        screen.blit(discard, (cx - discard.get_width() // 2, cy + card_h // 2 + 24))


# ─── Hand (playing-card style) ─────────────────────────────────────────────

def draw_hand(screen, hand, is_top, font_small, can_play=True):
    """Draw a player's card hand as proper playing cards.
    Returns list of (rect, card) for tooltip/click hit-testing."""
    card_rects = []
    if not hand:
        return card_rects

    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    hand_h = C.HAND_H
    left = C.LEFT_PANEL_W
    right = W - C.SHOP_PANEL_W
    strip_w = right - left

    bar_y = 0 if is_top else H - hand_h

    # Semi-transparent strip background
    surf = pygame.Surface((strip_w, hand_h), pygame.SRCALPHA)
    surf.fill((24, 26, 30, 210))
    screen.blit(surf, (left, bar_y))
    border_y = bar_y + (hand_h if is_top else 0)
    pygame.draw.line(screen, C.PANEL_BORDER, (left, border_y), (right, border_y), 1)

    cw = C.CARD_W
    ch = C.CARD_H
    gap = 10
    total_w = len(hand) * (cw + gap) - gap
    start_x = left + (strip_w - total_w) // 2
    card_top = bar_y + (hand_h - ch) // 2

    now = time.time()
    ifont = _icon_font(28)
    name_font = pygame.font.SysFont('arial', 12)
    rarity_font = pygame.font.SysFont('arial', 10)

    for i, card in enumerate(hand):
        cx = start_x + i * (cw + gap)
        cy = card_top
        if cx + cw > right - 8:
            break

        rarity = getattr(card, 'rarity', 'common')
        border_col = _rarity_color(rarity)
        tags = getattr(card, 'tags', [])
        icon = _icon_for(tags)

        # Rarity glow for epic/legendary
        if rarity in ("epic", "legendary"):
            glow_alpha = int(40 + 25 * math.sin(now * 3 + i))
            glow = pygame.Surface((cw + 8, ch + 8), pygame.SRCALPHA)
            glow.fill((*border_col, glow_alpha))
            screen.blit(glow, (cx - 4, cy - 4))

        # Card body
        _rounded_rect(screen, (28, 30, 35), (cx, cy, cw, ch),
                      radius=6, border=2, border_color=border_col)

        # Rarity accent strip at top
        strip_h = 4
        pygame.draw.rect(screen, border_col, (cx + 2, cy + 2, cw - 4, strip_h))

        # Icon (centered in upper half)
        icon_surf = ifont.render(icon, True, border_col)
        screen.blit(icon_surf, (cx + cw // 2 - icon_surf.get_width() // 2,
                                cy + 14))

        # Card name (wrapped, centered in lower portion)
        card_name = getattr(card, 'name', str(card))
        lines = _word_wrap(name_font, card_name, cw - 8)
        text_y = cy + ch - 8 - len(lines) * (name_font.get_height() + 1)
        for line in lines[:3]:
            lbl = name_font.render(line, True, C.TEXT_PRIMARY)
            screen.blit(lbl, (cx + cw // 2 - lbl.get_width() // 2, text_y))
            text_y += name_font.get_height() + 1

        # Rarity initial in top-left corner
        r_char = rarity[0].upper()
        r_surf = rarity_font.render(r_char, True, border_col)
        screen.blit(r_surf, (cx + 5, cy + 8))

        # Dim overlay if can't play this turn
        if not can_play:
            dim = pygame.Surface((cw, ch), pygame.SRCALPHA)
            dim.fill((0, 0, 0, 80))
            screen.blit(dim, (cx, cy))

        card_rects.append(((cx, cy, cw, ch), card))

    return card_rects


# ─── Promotion Modal ───────────────────────────────────────────────────────

def draw_promotion_modal(screen, white, piece_images, mx, my, accept_input,
                         mouse_clicked, font_ui, font_piece):
    W, H = C.WINDOW_WIDTH, C.WINDOW_HEIGHT
    overlay = pygame.Surface((W, H), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, C.PROMOTION_OVERLAY_ALPHA))
    screen.blit(overlay, (0, 0))

    cx, cy = W // 2, H // 2
    bw, bh = C.PROMOTION_BOX_W, C.PROMOTION_BOX_H
    bx, by = cx - bw // 2, cy - bh // 2

    _rounded_rect(screen, C.PANEL_BG, (bx, by, bw, bh), radius=12,
                  border=2, border_color=C.PANEL_BORDER)

    title = font_ui.render("Choose promotion piece", True, C.TEXT_SECONDARY)
    screen.blit(title, (cx - title.get_width() // 2, by + C.PROMOTION_TITLE_Y_OFFSET))

    total_w = 4 * C.PROMOTION_PIECE_SIZE + 3 * C.PROMOTION_PIECE_GAP
    start_x = cx - total_w // 2
    start_y = by + C.PROMOTION_BUTTONS_Y_OFFSET

    chosen = None
    for i, (piece, _) in enumerate(C.PROMOTION_CHOICES):
        p = piece if white else piece.upper()
        px = start_x + i * (C.PROMOTION_PIECE_SIZE + C.PROMOTION_PIECE_GAP)
        py = start_y
        rect = (px, py, C.PROMOTION_PIECE_SIZE, C.PROMOTION_PIECE_SIZE)
        hover = rect[0] <= mx <= rect[0] + rect[2] and rect[1] <= my <= rect[1] + rect[3]
        bg = C.PANEL_BG_LIGHTER if hover else C.INPUT_BG
        _rounded_rect(screen, bg, rect, radius=6, border=1, border_color=C.PANEL_BORDER)
        piece_size = C.PROMOTION_PIECE_SIZE - 12
        render.draw_piece_at(screen, p, px + 6, py + 6, piece_size, piece_images, font_piece)
        if accept_input and mouse_clicked and hover:
            chosen = p
    return chosen

"""Constants for Pawnageddon: dimensions, colors, asset paths, starting position."""

# Window and layout (updated at runtime via update_window_size)
WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 800
SQUARES = 8
MARGIN_Y = 48
LEFT_PANEL_W = 220
LEFT_PANEL_PAD = 16
SHOP_PANEL_W = 260
SHOP_PANEL_PAD = 14
BOARD_AREA_W = WINDOW_WIDTH - LEFT_PANEL_W - SHOP_PANEL_W
BOARD_AREA_H = WINDOW_HEIGHT - 2 * MARGIN_Y

# Deck appears at this turn; hands appear once a player has drawn cards
DECK_TURN = 8
HAND_H = 140
CARD_W = 80
CARD_H = 112

# Card economy
EXTRA_DRAW_COST = 3
MAX_PLAYS_PER_TURN = 1


def update_window_size(w, h):
    """Call after setting display mode so layout uses actual screen size."""
    global WINDOW_WIDTH, WINDOW_HEIGHT, BOARD_AREA_W, BOARD_AREA_H
    WINDOW_WIDTH = w
    WINDOW_HEIGHT = h
    BOARD_AREA_W = w - LEFT_PANEL_W - SHOP_PANEL_W
    BOARD_AREA_H = h - 2 * MARGIN_Y


# Square colors
LIGHT_SQUARE = (240, 217, 181)
DARK_SQUARE = (181, 136, 99)
HIGHLIGHT_SQUARE = (255, 255, 0, 100)
VALID_MOVE_SQUARE = (0, 255, 0, 80)
VALID_CAPTURE_SQUARE = (255, 0, 0, 100)

# Piece asset paths
PIECE_ASSETS = {
    'r': 'chess-pieces/rook-white.png',
    'n': 'chess-pieces/knight-white.png',
    'b': 'chess-pieces/bishop-white.png',
    'q': 'chess-pieces/queen-white.png',
    'k': 'chess-pieces/king-white.png',
    'p': 'chess-pieces/pawn-white.png',
    'R': 'chess-pieces/rook-black.png',
    'N': 'chess-pieces/knight-black.png',
    'B': 'chess-pieces/bishop-black.png',
    'Q': 'chess-pieces/queen-black.png',
    'K': 'chess-pieces/king-black.png',
    'P': 'chess-pieces/pawn-black.png',
}
TITLE_IMAGE_PATH = 'pawnageddon-title.png'

FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

# ── Color theme ──
BG_DARK = (24, 26, 30)
BG_DARKER = (18, 20, 23)
PANEL_BG = (32, 34, 38)
PANEL_BG_LIGHTER = (40, 42, 47)
PANEL_BORDER = (52, 55, 62)
TEXT_PRIMARY = (235, 235, 240)
TEXT_SECONDARY = (160, 164, 172)
TEXT_MUTED = (110, 114, 120)
ACCENT_GOLD = (218, 175, 62)
ACCENT_WARM = (180, 120, 60)
ACCENT_HOVER = (200, 140, 75)
INPUT_BG = (26, 28, 32)
INPUT_BORDER = (60, 63, 70)
INPUT_FOCUS = (100, 140, 210)
PLACEHOLDER_COLOR = (80, 83, 90)
CHAOS_BAR_BG = (40, 42, 46)
CHAOS_FILL = (180, 65, 65)
SHOP_ITEM_BG = (36, 38, 43)
SHOP_ITEM_HOVER = (48, 51, 58)

# Legacy aliases used elsewhere
BACKGROUND_DARK = BG_DARK
UI_TEXT_COLOR = TEXT_PRIMARY
GOLD_COLOR = ACCENT_GOLD
LABEL_MUTED = TEXT_SECONDARY

# Layout sizes
CHAOS_BAR_W = 120
CHAOS_BAR_H = 12
INVENTORY_SLOT_SIZE = 34
INVENTORY_SLOT_GAP = 6
SHOP_ITEM_ROW_H = 52

# Menu
MENU_ICON_SIZE = 36
MENU_ICON_PAD = 20
MENU_DROPDOWN_W = 180
MENU_ITEM_H = 40

# Promotion modal
PROMOTION_OVERLAY_ALPHA = 180
PROMOTION_BOX_W = 420
PROMOTION_BOX_H = 200
PROMOTION_PIECE_SIZE = 68
PROMOTION_PIECE_GAP = 20
PROMOTION_TITLE_Y_OFFSET = 28
PROMOTION_BUTTONS_Y_OFFSET = 90
PROMOTION_CHOICES = [('q', 'Queen'), ('r', 'Rook'), ('b', 'Bishop'), ('n', 'Knight')]

# ── Wacky features ──
PIECE_VALUES = {'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0}
CHAOS_MAX = 30
STARTING_GOLD = 0

SHOP_ITEMS = [
    {'id': 'shield', 'name': 'Shield', 'cost': 5, 'desc': 'Protects once'},
    {'id': 'dagger', 'name': 'Dagger', 'cost': 3, 'desc': '+1 chaos on capture'},
    {'id': 'boots',  'name': 'Boots',  'cost': 4, 'desc': 'Move again'},
    {'id': 'crown',  'name': 'Crown',  'cost': 8, 'desc': 'Royal flair'},
    {'id': 'potion', 'name': 'Potion', 'cost': 2, 'desc': 'Mysterious'},
]
SHOP_TURN = 4


def piece_value(piece_char):
    if piece_char == ' ':
        return 0
    return PIECE_VALUES.get(piece_char.lower(), 0)


def default_castling_rights():
    return {
        'white_kingside': True, 'white_queenside': True,
        'black_kingside': True, 'black_queenside': True,
    }


STARTING_POSITION = [
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
]

"""Drawing: board, pieces, notation, captured pieces, highlights."""

import pygame
from . import constants as C
from . import board as board_mod


def square_px():
    return board_px() / C.SQUARES


def board_px():
    reserve = 220
    max_h = max(320, C.BOARD_AREA_H - reserve)
    side = min(C.BOARD_AREA_W, max_h)
    return int(side // C.SQUARES) * C.SQUARES


def board_origin():
    bp = board_px()
    left = C.LEFT_PANEL_W + (C.BOARD_AREA_W - bp) // 2
    top = (C.WINDOW_HEIGHT - bp) // 2
    return (left, top)


def screen_to_logical(mouse_x, mouse_y, white_view):
    left, top = board_origin()
    sq = square_px()
    bp = board_px()
    bx = mouse_x - left
    by = mouse_y - top
    if bx < 0 or by < 0 or bx >= bp or by >= bp:
        return None
    sc = int(bx / sq)
    sr = int(by / sq)
    if white_view:
        col, row = sc, sr
    else:
        col, row = 7 - sc, 7 - sr
    if 0 <= col < C.SQUARES and 0 <= row < C.SQUARES:
        return (col, row)
    return None


def logical_to_screen(col, row, white_view):
    left, top = board_origin()
    sq = square_px()
    if white_view:
        draw_col, draw_row = col, row
    else:
        draw_col, draw_row = 7 - col, 7 - row
    x = left + draw_col * sq
    y = top + draw_row * sq
    return (x, y)


def _make_alpha_surface(w, h, color):
    s = pygame.Surface((int(w), int(h)))
    s.set_alpha(color[3] if len(color) > 3 else 255)
    s.fill(color[:3])
    return s


def draw_board_squares(screen, white_view):
    sq = square_px()
    for row in range(C.SQUARES):
        for col in range(C.SQUARES):
            x, y = logical_to_screen(col, row, white_view)
            is_light = (row + col) % 2 == 0
            color = C.LIGHT_SQUARE if is_light else C.DARK_SQUARE
            pygame.draw.rect(screen, color, (x, y, sq, sq))


def draw_highlight(screen, col, row, white_view):
    x, y = logical_to_screen(col, row, white_view)
    sq = square_px()
    surf = _make_alpha_surface(sq, sq, C.HIGHLIGHT_SQUARE)
    screen.blit(surf, (x, y))


def draw_valid_moves(screen, board, valid_moves, white_view):
    sq = square_px()
    for (col, row) in valid_moves:
        x, y = logical_to_screen(col, row, white_view)
        is_capture = not board_mod.is_empty(board, col, row)
        color = C.VALID_CAPTURE_SQUARE if is_capture else C.VALID_MOVE_SQUARE
        surf = _make_alpha_surface(sq, sq, color)
        screen.blit(surf, (x, y))


def draw_piece_at(screen, piece, x, y, size, piece_images, font):
    if piece in piece_images and piece_images[piece] is not None:
        img = piece_images[piece]
        scaled = pygame.transform.smoothscale(img, (int(size), int(size)))
        screen.blit(scaled, (x, y))
    else:
        label = piece.upper()
        color = (255, 255, 255) if board_mod.is_white_piece(piece) else (0, 0, 0)
        text = font.render(label, True, color)
        screen.blit(text, (x + size * 0.2, y + size * 0.5))


def draw_pieces(screen, board, piece_images, white_view, skip_square, font, equipped=None):
    if equipped is None:
        equipped = {}
    sq = square_px()
    size = sq * 0.9
    pad = (sq - size) / 2
    font_size = max(12, int(sq * 0.5))
    try:
        piece_font = pygame.font.Font(None, font_size)
    except Exception:
        piece_font = pygame.font.SysFont('arial', max(12, font_size // 2))
    for row in range(C.SQUARES):
        for col in range(C.SQUARES):
            if skip_square == (col, row):
                continue
            piece = board_mod.get_piece(board, col, row)
            if piece == ' ':
                continue
            x, y = logical_to_screen(col, row, white_view)
            draw_piece_at(screen, piece, x + pad, y + pad, size, piece_images, piece_font)
            if (col, row) in equipped:
                rx, ry = x + pad + size - 12, y + pad + 2
                pygame.draw.circle(screen, (255, 200, 80), (int(rx), int(ry)), 6)
                pygame.draw.circle(screen, (180, 140, 40), (int(rx), int(ry)), 6, 1)


def draw_notation(screen, white_view, font):
    left, top = board_origin()
    sq = square_px()
    bp = board_px()
    for i, f in enumerate(C.FILES):
        x, _ = logical_to_screen(i, 7, white_view)
        y = top + bp + 4
        text = font.render(f, True, (200, 200, 200))
        screen.blit(text, (x + sq * 0.35, y))
    for r in range(C.SQUARES):
        rank_display = 8 - r if white_view else r + 1
        _, y = logical_to_screen(0, r, white_view)
        text = font.render(str(rank_display), True, (200, 200, 200))
        screen.blit(text, (left - 20, y + sq * 0.6))


def draw_captured_pieces(screen, pieces, piece_images, x, y, scale, font):
    px = x
    for p in pieces:
        draw_piece_at(screen, p, px, y, scale, piece_images, font)
        px += scale * 0.7

"""Main game loop and entry point."""

import os
import sys
import time
import pygame

from . import constants as C
from .game import GameState
from .pieces import is_king_in_check, no_legal_moves
from . import render
from . import ui
from . import sounds


def resolve_assets_folder():
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
        path = os.path.join(base, 'assets')
    else:
        path = os.path.join(os.getcwd(), 'assets')
    if os.path.isdir(path):
        return path
    return 'assets'


def load_piece_images(assets_dir):
    out = {}
    for piece, rel_path in C.PIECE_ASSETS.items():
        path = os.path.join(assets_dir, rel_path)
        try:
            img = pygame.image.load(path).convert_alpha()
            out[piece] = img
        except Exception:
            out[piece] = None
    return out


def load_title_image(assets_dir):
    path = os.path.join(assets_dir, C.TITLE_IMAGE_PATH)
    try:
        return pygame.image.load(path).convert_alpha()
    except Exception:
        return None


def main():
    pygame.init()
    pygame.mixer.init()
    sounds.init()

    screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
    C.update_window_size(screen.get_width(), screen.get_height())
    pygame.display.set_caption("Pawnageddon")

    assets_dir = resolve_assets_folder()
    piece_images = load_piece_images(assets_dir)
    title_image = load_title_image(assets_dir)

    font_large = pygame.font.SysFont('georgia', 28, bold=True)
    font_med = pygame.font.SysFont('arial', 20)
    font_small = pygame.font.SysFont('arial', 16)
    font_tiny = pygame.font.SysFont('arial', 14)
    font_piece = pygame.font.SysFont('arial', 24)

    screen_enum = 'title_splash'
    white_name = "White"
    black_name = "Black"
    input_focus = 0
    game = GameState()
    white_at_bottom = True
    menu_open = False
    promotion_pending = None
    promotion_modal_accept_input = False
    dragging_inventory_index = None
    inventory_slot_rects = []
    shop_item_rects = []
    hand_card_rects = []  # (rect, card) for tooltip detection

    # Floating messages: (text, timestamp) — persists across turns
    floating_msgs = []

    # Card-play floating text animation: (text, start_time, cx, cy)
    card_play_anim = []

    clock = pygame.time.Clock()
    key_event_this_frame = None

    while True:
        mx, my = pygame.mouse.get_pos()
        mouse_clicked = False
        mouse_released = False
        right_clicked = False

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                key_event_this_frame = event
                if event.key == pygame.K_ESCAPE:
                    pygame.quit()
                    sys.exit()
            if event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:
                    mouse_clicked = True
                elif event.button == 3:
                    right_clicked = True
            if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                mouse_released = True

        # ── Title splash ──
        if screen_enum == 'title_splash':
            ui.draw_title_splash(screen, title_image, mx, my, font_large, font_small)
            if mouse_clicked:
                sounds.play("click")
                screen_enum = 'name_input'
                key_event_this_frame = None

        # ── Name input ──
        elif screen_enum == 'name_input':
            new_game_rect, white_rect, black_rect = ui.draw_name_input_screen(
                screen, white_name, black_name, input_focus, mx, my,
                font_large, font_small, font_med,
            )
            input_focus, white_name, black_name = ui.text_input(
                input_focus, white_name, black_name,
                white_rect, black_rect, mx, my, mouse_clicked, key_event_this_frame,
            )

            def _start_game():
                nonlocal game, white_name, black_name, screen_enum, menu_open, floating_msgs
                game = GameState()
                game.start_turn()
                white_name = white_name.strip() or "White"
                black_name = black_name.strip() or "Black"
                screen_enum = 'playing'
                menu_open = False
                floating_msgs = []
                sounds.play("click")

            if key_event_this_frame and key_event_this_frame.key == pygame.K_RETURN:
                _start_game()
            elif mouse_clicked:
                ngx, ngy, ngw, ngh = new_game_rect
                if ngx <= mx <= ngx + ngw and ngy <= my <= ngy + ngh:
                    _start_game()
            if key_event_this_frame:
                key_event_this_frame = None

        # ── Playing ──
        elif screen_enum == 'playing':

            # Sync new turn messages into floating messages
            if game.turn_messages:
                now = time.time()
                for msg in game.turn_messages:
                    floating_msgs.append((msg, now))
                game.turn_messages.clear()

            if menu_open:
                ix, iy, iw, ih = ui.menu_icon_rect()
                menu_x = ix + iw - C.MENU_DROPDOWN_W
                menu_y = iy + ih + 4
                new_game_clicked, flip_clicked = ui.menu_hit_test(mx, my, mouse_clicked)
                outside = (mx < menu_x or mx > menu_x + C.MENU_DROPDOWN_W
                           or my < menu_y or my > menu_y + C.MENU_ITEM_H * 2)
                if mouse_clicked:
                    if new_game_clicked:
                        screen_enum = 'name_input'
                        menu_open = False
                        sounds.play("click")
                    elif flip_clicked:
                        white_at_bottom = not white_at_bottom
                        menu_open = False
                        sounds.play("click")
                    elif ix <= mx <= ix + iw and iy <= my <= iy + ih:
                        menu_open = False
                    elif outside:
                        menu_open = False
            elif mouse_clicked:
                ix, iy, iw, ih = ui.menu_icon_rect()
                if ix <= mx <= ix + iw and iy <= my <= iy + ih:
                    menu_open = True
                    sounds.play("click")
                else:
                    # Check deck click (extra draws cost gold)
                    deck_clicked = False
                    if game.turn_count >= C.DECK_TURN:
                        _left, _top = render.board_origin()
                        _bp = render.board_px()
                        shop_left = C.WINDOW_WIDTH - C.SHOP_PANEL_W
                        deck_cx = _left + _bp + (shop_left - _left - _bp) // 2
                        deck_cy = (_top + _top + _bp) // 2
                        if abs(mx - deck_cx) < 35 and abs(my - deck_cy) < 45:
                            drawn = game.draw_card(game.white_to_move)
                            if drawn:
                                sounds.play("card_draw")
                            else:
                                sounds.play("error")
                            deck_clicked = True

                    # Check hand card click (play a card)
                    card_clicked = False
                    if not deck_clicked:
                        for rect, card in hand_card_rects:
                            rx, ry, rw, rh = rect
                            if rx <= mx <= rx + rw and ry <= my <= ry + rh:
                                result = game.play_card(card.id, game.white_to_move)
                                if result:
                                    sounds.play("card_play")
                                    _left, _top = render.board_origin()
                                    _bp = render.board_px()
                                    bcx = _left + _bp // 2
                                    bcy = _top + _bp // 2
                                    card_play_anim.append((card.name, time.time(), bcx, bcy))
                                card_clicked = True
                                break

                    # Shop hit-test (only when shop is open)
                    shop_hit = None
                    if not deck_clicked and not card_clicked and game.turn_count >= C.SHOP_TURN:
                        for rect, item_dict in shop_item_rects:
                            if rect[0] <= mx <= rect[0] + rect[2] and rect[1] <= my <= rect[1] + rect[3]:
                                success = game.buy_item(game.white_to_move, item_dict['id'])
                                if success:
                                    sounds.play("buy")
                                else:
                                    sounds.play("error")
                                shop_hit = item_dict['id']
                                break

                    if not shop_hit and not deck_clicked and not card_clicked:
                        slot_hit = None
                        for rect, idx in inventory_slot_rects:
                            if rect[0] <= mx <= rect[0] + rect[2] and rect[1] <= my <= rect[1] + rect[3]:
                                slot_hit = idx
                                break
                        if slot_hit is not None:
                            inv = game.white_inventory if game.white_to_move else game.black_inventory
                            if slot_hit < len(inv):
                                dragging_inventory_index = slot_hit
                        else:
                            pos = render.screen_to_logical(mx, my, white_at_bottom)
                            if pos is not None:
                                col, row = pos
                                result = game.on_square_clicked(col, row)
                                if result == 'done':
                                    pass
                                elif result[0] == 'promotion_pending':
                                    _, from_c, from_r, to_c, to_r, white = result
                                    promotion_pending = (from_c, from_r, to_c, to_r, white)
                                    screen_enum = 'promotion'
                                    promotion_modal_accept_input = False

            if mouse_released and dragging_inventory_index is not None:
                pos = render.screen_to_logical(mx, my, white_at_bottom)
                if pos is not None:
                    col, row = pos
                    inv = game.white_inventory if game.white_to_move else game.black_inventory
                    if dragging_inventory_index < len(inv):
                        item_id = inv[dragging_inventory_index]
                        game.equip_item(game.white_to_move, item_id, col, row)
                dragging_inventory_index = None

            if right_clicked:
                pos = render.screen_to_logical(mx, my, white_at_bottom)
                if pos is not None:
                    col, row = pos
                    game.unequip_item(col, row, game.white_to_move)

            # ── Draw game screen ──
            screen.fill(C.BG_DARK)

            left, top = render.board_origin()
            bp = render.board_px()
            board_bottom = top + bp
            sq_scale = render.square_px() * 0.55
            board_cx = left + bp // 2

            # Left panel
            inventory_slot_rects = ui.draw_left_panel(
                screen, game, white_name, black_name, top, board_bottom,
                piece_images, sq_scale, font_small, font_piece,
            )

            # Board
            render.draw_board_squares(screen, white_at_bottom)
            if game.selected is not None:
                sc, sr = game.selected
                render.draw_highlight(screen, sc, sr, white_at_bottom)
                render.draw_valid_moves(screen, game.board, game.valid_moves, white_at_bottom)
            render.draw_pieces(screen, game.board, piece_images, white_at_bottom,
                               None, font_piece, game.equipped)
            render.draw_notation(screen, white_at_bottom, font_tiny)

            # Turn / status / phase in the gap
            status_x = left + bp + 20
            ui.draw_turn_counter(screen, game.turn_count, game.random_seed,
                                 status_x, top, font_small)
            phase_text = f"Phase {game.chaos_phase}: {game.chaos_phase_name}"
            ui.draw_status_text(screen, phase_text, status_x, top + 44, font_small)

            turn_name = white_name if game.white_to_move else black_name
            in_check = is_king_in_check(game.board, game.white_to_move,
                                        game.castling_rights, game.en_passant_target)
            no_moves = no_legal_moves(game.board, game.white_to_move,
                                      game.castling_rights, game.en_passant_target)
            if no_moves and in_check:
                winner = black_name if game.white_to_move else white_name
                status = f"Checkmate! {winner} wins"
                sounds.play("capture")
            elif no_moves:
                status = "Stalemate"
            elif in_check:
                status = f"{turn_name} to move (check)"
            else:
                status = f"{turn_name} to move"
            ui.draw_status_text(screen, status, status_x, top + 68, font_small)

            # Shop sidebar (gated on turn count)
            if game.turn_count >= C.SHOP_TURN:
                shop_item_rects = ui.draw_shop_sidebar(
                    screen, game, game.white_to_move, mx, my,
                    mouse_clicked, font_med, font_small,
                )
            else:
                ui.draw_shop_locked(screen, game.turn_count, font_med, font_small)
                shop_item_rects = []

            # Deck (appears at turn DECK_TURN)
            if game.turn_count >= C.DECK_TURN:
                ui.draw_deck(screen, game, left + bp, top, board_bottom,
                             font_med, font_small)

            # Player hands (active player's hand can play if they haven't used their play)
            hand_card_rects = []
            white_can_play = game.white_to_move and game.cards_played_this_turn < C.MAX_PLAYS_PER_TURN
            black_can_play = not game.white_to_move and game.cards_played_this_turn < C.MAX_PLAYS_PER_TURN
            if white_at_bottom:
                hand_card_rects += ui.draw_hand(screen, game.black_hand, is_top=True,
                                                font_small=font_small, can_play=black_can_play)
                hand_card_rects += ui.draw_hand(screen, game.white_hand, is_top=False,
                                                font_small=font_small, can_play=white_can_play)
            else:
                hand_card_rects += ui.draw_hand(screen, game.white_hand, is_top=True,
                                                font_small=font_small, can_play=white_can_play)
                hand_card_rects += ui.draw_hand(screen, game.black_hand, is_top=False,
                                                font_small=font_small, can_play=black_can_play)

            # Floating event messages (bottom-center of board)
            ui.draw_floating_messages(screen, floating_msgs, board_cx, board_bottom, font_small)

            # Card-play floating text animation
            now = time.time()
            alive = []
            for text, start, cx, cy in card_play_anim:
                age = now - start
                if age < 2.0:
                    alpha = max(0, int(255 * (1.0 - age / 2.0)))
                    drift = int(age * 30)
                    surf = font_large.render(text, True, C.ACCENT_GOLD)
                    surf.set_alpha(alpha)
                    screen.blit(surf, (cx - surf.get_width() // 2, cy - drift - 20))
                    alive.append((text, start, cx, cy))
            card_play_anim[:] = alive

            # Menu icon
            ui.draw_menu_icon(screen, mx, my)
            if menu_open:
                ui.draw_menu(screen, font_small)

            # ── Tooltips (drawn last, on top of everything) ──

            # Shop item tooltips
            if game.turn_count >= C.SHOP_TURN:
                for rect, item_dict in shop_item_rects:
                    if rect[0] <= mx <= rect[0] + rect[2] and rect[1] <= my <= rect[1] + rect[3]:
                        ui.draw_tooltip(screen, item_dict['name'], item_dict['desc'],
                                        mx, my, font_med, font_small)
                        break

            # Hand card tooltips
            for rect, card in hand_card_rects:
                rx, ry, rw, rh = rect
                if rx <= mx <= rx + rw and ry <= my <= ry + rh:
                    desc = getattr(card, 'description', '')
                    rarity = getattr(card, 'rarity', 'common')
                    tags = getattr(card, 'tags', [])
                    icon = ui._icon_for(tags)
                    ui.draw_tooltip(screen, card.name, desc, mx, my, font_med, font_small,
                                    rarity=rarity, icon=icon)
                    break

        # ── Promotion ──
        elif screen_enum == 'promotion':
            if not promotion_modal_accept_input and not pygame.mouse.get_pressed()[0]:
                promotion_modal_accept_input = True

            screen.fill(C.BG_DARK)
            render.draw_board_squares(screen, white_at_bottom)
            render.draw_pieces(screen, game.board, piece_images, white_at_bottom,
                               None, font_piece)
            render.draw_notation(screen, white_at_bottom, font_tiny)

            if promotion_pending is not None:
                from_c, from_r, to_c, to_r, white = promotion_pending
                chosen = ui.draw_promotion_modal(
                    screen, white, piece_images, mx, my,
                    promotion_modal_accept_input, mouse_clicked,
                    font_small, font_piece,
                )
                if chosen is not None:
                    game.complete_promotion(from_c, from_r, to_c, to_r, chosen)
                    promotion_pending = None
                    screen_enum = 'playing'
                    sounds.play("click")

        pygame.display.flip()
        key_event_this_frame = None
        clock.tick(60)

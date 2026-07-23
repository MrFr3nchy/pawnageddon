"""Game state: board, turn, selection, moves, captures, castling, en passant, chaos engine."""

import random
from . import board as board_mod
from .board import get_piece, set_piece, is_white_piece
from .constants import default_castling_rights, piece_value, CHAOS_MAX
from .pieces import legal_moves
from .chaos import ChaosEngine


class GameState:
    def __init__(self):
        self.board = board_mod.new_board()
        self.white_to_move = True
        self.selected = None
        self.valid_moves = set()
        self.captured_white = []
        self.captured_black = []
        self.castling_rights = default_castling_rights()
        self.en_passant_target = None
        self.random_seed = random.randint(0, 2**32 - 1)
        random.seed(self.random_seed)
        self.turn_count = 0
        self.white_gold = 0
        self.black_gold = 0
        self.white_chaos = 0
        self.black_chaos = 0
        self.white_inventory = []
        self.black_inventory = []
        self.equipped = {}

        # Chaos engine
        self.chaos = ChaosEngine()

        # Messages to display this turn (set by chaos events, card plays, etc.)
        self.turn_messages: list[str] = []

        # Card economy: tracked per player-turn
        self.free_draws_remaining = 0
        self.cards_played_this_turn = 0

    # ── Convenience accessors for UI ──

    @property
    def white_hand(self):
        return self.chaos.white_hand.cards

    @property
    def black_hand(self):
        return self.chaos.black_hand.cards

    @property
    def chaos_phase(self):
        return self.chaos.phase

    @property
    def chaos_phase_name(self):
        return self.chaos.phase_name

    @property
    def any_capture(self):
        return len(self.captured_white) + len(self.captured_black) > 0

    @property
    def pieces_remaining(self):
        count = 0
        for r in range(8):
            for c in range(8):
                if self.board[r][c] != ' ':
                    count += 1
        return count

    @property
    def chaos_pct(self):
        total = self.white_chaos + self.black_chaos
        return min(100.0, total / (CHAOS_MAX * 2) * 100)

    # ── Chaos integration ──

    def start_turn(self):
        """Call at the beginning of each turn to process chaos events."""
        self.turn_messages.clear()
        self.free_draws_remaining = 0
        self.cards_played_this_turn = 0
        results = self.chaos.on_turn_start(
            self.turn_count, self.chaos_pct, self.pieces_remaining,
            self.board, self.white_to_move,
        )
        for r in results:
            self._apply_effect_result(r)
        self.turn_messages.extend(self.chaos.turn_log)

        # Auto-draw 1 free card per turn once deck is unlocked
        if self.turn_count >= 8:
            hand = self.chaos.white_hand if self.white_to_move else self.chaos.black_hand
            if not hand.is_full:
                drawn = self.chaos.draw_card(self.white_to_move)
                if drawn:
                    self.turn_messages.extend(self.chaos.turn_log[-len(drawn):])

    def draw_card(self, player_white: bool):
        """Player draws from the chaos deck. Free draws first, then costs gold."""
        from .constants import EXTRA_DRAW_COST
        hand = self.chaos.white_hand if player_white else self.chaos.black_hand
        if hand.is_full:
            self.turn_messages.append("Hand is full!")
            return []

        if self.free_draws_remaining > 0:
            self.free_draws_remaining -= 1
        else:
            gold = self.white_gold if player_white else self.black_gold
            if gold < EXTRA_DRAW_COST:
                self.turn_messages.append(f"Need {EXTRA_DRAW_COST} gold to draw!")
                return []
            if player_white:
                self.white_gold -= EXTRA_DRAW_COST
            else:
                self.black_gold -= EXTRA_DRAW_COST
            self.turn_messages.append(f"Paid {EXTRA_DRAW_COST} gold to draw")

        drawn = self.chaos.draw_card(player_white)
        self.turn_messages.extend(self.chaos.turn_log[-len(drawn):])
        return drawn

    def play_card(self, card_id: str, player_white: bool,
                  chosen_square=None, chosen_piece=None):
        """Player plays a card from their hand (limited to MAX_PLAYS_PER_TURN)."""
        from .constants import MAX_PLAYS_PER_TURN
        if self.cards_played_this_turn >= MAX_PLAYS_PER_TURN:
            self.turn_messages.append("Already played a card this turn!")
            return None
        result = self.chaos.play_card(
            card_id, self.board, player_white, chosen_square, chosen_piece,
        )
        if result:
            self.cards_played_this_turn += 1
            self._apply_effect_result(result)
            self.turn_messages.extend(result.messages)
        return result

    def _apply_effect_result(self, result):
        """Apply gold/chaos changes from an EffectResult to game state."""
        self.white_gold = max(0, self.white_gold + result.gold_changes.get("white", 0))
        self.black_gold = max(0, self.black_gold + result.gold_changes.get("black", 0))
        self.white_chaos = min(CHAOS_MAX, max(0, self.white_chaos + result.chaos_changes.get("white", 0)))
        self.black_chaos = min(CHAOS_MAX, max(0, self.black_chaos + result.chaos_changes.get("black", 0)))
        # Destroyed pieces go to captured lists
        for col, row, piece_char in result.destroyed:
            if piece_char != ' ':
                if is_white_piece(piece_char):
                    self.captured_white.append(piece_char)
                else:
                    self.captured_black.append(piece_char)
                self.chaos.on_piece_captured(col, row)

    # ── Square click handling ──

    def on_square_clicked(self, col, row):
        if not board_mod.in_bounds(col, row):
            self.selected = None
            self.valid_moves = set()
            return 'done'

        # Block frozen pieces from being selected
        if self.chaos.is_frozen(col, row) and board_mod.piece_is_side(self.board, col, row, self.white_to_move):
            self.turn_messages.append("That piece is frozen!")
            return 'done'

        if self.selected is not None:
            sc, sr = self.selected
            if (col, row) in self.valid_moves:
                piece = get_piece(self.board, sc, sr)
                is_pawn = piece.lower() == 'p'
                is_back_rank = (is_white_piece(piece) and row == 0) or (
                    board_mod.is_black_piece(piece) and row == 7
                )
                if is_pawn and is_back_rank:
                    self.selected = None
                    self.valid_moves = set()
                    return ('promotion_pending', sc, sr, col, row, is_white_piece(piece))
                self._make_move(sc, sr, col, row, None)
                self.selected = None
                self.valid_moves = set()
                return 'done'

        if board_mod.piece_is_side(self.board, col, row, self.white_to_move):
            self.selected = (col, row)
            self.valid_moves = legal_moves(
                self.board, col, row,
                self.castling_rights,
                self.en_passant_target,
            )
            return 'done'

        self.selected = None
        self.valid_moves = set()
        return 'done'

    def complete_promotion(self, from_c, from_r, to_c, to_r, piece):
        self._make_move(from_c, from_r, to_c, to_r, piece)

    # ── Legacy shop (kept for backward compat; chaos.shop is the enhanced version) ──

    def buy_item(self, player_white, item_id):
        from .constants import SHOP_ITEMS
        cost = next((it['cost'] for it in SHOP_ITEMS if it['id'] == item_id), None)
        if cost is None:
            return False
        gold = self.white_gold if player_white else self.black_gold
        if gold < cost:
            return False
        if player_white:
            self.white_gold -= cost
            self.white_inventory.append(item_id)
        else:
            self.black_gold -= cost
            self.black_inventory.append(item_id)
        return True

    def equip_item(self, player_white, item_id, col, row):
        inv = self.white_inventory if player_white else self.black_inventory
        if item_id not in inv:
            return False
        piece = get_piece(self.board, col, row)
        if piece == ' ' or board_mod.is_white_piece(piece) != player_white:
            return False
        inv.remove(item_id)
        self.equipped[(col, row)] = item_id
        return True

    def unequip_item(self, col, row, player_white):
        sq = (col, row)
        if sq not in self.equipped:
            return False
        piece = get_piece(self.board, col, row)
        if piece == ' ' or board_mod.is_white_piece(piece) != player_white:
            return False
        item_id = self.equipped.pop(sq)
        inv = self.white_inventory if player_white else self.black_inventory
        inv.append(item_id)
        return True

    # ── Move execution ──

    def _make_move(self, from_c, from_r, to_c, to_r, promote_to):
        piece = get_piece(self.board, from_c, from_r)
        white = is_white_piece(piece)
        start_row = 6 if white else 1
        is_pawn_two = (piece.lower() == 'p' and from_r == start_row
                       and abs(to_r - from_r) == 2)
        was_ep = self.en_passant_target == (to_c, to_r)
        if was_ep:
            capture_row = to_r + (1 if white else -1)
            captured = get_piece(self.board, to_c, capture_row)
        else:
            captured = get_piece(self.board, to_c, to_r)

        self.en_passant_target = (to_c, (from_r + to_r) // 2) if is_pawn_two else None

        # Shield check: if target square has a shielded piece, block the capture
        if captured != ' ' and self.chaos.is_shielded(to_c, to_r):
            self.chaos.mutations.remove_at(to_c, to_r)
            self.turn_messages.append(f"Shield absorbed the capture at {'abcdefgh'[to_c]}{8-to_r}!")
            captured = ' '

        if captured != ' ':
            capturer_white = not white
            value = piece_value(captured)
            if capturer_white:
                self.white_chaos = min(CHAOS_MAX, self.white_chaos + value)
                self.white_gold += value
            else:
                self.black_chaos = min(CHAOS_MAX, self.black_chaos + value)
                self.black_gold += value
            cap_sq = (to_c, to_r)
            if cap_sq in self.equipped:
                item = self.equipped.pop(cap_sq)
                if capturer_white:
                    self.white_inventory.append(item)
                else:
                    self.black_inventory.append(item)
            self.chaos.on_piece_captured(to_c, to_r)
            if is_white_piece(captured):
                self.captured_white.append(captured)
            else:
                self.captured_black.append(captured)

        if promote_to is not None:
            piece = promote_to
        elif piece.lower() == 'p' and (to_r == 0 or to_r == 7):
            piece = 'q' if white else 'Q'

        is_king = piece.lower() == 'k'
        is_rook = piece.lower() == 'r'

        if is_king and from_c == 4:
            if white:
                if to_c == 6:
                    set_piece(self.board, 5, 7, 'r')
                    set_piece(self.board, 7, 7, ' ')
                elif to_c == 2:
                    set_piece(self.board, 3, 7, 'r')
                    set_piece(self.board, 0, 7, ' ')
                self.castling_rights['white_kingside'] = False
                self.castling_rights['white_queenside'] = False
            else:
                if to_c == 6:
                    set_piece(self.board, 5, 0, 'R')
                    set_piece(self.board, 7, 0, ' ')
                elif to_c == 2:
                    set_piece(self.board, 3, 0, 'R')
                    set_piece(self.board, 0, 0, ' ')
                self.castling_rights['black_kingside'] = False
                self.castling_rights['black_queenside'] = False
        elif is_king:
            if white:
                self.castling_rights['white_kingside'] = False
                self.castling_rights['white_queenside'] = False
            else:
                self.castling_rights['black_kingside'] = False
                self.castling_rights['black_queenside'] = False
        elif is_rook:
            if white:
                if from_c == 0 and from_r == 7:
                    self.castling_rights['white_queenside'] = False
                elif from_c == 7 and from_r == 7:
                    self.castling_rights['white_kingside'] = False
            else:
                if from_c == 0 and from_r == 0:
                    self.castling_rights['black_queenside'] = False
                elif from_c == 7 and from_r == 0:
                    self.castling_rights['black_kingside'] = False

        set_piece(self.board, to_c, to_r, piece)
        set_piece(self.board, from_c, from_r, ' ')
        if was_ep:
            capture_row = to_r + (1 if white else -1)
            set_piece(self.board, to_c, capture_row, ' ')

        # Move equipped item and mutations with the piece
        from_sq = (from_c, from_r)
        if from_sq in self.equipped:
            self.equipped[(to_c, to_r)] = self.equipped.pop(from_sq)
        self.chaos.on_piece_move(from_c, from_r, to_c, to_r)

        # Check hazards at destination
        hazard_result = self.chaos.check_hazard_on_move(to_c, to_r, self.board, white)
        if hazard_result:
            self._apply_effect_result(hazard_result)
            self.turn_messages.extend(hazard_result.messages)

        self.white_to_move = not self.white_to_move
        self.turn_count += 1

        # Process turn-start chaos for the new active player
        self.start_turn()

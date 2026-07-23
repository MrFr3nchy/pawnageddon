"""Effect engine: interprets and applies structured effect dicts to game state.

Effect dict format:
    {"type": "destroy", "target": "random_enemy"}
    {"type": "gold", "player": "self", "amount": 5}
    {"type": "spawn", "piece": "q", "square": "random_empty"}
    etc.

Target selectors:
    "self_piece"      — caller picks one of their pieces
    "enemy_piece"     — caller picks an enemy piece
    "any_piece"       — caller picks any piece
    "random_self"     — random own piece
    "random_enemy"    — random enemy piece
    "random_any"      — random piece on board
    "all_pawns"       — every pawn
    "all_pieces"      — every piece
    "chosen_square"   — player clicks a square
    "random_square"   — random empty square
    "random_empty"    — random empty square
    "area"            — radius around a point
"""

from __future__ import annotations
import random
from typing import Any

# Sentinel: effect needs player input (click a square/piece)
NEEDS_TARGET = "needs_target"


def resolve_pieces(board, selector: str, player_white: bool) -> list[tuple[int, int]]:
    """Return list of (col, row) matching a target selector."""
    from ..board import is_white_piece, is_black_piece, in_bounds, get_piece
    SQUARES = 8
    results = []
    for r in range(SQUARES):
        for c in range(SQUARES):
            p = get_piece(board, c, r)
            if p == ' ':
                continue
            pw = is_white_piece(p)
            if selector == "random_self" and pw == player_white:
                results.append((c, r))
            elif selector == "random_enemy" and pw != player_white:
                results.append((c, r))
            elif selector in ("random_any", "any_piece"):
                results.append((c, r))
            elif selector == "all_pawns" and p.lower() == 'p':
                results.append((c, r))
            elif selector == "all_knights" and p.lower() == 'n':
                results.append((c, r))
            elif selector == "all_pieces":
                results.append((c, r))
    return results


def resolve_empty_squares(board) -> list[tuple[int, int]]:
    from ..board import get_piece
    SQUARES = 8
    return [(c, r) for r in range(SQUARES) for c in range(SQUARES) if get_piece(board, c, r) == ' ']


class EffectResult:
    """Accumulates outcomes of applying effects so the game/UI can react."""
    def __init__(self):
        self.destroyed: list[tuple[int, int, str]] = []   # (col, row, piece_char)
        self.spawned: list[tuple[int, int, str]] = []
        self.teleported: list[tuple[int, int, int, int]] = []  # (from_c, from_r, to_c, to_r)
        self.transformed: list[tuple[int, int, str, str]] = [] # (col, row, old, new)
        self.gold_changes: dict[str, int] = {"white": 0, "black": 0}
        self.chaos_changes: dict[str, int] = {"white": 0, "black": 0}
        self.cards_drawn: int = 0
        self.hazards_placed: list[dict] = []
        self.mutations_applied: list[dict] = []
        self.messages: list[str] = []
        self.extra_turns: int = 0
        self.needs_input: list[dict] = []  # effects that need player clicks


def apply_effect(effect: dict, board, player_white: bool, result: EffectResult,
                 chosen_square: tuple[int,int] | None = None,
                 chosen_piece: tuple[int,int] | None = None):
    """Apply a single effect dict to the board, accumulating into result."""
    from ..board import get_piece, set_piece, is_white_piece

    etype = effect.get("type", "")

    if etype == "destroy":
        targets = _get_targets(effect, board, player_white, chosen_piece)
        radius = effect.get("radius", 0)
        for c, r in targets:
            if radius > 0:
                _destroy_area(board, c, r, radius, result)
            else:
                p = get_piece(board, c, r)
                if p != ' ':
                    set_piece(board, c, r, ' ')
                    result.destroyed.append((c, r, p))
                    result.messages.append(f"{p} at {_sq_name(c, r)} destroyed")

    elif etype == "spawn":
        piece = effect.get("piece", "p")
        if not player_white:
            piece = piece.upper()
        sq = chosen_square or _random_empty(board)
        if sq:
            set_piece(board, sq[0], sq[1], piece)
            result.spawned.append((sq[0], sq[1], piece))
            result.messages.append(f"Spawned {piece} at {_sq_name(*sq)}")

    elif etype == "teleport":
        targets = _get_targets(effect, board, player_white, chosen_piece)
        for c, r in targets:
            dest = _random_empty(board)
            if dest:
                p = get_piece(board, c, r)
                set_piece(board, c, r, ' ')
                set_piece(board, dest[0], dest[1], p)
                result.teleported.append((c, r, dest[0], dest[1]))
                result.messages.append(f"{p} teleported {_sq_name(c,r)} → {_sq_name(*dest)}")

    elif etype == "swap":
        pieces = resolve_pieces(board, effect.get("target", "random_any"), player_white)
        if len(pieces) >= 2:
            a, b = random.sample(pieces, 2)
            pa, pb = get_piece(board, *a), get_piece(board, *b)
            set_piece(board, a[0], a[1], pb)
            set_piece(board, b[0], b[1], pa)
            result.teleported.append((a[0], a[1], b[0], b[1]))
            result.messages.append(f"Swapped {pa} and {pb}")

    elif etype == "transform":
        targets = _get_targets(effect, board, player_white, chosen_piece)
        into = effect.get("into", "q")
        for c, r in targets:
            old = get_piece(board, c, r)
            if old == ' ':
                continue
            white_piece = is_white_piece(old)
            new_p = into if white_piece else into.upper()
            set_piece(board, c, r, new_p)
            result.transformed.append((c, r, old, new_p))
            result.messages.append(f"{old} at {_sq_name(c,r)} → {new_p}")

    elif etype == "gold":
        player = effect.get("player", "self")
        amount = effect.get("amount", 1)
        _apply_resource(result.gold_changes, player, amount, player_white)
        result.messages.append(f"{'+'if amount>0 else ''}{amount} gold ({player})")

    elif etype == "chaos":
        player = effect.get("player", "self")
        amount = effect.get("amount", 1)
        _apply_resource(result.chaos_changes, player, amount, player_white)

    elif etype == "draw_cards":
        result.cards_drawn += effect.get("count", 1)
        result.messages.append(f"Draw {effect.get('count',1)} card(s)")

    elif etype == "steal_gold":
        amount = effect.get("amount", 3)
        _apply_resource(result.gold_changes, "self", amount, player_white)
        _apply_resource(result.gold_changes, "opponent", -amount, player_white)
        result.messages.append(f"Stole {amount} gold")

    elif etype == "place_hazard":
        hid = effect.get("hazard_id", "fire")
        duration = effect.get("duration", 5)
        sq = chosen_square or _random_empty(board)
        if sq:
            result.hazards_placed.append({"id": hid, "col": sq[0], "row": sq[1], "duration": duration})
            result.messages.append(f"Hazard '{hid}' at {_sq_name(*sq)}")

    elif etype == "shield":
        targets = _get_targets(effect, board, player_white, chosen_piece)
        dur = effect.get("duration", 3)
        for c, r in targets:
            result.mutations_applied.append({"type": "shield", "col": c, "row": r, "duration": dur})
            result.messages.append(f"Shield on {_sq_name(c,r)} for {dur} turns")

    elif etype == "freeze":
        targets = _get_targets(effect, board, player_white, chosen_piece)
        dur = effect.get("duration", 2)
        for c, r in targets:
            result.mutations_applied.append({"type": "freeze", "col": c, "row": r, "duration": dur})
            result.messages.append(f"Frozen {_sq_name(c,r)} for {dur} turns")

    elif etype == "resurrect":
        result.messages.append("Resurrect a captured piece")

    elif etype == "extra_turn":
        result.extra_turns += 1
        result.messages.append("Extra turn!")

    elif etype == "skip_turn":
        result.messages.append("Opponent's turn skipped!")

    elif etype == "clone":
        targets = _get_targets(effect, board, player_white, chosen_piece)
        for c, r in targets:
            p = get_piece(board, c, r)
            sq = _random_empty(board)
            if sq and p != ' ':
                set_piece(board, sq[0], sq[1], p)
                result.spawned.append((sq[0], sq[1], p))
                result.messages.append(f"Cloned {p} to {_sq_name(*sq)}")

    elif etype == "random_event":
        result.messages.append("A random event triggers!")

    elif etype == "cascade":
        count = effect.get("count", 2)
        result.messages.append(f"{count} chaos events cascade!")


def apply_effects(effects: list[dict], board, player_white: bool,
                  chosen_square=None, chosen_piece=None) -> EffectResult:
    """Apply a list of effects in order. Returns combined EffectResult."""
    result = EffectResult()
    for eff in effects:
        apply_effect(eff, board, player_white, result, chosen_square, chosen_piece)
    return result


# ── Internal helpers ──

def _get_targets(effect, board, player_white, chosen_piece):
    target = effect.get("target", "random_enemy")
    if target in ("self_piece", "enemy_piece", "any_piece", "chosen_piece"):
        return [chosen_piece] if chosen_piece else []
    pieces = resolve_pieces(board, target, player_white)
    count = effect.get("count", 1)
    if target.startswith("all_"):
        return pieces
    if pieces:
        return random.sample(pieces, min(count, len(pieces)))
    return []


def _random_empty(board):
    empties = resolve_empty_squares(board)
    return random.choice(empties) if empties else None


def _destroy_area(board, cx, cy, radius, result):
    from ..board import get_piece, set_piece
    for dr in range(-radius, radius + 1):
        for dc in range(-radius, radius + 1):
            c, r = cx + dc, cy + dr
            if 0 <= c < 8 and 0 <= r < 8:
                p = get_piece(board, c, r)
                if p != ' ':
                    set_piece(board, c, r, ' ')
                    result.destroyed.append((c, r, p))


def _apply_resource(changes, player_key, amount, caller_white):
    if player_key == "self":
        changes["white" if caller_white else "black"] += amount
    elif player_key == "opponent":
        changes["black" if caller_white else "white"] += amount
    elif player_key == "both":
        changes["white"] += amount
        changes["black"] += amount


def _sq_name(c, r):
    return f"{'abcdefgh'[c]}{8-r}"

"""Piece move generation: pseudo-legal moves, legal moves, check detection."""

from .constants import SQUARES
from . import board as board_mod


def _pawn_moves(board, col, row, white, en_passant_target, out):
    forward = -1 if white else 1
    start_row = 6 if white else 1
    r1 = row + forward
    if board_mod.in_bounds(col, r1) and board_mod.is_empty(board, col, r1):
        out.add((col, r1))
        if row == start_row:
            r2 = row + 2 * forward
            if board_mod.in_bounds(col, r2) and board_mod.is_empty(board, col, r2):
                out.add((col, r2))
    for dc in (-1, 1):
        c, r = col + dc, row + forward
        if not board_mod.in_bounds(c, r):
            continue
        p = board_mod.get_piece(board, c, r)
        if p != ' ' and board_mod.is_black_piece(p) == white:
            out.add((c, r))
        elif en_passant_target == (c, r):
            out.add((c, r))


def _sliding_moves(board, col, row, white, directions, out):
    for dc, dr in directions:
        c, r = col + dc, row + dr
        while board_mod.in_bounds(c, r):
            p = board_mod.get_piece(board, c, r)
            if p == ' ':
                out.add((c, r))
            else:
                if board_mod.is_black_piece(p) == white:
                    out.add((c, r))
                break
            c += dc
            r += dr


def _king_moves(board, col, row, white, out):
    for dc in (-1, 0, 1):
        for dr in (-1, 0, 1):
            if dc == 0 and dr == 0:
                continue
            c, r = col + dc, row + dr
            if not board_mod.in_bounds(c, r):
                continue
            p = board_mod.get_piece(board, c, r)
            if p == ' ' or (board_mod.is_black_piece(p) == white):
                out.add((c, r))


def _knight_moves(board, col, row, white, out):
    deltas = [(2, 1), (2, -1), (-2, 1), (-2, -1), (1, 2), (1, -2), (-1, 2), (-1, -2)]
    for dc, dr in deltas:
        c, r = col + dc, row + dr
        if not board_mod.in_bounds(c, r):
            continue
        p = board_mod.get_piece(board, c, r)
        if p == ' ' or (board_mod.is_black_piece(p) == white):
            out.add((c, r))


def _is_square_attacked(board, col, row, attacker_white):
    for r in range(SQUARES):
        for c in range(SQUARES):
            if not board_mod.piece_is_side(board, c, r, attacker_white):
                continue
            piece = board_mod.get_piece(board, c, r)
            lower = piece.lower()
            moves = set()
            if lower == 'p':
                _pawn_moves(board, c, r, attacker_white, None, moves)
            elif lower == 'r':
                _sliding_moves(board, c, r, attacker_white, [(0, 1), (0, -1), (1, 0), (-1, 0)], moves)
            elif lower == 'b':
                _sliding_moves(board, c, r, attacker_white, [(1, 1), (1, -1), (-1, 1), (-1, -1)], moves)
            elif lower == 'q':
                _sliding_moves(board, c, r, attacker_white, [(0, 1), (0, -1), (1, 0), (-1, 0)], moves)
                _sliding_moves(board, c, r, attacker_white, [(1, 1), (1, -1), (-1, 1), (-1, -1)], moves)
            elif lower == 'k':
                _king_moves(board, c, r, attacker_white, moves)
            elif lower == 'n':
                _knight_moves(board, c, r, attacker_white, moves)
            if (col, row) in moves:
                return True
    return False


def _king_castling_moves(board, col, row, white, rights, out):
    if col != 4:
        return
    opponent_white = not white
    if white:
        if row != 7:
            return
        kingside_ok = rights['white_kingside']
        queenside_ok = rights['white_queenside']
    else:
        if row != 0:
            return
        kingside_ok = rights['black_kingside']
        queenside_ok = rights['black_queenside']

    rook_char = 'r' if white else 'R'
    if kingside_ok:
        if (board_mod.is_empty(board, 5, row) and board_mod.is_empty(board, 6, row)
            and board_mod.get_piece(board, 7, row) == rook_char
            and not _is_square_attacked(board, 4, row, opponent_white)
            and not _is_square_attacked(board, 5, row, opponent_white)
            and not _is_square_attacked(board, 6, row, opponent_white)):
            out.add((6, row))
    if queenside_ok:
        if (board_mod.is_empty(board, 1, row) and board_mod.is_empty(board, 2, row)
            and board_mod.is_empty(board, 3, row)
            and board_mod.get_piece(board, 0, row) == rook_char
            and not _is_square_attacked(board, 4, row, opponent_white)
            and not _is_square_attacked(board, 3, row, opponent_white)
            and not _is_square_attacked(board, 2, row, opponent_white)):
            out.add((2, row))


def pseudo_legal_moves(board, col, row, castling_rights, en_passant_target):
    """All pseudo-legal target squares for the piece at (col, row)."""
    piece = board_mod.get_piece(board, col, row)
    if piece == ' ':
        return set()
    white = board_mod.is_white_piece(piece)
    targets = set()
    lower = piece.lower()
    ep = en_passant_target  # (c, r) or None

    if lower == 'p':
        _pawn_moves(board, col, row, white, ep, targets)
    elif lower == 'r':
        _sliding_moves(board, col, row, white, [(0, 1), (0, -1), (1, 0), (-1, 0)], targets)
    elif lower == 'b':
        _sliding_moves(board, col, row, white, [(1, 1), (1, -1), (-1, 1), (-1, -1)], targets)
    elif lower == 'q':
        _sliding_moves(board, col, row, white, [(0, 1), (0, -1), (1, 0), (-1, 0)], targets)
        _sliding_moves(board, col, row, white, [(1, 1), (1, -1), (-1, 1), (-1, -1)], targets)
    elif lower == 'k':
        _king_moves(board, col, row, white, targets)
        _king_castling_moves(board, col, row, white, castling_rights, targets)
    elif lower == 'n':
        _knight_moves(board, col, row, white, targets)
    return targets


def legal_moves(board, col, row, castling_rights, en_passant_target):
    """Filter pseudo-legal moves to those that don't leave own king in check."""
    piece = board_mod.get_piece(board, col, row)
    if piece == ' ':
        return set()
    white = board_mod.is_white_piece(piece)
    pseudo = pseudo_legal_moves(board, col, row, castling_rights, en_passant_target)
    legal = set()
    for tc, tr in pseudo:
        b = [r[:] for r in board]
        b[tr][tc] = piece
        b[row][col] = ' '
        if en_passant_target and (tc, tr) == en_passant_target:
            capture_row = tr + (1 if white else -1)
            b[capture_row][tc] = ' '
        if not is_king_in_check(b, white, castling_rights, None):
            legal.add((tc, tr))
    return legal


def is_king_in_check(board, white, castling_rights, en_passant_target):
    pos = board_mod.find_king(board, white)
    if pos is None:
        return False
    kcol, krow = pos
    opponent_white = not white
    for r in range(SQUARES):
        for c in range(SQUARES):
            if not board_mod.piece_is_side(board, c, r, opponent_white):
                continue
            moves = pseudo_legal_moves(board, c, r, castling_rights, en_passant_target)
            if (kcol, krow) in moves:
                return True
    return False


def no_legal_moves(board, white_to_move, castling_rights, en_passant_target):
    for r in range(SQUARES):
        for c in range(SQUARES):
            if not board_mod.piece_is_side(board, c, r, white_to_move):
                continue
            if legal_moves(board, c, r, castling_rights, en_passant_target):
                return False
    return True

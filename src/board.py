"""Board representation and helpers."""

from .constants import SQUARES, STARTING_POSITION


def new_board():
    """Return a fresh board with the standard starting position (copy)."""
    return [row[:] for row in STARTING_POSITION]


def in_bounds(col, row):
    return 0 <= col < SQUARES and 0 <= row < SQUARES


def is_empty(board, col, row):
    return board[row][col] == ' '


def is_white_piece(c):
    return c.islower() and c != ' '


def is_black_piece(c):
    return c.isupper() and c != ' '


def piece_is_side(board, col, row, white):
    c = board[row][col]
    return is_white_piece(c) if white else is_black_piece(c)


def get_piece(board, col, row):
    if not in_bounds(col, row):
        return ' '
    return board[row][col]


def set_piece(board, col, row, piece):
    if in_bounds(col, row):
        board[row][col] = piece


def find_king(board, white):
    king = 'k' if white else 'K'
    for r in range(SQUARES):
        for c in range(SQUARES):
            if board[r][c] == king:
                return (c, r)
    return None

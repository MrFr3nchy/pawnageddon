//! Board representation and helpers.

use crate::constants::{SQUARES, STARTING_POSITION};

pub type Board = [[char; 8]; 8];

/// Create a fresh board with the standard starting position.
pub fn new_board() -> Board {
    STARTING_POSITION
}

/// True if (col, row) is within 0..8.
#[inline]
pub fn in_bounds(col: i32, row: i32) -> bool {
    (0..SQUARES).contains(&col) && (0..SQUARES).contains(&row)
}

/// True if the square is empty.
#[inline]
pub fn is_empty(board: &Board, col: i32, row: i32) -> bool {
    board[row as usize][col as usize] == ' '
}

/// True if the piece at (col, row) is white (lowercase).
#[inline]
pub fn is_white_piece(c: char) -> bool {
    c.is_lowercase() && c != ' '
}

/// True if the piece at (col, row) is black (uppercase).
#[inline]
pub fn is_black_piece(c: char) -> bool {
    c.is_uppercase() && c != ' '
}

/// True if the piece at (col, row) belongs to the given side. white = true means white to move.
pub fn piece_is_side(board: &Board, col: i32, row: i32, white: bool) -> bool {
    let c = board[row as usize][col as usize];
    if white {
        is_white_piece(c)
    } else {
        is_black_piece(c)
    }
}

/// Get piece at (col, row). Returns space if out of bounds.
pub fn get_piece(board: &Board, col: i32, row: i32) -> char {
    if !in_bounds(col, row) {
        return ' ';
    }
    board[row as usize][col as usize]
}

/// Set piece at (col, row). No-op if out of bounds.
pub fn set_piece(board: &mut Board, col: i32, row: i32, piece: char) {
    if in_bounds(col, row) {
        board[row as usize][col as usize] = piece;
    }
}

/// Find the king of the given color. Returns (col, row) or None if not found.
pub fn find_king(board: &Board, white: bool) -> Option<(i32, i32)> {
    let king = if white { 'k' } else { 'K' };
    for r in 0..SQUARES {
        for c in 0..SQUARES {
            if board[r as usize][c as usize] == king {
                return Some((c, r));
            }
        }
    }
    None
}

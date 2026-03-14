//! Piece types, asset names, and move generation.

use crate::board::{self, Board, in_bounds};
use crate::constants::{CastlingRights, SQUARES};
use std::collections::HashSet;

/// Asset filename for a piece. char: R,N,B,Q,K,P (black) or r,n,b,q,k,p (white).
pub fn asset_name(piece: char) -> Option<&'static str> {
    use crate::constants::*;
    let s = match piece {
        'r' => ASSET_ROOK_WHITE,
        'n' => ASSET_KNIGHT_WHITE,
        'b' => ASSET_BISHOP_WHITE,
        'q' => ASSET_QUEEN_WHITE,
        'k' => ASSET_KING_WHITE,
        'p' => ASSET_PAWN_WHITE,
        'R' => ASSET_ROOK_BLACK,
        'N' => ASSET_KNIGHT_BLACK,
        'B' => ASSET_BISHOP_BLACK,
        'Q' => ASSET_QUEEN_BLACK,
        'K' => ASSET_KING_BLACK,
        'P' => ASSET_PAWN_BLACK,
        _ => return None,
    };
    Some(s)
}

/// Generate all pseudo-legal target squares for the piece at (col, row).
/// Does not filter for check. Uses castling_rights for king castling; en_passant_target for en passant.
pub fn pseudo_legal_moves(
    board: &Board,
    col: i32,
    row: i32,
    castling_rights: &CastlingRights,
    en_passant_target: Option<(i32, i32)>,
) -> HashSet<(i32, i32)> {
    let piece = board::get_piece(board, col, row);
    if piece == ' ' {
        return HashSet::new();
    }
    let white = board::is_white_piece(piece);
    let mut targets = HashSet::new();

    match piece.to_ascii_lowercase() {
        'p' => pawn_moves(board, col, row, white, en_passant_target, &mut targets),
        'r' => sliding_moves(board, col, row, white, &[(0, 1), (0, -1), (1, 0), (-1, 0)], &mut targets),
        'b' => sliding_moves(board, col, row, white, &[(1, 1), (1, -1), (-1, 1), (-1, -1)], &mut targets),
        'q' => {
            sliding_moves(board, col, row, white, &[(0, 1), (0, -1), (1, 0), (-1, 0)], &mut targets);
            sliding_moves(board, col, row, white, &[(1, 1), (1, -1), (-1, 1), (-1, -1)], &mut targets);
        }
        'k' => {
            king_moves(board, col, row, white, &mut targets);
            king_castling_moves(board, col, row, white, castling_rights, &mut targets);
        }
        'n' => knight_moves(board, col, row, white, &mut targets),
        _ => {}
    }
    targets
}

fn pawn_moves(
    board: &Board,
    col: i32,
    row: i32,
    white: bool,
    en_passant_target: Option<(i32, i32)>,
    out: &mut HashSet<(i32, i32)>,
) {
    let forward = if white { -1 } else { 1 };
    let start_row = if white { 6 } else { 1 };

    // One square forward
    let r1 = row + forward;
    if in_bounds(col, r1) && board::is_empty(board, col, r1) {
        out.insert((col, r1));
        // Two squares from start
        if row == start_row {
            let r2 = row + 2 * forward;
            if in_bounds(col, r2) && board::is_empty(board, col, r2) {
                out.insert((col, r2));
            }
        }
    }
    // Captures (normal and en passant)
    for dc in [-1, 1] {
        let c = col + dc;
        let r = row + forward;
        if !in_bounds(c, r) {
            continue;
        }
        let p = board::get_piece(board, c, r);
        if p != ' ' && board::is_black_piece(p) == white {
            out.insert((c, r));
        } else if en_passant_target == Some((c, r)) {
            out.insert((c, r));
        }
    }
}

fn sliding_moves(
    board: &Board,
    col: i32,
    row: i32,
    white: bool,
    directions: &[(i32, i32)],
    out: &mut HashSet<(i32, i32)>,
) {
    for &(dc, dr) in directions {
        let mut c = col + dc;
        let mut r = row + dr;
        while in_bounds(c, r) {
            let p = board::get_piece(board, c, r);
            if p == ' ' {
                out.insert((c, r));
            } else {
                if board::is_black_piece(p) == white {
                    out.insert((c, r));
                }
                break;
            }
            c += dc;
            r += dr;
        }
    }
}

fn king_moves(board: &Board, col: i32, row: i32, white: bool, out: &mut HashSet<(i32, i32)>) {
    for dc in -1..=1 {
        for dr in -1..=1 {
            if dc == 0 && dr == 0 {
                continue;
            }
            let c = col + dc;
            let r = row + dr;
            if !in_bounds(c, r) {
                continue;
            }
            let p = board::get_piece(board, c, r);
            if p == ' ' || (board::is_black_piece(p) == white) {
                out.insert((c, r));
            }
        }
    }
}

/// True if (col, row) is attacked by any piece of the given side.
fn is_square_attacked(board: &Board, col: i32, row: i32, attacker_white: bool) -> bool {
    for r in 0..SQUARES {
        for c in 0..SQUARES {
            if !board::piece_is_side(board, c, r, attacker_white) {
                continue;
            }
            let piece = board::get_piece(board, c, r);
            let lower = piece.to_lowercase().next().unwrap_or(piece);
            let moves = match lower {
                'p' => {
                    let mut s = HashSet::new();
                    pawn_moves(board, c, r, attacker_white, None, &mut s);
                    s
                }
                'r' => {
                    let mut s = HashSet::new();
                    sliding_moves(board, c, r, attacker_white, &[(0, 1), (0, -1), (1, 0), (-1, 0)], &mut s);
                    s
                }
                'b' => {
                    let mut s = HashSet::new();
                    sliding_moves(board, c, r, attacker_white, &[(1, 1), (1, -1), (-1, 1), (-1, -1)], &mut s);
                    s
                }
                'q' => {
                    let mut s = HashSet::new();
                    sliding_moves(board, c, r, attacker_white, &[(0, 1), (0, -1), (1, 0), (-1, 0)], &mut s);
                    sliding_moves(board, c, r, attacker_white, &[(1, 1), (1, -1), (-1, 1), (-1, -1)], &mut s);
                    s
                }
                'k' => {
                    let mut s = HashSet::new();
                    king_moves(board, c, r, attacker_white, &mut s);
                    s
                }
                'n' => {
                    let mut s = HashSet::new();
                    knight_moves(board, c, r, attacker_white, &mut s);
                    s
                }
                _ => HashSet::new(),
            };
            if moves.contains(&(col, row)) {
                return true;
            }
        }
    }
    false
}

/// Add castling moves for the king at (col, row). King must be on e-file (col 4), white on row 7, black on row 0.
/// Rules: (1) King and the rook must not have moved (enforced via castling_rights).
/// (2) No pieces between king and rook. (3) King not in check, and does not pass through or land in check.
fn king_castling_moves(
    board: &Board,
    col: i32,
    row: i32,
    white: bool,
    rights: &CastlingRights,
    out: &mut HashSet<(i32, i32)>,
) {
    if col != 4 {
        return;
    }
    let opponent_white = !white;
    let (kingside_ok, queenside_ok) = if white {
        if row != 7 {
            return;
        }
        (
            rights.white_kingside,
            rights.white_queenside,
        )
    } else {
        if row != 0 {
            return;
        }
        (
            rights.black_kingside,
            rights.black_queenside,
        )
    };

    if kingside_ok {
        if board::is_empty(board, 5, row) && board::is_empty(board, 6, row)
            && board::get_piece(board, 7, row) == if white { 'r' } else { 'R' }
            && !is_square_attacked(board, 4, row, opponent_white)
            && !is_square_attacked(board, 5, row, opponent_white)
            && !is_square_attacked(board, 6, row, opponent_white)
        {
            out.insert((6, row));
        }
    }
    if queenside_ok {
        if board::is_empty(board, 1, row) && board::is_empty(board, 2, row) && board::is_empty(board, 3, row)
            && board::get_piece(board, 0, row) == if white { 'r' } else { 'R' }
            && !is_square_attacked(board, 4, row, opponent_white)
            && !is_square_attacked(board, 3, row, opponent_white)
            && !is_square_attacked(board, 2, row, opponent_white)
        {
            out.insert((2, row));
        }
    }
}

fn knight_moves(board: &Board, col: i32, row: i32, white: bool, out: &mut HashSet<(i32, i32)>) {
    let deltas: [(i32, i32); 8] = [
        (2, 1), (2, -1), (-2, 1), (-2, -1),
        (1, 2), (1, -2), (-1, 2), (-1, -2),
    ];
    for (dc, dr) in deltas {
        let c = col + dc;
        let r = row + dr;
        if !in_bounds(c, r) {
            continue;
        }
        let p = board::get_piece(board, c, r);
        if p == ' ' || (board::is_black_piece(p) == white) {
            out.insert((c, r));
        }
    }
}

/// Filter pseudo-legal moves to only those that don't leave the current side's king in check.
pub fn legal_moves(
    board: &Board,
    col: i32,
    row: i32,
    castling_rights: &CastlingRights,
    en_passant_target: Option<(i32, i32)>,
) -> HashSet<(i32, i32)> {
    let piece = board::get_piece(board, col, row);
    if piece == ' ' {
        return HashSet::new();
    }
    let white = board::is_white_piece(piece);
    let pseudo = pseudo_legal_moves(board, col, row, castling_rights, en_passant_target);
    let mut legal = HashSet::new();
    for (tc, tr) in pseudo {
        let mut b = *board;
        b[tr as usize][tc as usize] = piece;
        b[row as usize][col as usize] = ' ';
        if en_passant_target == Some((tc, tr)) {
            let capture_row = tr + if white { 1 } else { -1 };
            b[capture_row as usize][tc as usize] = ' ';
        }
        if !is_king_in_check(&b, white, castling_rights, None) {
            legal.insert((tc, tr));
        }
    }
    legal
}

/// True if the given side's king is in check.
pub fn is_king_in_check(
    board: &Board,
    white: bool,
    castling_rights: &CastlingRights,
    en_passant_target: Option<(i32, i32)>,
) -> bool {
    let Some((kcol, krow)) = board::find_king(board, white) else {
        return false;
    };
    let opponent_white = !white;
    for r in 0..SQUARES {
        for c in 0..SQUARES {
            if !board::piece_is_side(board, c, r, opponent_white) {
                continue;
            }
            let moves = pseudo_legal_moves(board, c, r, castling_rights, en_passant_target);
            if moves.contains(&(kcol, krow)) {
                return true;
            }
        }
    }
    false
}

/// True if the side to move has no legal moves (checkmate or stalemate).
pub fn no_legal_moves(
    board: &Board,
    white_to_move: bool,
    castling_rights: &CastlingRights,
    en_passant_target: Option<(i32, i32)>,
) -> bool {
    for r in 0..SQUARES {
        for c in 0..SQUARES {
            if !board::piece_is_side(board, c, r, white_to_move) {
                continue;
            }
            if !legal_moves(board, c, r, castling_rights, en_passant_target).is_empty() {
                return false;
            }
        }
    }
    true
}

trait ToAsciiLowercase {
    fn to_ascii_lowercase(self) -> char;
}
impl ToAsciiLowercase for char {
    fn to_ascii_lowercase(self) -> char {
        self.to_lowercase().next().unwrap_or(self)
    }
}

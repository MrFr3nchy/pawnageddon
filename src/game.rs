//! Game state: board, turn, selection, valid moves, captured pieces, promotion, castling.

use crate::board::{self, new_board, Board};
use crate::constants::CastlingRights;
use crate::pieces::legal_moves;
use std::collections::HashSet;

/// Result of attempting a move: either done, or waiting for promotion choice.
#[derive(Debug)]
pub enum MoveResult {
    Done,
    /// Pawn reached back rank; must choose piece (from_c, from_r, to_c, to_r, promoting_white).
    PromotionPending { from_c: i32, from_r: i32, to_c: i32, to_r: i32, white: bool },
}

/// Square that can be captured en passant (the square the capturing pawn moves to). Set when a pawn moves two squares; cleared after the next move.
pub type EnPassantTarget = Option<(i32, i32)>;

pub struct GameState {
    pub board: Board,
    pub white_to_move: bool,
    pub selected: Option<(i32, i32)>,
    pub valid_moves: HashSet<(i32, i32)>,
    pub captured_white: Vec<char>,
    pub captured_black: Vec<char>,
    pub castling_rights: CastlingRights,
    pub en_passant_target: EnPassantTarget,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: new_board(),
            white_to_move: true,
            selected: None,
            valid_moves: HashSet::new(),
            captured_white: Vec::new(),
            captured_black: Vec::new(),
            castling_rights: CastlingRights::default(),
            en_passant_target: None,
        }
    }

    /// Handle click at board square (col, row). Returns MoveResult.
    pub fn on_square_clicked(&mut self, col: i32, row: i32) -> MoveResult {
        if !board::in_bounds(col, row) {
            self.selected = None;
            self.valid_moves.clear();
            return MoveResult::Done;
        }

        if let Some((sc, sr)) = self.selected {
            if self.valid_moves.contains(&(col, row)) {
                let piece = board::get_piece(&self.board, sc, sr);
                let is_pawn = piece.to_lowercase().next().unwrap_or(' ') == 'p';
                // White pawns move toward row 0; black toward row 7 (see pieces::pawn_moves).
                let is_back_rank = (board::is_white_piece(piece) && row == 0) || (board::is_black_piece(piece) && row == 7);
                if is_pawn && is_back_rank {
                    self.selected = None;
                    self.valid_moves.clear();
                    return MoveResult::PromotionPending {
                        from_c: sc,
                        from_r: sr,
                        to_c: col,
                        to_r: row,
                        white: board::is_white_piece(piece),
                    };
                }
                self.make_move(sc, sr, col, row, None);
                self.selected = None;
                self.valid_moves.clear();
                return MoveResult::Done;
            }
        }

        if board::piece_is_side(&self.board, col, row, self.white_to_move) {
            self.selected = Some((col, row));
            self.valid_moves = legal_moves(&self.board, col, row, &self.castling_rights, self.en_passant_target);
            return MoveResult::Done;
        }

        self.selected = None;
        self.valid_moves.clear();
        MoveResult::Done
    }

    /// Complete a promotion move with the chosen piece. Piece is 'q','r','b','n' for white or 'Q','R','B','N' for black.
    pub fn complete_promotion(&mut self, from_c: i32, from_r: i32, to_c: i32, to_r: i32, piece: char) {
        self.make_move(from_c, from_r, to_c, to_r, Some(piece));
    }

    fn make_move(&mut self, from_c: i32, from_r: i32, to_c: i32, to_r: i32, promote_to: Option<char>) {
        let mut piece = board::get_piece(&self.board, from_c, from_r);
        let is_pawn_two_squares = {
            let lower = lower_char(piece);
            let start_row = if board::is_white_piece(piece) { 6 } else { 1 };
            lower == 'p' && from_r == start_row && (to_r as i32 - from_r as i32).abs() == 2
        };
        let was_en_passant = self.en_passant_target == Some((to_c, to_r));
        let captured = if was_en_passant {
            let captured_row = to_r + if self.white_to_move { 1 } else { -1 };
            board::get_piece(&self.board, to_c, captured_row)
        } else {
            board::get_piece(&self.board, to_c, to_r)
        };

        self.en_passant_target = if is_pawn_two_squares {
            Some((to_c, (from_r + to_r) / 2))
        } else {
            None
        };

        if captured != ' ' {
            if board::is_white_piece(captured) {
                self.captured_white.push(captured);
            } else {
                self.captured_black.push(captured);
            }
        }

        if let Some(p) = promote_to {
            piece = p;
        } else {
            let lower = piece.to_lowercase().next().unwrap_or(piece);
            if lower == 'p' && (to_r == 0 || to_r == 7) {
                piece = if board::is_white_piece(piece) { 'q' } else { 'Q' };
            }
        }

        let is_king = lower_char(piece) == 'k';
        let is_rook = lower_char(piece) == 'r';

        if is_king && from_c == 4 {
            if self.white_to_move {
                if to_c == 6 {
                    board::set_piece(&mut self.board, 5, 7, 'r');
                    board::set_piece(&mut self.board, 7, 7, ' ');
                } else if to_c == 2 {
                    board::set_piece(&mut self.board, 3, 7, 'r');
                    board::set_piece(&mut self.board, 0, 7, ' ');
                }
                self.castling_rights.white_kingside = false;
                self.castling_rights.white_queenside = false;
            } else {
                if to_c == 6 {
                    board::set_piece(&mut self.board, 5, 0, 'R');
                    board::set_piece(&mut self.board, 7, 0, ' ');
                } else if to_c == 2 {
                    board::set_piece(&mut self.board, 3, 0, 'R');
                    board::set_piece(&mut self.board, 0, 0, ' ');
                }
                self.castling_rights.black_kingside = false;
                self.castling_rights.black_queenside = false;
            }
        } else if is_king {
            if board::is_white_piece(piece) {
                self.castling_rights.white_kingside = false;
                self.castling_rights.white_queenside = false;
            } else {
                self.castling_rights.black_kingside = false;
                self.castling_rights.black_queenside = false;
            }
        } else if is_rook {
            if self.white_to_move {
                if from_c == 0 && from_r == 7 {
                    self.castling_rights.white_queenside = false;
                } else if from_c == 7 && from_r == 7 {
                    self.castling_rights.white_kingside = false;
                }
            } else {
                if from_c == 0 && from_r == 0 {
                    self.castling_rights.black_queenside = false;
                } else if from_c == 7 && from_r == 0 {
                    self.castling_rights.black_kingside = false;
                }
            }
        }

        board::set_piece(&mut self.board, to_c, to_r, piece);
        board::set_piece(&mut self.board, from_c, from_r, ' ');
        if was_en_passant {
            let captured_row = to_r + if self.white_to_move { 1 } else { -1 };
            board::set_piece(&mut self.board, to_c, captured_row, ' ');
        }
        self.white_to_move = !self.white_to_move;
    }
}

fn lower_char(c: char) -> char {
    c.to_lowercase().next().unwrap_or(c)
}

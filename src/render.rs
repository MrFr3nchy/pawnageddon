//! Drawing: board, pieces, notation, captured pieces, highlights.

use macroquad::prelude::*;

use crate::assets::PieceTextures;
use crate::board::{self, Board};
use crate::constants::{
    board_px, DARK_SQUARE, FILES, LIGHT_SQUARE, VALID_CAPTURE_SQUARE, VALID_MOVE_SQUARE,
    WINDOW_HEIGHT, WINDOW_WIDTH,
};
use crate::constants::{SQUARES, HIGHLIGHT_SQUARE};
use std::collections::HashSet;

/// Board is drawn centered. Returns (left, top) of the board rectangle.
pub fn board_origin() -> (f32, f32) {
    let bp = board_px();
    let left = (WINDOW_WIDTH - bp) / 2.0;
    let top = (WINDOW_HEIGHT - bp) / 2.0;
    (left, top)
}

/// Size of one square in pixels.
pub fn square_px() -> f32 {
    board_px() / SQUARES as f32
}

/// Convert window (x, y) to board (col, row) in 0..8.
/// white_view: true = white at bottom (row 7 at screen bottom); false = black at bottom (row 0 at screen bottom).
pub fn screen_to_logical(mouse_x: f32, mouse_y: f32, white_view: bool) -> Option<(i32, i32)> {
    let (left, top) = board_origin();
    let sq = square_px();
    let bx = mouse_x - left;
    let by = mouse_y - top;
    if bx < 0.0 || by < 0.0 || bx >= board_px() || by >= board_px() {
        return None;
    }
    let sc = (bx / sq) as i32;
    let sr = (by / sq) as i32;
    let (col, row) = if white_view {
        (sc, sr)
    } else {
        (7 - sc, 7 - sr)
    };
    if (0..SQUARES).contains(&col) && (0..SQUARES).contains(&row) {
        Some((col, row))
    } else {
        None
    }
}

/// Logical (col, row) to screen position (x, y) of top-left of square. white_view: true = white at bottom.
pub fn logical_to_screen(col: i32, row: i32, white_view: bool) -> (f32, f32) {
    let (left, top) = board_origin();
    let sq = square_px();
    let (draw_col, draw_row) = if white_view {
        (col, row)
    } else {
        (7 - col, 7 - row)
    };
    let x = left + draw_col as f32 * sq;
    let y = top + draw_row as f32 * sq;
    (x, y)
}

/// Draw the board (squares only). white_view: which side is at bottom.
pub fn draw_board_squares(white_view: bool) {
    let sq = square_px();
    for row in 0..SQUARES {
        for col in 0..SQUARES {
            let (x, y) = logical_to_screen(col, row, white_view);
            let is_light = (row + col) % 2 == 0;
            let color = if is_light { LIGHT_SQUARE } else { DARK_SQUARE };
            draw_rectangle(x, y, sq, sq, color);
        }
    }
}

/// Draw highlight on a square (selected piece).
pub fn draw_highlight(col: i32, row: i32, white_view: bool) {
    let (x, y) = logical_to_screen(col, row, white_view);
    let sq = square_px();
    draw_rectangle(x, y, sq, sq, HIGHLIGHT_SQUARE);
}

/// Draw valid move indicators (green for empty, red for capture).
pub fn draw_valid_moves(
    board: &Board,
    valid_moves: &HashSet<(i32, i32)>,
    white_view: bool,
) {
    let sq = square_px();
    for &(col, row) in valid_moves {
        let (x, y) = logical_to_screen(col, row, white_view);
        let is_capture = !board::is_empty(board, col, row);
        let color = if is_capture {
            VALID_CAPTURE_SQUARE
        } else {
            VALID_MOVE_SQUARE
        };
        draw_rectangle(x, y, sq, sq, color);
    }
}

/// Draw all pieces on the board using textures (fallback to letter if texture missing).
pub fn draw_pieces(
    board: &Board,
    textures: &PieceTextures,
    white_view: bool,
    skip_square: Option<(i32, i32)>,
) {
    let sq = square_px();
    let size = sq * 0.9;
    let pad = (sq - size) / 2.0;
    let font_size = (sq * 0.5) as u16;

    for row in 0..SQUARES {
        for col in 0..SQUARES {
            if skip_square == Some((col, row)) {
                continue;
            }
            let piece = board::get_piece(board, col, row);
            if piece == ' ' {
                continue;
            }
            let (x, y) = logical_to_screen(col, row, white_view);
            draw_piece_at(piece, x + pad, y + pad, size, font_size, textures);
        }
    }
}

/// Draw a single piece at screen (x, y) with given size.
pub fn draw_piece_at(
    piece: char,
    x: f32,
    y: f32,
    size: f32,
    font_size: u16,
    textures: &PieceTextures,
) {
    if let Some(tex) = textures.get(piece) {
        draw_texture_ex(
            tex,
            x,
            y,
            WHITE,
            DrawTextureParams {
                dest_size: Some(vec2(size, size)),
                ..Default::default()
            },
        );
    } else {
        let label = piece.to_uppercase().to_string();
        let color = if board::is_white_piece(piece) {
            WHITE
        } else {
            BLACK
        };
        draw_text(&label, x + size * 0.2, y + size * 0.75, font_size as f32, color);
    }
}

/// Draw file (a-h) and rank (1-8) notation. white_view = white at bottom.
pub fn draw_notation(white_view: bool) {
    let (left, top) = board_origin();
    let sq = square_px();
    let font_size = (sq * 0.25).max(12.0) as u16;

    // Files along bottom
    for (i, &f) in FILES.iter().enumerate() {
        let (x, _) = logical_to_screen(i as i32, 7, white_view);
        let y = top + board_px() + (font_size as f32 * 0.8);
        draw_text(
            &f.to_string(),
            x + sq * 0.35,
            y,
            font_size as f32,
            Color::from_rgba(200, 200, 200, 255),
        );
    }
    // Ranks on the left (8 at top when white view, 1 at bottom)
    for r in 0..SQUARES {
        let rank_display = if white_view { 8 - r } else { r + 1 };
        let (_, y) = logical_to_screen(0, r, white_view);
        draw_text(
            &rank_display.to_string(),
            left - font_size as f32 * 0.8,
            y + sq * 0.7,
            font_size as f32,
            Color::from_rgba(200, 200, 200, 255),
        );
    }
}

/// Draw captured pieces for one side. pieces: list of piece chars. x, y = top-left of area; scale = size of each icon.
pub fn draw_captured_pieces(
    pieces: &[char],
    textures: &PieceTextures,
    x: f32,
    y: f32,
    scale: f32,
    font_size: u16,
) {
    let mut px = x;
    for &p in pieces {
        draw_piece_at(p, px, y, scale, font_size, textures);
        px += scale * 0.7;
    }
}

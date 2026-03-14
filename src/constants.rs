//! Constants for the chess game: dimensions, colors, asset names, starting position.

use macroquad::prelude::Color;

/// Window and layout
pub const WINDOW_WIDTH: f32 = 1200.0;
pub const WINDOW_HEIGHT: f32 = 800.0;
pub const SQUARES: i32 = 8;

/// Board: size is the smaller of the two dimensions so it fits; square size derived
pub fn board_px() -> f32 {
    let w = WINDOW_WIDTH - 2.0 * MARGIN_X;
    let h = WINDOW_HEIGHT - 2.0 * MARGIN_Y;
    let side = w.min(h);
    // Round down to multiple of 8 so each square is integer
    (side / SQUARES as f32).floor() * SQUARES as f32
}

pub const MARGIN_X: f32 = 120.0;
pub const MARGIN_Y: f32 = 60.0;

/// Square colors (classic board)
pub const LIGHT_SQUARE: Color = Color::from_rgba(240, 217, 181, 255);
pub const DARK_SQUARE: Color = Color::from_rgba(181, 136, 99, 255);
pub const HIGHLIGHT_SQUARE: Color = Color::from_rgba(255, 255, 0, 100);
pub const VALID_MOVE_SQUARE: Color = Color::from_rgba(0, 255, 0, 80);
pub const VALID_CAPTURE_SQUARE: Color = Color::from_rgba(255, 0, 0, 100);

/// Piece asset filenames (in assets/chess-pieces): piece-color.png
pub const ASSET_BISHOP_BLACK: &str = "chess-pieces/bishop-black.png";
pub const ASSET_BISHOP_WHITE: &str = "chess-pieces/bishop-white.png";
pub const ASSET_KING_BLACK: &str = "chess-pieces/king-black.png";
pub const ASSET_KING_WHITE: &str = "chess-pieces/king-white.png";
pub const ASSET_KNIGHT_BLACK: &str = "chess-pieces/knight-black.png";
pub const ASSET_KNIGHT_WHITE: &str = "chess-pieces/knight-white.png";
pub const ASSET_PAWN_BLACK: &str = "chess-pieces/pawn-black.png";
pub const ASSET_PAWN_WHITE: &str = "chess-pieces/pawn-white.png";
pub const ASSET_QUEEN_BLACK: &str = "chess-pieces/queen-black.png";
pub const ASSET_QUEEN_WHITE: &str = "chess-pieces/queen-white.png";
pub const ASSET_ROOK_BLACK: &str = "chess-pieces/rook-black.png";
pub const ASSET_ROOK_WHITE: &str = "chess-pieces/rook-white.png";

/// File labels for notation (a-h)
pub const FILES: [char; 8] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// ---------- UI / title screen ----------
pub const UI_TEXT_COLOR: Color = Color::from_rgba(220, 220, 220, 255);
pub const INPUT_BG_COLOR: Color = Color::from_rgba(60, 62, 65, 255);
pub const BUTTON_BG_COLOR: Color = Color::from_rgba(80, 82, 85, 255);
pub const TITLE_TEXT_COLOR: Color = Color::from_rgba(240, 240, 240, 255);
pub const BACKGROUND_DARK: Color = Color::from_rgba(52, 53, 55, 255);

pub const TITLE_LABEL_SIZE: f32 = 20.0;
pub const TITLE_INPUT_W: f32 = 280.0;
pub const TITLE_INPUT_H: f32 = 36.0;
pub const TITLE_LABEL_TO_INPUT_GAP: f32 = 8.0;
pub const TITLE_ROW_GAP: f32 = 28.0;
pub const TITLE_BTN_W: f32 = 180.0;
pub const TITLE_BTN_H: f32 = 44.0;
pub const TITLE_START_Y: f32 = 120.0;
pub const TITLE_OFFSET_AFTER_HEADING: f32 = 80.0;

// ---------- Menu ----------
pub const MENU_ICON_SIZE: f32 = 36.0;
pub const MENU_ICON_PAD: f32 = 20.0;
pub const MENU_DROPDOWN_W: f32 = 180.0;
pub const MENU_ITEM_H: f32 = 40.0;

// ---------- Promotion modal ----------
pub const PROMOTION_OVERLAY_ALPHA: u8 = 200;
pub const PROMOTION_BOX_W: f32 = 380.0;
pub const PROMOTION_BOX_H: f32 = 200.0;
pub const PROMOTION_PIECE_SIZE: f32 = 64.0;
pub const PROMOTION_PIECE_GAP: f32 = 16.0;
pub const PROMOTION_TITLE_Y_OFFSET: f32 = 32.0;
pub const PROMOTION_BUTTONS_Y_OFFSET: f32 = 75.0;

/// Promotion piece options: (lowercase char for white, label).
pub const PROMOTION_CHOICES: [(char, &str); 4] = [
    ('q', "Queen"),
    ('r', "Rook"),
    ('b', "Bishop"),
    ('n', "Knight"),
];

/// Castling rights: which sides can still castle (king and relevant rook never moved).
#[derive(Clone, Copy, Debug)]
pub struct CastlingRights {
    pub white_kingside: bool,
    pub white_queenside: bool,
    pub black_kingside: bool,
    pub black_queenside: bool,
}
impl Default for CastlingRights {
    fn default() -> Self {
        Self {
            white_kingside: true,
            white_queenside: true,
            black_kingside: true,
            black_queenside: true,
        }
    }
}

/// Starting position. Row 0 = black back rank, row 7 = white back rank.
/// Uppercase = black, lowercase = white. R=rook, N=knight, B=bishop, Q=queen, K=king, P=pawn.
pub const STARTING_POSITION: [[char; 8]; 8] = [
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
];

//! UI: title screen, menu, promotion modal, text input.
//! All layout/color constants live in `constants.rs`.

use macroquad::prelude::*;

use crate::assets::PieceTextures;
use crate::constants::{
    BUTTON_BG_COLOR, INPUT_BG_COLOR, MENU_ICON_PAD, MENU_ICON_SIZE, MENU_ITEM_H,
    MENU_DROPDOWN_W, PROMOTION_BOX_H, PROMOTION_BOX_W, PROMOTION_BUTTONS_Y_OFFSET, PROMOTION_CHOICES,
    PROMOTION_OVERLAY_ALPHA, PROMOTION_PIECE_GAP, PROMOTION_PIECE_SIZE, PROMOTION_TITLE_Y_OFFSET,
    TITLE_BTN_H, TITLE_BTN_W, TITLE_INPUT_H, TITLE_INPUT_W, TITLE_LABEL_SIZE,
    TITLE_LABEL_TO_INPUT_GAP, TITLE_OFFSET_AFTER_HEADING, TITLE_ROW_GAP, TITLE_START_Y,
    TITLE_TEXT_COLOR, UI_TEXT_COLOR, WINDOW_HEIGHT, WINDOW_WIDTH,
};
use crate::render;

/// Simple text input: focus 0 = none, 1 = first, 2 = second. Returns (focus_after, new_string).
pub fn text_input(
    focus: u8,
    white_name: &str,
    black_name: &str,
    white_rect: (f32, f32, f32, f32),
    black_rect: (f32, f32, f32, f32),
    mx: f32,
    my: f32,
    clicked: bool,
) -> (u8, String, String) {
    let mut new_focus = focus;
    let mut new_white = white_name.to_string();
    let mut new_black = black_name.to_string();

    if clicked {
        let (wx, wy, ww, wh) = white_rect;
        let (bx, by, bw, bh) = black_rect;
        if mx >= wx && mx <= wx + ww && my >= wy && my <= wy + wh {
            new_focus = 1;
        } else if mx >= bx && mx <= bx + bw && my >= by && my <= by + bh {
            new_focus = 2;
        } else {
            new_focus = 0;
        }
    }

    if new_focus == 1 {
        while new_white.len() < 20 {
            match get_char_pressed() {
                Some(c) if c.is_ascii() && !c.is_control() => new_white.push(c),
                _ => break,
            }
        }
        if is_key_pressed(KeyCode::Backspace) && !new_white.is_empty() {
            new_white.pop();
        }
    } else if new_focus == 2 {
        while new_black.len() < 20 {
            match get_char_pressed() {
                Some(c) if c.is_ascii() && !c.is_control() => new_black.push(c),
                _ => break,
            }
        }
        if is_key_pressed(KeyCode::Backspace) && !new_black.is_empty() {
            new_black.pop();
        }
    }

    (new_focus, new_white, new_black)
}

/// Draw title screen. Returns true if New Game was clicked.
pub fn draw_title_screen(
    white_name: &str,
    black_name: &str,
    input_focus: u8,
    mx: f32,
    my: f32,
) -> (bool, (f32, f32, f32, f32), (f32, f32, f32, f32)) {
    let cx = WINDOW_WIDTH / 2.0;
    let mut cy = TITLE_START_Y;

    draw_text_ex(
        "Pawnageddon",
        cx - 120.0,
        cy,
        TextParams {
            font_size: 48,
            color: TITLE_TEXT_COLOR,
            ..Default::default()
        },
    );
    cy += TITLE_OFFSET_AFTER_HEADING;

    draw_text("White player", cx - 70.0, cy, TITLE_LABEL_SIZE, UI_TEXT_COLOR);
    cy += TITLE_LABEL_SIZE + TITLE_LABEL_TO_INPUT_GAP;
    let white_rect = (cx - TITLE_INPUT_W / 2.0, cy, TITLE_INPUT_W, TITLE_INPUT_H);
    draw_rectangle(white_rect.0, white_rect.1, white_rect.2, white_rect.3, INPUT_BG_COLOR);
    draw_rectangle_lines(white_rect.0, white_rect.1, white_rect.2, white_rect.3, 2.0, UI_TEXT_COLOR);
    let display_white = if white_name.is_empty() { "Enter name..." } else { white_name };
    draw_text(display_white, white_rect.0 + 8.0, white_rect.1 + TITLE_INPUT_H / 2.0 + 6.0, 18.0, if white_name.is_empty() { GRAY } else { UI_TEXT_COLOR });
    if input_focus == 1 {
        draw_rectangle_lines(white_rect.0, white_rect.1, white_rect.2, white_rect.3, 2.0, WHITE);
    }
    cy += TITLE_INPUT_H + TITLE_ROW_GAP;

    draw_text("Black player", cx - 70.0, cy, TITLE_LABEL_SIZE, UI_TEXT_COLOR);
    cy += TITLE_LABEL_SIZE + TITLE_LABEL_TO_INPUT_GAP;
    let black_rect = (cx - TITLE_INPUT_W / 2.0, cy, TITLE_INPUT_W, TITLE_INPUT_H);
    draw_rectangle(black_rect.0, black_rect.1, black_rect.2, black_rect.3, INPUT_BG_COLOR);
    draw_rectangle_lines(black_rect.0, black_rect.1, black_rect.2, black_rect.3, 2.0, UI_TEXT_COLOR);
    let display_black = if black_name.is_empty() { "Enter name..." } else { black_name };
    draw_text(display_black, black_rect.0 + 8.0, black_rect.1 + TITLE_INPUT_H / 2.0 + 6.0, 18.0, if black_name.is_empty() { GRAY } else { UI_TEXT_COLOR });
    if input_focus == 2 {
        draw_rectangle_lines(black_rect.0, black_rect.1, black_rect.2, black_rect.3, 2.0, WHITE);
    }
    cy += TITLE_INPUT_H + 40.0;

    let new_game_rect = (cx - TITLE_BTN_W / 2.0, cy, TITLE_BTN_W, TITLE_BTN_H);
    draw_rectangle(new_game_rect.0, new_game_rect.1, new_game_rect.2, new_game_rect.3, BUTTON_BG_COLOR);
    draw_rectangle_lines(new_game_rect.0, new_game_rect.1, new_game_rect.2, new_game_rect.3, 2.0, UI_TEXT_COLOR);
    draw_text("New Game", new_game_rect.0 + 48.0, new_game_rect.1 + TITLE_BTN_H / 2.0 + 8.0, 24.0, UI_TEXT_COLOR);

    let new_game_clicked = is_mouse_button_pressed(MouseButton::Left)
        && mx >= new_game_rect.0 && mx <= new_game_rect.0 + new_game_rect.2
        && my >= new_game_rect.1 && my <= new_game_rect.1 + new_game_rect.3;

    (new_game_clicked, white_rect, black_rect)
}

/// Menu icon (hamburger) position and size. Returns (x, y, w, h).
pub fn menu_icon_rect() -> (f32, f32, f32, f32) {
    (MENU_ICON_PAD, MENU_ICON_PAD, MENU_ICON_SIZE, MENU_ICON_SIZE)
}

/// Draw menu icon (three lines). Returns true if clicked.
pub fn draw_menu_icon(mx: f32, my: f32) -> bool {
    let (x, y, w, h) = menu_icon_rect();
    draw_rectangle(x, y, w, h, Color::from_rgba(0, 0, 0, 0));
    let line_y = [y + h * 0.25, y + h * 0.5, y + h * 0.75];
    for &ly in &line_y {
        draw_rectangle(x + 6.0, ly - 2.0, w - 12.0, 4.0, UI_TEXT_COLOR);
    }
    is_mouse_button_pressed(MouseButton::Left)
        && mx >= x && mx <= x + w && my >= y && my <= y + h
}

/// Hit-test menu only (no draw). Returns (new_game_clicked, flip_clicked).
pub fn menu_hit_test(mx: f32, my: f32, pressed: bool) -> (bool, bool) {
    if !pressed {
        return (false, false);
    }
    let (ix, iy, _iw, ih) = menu_icon_rect();
    let menu_x = ix;
    let menu_y = iy + ih + 4.0;
    let new_clicked = mx >= menu_x && mx <= menu_x + MENU_DROPDOWN_W
        && my >= menu_y && my <= menu_y + MENU_ITEM_H;
    let flip_clicked = mx >= menu_x && mx <= menu_x + MENU_DROPDOWN_W
        && my >= menu_y + MENU_ITEM_H && my <= menu_y + MENU_ITEM_H * 2.0;
    (new_clicked, flip_clicked)
}

/// Draw dropdown menu (below icon).
pub fn draw_menu(_mx: f32, _my: f32) {
    let (ix, iy, _iw, ih) = menu_icon_rect();
    let menu_x = ix;
    let menu_y = iy + ih + 4.0;
    let menu_h = MENU_ITEM_H * 2.0;

    draw_rectangle(menu_x, menu_y, MENU_DROPDOWN_W, menu_h, BUTTON_BG_COLOR);
    draw_rectangle_lines(menu_x, menu_y, MENU_DROPDOWN_W, menu_h, 2.0, UI_TEXT_COLOR);

    draw_text("New game", menu_x + 16.0, menu_y + MENU_ITEM_H / 2.0 + 8.0, 20.0, UI_TEXT_COLOR);
    draw_text("Flip board", menu_x + 16.0, menu_y + MENU_ITEM_H + MENU_ITEM_H / 2.0 + 8.0, 20.0, UI_TEXT_COLOR);
}

/// Draw promotion modal. Returns Some(chosen_piece) when the user clicks a piece; None otherwise.
/// Only accepts a click when `accept_input` is true (e.g. after mouse was released since opening).
/// Piece is lowercase for white, uppercase for black.
pub fn draw_promotion_modal(
    white: bool,
    textures: &PieceTextures,
    mx: f32,
    my: f32,
    accept_input: bool,
) -> Option<char> {
    let overlay = Color::from_rgba(0, 0, 0, PROMOTION_OVERLAY_ALPHA);
    draw_rectangle(0.0, 0.0, WINDOW_WIDTH, WINDOW_HEIGHT, overlay);

    let cx = WINDOW_WIDTH / 2.0;
    let cy = WINDOW_HEIGHT / 2.0;
    let bx = cx - PROMOTION_BOX_W / 2.0;
    let by = cy - PROMOTION_BOX_H / 2.0;

    draw_rectangle(bx, by, PROMOTION_BOX_W, PROMOTION_BOX_H, BUTTON_BG_COLOR);
    draw_rectangle_lines(bx, by, PROMOTION_BOX_W, PROMOTION_BOX_H, 3.0, UI_TEXT_COLOR);

    draw_text(
        "Choose piece to promote your pawn",
        cx - 130.0,
        by + PROMOTION_TITLE_Y_OFFSET,
        22.0,
        UI_TEXT_COLOR,
    );

    let total_w = 4.0 * PROMOTION_PIECE_SIZE + 3.0 * PROMOTION_PIECE_GAP;
    let start_x = bx + (PROMOTION_BOX_W - total_w) / 2.0 + PROMOTION_PIECE_SIZE / 2.0 + PROMOTION_PIECE_GAP / 2.0;
    let start_y = by + PROMOTION_BUTTONS_Y_OFFSET;

    let pressed = accept_input && is_mouse_button_pressed(MouseButton::Left);
    let mut chosen = None;

    for (i, (piece, _label)) in PROMOTION_CHOICES.iter().enumerate() {
        let p = if white { *piece } else { piece.to_uppercase().next().unwrap_or(*piece) };
        let center_x = start_x + i as f32 * (PROMOTION_PIECE_SIZE + PROMOTION_PIECE_GAP);
        let center_y = start_y;
        let left = center_x - PROMOTION_PIECE_SIZE / 2.0;
        let top = center_y - PROMOTION_PIECE_SIZE / 2.0;

        draw_rectangle(left, top, PROMOTION_PIECE_SIZE, PROMOTION_PIECE_SIZE, INPUT_BG_COLOR);
        draw_rectangle_lines(left, top, PROMOTION_PIECE_SIZE, PROMOTION_PIECE_SIZE, 2.0, UI_TEXT_COLOR);
        render::draw_piece_at(p, left + 6.0, top + 6.0, PROMOTION_PIECE_SIZE - 12.0, 24, textures);

        if pressed && mx >= left && mx < left + PROMOTION_PIECE_SIZE && my >= top && my < top + PROMOTION_PIECE_SIZE {
            chosen = Some(p);
        }
    }

    chosen
}


//! Pawnageddon — a 2D chess game with macroquad.

mod assets;
mod board;
mod constants;
mod game;
mod pieces;
mod render;
mod ui;

use macroquad::file::set_pc_assets_folder;
use macroquad::prelude::*;

use crate::constants::{WINDOW_HEIGHT, WINDOW_WIDTH};
use crate::game::{GameState, MoveResult};

fn window_conf() -> Conf {
    Conf {
        window_title: "Pawnageddon".to_owned(),
        window_width: WINDOW_WIDTH as i32,
        window_height: WINDOW_HEIGHT as i32,
        window_resizable: true,
        ..Default::default()
    }
}

fn resolve_assets_folder() -> String {
    let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let from_cwd = cwd.join("assets");
    if from_cwd.exists() {
        return from_cwd.to_string_lossy().into_owned();
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let from_exe = dir.join("../../assets");
            if from_exe.exists() {
                return from_exe.to_string_lossy().into_owned();
            }
        }
    }
    "assets".to_owned()
}

#[derive(Clone, Copy)]
enum Screen {
    Title,
    Playing,
    Promotion,
}

#[macroquad::main(window_conf)]
async fn main() {
    let assets_path = resolve_assets_folder();
    set_pc_assets_folder(&assets_path);
    let textures = assets::PieceTextures::load_all().await;

    let mut screen = Screen::Title;
    let mut white_name = String::from("White");
    let mut black_name = String::from("Black");
    let mut input_focus: u8 = 0;

    let mut game = GameState::new();
    let mut white_at_bottom = true;
    let mut menu_open = false;

    let mut promotion_pending: Option<(i32, i32, i32, i32, bool)> = None;
    let mut promotion_modal_accept_input = false;

    let ui_text = constants::UI_TEXT_COLOR;

    loop {
        let (mx, my) = mouse_position();

        match screen {
            Screen::Title => {
                clear_background(constants::BACKGROUND_DARK);
                let (ng_clicked, wr, br) = ui::draw_title_screen(
                    &white_name,
                    &black_name,
                    input_focus,
                    mx,
                    my,
                );
                let (new_focus, nw, nb) = ui::text_input(
                    input_focus,
                    &white_name,
                    &black_name,
                    wr,
                    br,
                    mx,
                    my,
                    is_mouse_button_pressed(MouseButton::Left),
                );
                input_focus = new_focus;
                white_name = nw;
                black_name = nb;
                if ng_clicked {
                    game = GameState::new();
                    if white_name.trim().is_empty() {
                        white_name = "White".to_string();
                    }
                    if black_name.trim().is_empty() {
                        black_name = "Black".to_string();
                    }
                    screen = Screen::Playing;
                    menu_open = false;
                }
            }

            Screen::Playing => {
                if menu_open {
                    let (ix, iy, iw, ih) = ui::menu_icon_rect();
                    let (new_game_clicked, flip_clicked) = ui::menu_hit_test(mx, my, is_mouse_button_pressed(MouseButton::Left));
                    let menu_y = iy + ih + 4.0;
                    let outside = mx < ix || mx > ix + constants::MENU_DROPDOWN_W
                        || my < menu_y || my > menu_y + constants::MENU_ITEM_H * 2.0;

                    if is_mouse_button_pressed(MouseButton::Left) {
                        if new_game_clicked {
                            screen = Screen::Title;
                            menu_open = false;
                        } else if flip_clicked {
                            white_at_bottom = !white_at_bottom;
                            menu_open = false;
                        } else if mx >= ix && mx <= ix + iw && my >= iy && my <= iy + ih {
                            menu_open = false;
                        } else if outside {
                            menu_open = false;
                        }
                    }
                } else if is_mouse_button_pressed(MouseButton::Left) {
                    let (ix, iy, iw, ih) = ui::menu_icon_rect();
                    if mx >= ix && mx <= ix + iw && my >= iy && my <= iy + ih {
                        menu_open = true;
                    } else if let Some((col, row)) = render::screen_to_logical(mx, my, white_at_bottom) {
                        match game.on_square_clicked(col, row) {
                            MoveResult::Done => {}
                            MoveResult::PromotionPending { from_c, from_r, to_c, to_r, white } => {
                                promotion_pending = Some((from_c, from_r, to_c, to_r, white));
                                screen = Screen::Promotion;
                                promotion_modal_accept_input = false;
                            }
                        }
                    }
                }

                clear_background(constants::BACKGROUND_DARK);

                let white_view = white_at_bottom;
                let (left, top) = render::board_origin();
                let bp = constants::board_px();

                render::draw_board_squares(white_view);
                if let Some((sc, sr)) = game.selected {
                    render::draw_highlight(sc, sr, white_view);
                    render::draw_valid_moves(&game.board, &game.valid_moves, white_view);
                }
                render::draw_pieces(&game.board, &textures, white_view, None);
                render::draw_notation(white_view);

                let sq = render::square_px();
                let scale = sq * 0.6;
                let font_size = (scale * 0.8) as u16;
                let margin = constants::MARGIN_X;
                let captured_y_white = top - 30.0;
                let captured_y_black = top + bp + 10.0;

                let white_label = format!("{} lost:", white_name.trim());
                let black_label = format!("{} lost:", black_name.trim());
                draw_text(&white_label, left - margin + 10.0, captured_y_white - 15.0, 18.0, ui_text);
                render::draw_captured_pieces(
                    &game.captured_white,
                    &textures,
                    left - margin + 10.0,
                    captured_y_white,
                    scale,
                    font_size,
                );
                draw_text(&black_label, left - margin + 10.0, captured_y_black - 15.0, 18.0, ui_text);
                render::draw_captured_pieces(
                    &game.captured_black,
                    &textures,
                    left - margin + 10.0,
                    captured_y_black,
                    scale,
                    font_size,
                );

                let turn_name = if game.white_to_move { white_name.trim() } else { black_name.trim() };
                let in_check = pieces::is_king_in_check(&game.board, game.white_to_move, &game.castling_rights, game.en_passant_target);
                let no_moves = pieces::no_legal_moves(&game.board, game.white_to_move, &game.castling_rights, game.en_passant_target);
                let turn_text = if no_moves && in_check {
                    let winner = if game.white_to_move { black_name.trim() } else { white_name.trim() };
                    format!("Checkmate ({} wins)", winner)
                } else if no_moves {
                    "Stalemate".to_string()
                } else if in_check {
                    format!("{} to move (in check)", turn_name)
                } else {
                    format!("{} to move", turn_name)
                };
                draw_text(
                    &turn_text,
                    left + bp + 20.0,
                    top + bp / 2.0 - 10.0,
                    20.0,
                    ui_text,
                );

                ui::draw_menu_icon(mx, my);
                if menu_open {
                    ui::draw_menu(mx, my);
                }
            }

            Screen::Promotion => {
                if !promotion_modal_accept_input && is_mouse_button_released(MouseButton::Left) {
                    promotion_modal_accept_input = true;
                }
                clear_background(constants::BACKGROUND_DARK);
                let white_view = white_at_bottom;
                render::draw_board_squares(white_view);
                render::draw_pieces(&game.board, &textures, white_view, None);
                render::draw_notation(white_view);

                if let Some((from_c, from_r, to_c, to_r, white)) = promotion_pending {
                    if let Some(chosen) = ui::draw_promotion_modal(white, &textures, mx, my, promotion_modal_accept_input) {
                        game.complete_promotion(from_c, from_r, to_c, to_r, chosen);
                        promotion_pending = None;
                        screen = Screen::Playing;
                    }
                }
            }
        }

        next_frame().await;
    }
}

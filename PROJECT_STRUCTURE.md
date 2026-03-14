# Pawnageddon — Project Structure

**Always follow this file structure** so the codebase stays maintainable and easy to navigate.

## Module layout

- **`src/constants.rs`** — All constants: dimensions, colors, asset names, UI layout (margins, sizes, colors), promotion modal layout, menu layout, starting position. Do not put magic numbers or layout constants in other files.
- **`src/board.rs`** — Board representation and helpers (in_bounds, get/set piece, find_king, etc.).
- **`src/pieces.rs`** — Piece types, asset name mapping, move generation (pseudo-legal and legal), check detection.
- **`src/game.rs`** — Game state (board, turn, selection, valid moves, captured pieces) and move/promotion logic.
- **`src/assets.rs`** — Loading and caching piece textures.
- **`src/render.rs`** — All drawing: board, pieces, notation, highlights, captured pieces. Uses constants from `constants.rs`.
- **`src/ui.rs`** — UI flows only: title screen, menu, promotion modal, text input. Uses constants from `constants.rs`; no local layout/color constants.
- **`src/main.rs`** — Entry point, window config, game loop, screen dispatch. Minimal logic; delegates to modules.

## Rules

1. **Constants** — Put any new constant (numbers, colors, sizes, strings) in `constants.rs` with a clear name and, if needed, a short comment.
2. **No magic numbers** — Use named constants from `constants.rs` in `render.rs`, `ui.rs`, and `main.rs`.
3. **Single responsibility** — Keep each module focused: game logic in `game.rs` and `pieces.rs`, drawing in `render.rs` and `ui.rs`, configuration in `constants.rs`.

# Pawnageddon

A 2D chess board built in Rust with [macroquad](https://macroquad.rs/). Pawns use images from `assets/`; other pieces use letter placeholders (K, Q, R, B, N). Pawns can be moved forward one square.

## Assets

Place pawn sprites in the `assets/` folder at the project root:

- `assets/pawn-white.png` — white pawn
- `assets/pawn-black.png` — black pawn

If these files are missing, pawns are drawn as the letter "P" instead.

## Prerequisites

- [Rust](https://rustup.rs/) (install with `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)

## Run

```bash
cargo run
```

## Build release executable

```bash
cargo build --release
```

The executable will be at `target/release/pawnageddon` (or `pawnageddon.exe` on Windows). When running the binary directly, run it from the project root so `assets/` is found, or place `assets/` next to the executable.

## Controls

- **Click a pawn** of the side to move to select it (square highlights).
- **Click the square one step forward** to move the pawn (or click the same square to deselect).
- White moves first; turns alternate after each pawn move.
- Close the window to exit.

# Pawnageddon

A 2D chess game with a full board, piece images, and standard rules (castling, en passant, promotion, check/checkmate). Built with **Python** and **Pygame**.

## Assets

Place assets in the `assets/` folder at the project root:

- **Title screen:** `assets/pawnageddon-title.png` (optional; shows "Pawnageddon" text if missing)
- **Pieces:** `assets/chess-pieces/` with filenames like `pawn-white.png`, `king-black.png`, etc.

If a piece image is missing, that piece is drawn as a letter (K, Q, R, B, N, P).

## Prerequisites

- Python 3.7+
- [Pygame](https://www.pygame.org/): `pip install pygame`

## Run

From the project root (so `assets/` is found):

```bash
pip install -r requirements.txt
python main.py
```

Or run as a module:

```bash
python -m pawnageddon
```

## Project structure

```
pawnageddon/
├── main.py              # Entry point (launches the game)
├── requirements.txt
├── assets/              # Title image + chess-pieces/
└── pawnageddon/         # Game package
    ├── __init__.py
    ├── __main__.py      # Enables: python -m pawnageddon
    ├── constants.py     # Window size, colors, layout, starting position
    ├── board.py         # Board representation and helpers
    ├── pieces.py        # Move generation (legal, check, castling, en passant)
    ├── game.py          # GameState: selection, moves, captured pieces
    ├── render.py        # Drawing: board, pieces, notation, highlights
    ├── ui.py            # Title splash, name input, menu, promotion modal
    └── run.py           # Main game loop
```

## Controls

- **Title screen:** Click anywhere or "Play" to continue.
- **Name input:** Enter White and Black player names, then "Start game".
- **Game:** Click a piece to select it (highlights + valid moves). Click a valid square to move. Pawn promotion opens a piece chooser.
- **Menu (during game):** Hamburger icon → "New game" or "Flip board".
- Close the window to exit.

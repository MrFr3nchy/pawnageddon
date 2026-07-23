export const SQUARES = 8;
export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const CHAOS_MAX = 100;
export const FILES = ['a','b','c','d','e','f','g','h'];
export const DECK_TURN = 8;
export const SHOP_TURN = 4;
export const EXTRA_DRAW_COST = 3;
export const MAX_PLAYS_PER_TURN = 1;

export const PIECE_ASSETS = {
  r: 'chess-pieces/rook-white.png',
  n: 'chess-pieces/knight-white.png',
  b: 'chess-pieces/bishop-white.png',
  q: 'chess-pieces/queen-white.png',
  k: 'chess-pieces/king-white.png',
  p: 'chess-pieces/pawn-white.png',
  R: 'chess-pieces/rook-black.png',
  N: 'chess-pieces/knight-black.png',
  B: 'chess-pieces/bishop-black.png',
  Q: 'chess-pieces/queen-black.png',
  K: 'chess-pieces/king-black.png',
  P: 'chess-pieces/pawn-black.png',
};

export const STARTING_POSITION = [
  ['R','N','B','Q','K','B','N','R'],
  ['P','P','P','P','P','P','P','P'],
  [' ',' ',' ',' ',' ',' ',' ',' '],
  [' ',' ',' ',' ',' ',' ',' ',' '],
  [' ',' ',' ',' ',' ',' ',' ',' '],
  [' ',' ',' ',' ',' ',' ',' ',' '],
  ['p','p','p','p','p','p','p','p'],
  ['r','n','b','q','k','b','n','r'],
];

export function defaultCastlingRights() {
  return { white_kingside: true, white_queenside: true, black_kingside: true, black_queenside: true };
}

export function pieceValue(ch) {
  if (!ch || ch === ' ') return 0;
  return PIECE_VALUES[ch.toLowerCase()] ?? 0;
}

// Colors
export const LIGHT_SQUARE  = 0xf0d9b5;
export const DARK_SQUARE   = 0xb58863;
export const HIGHLIGHT_SEL = 0xf6f669;
export const HIGHLIGHT_MOVE= 0x7fc97f;
export const HIGHLIGHT_CAP = 0xe05c5c;
export const BG_DARK       = 0x0f0f13;
export const PANEL_BG      = 0x1a1c21;
export const ACCENT_GOLD   = 0xdaaf3e;
export const TEXT_PRIMARY  = 0xeeeef4;
export const CHAOS_FILL    = 0xb44141;

import { SQUARES, STARTING_POSITION } from './constants.js';

export function newBoard() {
  return STARTING_POSITION.map(row => [...row]);
}

export function inBounds(col, row) {
  return col >= 0 && col < SQUARES && row >= 0 && row < SQUARES;
}

export function getPiece(board, col, row) {
  return board[row][col];
}

export function setPiece(board, col, row, piece) {
  board[row][col] = piece;
}

export function isEmpty(board, col, row) {
  return board[row][col] === ' ';
}

export function isWhitePiece(p) {
  return p !== ' ' && p === p.toLowerCase();
}

export function isBlackPiece(p) {
  return p !== ' ' && p === p.toUpperCase();
}

export function pieceIsSide(board, col, row, white) {
  const p = board[row][col];
  if (p === ' ') return false;
  return white ? isWhitePiece(p) : isBlackPiece(p);
}

export function findKing(board, white) {
  const k = white ? 'k' : 'K';
  for (let r = 0; r < SQUARES; r++)
    for (let c = 0; c < SQUARES; c++)
      if (board[r][c] === k) return [c, r];
  return null;
}

export function cloneBoard(board) {
  return board.map(r => [...r]);
}

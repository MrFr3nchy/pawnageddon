import { SQUARES } from './constants.js';
import { inBounds, isEmpty, getPiece, setPiece, isWhitePiece, isBlackPiece, pieceIsSide, findKing, cloneBoard } from './board.js';

function pawnMoves(board, col, row, white, enPassantTarget, out) {
  const fwd = white ? -1 : 1;
  const startRow = white ? 6 : 1;
  const r1 = row + fwd;
  if (inBounds(col, r1) && isEmpty(board, col, r1)) {
    out.add(`${col},${r1}`);
    if (row === startRow) {
      const r2 = row + 2 * fwd;
      if (inBounds(col, r2) && isEmpty(board, col, r2)) out.add(`${col},${r2}`);
    }
  }
  for (const dc of [-1, 1]) {
    const c = col + dc, r = row + fwd;
    if (!inBounds(c, r)) continue;
    const p = getPiece(board, c, r);
    if (p !== ' ' && isBlackPiece(p) === white) out.add(`${c},${r}`);
    else if (enPassantTarget && enPassantTarget[0] === c && enPassantTarget[1] === r) out.add(`${c},${r}`);
  }
}

function slidingMoves(board, col, row, white, dirs, out) {
  for (const [dc, dr] of dirs) {
    let c = col + dc, r = row + dr;
    while (inBounds(c, r)) {
      const p = getPiece(board, c, r);
      if (p === ' ') { out.add(`${c},${r}`); }
      else { if (isBlackPiece(p) === white) out.add(`${c},${r}`); break; }
      c += dc; r += dr;
    }
  }
}

function kingMoves(board, col, row, white, out) {
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
    if (dc === 0 && dr === 0) continue;
    const c = col + dc, r = row + dr;
    if (!inBounds(c, r)) continue;
    const p = getPiece(board, c, r);
    if (p === ' ' || isBlackPiece(p) === white) out.add(`${c},${r}`);
  }
}

function knightMoves(board, col, row, white, out) {
  for (const [dc, dr] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
    const c = col + dc, r = row + dr;
    if (!inBounds(c, r)) continue;
    const p = getPiece(board, c, r);
    if (p === ' ' || isBlackPiece(p) === white) out.add(`${c},${r}`);
  }
}

function isSquareAttacked(board, col, row, attackerWhite) {
  for (let r = 0; r < SQUARES; r++) for (let c = 0; c < SQUARES; c++) {
    if (!pieceIsSide(board, c, r, attackerWhite)) continue;
    const moves = new Set();
    const lower = board[r][c].toLowerCase();
    if (lower === 'p') pawnMoves(board, c, r, attackerWhite, null, moves);
    else if (lower === 'r') slidingMoves(board, c, r, attackerWhite, [[0,1],[0,-1],[1,0],[-1,0]], moves);
    else if (lower === 'b') slidingMoves(board, c, r, attackerWhite, [[1,1],[1,-1],[-1,1],[-1,-1]], moves);
    else if (lower === 'q') { slidingMoves(board, c, r, attackerWhite, [[0,1],[0,-1],[1,0],[-1,0]], moves); slidingMoves(board, c, r, attackerWhite, [[1,1],[1,-1],[-1,1],[-1,-1]], moves); }
    else if (lower === 'k') kingMoves(board, c, r, attackerWhite, moves);
    else if (lower === 'n') knightMoves(board, c, r, attackerWhite, moves);
    if (moves.has(`${col},${row}`)) return true;
  }
  return false;
}

function castlingMoves(board, col, row, white, rights, out) {
  if (col !== 4) return;
  const oppWhite = !white;
  if (white && row !== 7) return;
  if (!white && row !== 0) return;
  const ks = white ? rights.white_kingside  : rights.black_kingside;
  const qs = white ? rights.white_queenside : rights.black_queenside;
  const rook = white ? 'r' : 'R';
  if (ks && isEmpty(board,5,row) && isEmpty(board,6,row) && getPiece(board,7,row)===rook
    && !isSquareAttacked(board,4,row,oppWhite) && !isSquareAttacked(board,5,row,oppWhite) && !isSquareAttacked(board,6,row,oppWhite))
    out.add(`6,${row}`);
  if (qs && isEmpty(board,1,row) && isEmpty(board,2,row) && isEmpty(board,3,row) && getPiece(board,0,row)===rook
    && !isSquareAttacked(board,4,row,oppWhite) && !isSquareAttacked(board,3,row,oppWhite) && !isSquareAttacked(board,2,row,oppWhite))
    out.add(`2,${row}`);
}

export function pseudoLegalMoves(board, col, row, castlingRights, enPassantTarget) {
  const piece = getPiece(board, col, row);
  if (piece === ' ') return new Set();
  const white = isWhitePiece(piece);
  const targets = new Set();
  const lower = piece.toLowerCase();
  if (lower === 'p') pawnMoves(board, col, row, white, enPassantTarget, targets);
  else if (lower === 'r') slidingMoves(board, col, row, white, [[0,1],[0,-1],[1,0],[-1,0]], targets);
  else if (lower === 'b') slidingMoves(board, col, row, white, [[1,1],[1,-1],[-1,1],[-1,-1]], targets);
  else if (lower === 'q') { slidingMoves(board, col, row, white, [[0,1],[0,-1],[1,0],[-1,0]], targets); slidingMoves(board, col, row, white, [[1,1],[1,-1],[-1,1],[-1,-1]], targets); }
  else if (lower === 'k') { kingMoves(board, col, row, white, targets); castlingMoves(board, col, row, white, castlingRights, targets); }
  else if (lower === 'n') knightMoves(board, col, row, white, targets);
  return targets;
}

export function isKingInCheck(board, white, castlingRights, enPassantTarget) {
  const pos = findKing(board, white);
  if (!pos) return false;
  const [kc, kr] = pos;
  for (let r = 0; r < SQUARES; r++) for (let c = 0; c < SQUARES; c++) {
    if (!pieceIsSide(board, c, r, !white)) continue;
    const moves = pseudoLegalMoves(board, c, r, castlingRights, enPassantTarget);
    if (moves.has(`${kc},${kr}`)) return true;
  }
  return false;
}

export function legalMoves(board, col, row, castlingRights, enPassantTarget) {
  const piece = getPiece(board, col, row);
  if (piece === ' ') return new Set();
  const white = isWhitePiece(piece);
  const pseudo = pseudoLegalMoves(board, col, row, castlingRights, enPassantTarget);
  const legal = new Set();
  for (const key of pseudo) {
    const [tc, tr] = key.split(',').map(Number);
    const b = cloneBoard(board);
    b[tr][tc] = piece;
    b[row][col] = ' ';
    if (enPassantTarget && tc === enPassantTarget[0] && tr === enPassantTarget[1]) {
      const capRow = tr + (white ? 1 : -1);
      b[capRow][tc] = ' ';
    }
    if (!isKingInCheck(b, white, castlingRights, null)) legal.add(key);
  }
  return legal;
}

export function noLegalMoves(board, whiteToMove, castlingRights, enPassantTarget) {
  for (let r = 0; r < SQUARES; r++) for (let c = 0; c < SQUARES; c++) {
    if (!pieceIsSide(board, c, r, whiteToMove)) continue;
    if (legalMoves(board, c, r, castlingRights, enPassantTarget).size > 0) return false;
  }
  return true;
}

export function parseMoveKey(key) {
  const [c, r] = key.split(',').map(Number);
  return [c, r];
}

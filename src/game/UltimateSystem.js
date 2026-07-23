// Ultimate attacks — one per piece type, costs chaos, produces big effects

import { isWhitePiece } from './board.js';

const PIECE_VALUES = { q:9, r:5, b:3, n:3, p:1 };

function empties(board) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === ' ') out.push([c, r]);
  return out;
}

export const ULTIMATES = {

  // ── PAWN: Cannonball ──────────────────────────────────────────────────────
  p: {
    name: 'Cannonball',
    icon: '💣',
    desc: 'Fires a cannonball through the entire file — destroys EVERY piece in its path!',
    chaosCost: 20,
    color: 0xff6600,
    animType: 'beam_vertical',
    apply(board, col, row, isWhite) {
      const destroyed = [], path = [];
      const dir = isWhite ? -1 : 1;
      for (let r = row + dir; r >= 0 && r < 8; r += dir) {
        path.push([col, r]);
        const p = board[r][col];
        if (p !== ' ') { destroyed.push({ col, row: r, piece: p }); board[r][col] = ' '; }
      }
      return { destroyed, spawned: [], path };
    },
  },

  // ── KNIGHT: Cavalry Charge ────────────────────────────────────────────────
  n: {
    name: 'Cavalry Charge',
    icon: '⚡',
    desc: 'Charges all 8 L-positions simultaneously, destroying every piece it can reach!',
    chaosCost: 25,
    color: 0xffee00,
    animType: 'multi_burst',
    apply(board, col, row, _isWhite) {
      const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      const destroyed = [], path = [];
      for (const [dc, dr] of jumps) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nc >= 8 || nr < 0 || nr >= 8) continue;
        path.push([nc, nr]);
        const p = board[nr][nc];
        if (p !== ' ') { destroyed.push({ col: nc, row: nr, piece: p }); board[nr][nc] = ' '; }
      }
      return { destroyed, spawned: [], path };
    },
  },

  // ── BISHOP: Sacred Flame ──────────────────────────────────────────────────
  b: {
    name: 'Sacred Flame',
    icon: '🔥',
    desc: 'Ignites all four diagonals up to 4 squares — burns through enemy pieces!',
    chaosCost: 25,
    color: 0xff8800,
    animType: 'diagonal_beams',
    apply(board, col, row, isWhite) {
      const destroyed = [], path = [];
      for (const [dc, dr] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let i = 1; i <= 4; i++) {
          const nc = col + dc * i, nr = row + dr * i;
          if (nc < 0 || nc >= 8 || nr < 0 || nr >= 8) break;
          path.push([nc, nr]);
          const p = board[nr][nc];
          if (p !== ' ') {
            if (isWhitePiece(p) !== isWhite) {
              destroyed.push({ col: nc, row: nr, piece: p }); board[nr][nc] = ' ';
            }
            break;
          }
        }
      }
      return { destroyed, spawned: [], path };
    },
  },

  // ── ROOK: Tower Collapse ──────────────────────────────────────────────────
  r: {
    name: 'Tower Collapse',
    icon: '💥',
    desc: 'The tower collapses! Destroys ALL pieces in the same row AND column!',
    chaosCost: 30,
    color: 0xff2200,
    animType: 'cross_beam',
    apply(board, col, row, _isWhite) {
      const destroyed = [], path = [];
      for (let c = 0; c < 8; c++) {
        if (c === col) continue;
        path.push([c, row]);
        const p = board[row][c];
        if (p !== ' ') { destroyed.push({ col: c, row, piece: p }); board[row][c] = ' '; }
      }
      for (let r = 0; r < 8; r++) {
        if (r === row) continue;
        path.push([col, r]);
        const p = board[r][col];
        if (p !== ' ') { destroyed.push({ col, row: r, piece: p }); board[r][col] = ' '; }
      }
      return { destroyed, spawned: [], path };
    },
  },

  // ── QUEEN: Chaos Nova ─────────────────────────────────────────────────────
  q: {
    name: 'Chaos Nova',
    icon: '🌀',
    desc: 'Releases a chaos nova — destroys ALL pieces within 2 squares!',
    chaosCost: 35,
    color: 0xaa00ff,
    animType: 'nova',
    apply(board, col, row, _isWhite) {
      const destroyed = [], path = [];
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nc >= 8 || nr < 0 || nr >= 8) continue;
        path.push([nc, nr]);
        const p = board[nr][nc];
        if (p !== ' ') { destroyed.push({ col: nc, row: nr, piece: p }); board[nr][nc] = ' '; }
      }
      return { destroyed, spawned: [], path };
    },
  },

  // ── KING: Royal Edict ────────────────────────────────────────────────────
  k: {
    name: 'Royal Edict',
    icon: '👑',
    desc: 'Issues a royal edict! Resurrects your 2 most valuable lost pieces anywhere on the board!',
    chaosCost: 40,
    color: 0xdaaf3e,
    animType: 'resurrect',
    apply(board, _col, _row, isWhite, capturedWhite, capturedBlack) {
      const spawned = [];
      const ownCaptured = (isWhite ? capturedWhite : capturedBlack).slice();
      ownCaptured.sort((a, b) => (PIECE_VALUES[b.toLowerCase()]||0) - (PIECE_VALUES[a.toLowerCase()]||0));
      const slots = empties(board);
      for (let i = 0; i < Math.min(2, ownCaptured.length, slots.length); i++) {
        const piece = ownCaptured[i];
        const idx = Math.floor(Math.random() * slots.length);
        const [ec, er] = slots.splice(idx, 1)[0];
        board[er][ec] = piece;
        spawned.push({ col: ec, row: er, piece });
      }
      return { destroyed: [], spawned, path: [] };
    },
  },
};

export function getUltimate(piece) {
  if (!piece || piece === ' ') return null;
  return ULTIMATES[piece.toLowerCase()] || null;
}

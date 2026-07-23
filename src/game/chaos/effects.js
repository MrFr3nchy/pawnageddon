// Effect engine — applies structured effect dicts to game board state

export class EffectResult {
  constructor() {
    this.destroyed   = [];  // [{col,row,piece}]
    this.spawned     = [];  // [{col,row,piece}]
    this.teleported  = [];  // [{fromCol,fromRow,toCol,toRow}]
    this.transformed = [];  // [{col,row,oldPiece,newPiece}]
    this.goldChanges  = { white: 0, black: 0 };
    this.chaosChanges = { white: 0, black: 0 };
    this.cardsDrawn   = 0;
    this.hazardsPlaced   = [];
    this.mutationsApplied = [];
    this.messages    = [];
    this.extraTurns  = 0;
  }
}

function sqName(c, r) { return `${'abcdefgh'[c]}${8 - r}`; }

function getPiece(board, c, r) { return board[r][c]; }
function setPiece(board, c, r, p) { board[r][c] = p; }
function isWhite(p) { return p !== ' ' && p === p.toLowerCase(); }

function allPieces(board, selector, playerWhite) {
  const results = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p === ' ') continue;
    const pw = isWhite(p);
    if (selector === 'random_self' && pw === playerWhite)   results.push([c, r]);
    else if (selector === 'random_enemy' && pw !== playerWhite) results.push([c, r]);
    else if (['random_any','any_piece'].includes(selector)) results.push([c, r]);
    else if (selector === 'all_pawns' && p.toLowerCase() === 'p') results.push([c, r]);
    else if (selector === 'all_pieces') results.push([c, r]);
  }
  return results;
}

function randomEmpty(board) {
  const empties = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === ' ') empties.push([c, r]);
  return empties.length ? empties[Math.floor(Math.random() * empties.length)] : null;
}

function sample(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

function getTargets(effect, board, playerWhite, chosenPiece) {
  const target = effect.target || 'random_enemy';
  if (['self_piece','enemy_piece','any_piece','chosen_piece'].includes(target)) return chosenPiece ? [chosenPiece] : [];
  const pieces = allPieces(board, target, playerWhite);
  if (target.startsWith('all_')) return pieces;
  const count = effect.count || 1;
  return pieces.length ? sample(pieces, Math.min(count, pieces.length)) : [];
}

function applyResource(changes, playerKey, amount, callerWhite) {
  if (playerKey === 'self') changes[callerWhite ? 'white' : 'black'] += amount;
  else if (playerKey === 'opponent') changes[callerWhite ? 'black' : 'white'] += amount;
  else if (playerKey === 'both') { changes.white += amount; changes.black += amount; }
}

export function applyEffect(effect, board, playerWhite, result, chosenSquare = null, chosenPiece = null) {
  const etype = effect.type || '';

  if (etype === 'destroy') {
    const targets = getTargets(effect, board, playerWhite, chosenPiece);
    const radius = effect.radius || 0;
    for (const [c, r] of targets) {
      if (radius > 0) {
        for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
          const nc = c + dc, nr = r + dr;
          if (nc >= 0 && nc < 8 && nr >= 0 && nr < 8) {
            const p = getPiece(board, nc, nr);
            if (p !== ' ') { setPiece(board, nc, nr, ' '); result.destroyed.push({ col: nc, row: nr, piece: p }); }
          }
        }
      } else {
        const p = getPiece(board, c, r);
        if (p !== ' ') { setPiece(board, c, r, ' '); result.destroyed.push({ col: c, row: r, piece: p }); result.messages.push(`${p} at ${sqName(c,r)} destroyed`); }
      }
    }
  } else if (etype === 'spawn') {
    let piece = effect.piece || 'p';
    if (!playerWhite) piece = piece.toUpperCase();
    const sq = chosenSquare || randomEmpty(board);
    if (sq) { setPiece(board, sq[0], sq[1], piece); result.spawned.push({ col: sq[0], row: sq[1], piece }); result.messages.push(`Spawned ${piece} at ${sqName(...sq)}`); }
  } else if (etype === 'teleport') {
    const targets = getTargets(effect, board, playerWhite, chosenPiece);
    for (const [c, r] of targets) {
      const dest = randomEmpty(board);
      if (dest) {
        const p = getPiece(board, c, r);
        setPiece(board, c, r, ' ');
        setPiece(board, dest[0], dest[1], p);
        result.teleported.push({ fromCol: c, fromRow: r, toCol: dest[0], toRow: dest[1] });
        result.messages.push(`${p} teleported ${sqName(c,r)} → ${sqName(...dest)}`);
      }
    }
  } else if (etype === 'swap') {
    const pieces = allPieces(board, effect.target || 'random_any', playerWhite);
    if (pieces.length >= 2) {
      const [[ac,ar],[bc,br]] = sample(pieces, 2);
      const pa = getPiece(board,ac,ar), pb = getPiece(board,bc,br);
      setPiece(board,ac,ar,pb); setPiece(board,bc,br,pa);
      result.teleported.push({ fromCol:ac,fromRow:ar,toCol:bc,toRow:br });
      result.messages.push(`Swapped ${pa} and ${pb}`);
    }
  } else if (etype === 'transform') {
    const targets = getTargets(effect, board, playerWhite, chosenPiece);
    const into = effect.into || 'q';
    for (const [c, r] of targets) {
      const old = getPiece(board, c, r);
      if (old === ' ') continue;
      const newP = isWhite(old) ? into.toLowerCase() : into.toUpperCase();
      setPiece(board, c, r, newP);
      result.transformed.push({ col: c, row: r, oldPiece: old, newPiece: newP });
      result.messages.push(`${old} at ${sqName(c,r)} → ${newP}`);
    }
  } else if (etype === 'gold') {
    applyResource(result.goldChanges, effect.player || 'self', effect.amount || 1, playerWhite);
    const a = effect.amount || 1;
    result.messages.push(`${a > 0 ? '+' : ''}${a} gold`);
  } else if (etype === 'chaos') {
    applyResource(result.chaosChanges, effect.player || 'self', effect.amount || 1, playerWhite);
  } else if (etype === 'steal_gold') {
    const amount = effect.amount || 3;
    applyResource(result.goldChanges, 'self', amount, playerWhite);
    applyResource(result.goldChanges, 'opponent', -amount, playerWhite);
    result.messages.push(`Stole ${amount} gold`);
  } else if (etype === 'place_hazard') {
    const sq = chosenSquare || randomEmpty(board);
    if (sq) { result.hazardsPlaced.push({ id: effect.hazard_id || 'fire', col: sq[0], row: sq[1], duration: effect.duration || 3 }); result.messages.push(`Hazard '${effect.hazard_id}' placed`); }
  } else if (etype === 'freeze') {
    const targets = getTargets(effect, board, playerWhite, chosenPiece);
    for (const [c, r] of targets) { result.mutationsApplied.push({ type: 'freeze', col: c, row: r, duration: effect.duration || 2 }); result.messages.push(`Frozen ${sqName(c,r)}`); }
  } else if (etype === 'shield') {
    const targets = getTargets(effect, board, playerWhite, chosenPiece);
    for (const [c, r] of targets) { result.mutationsApplied.push({ type: 'shield', col: c, row: r, duration: effect.duration || 3 }); }
  } else if (etype === 'clone') {
    const targets = getTargets(effect, board, playerWhite, chosenPiece);
    for (const [c, r] of targets) {
      const p = getPiece(board, c, r); const sq = randomEmpty(board);
      if (sq && p !== ' ') { setPiece(board, sq[0], sq[1], p); result.spawned.push({ col: sq[0], row: sq[1], piece: p }); result.messages.push(`Cloned ${p}`); }
    }
  } else if (etype === 'extra_turn') {
    result.extraTurns += 1; result.messages.push('Extra turn!');
  } else if (etype === 'draw_cards') {
    result.cardsDrawn += effect.count || 1;
  }
}

export function applyEffects(effects, board, playerWhite, chosenSquare = null, chosenPiece = null) {
  const result = new EffectResult();
  for (const eff of (effects || [])) applyEffect(eff, board, playerWhite, result, chosenSquare, chosenPiece);
  return result;
}

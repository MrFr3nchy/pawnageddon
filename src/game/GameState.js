import { newBoard, getPiece, setPiece, isWhitePiece, isBlackPiece, pieceIsSide, cloneBoard } from './board.js';
import { legalMoves, isKingInCheck, noLegalMoves } from './pieces.js';
import { defaultCastlingRights, pieceValue, CHAOS_MAX, DECK_TURN, SHOP_TURN, EXTRA_DRAW_COST, MAX_PLAYS_PER_TURN } from './constants.js';
import { ChaosEngine } from './chaos/ChaosEngine.js';
import { getUltimate } from './UltimateSystem.js';
import { WEAPONS, SHIELDS } from './EquipSystem.js';

// Minimal event emitter
class EventEmitter {
  constructor() { this._h = {}; }
  on(e, fn) { (this._h[e] ??= []).push(fn); return () => this.off(e, fn); }
  off(e, fn) { this._h[e] = (this._h[e] || []).filter(h => h !== fn); }
  emit(e, ...args) { [...(this._h[e] || [])].forEach(fn => fn(...args)); }
}

export class GameState extends EventEmitter {
  constructor() {
    super();
    this.board           = newBoard();
    this.whiteToMove     = true;
    this.selected        = null;
    this.validMoves      = new Set();
    this.capturedWhite   = [];
    this.capturedBlack   = [];
    this.castlingRights  = defaultCastlingRights();
    this.enPassantTarget = null;
    this.turnCount       = 0;
    this.whiteGold       = 0;
    this.blackGold       = 0;
    this.whiteChaos      = 0;
    this.blackChaos      = 0;
    this.turnMessages    = [];
    this.gameOver        = null;
    this.winner          = null;
    this.freeDrawsRemaining  = 0;
    this.cardsPlayedThisTurn = 0;
    this.playerNames     = { white: 'White', black: 'Black' };

    this.chaos = new ChaosEngine();

    // Gear — key: `${col},${row}`
    this.pieceWeapons = new Map();   // → { id, uses }
    this.pieceShields = new Map();   // → { id, uses }
    this.ultimateCooldowns = new Set(); // keys of pieces that used ultimate this game (for optional cooldown)
  }

  // ── Accessors ──
  get whiteHand()     { return this.chaos.whiteHand; }
  get blackHand()     { return this.chaos.blackHand; }
  get chaosPct()      { return Math.min(100, (this.whiteChaos + this.blackChaos) / (CHAOS_MAX * 2) * 100); }
  get phaseName()     { return this.chaos.phaseName; }
  get phase()         { return this.chaos.phase; }
  get piecesRemaining() {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (this.board[r][c] !== ' ') n++;
    return n;
  }
  get currentPlayerGold()  { return this.whiteToMove ? this.whiteGold  : this.blackGold;  }
  get currentPlayerChaos() { return this.whiteToMove ? this.whiteChaos : this.blackChaos; }
  get currentHand()        { return this.whiteToMove ? this.chaos.whiteHand : this.chaos.blackHand; }
  get shopUnlocked()       { return this.turnCount >= SHOP_TURN; }
  get deckUnlocked()       { return this.turnCount >= DECK_TURN; }
  get chaosRevealed()      { return (this.capturedWhite.length + this.capturedBlack.length) > 0 || this.phase >= 3; }

  // ── Start turn ──
  startTurn() {
    this.turnMessages = [];
    this.freeDrawsRemaining  = 0;
    this.cardsPlayedThisTurn = 0;

    const events = this.chaos.onTurnStart(this.turnCount, this.chaosPct, this.piecesRemaining, this.board, this.whiteToMove);
    this.turnMessages.push(...this.chaos.turnLog);

    for (const ev of events) {
      if (ev.type === 'phaseUp') this.emit('phaseUp', ev);
      if (ev.type === 'chaosEvent') {
        this._applyEffectResult(ev.result);
        this.emit('chaosEvent', ev);
        this.emit('boardUpdate');
      }
    }

    if (this.deckUnlocked) {
      const hand = this.whiteToMove ? this.chaos.whiteHand : this.chaos.blackHand;
      if (hand.length < this.chaos.maxHandSize) this.chaos.drawCard(this.whiteToMove);
    }

    this.emit('turnStart', { whiteToMove: this.whiteToMove, turn: this.turnCount });
    this.emit('stateUpdate');
  }

  // ── Square click ──
  onSquareClicked(col, row) {
    if (this.gameOver) return;

    if (this.chaos.isFrozen(col, row) && pieceIsSide(this.board, col, row, this.whiteToMove)) {
      this.turnMessages.push('That piece is frozen!');
      this.emit('stateUpdate');
      return;
    }

    if (this.selected !== null) {
      const [sc, sr] = this.selected;
      const key = `${col},${row}`;
      if (this.validMoves.has(key)) {
        const piece = getPiece(this.board, sc, sr);
        const isBackRank = (isWhitePiece(piece) && row === 0) || (isBlackPiece(piece) && row === 7);
        if (piece.toLowerCase() === 'p' && isBackRank) {
          this.selected = null; this.validMoves = new Set();
          this.emit('promotionNeeded', { fromCol: sc, fromRow: sr, toCol: col, toRow: row, white: isWhitePiece(piece) });
          return;
        }
        this._makeMove(sc, sr, col, row, null);
        this.selected = null; this.validMoves = new Set();
        return;
      }
    }

    if (pieceIsSide(this.board, col, row, this.whiteToMove)) {
      this.selected = [col, row];
      this.validMoves = legalMoves(this.board, col, row, this.castlingRights, this.enPassantTarget);
      this.emit('selectionUpdate', { selected: this.selected, validMoves: this.validMoves });
      return;
    }

    this.selected = null; this.validMoves = new Set();
    this.emit('selectionUpdate', { selected: null, validMoves: new Set() });
  }

  completePromotion(fromC, fromR, toC, toR, promoteTo) {
    this._makeMove(fromC, fromR, toC, toR, promoteTo);
  }

  // ── Move execution ──
  _makeMove(fromC, fromR, toC, toR, promoteTo) {
    const piece   = getPiece(this.board, fromC, fromR);
    const white   = isWhitePiece(piece);
    const lower   = piece.toLowerCase();
    const startRow = white ? 6 : 1;
    const isPawnTwo = lower === 'p' && fromR === startRow && Math.abs(toR - fromR) === 2;
    const wasEP   = this.enPassantTarget && this.enPassantTarget[0] === toC && this.enPassantTarget[1] === toR;

    let captured = wasEP ? getPiece(this.board, toC, toR + (white ? 1 : -1)) : getPiece(this.board, toC, toR);

    // Shield check (opponent's shield)
    const toKey = `${toC},${toR}`;
    if (captured !== ' ' && this.pieceShields.has(toKey)) {
      const sh = this.pieceShields.get(toKey);
      sh.uses--;
      if (sh.uses <= 0) this.pieceShields.delete(toKey);
      captured = ' ';
      this.turnMessages.push('🛡️ Shield absorbed the capture!');
      this.emit('shieldBlocked', { col: toC, row: toR });
    } else if (captured !== ' ' && this.chaos.isShielded(toC, toR)) {
      this.chaos.mutations.delete(toKey);
      captured = ' ';
      this.turnMessages.push('Shield absorbed the capture!');
    }

    this.enPassantTarget = isPawnTwo ? [toC, Math.floor((fromR + toR) / 2)] : null;
    let movingPiece = promoteTo ?? piece;

    // Castling rook
    if (lower === 'k' && fromC === 4) {
      if (toC === 6) { setPiece(this.board, 5, toR, white ? 'r' : 'R'); setPiece(this.board, 7, toR, ' '); }
      if (toC === 2) { setPiece(this.board, 3, toR, white ? 'r' : 'R'); setPiece(this.board, 0, toR, ' '); }
    }

    // Castling rights
    if (lower === 'k') {
      if (white) { this.castlingRights.white_kingside = false; this.castlingRights.white_queenside = false; }
      else       { this.castlingRights.black_kingside = false; this.castlingRights.black_queenside = false; }
    } else if (lower === 'r') {
      if (white) { if (fromC===0&&fromR===7) this.castlingRights.white_queenside=false; if (fromC===7&&fromR===7) this.castlingRights.white_kingside=false; }
      else       { if (fromC===0&&fromR===0) this.castlingRights.black_queenside=false; if (fromC===7&&fromR===0) this.castlingRights.black_kingside=false; }
    }

    const captureInfo = captured !== ' ' ? { col: toC, row: toR, piece: captured } : null;

    // Weapon effects on capture
    const fromKey = `${fromC},${fromR}`;
    let weaponEffect = null;
    if (captured !== ' ' && this.pieceWeapons.has(fromKey)) {
      const wpn = this.pieceWeapons.get(fromKey);
      weaponEffect = wpn.id;
      wpn.uses--;
      if (wpn.uses <= 0) this.pieceWeapons.delete(fromKey);
      else this.pieceWeapons.set(fromKey, wpn); // will migrate below
    }

    // Execute move
    setPiece(this.board, toC, toR, movingPiece);
    setPiece(this.board, fromC, fromR, ' ');
    if (wasEP) setPiece(this.board, toC, toR + (white ? 1 : -1), ' ');

    // Capture bookkeeping
    let weaponBonuses = null;
    if (captured !== ' ') {
      const value = pieceValue(captured);
      let goldBonus = 0;
      if (weaponEffect === 'sword') { goldBonus = 3; this.turnMessages.push('⚔️ Sword strike! +3 gold!'); }
      if (white) { this.whiteChaos = Math.min(CHAOS_MAX, this.whiteChaos + value); this.whiteGold += value + goldBonus; }
      else       { this.blackChaos = Math.min(CHAOS_MAX, this.blackChaos + value); this.blackGold += value + goldBonus; }
      this.chaos.onPieceCaptured(toC, toR);
      if (isWhitePiece(captured)) this.capturedWhite.push(captured);
      else                        this.capturedBlack.push(captured);

      // Bomb weapon: explode adjacent
      if (weaponEffect === 'bomb') {
        const exploded = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = toC + dc, nr = toR + dr;
          if (nc < 0 || nc >= 8 || nr < 0 || nr >= 8) continue;
          const ep = getPiece(this.board, nc, nr);
          if (ep !== ' ') { exploded.push({ col: nc, row: nr, piece: ep }); setPiece(this.board, nc, nr, ' '); }
        }
        if (exploded.length) {
          weaponBonuses = { type: 'bomb', exploded };
          this.turnMessages.push(`💣 BOOM! Bomb destroyed ${exploded.length} adjacent piece(s)!`);
          for (const e of exploded) {
            if (isWhitePiece(e.piece)) this.capturedWhite.push(e.piece);
            else                       this.capturedBlack.push(e.piece);
          }
        }
      }

      // Poison weapon: leave hazard
      if (weaponEffect === 'poison') {
        this.chaos.hazards.set(toKey, { id: 'plague', duration: 4 });
        this.turnMessages.push('☠️ Poison left on the square!');
      }
    }

    // Migrate gear with piece
    this._migrateGear(fromC, fromR, toC, toR);
    this.chaos.onPieceMove(fromC, fromR, toC, toR);

    // Hazard check
    const hazResult = this.chaos.checkHazardOnMove(toC, toR, this.board, white);
    if (hazResult) { this._applyEffectResult(hazResult); this.turnMessages.push(...hazResult.messages); }

    this.emit('pieceMoved', { fromCol: fromC, fromRow: fromR, toCol: toC, toRow: toR, piece: movingPiece, captureInfo, promoteTo, weaponBonuses });

    this.whiteToMove = !this.whiteToMove;
    this.turnCount++;

    const inCheck = isKingInCheck(this.board, this.whiteToMove, this.castlingRights, this.enPassantTarget);
    const noMoves = noLegalMoves(this.board, this.whiteToMove, this.castlingRights, this.enPassantTarget);
    if (noMoves) {
      this.gameOver = inCheck ? 'checkmate' : 'stalemate';
      this.winner   = inCheck ? (this.whiteToMove ? 'black' : 'white') : null;
      this.emit('gameOver', { result: this.gameOver, winner: this.winner });
      this.emit('boardUpdate');
      return;
    }
    if (inCheck) { this.turnMessages.push('Check!'); this.emit('check', { white: this.whiteToMove }); }

    this.startTurn();
    this.emit('boardUpdate');
  }

  // Move gear maps when a piece moves
  _migrateGear(fromC, fromR, toC, toR) {
    const fk = `${fromC},${fromR}`, tk = `${toC},${toR}`;
    if (this.pieceWeapons.has(fk)) { this.pieceWeapons.set(tk, this.pieceWeapons.get(fk)); this.pieceWeapons.delete(fk); }
    if (this.pieceShields.has(fk)) { this.pieceShields.set(tk, this.pieceShields.get(fk)); this.pieceShields.delete(fk); }
  }

  _applyEffectResult(result) {
    this.whiteGold  = Math.max(0, this.whiteGold  + (result.goldChanges?.white  || 0));
    this.blackGold  = Math.max(0, this.blackGold  + (result.goldChanges?.black  || 0));
    this.whiteChaos = Math.min(CHAOS_MAX, Math.max(0, this.whiteChaos + (result.chaosChanges?.white || 0)));
    this.blackChaos = Math.min(CHAOS_MAX, Math.max(0, this.blackChaos + (result.chaosChanges?.black || 0)));
    for (const d of (result.destroyed || [])) {
      if (d.piece && d.piece !== ' ') {
        if (isWhitePiece(d.piece)) this.capturedWhite.push(d.piece);
        else                       this.capturedBlack.push(d.piece);
      }
    }
  }

  // ── Equipment ──
  equipWeapon(col, row, weaponId, playerWhite) {
    const piece = getPiece(this.board, col, row);
    if (!piece || piece === ' ' || isWhitePiece(piece) !== playerWhite) return false;
    const wpn = WEAPONS[weaponId];
    if (!wpn) return false;
    const gold = playerWhite ? this.whiteGold : this.blackGold;
    if (gold < wpn.cost) { this.turnMessages.push(`Need ${wpn.cost}🪙 to equip ${wpn.name}`); return false; }
    if (playerWhite) this.whiteGold -= wpn.cost;
    else             this.blackGold -= wpn.cost;
    this.pieceWeapons.set(`${col},${row}`, { id: weaponId, uses: wpn.uses });
    this.turnMessages.push(`${wpn.icon} Equipped ${wpn.name} on ${piece}!`);
    this.emit('gearEquipped', { col, row, type: 'weapon', weaponId });
    this.emit('stateUpdate');
    return true;
  }

  equipShield(col, row, shieldId, playerWhite) {
    const piece = getPiece(this.board, col, row);
    if (!piece || piece === ' ' || isWhitePiece(piece) !== playerWhite) return false;
    const sh = SHIELDS[shieldId];
    if (!sh) return false;
    const gold = playerWhite ? this.whiteGold : this.blackGold;
    if (gold < sh.cost) { this.turnMessages.push(`Need ${sh.cost}🪙 to equip ${sh.name}`); return false; }
    if (playerWhite) this.whiteGold -= sh.cost;
    else             this.blackGold -= sh.cost;
    this.pieceShields.set(`${col},${row}`, { id: shieldId, uses: sh.uses });
    this.turnMessages.push(`${sh.icon} Equipped ${sh.name} on ${piece}!`);
    this.emit('gearEquipped', { col, row, type: 'shield', shieldId });
    this.emit('stateUpdate');
    return true;
  }

  // ── Ultimate attacks ──
  useUltimate(col, row) {
    if (this.gameOver) return null;
    const piece = getPiece(this.board, col, row);
    if (!piece || piece === ' ') return null;
    const isWhite = isWhitePiece(piece);
    if (isWhite !== this.whiteToMove) return null;

    const ult = getUltimate(piece);
    if (!ult) return null;

    const chaos = isWhite ? this.whiteChaos : this.blackChaos;
    if (chaos < ult.chaosCost) {
      this.turnMessages.push(`Need ${ult.chaosCost}⚡ chaos to use ${ult.name}! (have ${Math.round(chaos)})`);
      this.emit('stateUpdate');
      return null;
    }

    // Drain chaos
    if (isWhite) this.whiteChaos = Math.max(0, this.whiteChaos - ult.chaosCost);
    else         this.blackChaos = Math.max(0, this.blackChaos - ult.chaosCost);

    // Apply effect
    const result = ult.apply(this.board, col, row, isWhite, this.capturedWhite, this.capturedBlack);

    // Bookkeeping for destroyed pieces
    for (const d of (result.destroyed || [])) {
      if (isWhitePiece(d.piece)) this.capturedWhite.push(d.piece);
      else                       this.capturedBlack.push(d.piece);
      this.pieceWeapons.delete(`${d.col},${d.row}`);
      this.pieceShields.delete(`${d.col},${d.row}`);
    }

    this.turnMessages.push(`💥 ${ult.icon} ${ult.name} — ${result.destroyed.length} piece(s) destroyed!`);
    this.emit('ultimateUsed', { col, row, piece, ult, result });
    this.emit('boardUpdate');
    this.emit('stateUpdate');
    return result;
  }

  // ── Cards ──
  drawCard(playerWhite) {
    const hand = playerWhite ? this.chaos.whiteHand : this.chaos.blackHand;
    if (hand.length >= this.chaos.maxHandSize) { this.turnMessages.push('Hand is full!'); return null; }
    if (this.freeDrawsRemaining > 0) {
      this.freeDrawsRemaining--;
    } else {
      const gold = playerWhite ? this.whiteGold : this.blackGold;
      if (gold < EXTRA_DRAW_COST) { this.turnMessages.push(`Need ${EXTRA_DRAW_COST} gold to draw!`); return null; }
      if (playerWhite) this.whiteGold -= EXTRA_DRAW_COST;
      else             this.blackGold -= EXTRA_DRAW_COST;
    }
    const card = this.chaos.drawCard(playerWhite);
    if (card) this.emit('cardDrawn', { card, playerWhite });
    this.emit('stateUpdate');
    return card;
  }

  playCard(cardId, playerWhite) {
    if (this.cardsPlayedThisTurn >= MAX_PLAYS_PER_TURN) { this.turnMessages.push('Already played a card this turn!'); return null; }
    const res = this.chaos.playCard(cardId, this.board, playerWhite);
    if (res) {
      this.cardsPlayedThisTurn++;
      this._applyEffectResult(res.result);
      this.turnMessages.push(...(res.result.messages || []));
      this.emit('cardPlayed', { card: res.card, result: res.result, playerWhite });
      this.emit('boardUpdate');
      this.emit('stateUpdate');
    }
    return res;
  }

  // Helpers for UI queries
  getWeaponAt(col, row) { return this.pieceWeapons.get(`${col},${row}`) || null; }
  getShieldAt(col, row) { return this.pieceShields.get(`${col},${row}`) || null; }
}

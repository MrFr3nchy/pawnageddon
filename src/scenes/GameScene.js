import Phaser from 'phaser';
import { GameState } from '../game/GameState.js';
import { bindToGameState } from '../audio/SoundManager.js';
import { LIGHT_SQUARE, DARK_SQUARE, HIGHLIGHT_SEL, HIGHLIGHT_MOVE, HIGHLIGHT_CAP, FILES } from '../game/constants.js';
import { getPiece, isWhitePiece, isBlackPiece } from '../game/board.js';
import { WEAPON_LIST, SHIELD_LIST, WEAPONS, SHIELDS } from '../game/EquipSystem.js';
import { getUltimate } from '../game/UltimateSystem.js';

const BOARD_COLS = 8;
const CARD_ZONE  = 120; // px reserved above & below board for card hands

// Tag → emoji icon for cards
const TAG_ICONS = {
  economy: '💰', damage: '⚔️', chaos: '🌀', movement: '🌪️',
  defense: '🛡️', buff: '✨', debuff: '☠️', destruction: '💥',
  transform: '🔄', freeze: '🧊', default: '🃏',
};
const RARITY_COLORS = {
  common: '#888888', uncommon: '#4488ff', rare: '#8844ff',
  epic: '#ff8800', legendary: '#ff2200',
};

function cardIcon(card) {
  for (const tag of (card.tags || [])) if (TAG_ICONS[tag]) return TAG_ICONS[tag];
  return TAG_ICONS.default;
}

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.destroy();
  }

  create() {
    const { width: W, height: H } = this.cameras.main;

    this.gs = new GameState();
    window.__gs = this.gs;
    bindToGameState(this.gs);

    // ── Layout: reserve CARD_ZONE above & below for card hands ──
    const availH   = H - CARD_ZONE * 2;
    const boardFit = Math.min(W - 80, availH - 40);
    this.SQUARE        = Math.floor(boardFit / BOARD_COLS);
    this.BOARD_SIZE    = this.SQUARE * BOARD_COLS;
    this.BOARD_ORIGIN_X = Math.floor((W - this.BOARD_SIZE) / 2);
    this.BOARD_ORIGIN_Y = CARD_ZONE + Math.floor((availH - this.BOARD_SIZE) / 2);

    this.cameras.main.setBackgroundColor(0x0f0f13);

    // Disable browser right-click menu inside canvas
    this.input.mouse?.disableContextMenu();

    this._buildBoard();
    this._buildHighlightLayers();
    this._buildPieceSprites();
    this._buildCoordLabels();
    this._buildEventBanner();
    this._buildPromotionModal();
    this._buildCardHands();
    this._buildContextMenu();
    this._buildGearOverlays();

    // Input
    this.input.on('pointerdown', this._onPointerDown, this);

    this._moveAnimating = false;
    this._ctxOpen = false;

    // Game state events
    this.gs.on('boardUpdate',     () => { if (!this._moveAnimating) this._refreshBoard(); });
    this.gs.on('pieceMoved',      (data) => this._animateMove(data));
    this.gs.on('selectionUpdate', (data) => this._refreshHighlights(data));
    this.gs.on('chaosEvent',      (ev)   => this._showEventBanner(ev.event.name, ev.event.desc));
    this.gs.on('phaseUp',         (ev)   => this._showEventBanner(`Phase ${ev.phase}: ${ev.name}`, '⚡ The chaos escalates!', 0xdaaf3e));
    this.gs.on('check',           ()     => this._flashCheck());
    this.gs.on('gameOver',        (data) => this._showGameOver(data));
    this.gs.on('promotionNeeded', (data) => this._showPromotion(data));
    this.gs.on('cardPlayed',      (data) => this._animateCardEffects(data.result));
    this.gs.on('cardDrawn',       ()     => this._refreshCardHands());
    this.gs.on('turnStart',       ()     => this._refreshCardHands());
    this.gs.on('stateUpdate',     ()     => this._refreshCardHands());
    this.gs.on('gearEquipped',    ()     => this._refreshGearOverlays());
    this.gs.on('shieldBlocked',   (data) => { this._animateShieldBlock(data?.col, data?.row); this._refreshGearOverlays(); });
    this.gs.on('ultimateUsed',    (data) => this._animateUltimate(data));

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.gs.startTurn();
    window.dispatchEvent(new CustomEvent('gameReady', { detail: this.gs }));
  }

  // ── Board construction ──────────────────────────────────────────────────────
  _buildBoard() {
    this.boardGraphics = this.add.graphics();
    this._drawBoard();
  }

  _drawBoard() {
    const g = this.boardGraphics;
    g.clear();
    for (let r = 0; r < BOARD_COLS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const x = this.BOARD_ORIGIN_X + c * this.SQUARE;
        const y = this.BOARD_ORIGIN_Y + r * this.SQUARE;
        const light = (r + c) % 2 === 0;
        g.fillStyle(light ? LIGHT_SQUARE : DARK_SQUARE).fillRect(x, y, this.SQUARE, this.SQUARE);
      }
    }
    g.lineStyle(2, 0x5a4a3a);
    g.strokeRect(this.BOARD_ORIGIN_X - 1, this.BOARD_ORIGIN_Y - 1, this.BOARD_SIZE + 2, this.BOARD_SIZE + 2);
  }

  _buildHighlightLayers() {
    this.highlightGraphics = this.add.graphics();
    this.hazardGraphics    = this.add.graphics();
  }

  _buildCoordLabels() {
    const style = { fontSize: '11px', fontFamily: 'Segoe UI, monospace', color: '#888' };
    for (let i = 0; i < 8; i++) {
      this.add.text(
        this.BOARD_ORIGIN_X + i * this.SQUARE + this.SQUARE / 2,
        this.BOARD_ORIGIN_Y + this.BOARD_SIZE + 4,
        FILES[i], style
      ).setOrigin(0.5, 0);
      this.add.text(
        this.BOARD_ORIGIN_X - 14,
        this.BOARD_ORIGIN_Y + (7 - i) * this.SQUARE + this.SQUARE / 2,
        String(i + 1), style
      ).setOrigin(0.5, 0.5);
    }
  }

  _buildPieceSprites() {
    this.pieceContainer = this.add.container(0, 0);
    this.pieceSprites = {};
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = getPiece(this.gs.board, c, r);
        if (p !== ' ') this._createPieceSprite(p, c, r);
      }
    }
  }

  _createPieceSprite(piece, col, row) {
    const { x, y } = this._squareCenter(col, row);
    const size = this.SQUARE * 0.86;
    const sprite = this.add.image(x, y, `piece_${piece}`).setDisplaySize(size, size);
    this.pieceContainer.add(sprite);
    this.pieceSprites[`${col},${row}`] = sprite;
    return sprite;
  }

  _squareCenter(col, row) {
    return {
      x: this.BOARD_ORIGIN_X + col * this.SQUARE + this.SQUARE / 2,
      y: this.BOARD_ORIGIN_Y + row * this.SQUARE + this.SQUARE / 2,
    };
  }

  // ── Card Hands (in-canvas) ──────────────────────────────────────────────────
  _buildCardHands() {
    this.cardHandBlack = this.add.container(0, 0).setDepth(5);
    this.cardHandWhite = this.add.container(0, 0).setDepth(5);
    this._refreshCardHands();
  }

  _refreshCardHands() {
    this.cardHandBlack.removeAll(true);
    this.cardHandWhite.removeAll(true);

    const { width: W } = this.cameras.main;
    const startX = this.BOARD_ORIGIN_X;
    const handW  = this.BOARD_SIZE;

    // Black hand — above board
    const blackY = this.BOARD_ORIGIN_Y - CARD_ZONE / 2 - 4;
    this._renderCardRow(this.cardHandBlack, this.gs.blackHand || [], startX, handW, blackY, false);

    // White hand — below board
    const whiteY = this.BOARD_ORIGIN_Y + this.BOARD_SIZE + CARD_ZONE / 2 + 4;
    this._renderCardRow(this.cardHandWhite, this.gs.whiteHand || [], startX, handW, whiteY, true);
  }

  _renderCardRow(container, hand, startX, totalW, centerY, isWhite) {
    const { width: W } = this.cameras.main;
    const canPlay = (isWhite && this.gs.whiteToMove) || (!isWhite && !this.gs.whiteToMove);

    // Player label
    const labelTxt = isWhite ? '♙ White Hand' : '♟ Black Hand';
    const labelCol = isWhite ? '#daaf3e' : '#9966ff';
    const label = this.add.text(startX, centerY - 36, labelTxt, {
      fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: labelCol, fontStyle: 'bold',
    }).setDepth(6);
    container.add(label);

    if (!hand || hand.length === 0) {
      const empty = this.add.text(startX + totalW / 2, centerY, 'No cards', {
        fontSize: '12px', fontFamily: 'Segoe UI, sans-serif', color: '#444',
      }).setOrigin(0.5).setDepth(6);
      container.add(empty);
      return;
    }

    const CARD_W = Math.min(86, (totalW - 4) / hand.length - 4);
    const CARD_H = 66;
    const gap    = 4;
    const total  = hand.length * (CARD_W + gap) - gap;
    let cx       = startX + (totalW - total) / 2 + CARD_W / 2;

    for (const card of hand) {
      const rarityColor = parseInt((RARITY_COLORS[card.rarity] || '#888888').slice(1), 16);
      const isMyTurn = canPlay;

      // Background
      const bg = this.add.graphics().setDepth(6);
      const bgCol = isWhite ? 0x1e1c10 : 0x10101e;
      bg.fillStyle(bgCol, 0.95);
      bg.fillRoundedRect(cx - CARD_W / 2, centerY - CARD_H / 2, CARD_W, CARD_H, 5);
      bg.lineStyle(1.5, rarityColor, isMyTurn ? 0.9 : 0.35);
      bg.strokeRoundedRect(cx - CARD_W / 2, centerY - CARD_H / 2, CARD_W, CARD_H, 5);

      // Icon
      const icon = this.add.text(cx, centerY - 16, cardIcon(card), {
        fontSize: '18px', fontFamily: 'Segoe UI Emoji, sans-serif',
      }).setOrigin(0.5).setDepth(7).setAlpha(isMyTurn ? 1 : 0.45);

      // Name
      const name = this.add.text(cx, centerY + 4, card.name, {
        fontSize: '8px', fontFamily: 'Segoe UI, sans-serif',
        color: isMyTurn ? '#ddd' : '#555',
        wordWrap: { width: CARD_W - 6 }, align: 'center',
      }).setOrigin(0.5).setDepth(7);

      // Rarity dot
      const rDot = this.add.graphics().setDepth(7);
      rDot.fillStyle(rarityColor, isMyTurn ? 0.8 : 0.2);
      rDot.fillCircle(cx, centerY + CARD_H / 2 - 8, 3);

      container.add([bg, icon, name, rDot]);

      // Click zone (only if it's your turn)
      if (isMyTurn) {
        const hz = this.add.zone(cx, centerY, CARD_W, CARD_H).setInteractive({ useHandCursor: true }).setDepth(8);
        hz.on('pointerover', () => { bg.clear(); bg.fillStyle(bgCol + 0x111111, 0.95); bg.fillRoundedRect(cx - CARD_W / 2, centerY - CARD_H / 2, CARD_W, CARD_H, 5); bg.lineStyle(2, rarityColor, 1); bg.strokeRoundedRect(cx - CARD_W / 2, centerY - CARD_H / 2, CARD_W, CARD_H, 5); });
        hz.on('pointerout',  () => { bg.clear(); bg.fillStyle(bgCol, 0.95); bg.fillRoundedRect(cx - CARD_W / 2, centerY - CARD_H / 2, CARD_W, CARD_H, 5); bg.lineStyle(1.5, rarityColor, 0.9); bg.strokeRoundedRect(cx - CARD_W / 2, centerY - CARD_H / 2, CARD_W, CARD_H, 5); });
        hz.on('pointerdown', () => this._onCardClicked(card, isWhite));
        container.add(hz);
      }

      cx += CARD_W + gap;
    }
  }

  _onCardClicked(card, isWhite) {
    const result = this.gs.playCard(card.id, isWhite);
    if (result) {
      this._refreshCardHands();
      window.dispatchEvent(new CustomEvent('gsUpdate', { detail: this.gs }));
    }
  }

  // ── Gear Overlays ──────────────────────────────────────────────────────────
  _buildGearOverlays() {
    this.gearContainer = this.add.container(0, 0).setDepth(9);
    this._refreshGearOverlays();
  }

  _refreshGearOverlays() {
    this.gearContainer.removeAll(true);
    if (!this.gs.pieceWeapons || !this.gs.pieceShields) return;

    for (const [key, gear] of this.gs.pieceWeapons.entries()) {
      const [col, row] = key.split(',').map(Number);
      const { x, y } = this._squareCenter(col, row);
      const def = WEAPONS[gear.id] || {};
      const t = this.add.text(x + this.SQUARE * 0.3, y - this.SQUARE * 0.3, def.icon || '⚔️', {
        fontSize: '11px', fontFamily: 'Segoe UI Emoji, sans-serif',
      }).setOrigin(0.5).setDepth(10);
      this.gearContainer.add(t);
    }

    for (const [key, gear] of this.gs.pieceShields.entries()) {
      const [col, row] = key.split(',').map(Number);
      const { x, y } = this._squareCenter(col, row);
      const def = SHIELDS[gear.id] || {};
      const t = this.add.text(x - this.SQUARE * 0.3, y - this.SQUARE * 0.3, def.icon || '🛡️', {
        fontSize: '11px', fontFamily: 'Segoe UI Emoji, sans-serif',
      }).setOrigin(0.5).setDepth(10);
      this.gearContainer.add(t);
    }
  }

  // ── Context Menu (right-click) ─────────────────────────────────────────────
  _buildContextMenu() {
    this._ctxOpen    = false;
    this._ctxCol     = -1;
    this._ctxRow     = -1;
    this._ctxPage    = 'main';
    this._ctxPiece   = null;
    this._ctxScreenX = 0;
    this._ctxScreenY = 0;

    this.ctxContainer = this.add.container(0, 0).setDepth(50).setVisible(false);
  }

  _openContextMenuAt(col, row, screenX, screenY) {
    const piece = getPiece(this.gs.board, col, row);
    if (!piece || piece === ' ') { this._closeContextMenu(); return; }

    this._ctxCol   = col;
    this._ctxRow   = row;
    this._ctxPiece = piece;
    this._ctxPage  = 'main';
    this._drawContextMenu(screenX, screenY);
  }

  _drawContextMenu(screenX, screenY) {
    const { width: W, height: H } = this.cameras.main;
    this.ctxContainer.removeAll(true);

    const col    = this._ctxCol;
    const row    = this._ctxRow;
    const piece  = this._ctxPiece;
    const isWh   = isWhitePiece(piece);
    const gold   = isWh ? this.gs.whiteGold  : this.gs.blackGold;
    const chaos  = isWh ? this.gs.whiteChaos : this.gs.blackChaos;
    const ult    = getUltimate(piece);

    const items = [];
    if (this._ctxPage === 'main') {
      if (ult) {
        const canUlt = chaos >= ult.chaosCost;
        items.push({ label: `${ult.icon} ${ult.name}`, sub: `${ult.chaosCost}⚡  chaos needed`, action: 'ultimate', enabled: canUlt });
      }
      items.push({ label: '⚔️  Equip Weapon', sub: `Gold: ${gold}g`, action: 'goto_weapon', enabled: true });
      items.push({ label: '🛡️  Equip Shield', sub: `Gold: ${gold}g`, action: 'goto_shield', enabled: true });
      // Show current gear
      const curW = this.gs.getWeaponAt(col, row);
      const curS = this.gs.getShieldAt(col, row);
      if (curW) { const d = WEAPONS[curW.id] || {}; items.push({ label: `  ${d.icon || '⚔️'} ${d.name || curW.id} (${curW.uses} uses)`, sub: 'Weapon equipped', action: null, enabled: false }); }
      if (curS) { const d = SHIELDS[curS.id] || {}; items.push({ label: `  ${d.icon || '🛡️'} ${d.name || curS.id} (${curS.uses} uses)`, sub: 'Shield equipped', action: null, enabled: false }); }
    } else if (this._ctxPage === 'weapon') {
      items.push({ label: '← Back', sub: '', action: 'back', enabled: true });
      for (const w of WEAPON_LIST) {
        items.push({ label: `${w.icon} ${w.name}`, sub: `${w.cost}g — ${w.desc}`, action: `equip_weapon_${w.id}`, enabled: gold >= w.cost });
      }
    } else if (this._ctxPage === 'shield') {
      items.push({ label: '← Back', sub: '', action: 'back', enabled: true });
      for (const s of SHIELD_LIST) {
        items.push({ label: `${s.icon} ${s.name}`, sub: `${s.cost}g — ${s.desc}`, action: `equip_shield_${s.id}`, enabled: gold >= s.cost });
      }
    }

    const MENU_W = 218;
    const ITEM_H = 44;
    const MENU_H = items.length * ITEM_H + 10;

    let mx = Math.min(screenX + 4, W - MENU_W - 8);
    let my = Math.min(screenY,     H - MENU_H - 8);

    // BG
    const bgG = this.add.graphics();
    bgG.fillStyle(0x15121e, 0.97);
    bgG.fillRoundedRect(mx, my, MENU_W, MENU_H, 8);
    bgG.lineStyle(1.5, 0x6644aa);
    bgG.strokeRoundedRect(mx, my, MENU_W, MENU_H, 8);
    this.ctxContainer.add(bgG);

    items.forEach((item, i) => {
      const iy = my + 5 + i * ITEM_H;
      const rowBg = this.add.graphics();
      rowBg.fillStyle(0x2a1a50, 0);
      rowBg.fillRoundedRect(mx + 4, iy + 1, MENU_W - 8, ITEM_H - 2, 4);

      const labelColor = item.enabled ? '#eeeeee' : '#555555';
      const subColor   = item.enabled ? '#9977bb' : '#444444';

      const lbl = this.add.text(mx + 12, iy + 7, item.label, {
        fontSize: '13px', fontFamily: 'Segoe UI Emoji, Segoe UI, sans-serif', color: labelColor,
      }).setDepth(51);
      const sub = this.add.text(mx + 12, iy + 26, item.sub, {
        fontSize: '9px', fontFamily: 'Segoe UI, sans-serif', color: subColor,
      }).setDepth(51);

      this.ctxContainer.add([rowBg, lbl, sub]);

      if (item.enabled && item.action) {
        const hz = this.add.zone(mx + MENU_W / 2, iy + ITEM_H / 2, MENU_W - 8, ITEM_H).setInteractive({ useHandCursor: true }).setDepth(52);
        hz.on('pointerover', () => { rowBg.clear(); rowBg.fillStyle(0x3a1a60, 0.85); rowBg.fillRoundedRect(mx + 4, iy + 1, MENU_W - 8, ITEM_H - 2, 4); });
        hz.on('pointerout',  () => { rowBg.clear(); rowBg.fillStyle(0x2a1a50, 0); rowBg.fillRoundedRect(mx + 4, iy + 1, MENU_W - 8, ITEM_H - 2, 4); });
        hz.on('pointerdown', () => this._handleCtxAction(item.action));
        this.ctxContainer.add(hz);
      }
    });

    this.ctxContainer.setVisible(true);
    this._ctxOpen    = true;
    this._ctxScreenX = screenX;
    this._ctxScreenY = screenY;
  }

  _closeContextMenu() {
    this.ctxContainer.setVisible(false);
    this._ctxOpen = false;
  }

  _handleCtxAction(action) {
    const col    = this._ctxCol;
    const row    = this._ctxRow;
    const piece  = this._ctxPiece;
    const isWh   = isWhitePiece(piece);

    if (action === 'back') {
      this._ctxPage = 'main';
      this._drawContextMenu(this._ctxScreenX, this._ctxScreenY);
      return;
    }
    if (action === 'goto_weapon') {
      this._ctxPage = 'weapon';
      this._drawContextMenu(this._ctxScreenX, this._ctxScreenY);
      return;
    }
    if (action === 'goto_shield') {
      this._ctxPage = 'shield';
      this._drawContextMenu(this._ctxScreenX, this._ctxScreenY);
      return;
    }
    if (action === 'ultimate') {
      this._closeContextMenu();
      this.gs.useUltimate(col, row);
      return;
    }
    if (action.startsWith('equip_weapon_')) {
      const id = action.slice('equip_weapon_'.length);
      this.gs.equipWeapon(col, row, id, isWh);
      this._closeContextMenu();
      this._refreshGearOverlays();
      window.dispatchEvent(new CustomEvent('gsUpdate', { detail: this.gs }));
      return;
    }
    if (action.startsWith('equip_shield_')) {
      const id = action.slice('equip_shield_'.length);
      this.gs.equipShield(col, row, id, isWh);
      this._closeContextMenu();
      this._refreshGearOverlays();
      window.dispatchEvent(new CustomEvent('gsUpdate', { detail: this.gs }));
      return;
    }
    this._closeContextMenu();
  }

  // ── Highlights ─────────────────────────────────────────────────────────────
  _refreshHighlights({ selected, validMoves }) {
    const g = this.highlightGraphics;
    g.clear();
    if (!selected) return;
    const [sc, sr] = selected;
    g.fillStyle(HIGHLIGHT_SEL, 0.55).fillRect(
      this.BOARD_ORIGIN_X + sc * this.SQUARE, this.BOARD_ORIGIN_Y + sr * this.SQUARE,
      this.SQUARE, this.SQUARE
    );
    for (const key of validMoves) {
      const [tc, tr] = key.split(',').map(Number);
      const { x: mx, y: my } = this._squareCenter(tc, tr);
      const isCapture = getPiece(this.gs.board, tc, tr) !== ' ';
      if (isCapture) {
        g.fillStyle(HIGHLIGHT_CAP, 0.6).fillRect(
          this.BOARD_ORIGIN_X + tc * this.SQUARE, this.BOARD_ORIGIN_Y + tr * this.SQUARE,
          this.SQUARE, this.SQUARE
        );
      } else {
        g.fillStyle(HIGHLIGHT_MOVE, 0.7).fillCircle(mx, my, this.SQUARE * 0.18);
      }
    }
  }

  _refreshHazards() {
    const g = this.hazardGraphics;
    g.clear();
    const hazardColors = {
      fire: 0xff4400, lava: 0xff6600, ice: 0x88ccff, fog: 0x8888aa,
      lightning: 0xffff44, plague: 0x44ff44, curse: 0x8800aa,
    };
    for (const haz of this.gs.chaos.getHazardsArray()) {
      const color = hazardColors[haz.id] || 0xff00ff;
      g.fillStyle(color, 0.28).fillRect(
        this.BOARD_ORIGIN_X + haz.col * this.SQUARE, this.BOARD_ORIGIN_Y + haz.row * this.SQUARE,
        this.SQUARE, this.SQUARE
      );
    }
  }

  // ── Board refresh ──────────────────────────────────────────────────────────
  _refreshBoard() {
    for (const sprite of Object.values(this.pieceSprites)) sprite.destroy();
    this.pieceSprites = {};
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = getPiece(this.gs.board, c, r);
        if (p !== ' ') this._createPieceSprite(p, c, r);
      }
    }
    this._refreshHazards();
    this._refreshGearOverlays();
    window.dispatchEvent(new CustomEvent('gsUpdate', { detail: this.gs }));
  }

  // ── Move animation ─────────────────────────────────────────────────────────
  _animateMove({ fromCol, fromRow, toCol, toRow, piece, captureInfo, promoteTo }) {
    const fromKey = `${fromCol},${fromRow}`;
    const toKey   = `${toCol},${toRow}`;
    const sprite  = this.pieceSprites[fromKey];
    if (!sprite) { this._refreshBoard(); return; }

    this._moveAnimating = true;

    if (captureInfo) {
      const capSprite = this.pieceSprites[toKey];
      if (capSprite) {
        this.tweens.add({ targets: capSprite, scaleX: 0, scaleY: 0, alpha: 0, duration: 120, ease: 'Back.in', onComplete: () => capSprite.destroy() });
        delete this.pieceSprites[toKey];
        this._spawnCaptureParticles(toCol, toRow);
      }
    }

    const { x: tx, y: ty } = this._squareCenter(toCol, toRow);
    delete this.pieceSprites[fromKey];

    this.tweens.add({
      targets: sprite, x: tx, y: ty, duration: 200, ease: 'Power2.easeInOut',
      onUpdate: (tween) => {
        const arc = Math.sin(tween.progress * Math.PI) * 0.12;
        sprite.setScale((this.SQUARE * 0.86 / sprite.width) * (1 + arc));
      },
      onComplete: () => {
        sprite.setScale(this.SQUARE * 0.86 / sprite.width);
        if (promoteTo) { sprite.setTexture(`piece_${promoteTo}`); this._spawnPromoteParticles(toCol, toRow); }
        this.pieceSprites[toKey] = sprite;
        this._moveAnimating = false;
        this._refreshBoard();
      },
    });
  }

  // ── Ultimate Animations ────────────────────────────────────────────────────
  _animateUltimate({ col, row, ult, result }) {
    const { x: ox, y: oy } = this._squareCenter(col, row);
    const type  = ult?.animType || 'nova';
    const color = ult?.color    || 0xaa00ff;

    // Flash the casting piece
    const caster = this.pieceSprites[`${col},${row}`];
    if (caster) {
      this.tweens.add({ targets: caster, scaleX: 1.45, scaleY: 1.45, yoyo: true, duration: 180, ease: 'Power2' });
    }

    // Screen flash
    const { width: W, height: H } = this.cameras.main;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, color, 0).setDepth(20);
    this.tweens.add({ targets: flash, alpha: 0.18, duration: 80, yoyo: true, onComplete: () => flash.destroy() });

    // Banner
    this._showEventBanner(`${ult?.icon || '💥'} ${ult?.name || 'Ultimate'}`, ult?.desc || '', color);

    switch (type) {
      case 'beam_vertical':  this._animBeamVertical(col, row, ox, oy, color);  break;
      case 'multi_burst':    this._animMultiBurst(col, row, ox, oy, color);    break;
      case 'diagonal_beams': this._animDiagonalBeams(col, row, ox, oy, color); break;
      case 'cross_beam':     this._animCrossBeam(ox, oy, color);               break;
      case 'nova':           this._animNova(col, row, ox, oy, color);          break;
      case 'resurrect':      this._animResurrect(result, color);               break;
    }

    // Visual destruction of affected pieces
    this.time.delayedCall(250, () => {
      for (const d of (result?.destroyed || [])) {
        this._spawnCaptureParticles(d.col, d.row);
        const s = this.pieceSprites[`${d.col},${d.row}`];
        if (s) {
          this.tweens.add({ targets: s, alpha: 0, scaleX: 0.1, scaleY: 0.1, duration: 200, onComplete: () => s.destroy() });
          delete this.pieceSprites[`${d.col},${d.row}`];
        }
      }
    });
    for (const sp of (result?.spawned || [])) {
      this.time.delayedCall(450, () => this._spawnPromoteParticles(sp.col, sp.row));
    }
    this.time.delayedCall(650, () => this._refreshBoard());
  }

  _animBeamVertical(col, row, ox, oy, color) {
    const { height: H } = this.cameras.main;
    const beam = this.add.graphics().setDepth(16);
    beam.lineStyle(this.SQUARE * 0.45, color, 0.65);
    beam.lineBetween(ox, 0, ox, H);
    beam.lineStyle(this.SQUARE * 0.7, color, 0.12);
    beam.lineBetween(ox, 0, ox, H);
    this.tweens.add({ targets: beam, alpha: 0, duration: 550, delay: 80, onComplete: () => beam.destroy() });
    this._spawnEventParticles(col, row, color);
  }

  _animMultiBurst(col, row, ox, oy, color) {
    const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dc, dr] of jumps) {
      const nc = col + dc, nr = row + dr;
      if (nc < 0 || nc >= 8 || nr < 0 || nr >= 8) continue;
      const { x: tx, y: ty } = this._squareCenter(nc, nr);
      const beam = this.add.graphics().setDepth(16);
      beam.lineStyle(3, color, 0.9);
      beam.lineBetween(ox, oy, tx, ty);
      this.tweens.add({ targets: beam, alpha: 0, duration: 380, delay: 40, onComplete: () => beam.destroy() });
      const flash = this.add.rectangle(tx, ty, this.SQUARE * 0.9, this.SQUARE * 0.9, color, 0.55).setDepth(15);
      this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 320, onComplete: () => flash.destroy() });
    }
    this._spawnEventParticles(col, row, color);
  }

  _animDiagonalBeams(col, row, ox, oy, color) {
    for (const [dc, dr] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const endC = Math.max(0, Math.min(7, col + dc * 5));
      const endR = Math.max(0, Math.min(7, row + dr * 5));
      const { x: ex, y: ey } = this._squareCenter(endC, endR);
      const beam = this.add.graphics().setDepth(16);
      beam.lineStyle(this.SQUARE * 0.32, color, 0.65);
      beam.lineBetween(ox, oy, ex, ey);
      this.tweens.add({ targets: beam, alpha: 0, duration: 500, delay: 60, onComplete: () => beam.destroy() });
    }
    this._spawnEventParticles(col, row, color);
    this._spawnEventParticles(col, row, 0xffffff);
  }

  _animCrossBeam(ox, oy, color) {
    const { width: W, height: H } = this.cameras.main;
    const g = this.add.graphics().setDepth(16);
    g.lineStyle(this.SQUARE * 0.38, color, 0.72);
    g.lineBetween(0, oy, W, oy);
    g.lineBetween(ox, 0, ox, H);
    this.tweens.add({ targets: g, alpha: 0, duration: 600, delay: 80, onComplete: () => g.destroy() });

    const rowF = this.add.rectangle(W / 2, oy, W, this.SQUARE, color, 0.22).setDepth(15);
    const colF = this.add.rectangle(ox, H / 2, this.SQUARE, H, color, 0.22).setDepth(15);
    this.tweens.add({ targets: [rowF, colF], alpha: 0, duration: 500, onComplete: () => { rowF.destroy(); colF.destroy(); } });
  }

  _animNova(col, row, ox, oy, color) {
    const radius = this.SQUARE * 2.5;
    // Expanding ring
    const ring = this.add.graphics().setDepth(16);
    ring.lineStyle(5, color, 0.9);
    ring.strokeCircle(ox, oy, 8);
    this.tweens.add({ targets: ring, scaleX: radius / 8, scaleY: radius / 8, alpha: 0, duration: 500, ease: 'Power2.out', onComplete: () => ring.destroy() });
    // Fill
    const fill = this.add.graphics().setDepth(15);
    fill.fillStyle(color, 0.22);
    fill.fillCircle(ox, oy, 8);
    this.tweens.add({ targets: fill, scaleX: radius / 8, scaleY: radius / 8, alpha: 0, duration: 500, ease: 'Power2.out', onComplete: () => fill.destroy() });
    this._spawnEventParticles(col, row, color);
    this._spawnEventParticles(col, row, 0xffffff);
  }

  _animResurrect(result, color) {
    for (const sp of (result?.spawned || [])) {
      const { x, y } = this._squareCenter(sp.col, sp.row);
      const aura = this.add.graphics().setDepth(14);
      aura.fillStyle(color, 0.45);
      aura.fillCircle(x, y, this.SQUARE * 0.55);
      this.tweens.add({ targets: aura, alpha: 0, scaleX: 2.2, scaleY: 2.2, duration: 700, ease: 'Power2.out', onComplete: () => aura.destroy() });
    }
  }

  // ── Shield Block Animation ────────────────────────────────────────────────
  _animateShieldBlock(col, row) {
    if (col == null || row == null) return;
    const { x, y } = this._squareCenter(col, row);
    const r = this.SQUARE * 0.52;

    const dome = this.add.graphics().setDepth(17);
    dome.lineStyle(3, 0x44ccff, 0.95);
    dome.strokeCircle(x, y, r);
    dome.fillStyle(0x44ccff, 0.14);
    dome.fillCircle(x, y, r);
    this.tweens.add({ targets: dome, scaleX: 1.35, scaleY: 1.35, alpha: 0, duration: 500, ease: 'Power2.out', onComplete: () => dome.destroy() });

    const ripple = this.add.graphics().setDepth(17);
    ripple.lineStyle(2, 0xffffff, 0.45);
    ripple.strokeCircle(x, y, r);
    this.tweens.add({ targets: ripple, scaleX: 1.9, scaleY: 1.9, alpha: 0, duration: 420, delay: 90, onComplete: () => ripple.destroy() });
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  _spawnCaptureParticles(col, row) {
    const { x, y } = this._squareCenter(col, row);
    const e = this.add.particles(x, y, 'spark', {
      speed: { min: 80, max: 180 }, angle: { min: 0, max: 360 },
      scale: { start: 0.15, end: 0 }, lifespan: 380, quantity: 14,
      tint: [0xff6600, 0xffcc00, 0xffffff], blendMode: 'ADD',
    });
    this.time.delayedCall(400, () => e.destroy());
  }

  _spawnPromoteParticles(col, row) {
    const { x, y } = this._squareCenter(col, row);
    const e = this.add.particles(x, y, 'spark', {
      speed: { min: 60, max: 140 }, angle: { min: 0, max: 360 },
      scale: { start: 0.12, end: 0 }, lifespan: 600, quantity: 20,
      tint: [0xdaaf3e, 0xffffff, 0xffee00], blendMode: 'ADD',
    });
    this.time.delayedCall(650, () => e.destroy());
  }

  _spawnEventParticles(col, row, color) {
    const { x, y } = this._squareCenter(col, row);
    const e = this.add.particles(x, y, 'spark', {
      speed: { min: 40, max: 120 }, angle: { min: 0, max: 360 },
      scale: { start: 0.1, end: 0 }, lifespan: 500, quantity: 10,
      tint: color || 0x8800ff, blendMode: 'ADD',
    });
    this.time.delayedCall(550, () => e.destroy());
  }

  _animateCardEffects(result) {
    for (const d of (result.destroyed  || [])) this._spawnCaptureParticles(d.col, d.row);
    for (const t of (result.teleported || [])) {
      this._spawnEventParticles(t.fromCol, t.fromRow, 0x00aaff);
      this._spawnEventParticles(t.toCol,   t.toRow,   0x00ffff);
    }
    for (const s  of (result.spawned      || [])) this._spawnPromoteParticles(s.col, s.row);
    for (const tr of (result.transformed  || [])) this._spawnPromoteParticles(tr.col, tr.row);
  }

  // ── Check Flash ────────────────────────────────────────────────────────────
  _flashCheck() {
    const king = this.gs.whiteToMove
      ? this.gs.board.flatMap((row, r) => row.map((p, c) => p === 'k' ? [c, r] : null)).find(Boolean)
      : this.gs.board.flatMap((row, r) => row.map((p, c) => p === 'K' ? [c, r] : null)).find(Boolean);
    if (!king) return;
    const [kc, kr] = king;
    const flash = this.add.rectangle(
      this.BOARD_ORIGIN_X + kc * this.SQUARE + this.SQUARE / 2,
      this.BOARD_ORIGIN_Y + kr * this.SQUARE + this.SQUARE / 2,
      this.SQUARE, this.SQUARE, 0xff2020, 0.6
    );
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, yoyo: true, repeat: 2, onComplete: () => flash.destroy() });
  }

  // ── Event Banner ───────────────────────────────────────────────────────────
  _buildEventBanner() {
    const { width: W } = this.cameras.main;
    this.bannerBg    = this.add.rectangle(W / 2, -80, W * 0.75, 70, 0x1a0030, 0.92).setDepth(20);
    this.bannerTitle = this.add.text(W / 2, -88, '', { fontSize: '18px', fontFamily: 'Segoe UI, sans-serif', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21);
    this.bannerDesc  = this.add.text(W / 2, -68, '', { fontSize: '13px', fontFamily: 'Segoe UI, sans-serif', color: '#ccaaff' }).setOrigin(0.5).setDepth(21);
    this.bannerBg.setStrokeStyle(1, 0x9900ff);
  }

  _showEventBanner(title, desc, color = 0xffffff) {
    this.bannerTitle.setText(title).setColor(`#${color.toString(16).padStart(6, '0')}`);
    this.bannerDesc.setText(desc);
    this.tweens.killTweensOf([this.bannerBg, this.bannerTitle, this.bannerDesc]);
    this.tweens.add({
      targets: [this.bannerBg, this.bannerTitle, this.bannerDesc],
      y: (obj) => obj === this.bannerBg ? 60 : obj === this.bannerTitle ? 47 : 70,
      duration: 350, ease: 'Back.out',
    });
    this.time.delayedCall(2800, () => {
      this.tweens.add({ targets: [this.bannerBg, this.bannerTitle, this.bannerDesc], y: -80, duration: 300, ease: 'Power2.in' });
    });
  }

  // ── Promotion Modal ────────────────────────────────────────────────────────
  _buildPromotionModal() {
    const { width: W, height: H } = this.cameras.main;
    this.promoContainer = this.add.container(W / 2, H / 2).setDepth(30).setVisible(false);
    const bg    = this.add.rectangle(0, 0, 380, 160, 0x111118, 0.97).setStrokeStyle(2, 0xdaaf3e);
    const title = this.add.text(0, -55, 'Choose Promotion', { fontSize: '16px', fontFamily: 'Segoe UI, sans-serif', color: '#daaf3e', fontStyle: 'bold' }).setOrigin(0.5);
    this.promoContainer.add([bg, title]);
    this._promoData    = null;
    this._promoButtons = [];

    const pieces = ['q', 'r', 'b', 'n'];
    const labels = ['Queen', 'Rook', 'Bishop', 'Knight'];
    for (let i = 0; i < 4; i++) {
      const bx  = -135 + i * 90;
      const btn = this.add.container(bx, 10);
      const bBg = this.add.rectangle(0, 0, 76, 90, 0x2a2a38).setStrokeStyle(1, 0x555566).setInteractive({ useHandCursor: true });
      const bLbl = this.add.text(0, 32, labels[i], { fontSize: '11px', fontFamily: 'Segoe UI, sans-serif', color: '#aaa' }).setOrigin(0.5);
      const bImg = this.add.image(0, -10, `piece_${pieces[i]}`).setDisplaySize(52, 52);
      btn.add([bBg, bImg, bLbl]);
      bBg.on('pointerover', () => bBg.setFillStyle(0x3a3a50));
      bBg.on('pointerout',  () => bBg.setFillStyle(0x2a2a38));
      bBg.on('pointerdown', () => this._selectPromotion(pieces[i]));
      this.promoContainer.add(btn);
      this._promoButtons.push({ piece: pieces[i], img: bImg });
    }
  }

  _showPromotion({ fromCol, fromRow, toCol, toRow, white }) {
    this._promoData = { fromCol, fromRow, toCol, toRow, white };
    for (const { piece, img } of this._promoButtons) {
      img.setTexture(`piece_${white ? piece : piece.toUpperCase()}`);
    }
    this.promoContainer.setVisible(true);
    this.tweens.add({ targets: this.promoContainer, scaleX: 1, scaleY: 1, alpha: 1, duration: 200, ease: 'Back.out', from: 0 });
  }

  _selectPromotion(piece) {
    if (!this._promoData) return;
    const { fromCol, fromRow, toCol, toRow, white } = this._promoData;
    this.promoContainer.setVisible(false);
    this._promoData = null;
    this.gs.completePromotion(fromCol, fromRow, toCol, toRow, white ? piece : piece.toUpperCase());
  }

  // ── Game Over ──────────────────────────────────────────────────────────────
  _showGameOver({ result, winner }) {
    const { width: W, height: H } = this.cameras.main;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(40);
    this.tweens.add({ targets: overlay, alpha: 0.65, duration: 500 });
    const msg = result === 'checkmate'
      ? `${winner === 'white' ? 'White' : 'Black'} wins by checkmate!`
      : 'Stalemate — draw!';
    this.add.rectangle(W / 2, H / 2, 420, 160, 0x1a1a2e, 0.97).setDepth(41).setStrokeStyle(2, 0xdaaf3e);
    this.add.text(W / 2, H / 2 - 30, 'GAME OVER', { fontSize: '26px', fontFamily: 'Segoe UI, sans-serif', color: '#daaf3e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(42);
    this.add.text(W / 2, H / 2 + 10, msg, { fontSize: '16px', fontFamily: 'Segoe UI, sans-serif', color: '#eee' }).setOrigin(0.5).setDepth(42);
    const btn = this.add.text(W / 2, H / 2 + 52, 'Play Again', { fontSize: '15px', fontFamily: 'Segoe UI, sans-serif', color: '#daaf3e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout',  () => btn.setStyle({ color: '#daaf3e' }));
    btn.on('pointerdown', () => { this.cameras.main.fadeOut(400, 0, 0, 0); this.time.delayedCall(420, () => this.scene.restart()); });
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  _onPointerDown(pointer) {
    if (this.gs.gameOver) return;
    if (this.promoContainer.visible) return;

    const col = Math.floor((pointer.x - this.BOARD_ORIGIN_X) / this.SQUARE);
    const row = Math.floor((pointer.y - this.BOARD_ORIGIN_Y) / this.SQUARE);
    const onBoard = col >= 0 && col < 8 && row >= 0 && row < 8;

    // Right click → context menu
    if (pointer.rightButtonDown()) {
      if (onBoard) this._openContextMenuAt(col, row, pointer.x, pointer.y);
      else this._closeContextMenu();
      return;
    }

    // Left click → close any open menu first
    if (this._ctxOpen) {
      this._closeContextMenu();
      return;
    }

    // Normal board click
    if (pointer.leftButtonDown() && onBoard) {
      this.gs.onSquareClicked(col, row);
    }
  }
}

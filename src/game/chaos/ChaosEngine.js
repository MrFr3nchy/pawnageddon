// Chaos Engine — coordinates all chaos subsystems
import { applyEffects } from './effects.js';
import CARDS_DATA from './content/cards_data.js';
import EVENTS_DATA from './content/events_data.js';

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) { r -= (item.weight || 1); if (r <= 0) return item; }
  return items[items.length - 1];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Phase config: unlocks when turn >= minTurn OR chaos >= minChaos OR pieces <= maxPieces
const PHASE_TRIGGERS = {
  1: { minTurn: 0,  minChaos: 0,  maxPieces: 32 },
  2: { minTurn: 8,  minChaos: 15, maxPieces: 28 },
  3: { minTurn: 18, minChaos: 35, maxPieces: 22 },
  4: { minTurn: 30, minChaos: 55, maxPieces: 16 },
  5: { minTurn: 45, minChaos: 80, maxPieces: 10 },
};

const PHASE_NAMES = { 1: 'Opening', 2: 'Strange Happenings', 3: 'Board Instability', 4: 'Tactical Mayhem', 5: 'Pawnageddon' };

export class ChaosEngine {
  constructor() {
    this.phase = 1;
    this.phaseName = PHASE_NAMES[1];
    this.turnLog = [];

    // Card deck & hands
    this._buildDeck();
    this.whiteHand = [];
    this.blackHand = [];
    this.maxHandSize = 7;

    // Mutations & hazards (per-square state)
    this.mutations = new Map();  // key: `${c},${r}` → {type, duration, ...}
    this.hazards   = new Map();  // key: `${c},${r}` → {id, duration}

    // Event cooldowns
    this.eventCooldowns = new Map(); // eventId → turnsRemaining
    this.lastEventTurn  = -99;
  }

  // ── Phase management ──
  updatePhase(turn, chaosPct, piecesRemaining) {
    let newPhase = 1;
    for (let p = 5; p >= 1; p--) {
      const t = PHASE_TRIGGERS[p];
      if (turn >= t.minTurn || chaosPct >= t.minChaos || piecesRemaining <= t.maxPieces) { newPhase = p; break; }
    }
    const phaseUp = newPhase > this.phase;
    this.phase = newPhase;
    this.phaseName = PHASE_NAMES[newPhase];
    return phaseUp;
  }

  // ── Card deck ──
  _buildDeck() {
    const pool = CARDS_DATA.filter(c => c.phase <= 3);  // start with early-phase cards
    this.deck = shuffle([...pool, ...pool, ...pool]).slice(0, 40); // 40-card deck
    this.deckIndex = 0;
  }

  drawCard(playerWhite) {
    if (this.deckIndex >= this.deck.length) this._buildDeck();
    const hand = playerWhite ? this.whiteHand : this.blackHand;
    if (hand.length >= this.maxHandSize) return null;
    const card = this.deck[this.deckIndex++];
    hand.push({ ...card });
    return card;
  }

  playCard(cardId, board, playerWhite, chosenSquare = null, chosenPiece = null) {
    const hand = playerWhite ? this.whiteHand : this.blackHand;
    const idx = hand.findIndex(c => c.id === cardId);
    if (idx === -1) return null;
    const card = hand.splice(idx, 1)[0];
    const result = applyEffects(card.effects || [], board, playerWhite, chosenSquare, chosenPiece);
    // Apply mutations from result
    for (const m of result.mutationsApplied) this.mutations.set(`${m.col},${m.row}`, m);
    // Apply hazards from result
    for (const h of result.hazardsPlaced) this.hazards.set(`${h.col},${h.row}`, h);
    this.turnLog = [`Card: ${card.name}`, ...result.messages];
    return { card, result };
  }

  // ── Turn processing ──
  onTurnStart(turn, chaosPct, piecesRemaining, board, whiteToMove) {
    this.turnLog = [];
    const events = [];

    // Phase update
    const phaseUp = this.updatePhase(turn, chaosPct, piecesRemaining);
    if (phaseUp) {
      this.turnLog.push(`⚡ Phase ${this.phase}: ${this.phaseName}!`);
      events.push({ type: 'phaseUp', phase: this.phase, name: this.phaseName });
    }

    // Tick mutation durations
    for (const [key, mut] of this.mutations) {
      mut.duration--;
      if (mut.duration <= 0) this.mutations.delete(key);
    }

    // Tick hazard durations
    for (const [key, haz] of this.hazards) {
      haz.duration--;
      if (haz.duration <= 0) this.hazards.delete(key);
    }

    // Tick event cooldowns
    for (const [id, cd] of this.eventCooldowns) {
      this.eventCooldowns.set(id, cd - 1);
      if (cd - 1 <= 0) this.eventCooldowns.delete(id);
    }

    // Random event check (phase 2+, every 3 turns)
    if (this.phase >= 2 && turn > 0 && turn % 3 === 0 && turn !== this.lastEventTurn) {
      const baseChance = 0.20 + (this.phase - 1) * 0.10;
      if (Math.random() < baseChance) {
        const ev = this._pickEvent();
        if (ev) {
          const result = applyEffects(ev.effects || [], board, whiteToMove);
          for (const m of result.mutationsApplied) this.mutations.set(`${m.col},${m.row}`, m);
          for (const h of result.hazardsPlaced) this.hazards.set(`${h.col},${h.row}`, h);
          this.lastEventTurn = turn;
          this.eventCooldowns.set(ev.id, ev.cooldown || 4);
          this.turnLog.push(`🌪 ${ev.name}: ${ev.desc}`);
          events.push({ type: 'chaosEvent', event: ev, result });
        }
      }
    }

    return events;
  }

  _pickEvent() {
    const available = EVENTS_DATA.filter(e => {
      const cd = this.eventCooldowns.get(e.id) || 0;
      return e.phase <= this.phase && cd <= 0;
    });
    return available.length ? weightedRandom(available) : null;
  }

  // ── Mutations ──
  isFrozen(col, row) {
    const m = this.mutations.get(`${col},${row}`);
    return m?.type === 'freeze';
  }

  isShielded(col, row) {
    const m = this.mutations.get(`${col},${row}`);
    return m?.type === 'shield';
  }

  onPieceMove(fromC, fromR, toC, toR) {
    const key = `${fromC},${fromR}`;
    if (this.mutations.has(key)) {
      const m = this.mutations.get(key);
      this.mutations.delete(key);
      this.mutations.set(`${toC},${toR}`, m);
    }
  }

  onPieceCaptured(col, row) {
    this.mutations.delete(`${col},${row}`);
    this.hazards.delete(`${col},${row}`);
  }

  checkHazardOnMove(col, row, board, playerWhite) {
    const haz = this.hazards.get(`${col},${row}`);
    if (!haz) return null;
    if (haz.id === 'fire' || haz.id === 'lava') {
      const result = applyEffects([{ type: 'destroy', target: 'chosen_piece' }], board, playerWhite, null, [col, row]);
      result.messages.unshift(`🔥 ${haz.id.toUpperCase()} hazard triggered!`);
      return result;
    }
    return null;
  }

  getMutationAt(col, row) { return this.mutations.get(`${col},${row}`) || null; }
  getHazardAt(col, row)   { return this.hazards.get(`${col},${row}`) || null; }
  getHazardsArray() { return [...this.hazards.entries()].map(([k, v]) => { const [c, r] = k.split(',').map(Number); return { ...v, col: c, row: r }; }); }
}

"""ChaosEngine: central coordinator that ties all chaos systems together."""

from __future__ import annotations
import random
from .config import ChaosConfig
from .registry import ChaosRegistry, ChaosElement
from .phases import PhaseManager
from .cards import Deck, Hand
from .events import EventManager
from .shop import Shop
from .minigames import MinigameManager
from .hazards import HazardManager
from .mutations import MutationManager
from .effects import apply_effects, EffectResult


def _load_all_content(registry: ChaosRegistry):
    """Register all content from data files."""
    from .content.cards_data import CARDS
    from .content.events_data import EVENTS
    from .content.items_data import ITEMS
    from .content.minigames_data import MINIGAMES
    from .content.hazards_data import HAZARDS
    from .content.mutations_data import MUTATIONS

    registry.register_batch(CARDS, "card")
    registry.register_batch(EVENTS, "event")
    registry.register_batch(ITEMS, "item")
    registry.register_batch(MINIGAMES, "minigame")
    registry.register_batch(HAZARDS, "hazard")
    registry.register_batch(MUTATIONS, "mutation")


class ChaosEngine:
    """Main interface between the game and all chaos systems.

    Usage:
        engine = ChaosEngine()
        # Each turn:
        events = engine.on_turn_start(turn, chaos_pct, pieces_remaining, board, white_to_move)
        # Player draws card:
        cards = engine.draw_card(player_white)
        # Player plays card:
        result = engine.play_card(card_id, board, player_white)
    """

    def __init__(self, config: ChaosConfig | None = None):
        self.config = config or ChaosConfig()
        self.registry = ChaosRegistry()

        self.phases = PhaseManager(self.config)
        self.deck = Deck(self.registry, self.config)
        self.events = EventManager(self.registry, self.config)
        self.shop = Shop(self.registry, self.config)
        self.minigames = MinigameManager(self.registry, self.config)
        self.hazards = HazardManager(self.config)
        self.mutations = MutationManager(self.config)

        self.white_hand = Hand(self.config.max_hand_size)
        self.black_hand = Hand(self.config.max_hand_size)

        self.turn_log: list[str] = []  # messages for UI to display

        _load_all_content(self.registry)

    # ── Per-turn lifecycle ──

    def on_turn_start(self, turn: int, chaos_pct: float, pieces_remaining: int,
                      board, player_white: bool) -> list[EffectResult]:
        """Called at the start of each turn. Returns list of event results to display."""
        self.turn_log.clear()

        # Update phase
        old_phase = self.phases.current_phase
        new_phase = self.phases.update(turn, chaos_pct, pieces_remaining)
        if new_phase > old_phase:
            self.turn_log.append(f"Phase {new_phase}: {self.phases.phase_name}!")

        # Tick durations
        self.deck.tick_cooldowns()
        self.events.tick_cooldowns()
        self.events.tick_active()
        self.hazards.tick()
        self.mutations.tick()

        # Restock shop if needed
        if turn >= self.config.shop_unlock_turn and self.shop.should_restock(turn):
            self.shop.restock(new_phase, turn)

        # Auto-draw is now handled by GameState.start_turn() / draw_card()
        # so the player gets exactly 1 free draw per turn (paid extras via gold)

        # Check for random events
        event_results = []
        triggered = self.events.check_triggers(turn, new_phase, chaos_pct)
        for event in triggered:
            self.turn_log.append(f"EVENT: {event.name} — {event.description}")
            result = apply_effects(event.effects, board, player_white)
            event_results.append(result)
            # Apply hazards from event effects
            for h in result.hazards_placed:
                self.hazards.place(h["id"], h["col"], h["row"], h.get("duration", 5))
            for m in result.mutations_applied:
                self.mutations.apply(m["type"], m["col"], m["row"], m.get("duration", 4))

        return event_results

    # ── Card actions ──

    def draw_card(self, player_white: bool) -> list[ChaosElement]:
        """Manually draw a card (e.g. from deck click)."""
        hand = self.white_hand if player_white else self.black_hand
        if hand.is_full:
            return []
        phase = self.phases.current_phase
        drawn = self.deck.draw(phase, 1)
        hand.add(drawn)
        for c in drawn:
            self.turn_log.append(f"Drew: {c.name}")
        return drawn

    def play_card(self, card_id: str, board, player_white: bool,
                  chosen_square=None, chosen_piece=None) -> EffectResult | None:
        """Play a card from hand. Returns effect result or None if invalid."""
        hand = self.white_hand if player_white else self.black_hand
        card = hand.remove(card_id)
        if card is None:
            return None

        self.turn_log.append(f"Played: {card.name}")
        result = apply_effects(card.effects, board, player_white, chosen_square, chosen_piece)

        for h in result.hazards_placed:
            self.hazards.place(h["id"], h["col"], h["row"], h.get("duration", 5))
        for m in result.mutations_applied:
            self.mutations.apply(m["type"], m["col"], m["row"], m.get("duration", 4))

        return result

    def get_hand(self, player_white: bool) -> Hand:
        return self.white_hand if player_white else self.black_hand

    # ── Shop actions ──

    def get_shop_stock(self) -> list[ChaosElement]:
        return self.shop.current_stock

    def buy_item(self, item_id: str, player_gold: int) -> tuple[ChaosElement | None, int]:
        return self.shop.buy(item_id, player_gold, self.phases.current_phase)

    # ── Hazard checks ──

    def check_hazard_on_move(self, col: int, row: int, board, player_white: bool) -> EffectResult | None:
        """Check if a piece stepped on a hazard. Returns effect result or None."""
        hazards_here = self.hazards.get_at(col, row)
        if not hazards_here:
            return None
        all_effects = []
        for h in hazards_here:
            element = self.registry.get(h.id)
            if element:
                all_effects.extend(element.effects)
                self.turn_log.append(f"Hazard triggered: {element.name}")
        if all_effects:
            return apply_effects(all_effects, board, player_white,
                                 chosen_square=(col, row), chosen_piece=(col, row))
        return None

    # ── Mutation checks ──

    def is_frozen(self, col: int, row: int) -> bool:
        return self.mutations.is_frozen(col, row)

    def is_shielded(self, col: int, row: int) -> bool:
        return self.mutations.is_shielded(col, row)

    def on_piece_move(self, from_c: int, from_r: int, to_c: int, to_r: int):
        """Update mutations when a piece moves."""
        self.mutations.move_piece(from_c, from_r, to_c, to_r)

    def on_piece_captured(self, col: int, row: int):
        """Clean up mutations/hazards on capture."""
        self.mutations.remove_at(col, row)

    # ── Info ──

    @property
    def phase(self) -> int:
        return self.phases.current_phase

    @property
    def phase_name(self) -> str:
        return self.phases.phase_name

    def content_stats(self) -> dict:
        return {
            "cards": self.registry.count("card"),
            "events": self.registry.count("event"),
            "items": self.registry.count("item"),
            "minigames": self.registry.count("minigame"),
            "hazards": self.registry.count("hazard"),
            "mutations": self.registry.count("mutation"),
            "total": self.registry.count(),
        }

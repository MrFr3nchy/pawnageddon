"""Card and deck system: draw from registry, manage hands, play cards."""

from __future__ import annotations
import random
from .registry import ChaosRegistry, ChaosElement
from .config import ChaosConfig


class Deck:
    """Draws cards from the registry pool, filtered by current phase and weighted by rarity."""

    def __init__(self, registry: ChaosRegistry, config: ChaosConfig):
        self.registry = registry
        self.config = config
        self._cooldowns: dict[str, int] = {}  # card_id -> turns remaining

    def draw(self, current_phase: int, count: int = 1) -> list[ChaosElement]:
        """Draw `count` cards available at the current phase."""
        pool = self.registry.by_phase("card", current_phase)
        pool = [c for c in pool if self._cooldowns.get(c.id, 0) <= 0]
        if not pool:
            return []

        rarity_w = self.config.rarity_weights
        weights = [c.weight * rarity_w.get(c.rarity, 10) for c in pool]
        drawn = []
        for _ in range(count):
            if not pool:
                break
            picks = random.choices(pool, weights=weights, k=1)
            card = picks[0]
            drawn.append(card)
            if card.cooldown > 0:
                self._cooldowns[card.id] = card.cooldown
        return drawn

    def tick_cooldowns(self):
        """Call once per turn to decrement cooldowns."""
        expired = []
        for cid in self._cooldowns:
            self._cooldowns[cid] -= 1
            if self._cooldowns[cid] <= 0:
                expired.append(cid)
        for cid in expired:
            del self._cooldowns[cid]


class Hand:
    """A player's hand of cards."""

    def __init__(self, max_size: int = 7):
        self.cards: list[ChaosElement] = []
        self.max_size = max_size

    def add(self, cards: list[ChaosElement]):
        for card in cards:
            if len(self.cards) < self.max_size:
                self.cards.append(card)

    def remove(self, card_id: str) -> ChaosElement | None:
        for i, c in enumerate(self.cards):
            if c.id == card_id:
                return self.cards.pop(i)
        return None

    def has(self, card_id: str) -> bool:
        return any(c.id == card_id for c in self.cards)

    @property
    def count(self) -> int:
        return len(self.cards)

    @property
    def is_full(self) -> bool:
        return len(self.cards) >= self.max_size

    def card_ids(self) -> list[str]:
        return [c.id for c in self.cards]

"""Enhanced shop system: items from the registry, restocking, phase-gated."""

from __future__ import annotations
import random
from .registry import ChaosRegistry, ChaosElement
from .config import ChaosConfig


class Shop:
    """Manages the item shop: stocking, purchasing, restocking."""

    def __init__(self, registry: ChaosRegistry, config: ChaosConfig):
        self.registry = registry
        self.config = config
        self.current_stock: list[ChaosElement] = []
        self._last_restock_turn = 0

    def restock(self, phase: int, turn: int):
        """Fill shop slots with items available at current phase."""
        pool = self.registry.by_phase("item", phase)
        if not pool:
            self.current_stock = []
            return

        rarity_w = self.config.rarity_weights
        weights = [e.weight * rarity_w.get(e.rarity, 10) for e in pool]
        count = min(self.config.shop_slots, len(pool))
        self.current_stock = random.choices(pool, weights=weights, k=count)
        # Deduplicate
        seen = set()
        unique = []
        for item in self.current_stock:
            if item.id not in seen:
                seen.add(item.id)
                unique.append(item)
        self.current_stock = unique
        self._last_restock_turn = turn

    def should_restock(self, turn: int) -> bool:
        return (turn - self._last_restock_turn) >= self.config.shop_restock_interval

    def get_cost(self, item: ChaosElement, phase: int) -> int:
        base = item.meta.get("cost", 5)
        return max(1, int(base * self.config.item_cost_scaling))

    def buy(self, item_id: str, player_gold: int, phase: int) -> tuple[ChaosElement | None, int]:
        """Attempt purchase. Returns (item, cost) or (None, 0) if failed."""
        for item in self.current_stock:
            if item.id == item_id:
                cost = self.get_cost(item, phase)
                if player_gold >= cost:
                    self.current_stock.remove(item)
                    return item, cost
                return None, 0
        return None, 0

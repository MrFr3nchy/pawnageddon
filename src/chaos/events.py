"""Global chaos event manager: triggers events based on turn, chaos, phase."""

from __future__ import annotations
import random
from .registry import ChaosRegistry, ChaosElement
from .config import ChaosConfig


class EventManager:
    """Checks and fires chaos events each turn."""

    def __init__(self, registry: ChaosRegistry, config: ChaosConfig):
        self.registry = registry
        self.config = config
        self.active_events: list[ActiveEvent] = []
        self._cooldowns: dict[str, int] = {}
        self._last_check_turn = 0

    def check_triggers(self, turn: int, phase: int, chaos_pct: float) -> list[ChaosElement]:
        """Called each turn. Returns list of events that should fire now."""
        interval = self.config.event_check_interval
        if turn - self._last_check_turn < interval:
            return []
        self._last_check_turn = turn

        chance = self.config.event_base_chance + phase * self.config.event_chance_per_phase
        if random.random() > chance:
            return []

        pool = self.registry.by_phase("event", phase)
        pool = [e for e in pool if self._cooldowns.get(e.id, 0) <= 0]
        if not pool:
            return []

        rarity_w = self.config.rarity_weights
        weights = [e.weight * rarity_w.get(e.rarity, 10) for e in pool]
        count = min(1 + phase // 3, self.config.max_concurrent_events)
        chosen = []
        for _ in range(count):
            if not pool:
                break
            pick = random.choices(pool, weights=weights, k=1)[0]
            chosen.append(pick)
            if pick.cooldown > 0:
                self._cooldowns[pick.id] = pick.cooldown
            idx = pool.index(pick)
            pool.pop(idx)
            weights.pop(idx)

        return chosen

    def tick_cooldowns(self):
        expired = [k for k, v in self._cooldowns.items() if v <= 1]
        for k in self._cooldowns:
            self._cooldowns[k] -= 1
        for k in expired:
            del self._cooldowns[k]

    def tick_active(self):
        """Tick duration of active (persistent) events."""
        still_active = []
        for ae in self.active_events:
            ae.remaining -= 1
            if ae.remaining > 0:
                still_active.append(ae)
        self.active_events = still_active

    def add_active(self, element: ChaosElement, duration: int):
        self.active_events.append(ActiveEvent(element, duration))


class ActiveEvent:
    """An event with ongoing duration."""
    def __init__(self, element: ChaosElement, duration: int):
        self.element = element
        self.remaining = duration

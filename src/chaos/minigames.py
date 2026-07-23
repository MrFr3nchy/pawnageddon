"""Minigame framework: quick challenges that return success/partial/fail outcomes."""

from __future__ import annotations
import random
from .registry import ChaosElement
from .config import ChaosConfig


class MinigameOutcome:
    SUCCESS = "success"
    PARTIAL = "partial"
    FAIL = "fail"


class MinigameInstance:
    """A running minigame. The UI layer drives the actual gameplay; this tracks state."""

    def __init__(self, element: ChaosElement, config: ChaosConfig):
        self.element = element
        self.config = config
        self.minigame_type = element.meta.get("type", "reaction")
        self.difficulty = element.meta.get("difficulty", 1)
        self.time_limit = element.meta.get("time_limit", 5.0)
        self.outcome: str | None = None

    def complete(self, outcome: str) -> dict:
        """Finalize with an outcome. Returns reward dict."""
        self.outcome = outcome
        rewards = {"gold": 0, "cards": 0, "chaos": 0, "effects": []}

        if outcome == MinigameOutcome.SUCCESS:
            rewards["gold"] = self.config.minigame_reward_gold_success
            rewards["cards"] = self.config.minigame_reward_cards_success
            rewards["effects"] = self.element.meta.get("success_effects", [])
        elif outcome == MinigameOutcome.PARTIAL:
            rewards["gold"] = self.config.minigame_reward_gold_partial
            rewards["effects"] = self.element.meta.get("partial_effects", [])
        else:
            rewards["gold"] = self.config.minigame_reward_gold_fail
            rewards["effects"] = self.element.meta.get("fail_effects", [])

        return rewards


class MinigameManager:
    """Manages minigame triggering and lifecycle."""

    def __init__(self, registry, config: ChaosConfig):
        self.registry = registry
        self.config = config
        self.active: MinigameInstance | None = None

    def should_trigger(self, phase: int) -> bool:
        if self.active is not None:
            return False
        return random.random() < self.config.minigame_chance_per_event

    def start(self, phase: int) -> MinigameInstance | None:
        pool = self.registry.by_phase("minigame", phase)
        if not pool:
            return None
        element = random.choice(pool)
        self.active = MinigameInstance(element, self.config)
        return self.active

    def finish(self, outcome: str) -> dict:
        if self.active is None:
            return {}
        rewards = self.active.complete(outcome)
        self.active = None
        return rewards

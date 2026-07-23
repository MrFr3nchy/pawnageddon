"""Board hazards: persistent square effects that damage/modify pieces stepping on them."""

from __future__ import annotations
from .config import ChaosConfig


class Hazard:
    """A hazard occupying a board square."""
    def __init__(self, hazard_id: str, col: int, row: int, duration: int, meta: dict | None = None):
        self.id = hazard_id
        self.col = col
        self.row = row
        self.duration = duration
        self.meta = meta or {}

    @property
    def pos(self):
        return (self.col, self.row)


class HazardManager:
    """Tracks active board hazards."""

    def __init__(self, config: ChaosConfig):
        self.config = config
        self.active: list[Hazard] = []

    def place(self, hazard_id: str, col: int, row: int, duration: int = 0, meta: dict | None = None):
        if len(self.active) >= self.config.max_active_hazards:
            self.active.pop(0)
        dur = duration or self.config.hazard_default_duration
        self.active.append(Hazard(hazard_id, col, row, dur, meta))

    def get_at(self, col: int, row: int) -> list[Hazard]:
        return [h for h in self.active if h.col == col and h.row == row]

    def tick(self):
        """Decrement durations, remove expired."""
        still = []
        for h in self.active:
            h.duration -= 1
            if h.duration > 0:
                still.append(h)
        self.active = still

    def remove_at(self, col: int, row: int):
        self.active = [h for h in self.active if not (h.col == col and h.row == row)]

    def all_positions(self) -> set[tuple[int, int]]:
        return {(h.col, h.row) for h in self.active}

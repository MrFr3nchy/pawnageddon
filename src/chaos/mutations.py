"""Piece mutations: temporary or permanent modifications to individual pieces."""

from __future__ import annotations
from .config import ChaosConfig


class Mutation:
    """A mutation applied to a piece at a board position."""
    def __init__(self, mutation_type: str, col: int, row: int, duration: int, meta: dict | None = None):
        self.type = mutation_type  # "shield", "freeze", "haste", "enrage", etc.
        self.col = col
        self.row = row
        self.duration = duration  # -1 = permanent
        self.meta = meta or {}

    @property
    def pos(self):
        return (self.col, self.row)

    @property
    def permanent(self):
        return self.duration == -1


class MutationManager:
    """Tracks piece mutations."""

    def __init__(self, config: ChaosConfig):
        self.config = config
        self.active: list[Mutation] = []

    def apply(self, mutation_type: str, col: int, row: int, duration: int = 0, meta: dict | None = None):
        if len(self.active) >= self.config.max_active_mutations:
            non_perm = [m for m in self.active if not m.permanent]
            if non_perm:
                self.active.remove(non_perm[0])
        dur = duration or self.config.mutation_default_duration
        self.active.append(Mutation(mutation_type, col, row, dur, meta))

    def get_at(self, col: int, row: int) -> list[Mutation]:
        return [m for m in self.active if m.col == col and m.row == row]

    def has_type_at(self, mutation_type: str, col: int, row: int) -> bool:
        return any(m.type == mutation_type and m.col == col and m.row == row for m in self.active)

    def is_frozen(self, col: int, row: int) -> bool:
        return self.has_type_at("freeze", col, row)

    def is_shielded(self, col: int, row: int) -> bool:
        return self.has_type_at("shield", col, row)

    def tick(self):
        still = []
        for m in self.active:
            if m.permanent:
                still.append(m)
            else:
                m.duration -= 1
                if m.duration > 0:
                    still.append(m)
        self.active = still

    def move_piece(self, from_c: int, from_r: int, to_c: int, to_r: int):
        """Update mutation positions when a piece moves."""
        for m in self.active:
            if m.col == from_c and m.row == from_r:
                m.col = to_c
                m.row = to_r

    def remove_at(self, col: int, row: int):
        self.active = [m for m in self.active if not (m.col == col and m.row == row)]

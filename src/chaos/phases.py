"""Phase-based chaos progression. Unlocks mechanics as the game evolves."""

from __future__ import annotations
from .config import ChaosConfig

PHASE_NAMES = {
    1: "Opening",
    2: "Strange Happenings",
    3: "Board Instability",
    4: "Tactical Mayhem",
    5: "Pawnageddon",
}


class PhaseManager:
    def __init__(self, config: ChaosConfig):
        self.config = config
        self.current_phase = 1
        self._phase_history: list[tuple[int, int]] = [(1, 0)]  # (phase, turn_entered)

    def update(self, turn: int, chaos_pct: float, pieces_remaining: int) -> int:
        """Recalculate phase. Returns new phase number (may be same as before)."""
        new_phase = 1
        for phase in sorted(self.config.phase_triggers.keys()):
            min_turn, min_chaos, max_pieces = self.config.phase_triggers[phase]
            if turn >= min_turn or chaos_pct >= min_chaos or pieces_remaining <= max_pieces:
                new_phase = phase

        if new_phase > self.current_phase:
            self.current_phase = new_phase
            self._phase_history.append((new_phase, turn))

        return self.current_phase

    @property
    def phase_name(self) -> str:
        return PHASE_NAMES.get(self.current_phase, "Unknown")

    @property
    def history(self) -> list[tuple[int, int]]:
        return list(self._phase_history)

"""Central registry for all chaos content: cards, events, items, minigames, hazards, mutations."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChaosElement:
    """Universal structure for any registered chaos mechanic."""
    id: str
    name: str
    description: str
    category: str           # "card", "event", "item", "minigame", "hazard", "mutation"
    rarity: str = "common"  # common, uncommon, rare, epic, legendary
    phase_req: int = 1      # minimum phase to appear
    weight: float = 10.0    # probability weight for random selection
    cooldown: int = 0       # turns before can trigger again
    tags: list[str] = field(default_factory=list)
    effects: list[dict] = field(default_factory=list)
    meta: dict = field(default_factory=dict)  # category-specific extra data

    @classmethod
    def from_dict(cls, d: dict, category: str) -> "ChaosElement":
        return cls(
            id=d["id"],
            name=d["name"],
            description=d.get("desc", ""),
            category=category,
            rarity=d.get("rarity", "common"),
            phase_req=d.get("phase", 1),
            weight=d.get("weight", 10.0),
            cooldown=d.get("cooldown", 0),
            tags=d.get("tags", []),
            effects=d.get("effects", []),
            meta=d.get("meta", {}),
        )


class ChaosRegistry:
    """Stores and indexes all chaos content. Query by category, phase, rarity, tags."""

    def __init__(self):
        self._elements: dict[str, ChaosElement] = {}  # id -> element
        self._by_category: dict[str, list[ChaosElement]] = {}

    # ── Registration ──

    def register(self, element: ChaosElement):
        self._elements[element.id] = element
        self._by_category.setdefault(element.category, []).append(element)

    def register_card(self, data: dict):
        self.register(ChaosElement.from_dict(data, "card"))

    def register_event(self, data: dict):
        self.register(ChaosElement.from_dict(data, "event"))

    def register_item(self, data: dict):
        self.register(ChaosElement.from_dict(data, "item"))

    def register_minigame(self, data: dict):
        self.register(ChaosElement.from_dict(data, "minigame"))

    def register_hazard(self, data: dict):
        self.register(ChaosElement.from_dict(data, "hazard"))

    def register_mutation(self, data: dict):
        self.register(ChaosElement.from_dict(data, "mutation"))

    def register_batch(self, data_list: list[dict], category: str):
        reg_fn = getattr(self, f"register_{category}")
        for d in data_list:
            reg_fn(d)

    # ── Queries ──

    def get(self, element_id: str) -> ChaosElement | None:
        return self._elements.get(element_id)

    def all(self, category: str | None = None) -> list[ChaosElement]:
        if category:
            return list(self._by_category.get(category, []))
        return list(self._elements.values())

    def by_phase(self, category: str, max_phase: int) -> list[ChaosElement]:
        return [e for e in self.all(category) if e.phase_req <= max_phase]

    def by_rarity(self, category: str, rarity: str) -> list[ChaosElement]:
        return [e for e in self.all(category) if e.rarity == rarity]

    def by_tags(self, category: str, tags: list[str], match_all: bool = False) -> list[ChaosElement]:
        tag_set = set(tags)
        if match_all:
            return [e for e in self.all(category) if tag_set.issubset(set(e.tags))]
        return [e for e in self.all(category) if tag_set & set(e.tags)]

    def count(self, category: str | None = None) -> int:
        return len(self.all(category))

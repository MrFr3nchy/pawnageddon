"""Centralized configuration for all chaos mechanics. Tweak values here, not in game logic."""


class ChaosConfig:
    """All tuning knobs for the chaos system. Instantiate with overrides or use defaults."""

    def __init__(self, **overrides):
        # ── Phase triggers ──
        # Each phase tuple: (min_turn, min_chaos_pct, max_pieces_remaining)
        # Phase unlocks when ANY condition is met.
        self.phase_triggers = {
            1: (0, 0, 32),       # Opening — always active
            2: (8, 15, 28),      # Strange Happenings
            3: (18, 35, 22),     # Board Instability
            4: (30, 55, 16),     # Tactical Mayhem
            5: (45, 80, 10),     # Pawnageddon
        }

        # ── Chaos meter ──
        self.chaos_max = 100
        self.chaos_per_capture_base = 5
        self.chaos_per_turn_passive = 1     # added every turn from phase 2+
        self.chaos_from_card_play = 2
        self.chaos_from_event = 3

        # ── Card system ──
        self.deck_unlock_turn = 8
        self.cards_per_draw = 1
        self.max_hand_size = 7
        self.bonus_draw_chaos_threshold = 60  # draw 2 cards above this chaos %
        self.card_draw_rate_by_phase = {1: 0, 2: 1, 3: 1, 4: 2, 5: 2}

        # ── Event system ──
        self.event_check_interval = 3        # check for random events every N turns
        self.event_base_chance = 0.25        # base probability per check
        self.event_chance_per_phase = 0.12   # added per phase level
        self.max_concurrent_events = 3

        # ── Shop ──
        self.shop_unlock_turn = 4
        self.shop_restock_interval = 6
        self.shop_slots = 5
        self.item_cost_scaling = 1.0         # multiplier applied per phase

        # ── Minigames ──
        self.minigame_chance_per_event = 0.15
        self.minigame_reward_gold_success = 8
        self.minigame_reward_gold_partial = 3
        self.minigame_reward_gold_fail = 0
        self.minigame_reward_cards_success = 1

        # ── Hazards ──
        self.max_active_hazards = 8
        self.hazard_default_duration = 5

        # ── Mutations ──
        self.max_active_mutations = 6
        self.mutation_default_duration = 4

        # ── Rarity weights (used for draws/spawns) ──
        self.rarity_weights = {
            "common":    50,
            "uncommon":  30,
            "rare":      14,
            "epic":       5,
            "legendary":  1,
        }

        # ── Gold economy ──
        self.gold_per_pawn_capture = 1
        self.gold_per_piece_capture = 3
        self.gold_per_major_capture = 5
        self.gold_interest_rate = 0.0        # % bonus gold per turn (0 = off)

        # Apply overrides
        for k, v in overrides.items():
            if hasattr(self, k):
                setattr(self, k, v)

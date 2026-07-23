"""Sound effects using pyfxr. Falls back silently if pyfxr unavailable."""

import pygame

_sounds = {}
_enabled = False


def init():
    """Generate all sound effects. Call after pygame.init()."""
    global _sounds, _enabled
    try:
        import pyfxr
        _raw = {
            "click":     pyfxr.select(),
            "card_draw": pyfxr.pickup(),
            "card_play": pyfxr.powerup(),
            "capture":   pyfxr.explosion(),
            "buy":       pyfxr.pickup(),
            "event":     pyfxr.laser(),
            "phase_up":  pyfxr.powerup(),
            "error":     pyfxr.hurt(),
            "check":     pyfxr.hurt(),
        }
        for name, buf in _raw.items():
            _sounds[name] = pygame.mixer.Sound(buffer=buf)
        _enabled = True
    except Exception:
        _enabled = False


def play(name: str):
    """Play a named sound effect. No-op if sounds unavailable."""
    if _enabled and name in _sounds:
        try:
            _sounds[name].play()
        except Exception:
            pass

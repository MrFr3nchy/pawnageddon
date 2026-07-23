// Weapons & shields — equippable gear for individual pieces

export const WEAPONS = {
  sword: {
    id: 'sword', name: 'Sword', icon: '⚔️', cost: 3,
    desc: '+3 gold on your next capture',
    color: 0x88aaff,
    uses: 1,
  },
  bomb: {
    id: 'bomb', name: 'Bomb', icon: '💣', cost: 5,
    desc: 'Next capture explodes — destroys all adjacent pieces too!',
    color: 0xff6600,
    uses: 1,
  },
  poison: {
    id: 'poison', name: 'Poison Blade', icon: '☠️', cost: 4,
    desc: 'Each capture leaves a poison hazard on that square (3 uses)',
    color: 0x44ff88,
    uses: 3,
  },
};

export const SHIELDS = {
  iron: {
    id: 'iron', name: 'Iron Shield', icon: '🛡️', cost: 4,
    desc: 'Blocks the next capture attempt — piece survives once',
    color: 0xaaaaaa,
    uses: 1,
  },
  magic: {
    id: 'magic', name: 'Magic Ward', icon: '✨', cost: 6,
    desc: 'Blocks the next chaos event targeting this piece',
    color: 0x44ccff,
    uses: 1,
  },
};

export const WEAPON_LIST  = Object.values(WEAPONS);
export const SHIELD_LIST  = Object.values(SHIELDS);
export const ALL_EQUIP    = [...WEAPON_LIST, ...SHIELD_LIST];

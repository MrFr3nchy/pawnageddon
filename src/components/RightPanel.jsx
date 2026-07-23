import { useEffect, useState } from 'react';
import { WEAPONS, SHIELDS } from '../game/EquipSystem.js';

function ChaosBar({ label, value, max = 100, color = '#9944ff' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888', marginBottom:3 }}>
        <span>{label}</span>
        <span style={{ color }}>{value} / {max}</span>
      </div>
      <div style={{ background:'#1a1a28', borderRadius:4, height:6, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background: color, borderRadius:4, transition:'width 0.4s' }} />
      </div>
    </div>
  );
}

function GearList({ weapons, shields }) {
  const weaponEntries = weapons ? [...weapons.entries()] : [];
  const shieldEntries = shields ? [...shields.entries()] : [];
  if (weaponEntries.length === 0 && shieldEntries.length === 0) {
    return <div style={{ color:'#444', fontSize:11 }}>No gear equipped. Right-click pieces to equip!</div>;
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {weaponEntries.map(([key, w]) => {
        const def = WEAPONS[w.id] || {};
        return (
          <div key={key} style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color:'#ccbbee' }}>
            <span>{def.icon || '⚔️'}</span>
            <span style={{ color:'#aaa' }}>{def.name || w.id}</span>
            <span style={{ color:'#666', marginLeft:'auto' }}>{w.uses} use{w.uses !== 1 ? 's' : ''}</span>
          </div>
        );
      })}
      {shieldEntries.map(([key, s]) => {
        const def = SHIELDS[s.id] || {};
        return (
          <div key={key} style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color:'#aaddff' }}>
            <span>{def.icon || '🛡️'}</span>
            <span style={{ color:'#aaa' }}>{def.name || s.id}</span>
            <span style={{ color:'#666', marginLeft:'auto' }}>{s.uses} use{s.uses !== 1 ? 's' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function MessageFeed({ messages }) {
  if (!messages?.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      {messages.slice(-5).map((msg, i) => (
        <div key={i} style={{ fontSize:11, color:'#cc88ff', padding:'2px 0', borderLeft:'2px solid #5500aa', paddingLeft:6, marginBottom:3, opacity: 1 - (messages.slice(-5).length - 1 - i) * 0.18 }}>
          {msg}
        </div>
      ))}
    </div>
  );
}

export function RightPanel({ gs }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!gs) return;
    const refresh = () => setTick(t => t + 1);
    const unsubs = [
      gs.on('stateUpdate',  refresh),
      gs.on('boardUpdate',  refresh),
      gs.on('turnStart',    refresh),
      gs.on('cardDrawn',    refresh),
      gs.on('cardPlayed',   refresh),
      gs.on('gearEquipped', refresh),
      gs.on('shieldBlocked',refresh),
      gs.on('ultimateUsed', refresh),
    ];
    refresh();
    return () => unsubs.forEach(u => u());
  }, [gs]);

  if (!gs) return <div style={panelStyle} />;

  const whiteToMove   = gs.whiteToMove;
  const turnMessages  = gs.turnMessages;
  const chaosRevealed = gs.chaosRevealed;
  const whiteGold     = gs.whiteGold  ?? 0;
  const blackGold     = gs.blackGold  ?? 0;
  const whiteChaos    = gs.whiteChaos ?? 0;
  const blackChaos    = gs.blackChaos ?? 0;
  const CHAOS_MAX     = 100;

  const handleDraw = () => gs.drawCard(whiteToMove);

  return (
    <div style={panelStyle}>

      {/* Chaos & Gold readouts */}
      {chaosRevealed && (
        <section style={{ ...sectionStyle, animation:'fadeIn 0.6s ease' }}>
          <SectionHeader icon="🌀" label="Chaos &amp; Resources" />
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:'#daaf3e', marginBottom:4, fontWeight:600 }}>♙ White</div>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>🪙 Gold: <strong style={{ color:'#daaf3e' }}>{whiteGold}</strong></div>
            <ChaosBar label="⚡ Chaos" value={whiteChaos} max={CHAOS_MAX} color="#9944ff" />
          </div>
          <div>
            <div style={{ fontSize:11, color:'#9966ff', marginBottom:4, fontWeight:600 }}>♟ Black</div>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>🪙 Gold: <strong style={{ color:'#daaf3e' }}>{blackGold}</strong></div>
            <ChaosBar label="⚡ Chaos" value={blackChaos} max={CHAOS_MAX} color="#cc44ff" />
          </div>
          <div style={{ marginTop:8, fontSize:10, color:'#555', textAlign:'center' }}>
            Right-click a piece to equip gear or launch an ultimate
          </div>
        </section>
      )}

      {/* Equipped gear summary */}
      {chaosRevealed && (
        <section style={{ ...sectionStyle, animation:'fadeIn 0.6s ease' }}>
          <SectionHeader icon="⚔️" label="Gear Equipped" />
          <GearList weapons={gs.pieceWeapons} shields={gs.pieceShields} />
        </section>
      )}

      {/* Cards reminder */}
      {chaosRevealed && gs.deckUnlocked && (
        <section style={{ ...sectionStyle }}>
          <SectionHeader icon="🃏" label="Cards" />
          <div style={{ fontSize:11, color:'#666', lineHeight:1.5 }}>
            Card hands are shown <strong style={{ color:'#888' }}>above &amp; below the board</strong>. Click a card on your turn to play it.
          </div>
          <button
            onClick={handleDraw}
            style={{ marginTop:8, fontSize:11, background:'#1e2030', color:'#daaf3e', border:'1px solid #daaf3e44', borderRadius:5, padding:'4px 12px', cursor:'pointer', width:'100%' }}
          >
            Draw Card (+3🪙)
          </button>
        </section>
      )}

      {/* Hint before chaos reveals */}
      {!chaosRevealed && (
        <div style={{ color:'#333', fontSize:12, textAlign:'center', padding:'20px 8px', lineHeight:1.6 }}>
          ✨ Chaos awaits your first capture…
        </div>
      )}

      {/* Turn log */}
      <section style={sectionStyle}>
        <SectionHeader icon="📋" label="Turn Log" />
        <MessageFeed messages={turnMessages} />
        {(!turnMessages || turnMessages.length === 0) && (
          <div style={{ color:'#444', fontSize:12 }}>No events this turn</div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, paddingBottom:6, borderBottom:'1px solid #1e2028' }}>
      <span>{icon}</span>
      <span style={{ fontSize:12, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>{label}</span>
    </div>
  );
}


const panelStyle = {
  width: '100%', height: '100%',
  background: '#10121a',
  borderLeft: '1px solid #1e2028',
  padding: '16px 14px',
  overflowY: 'auto',
  color: '#eee',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const sectionStyle = {
  background: '#13151f',
  border: '1px solid #1e2028',
  borderRadius: 10,
  padding: '12px 14px',
  marginBottom: 10,
};

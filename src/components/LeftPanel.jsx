import { useEffect, useState } from 'react';

const PIECE_LABELS = { p:'♟',P:'♟', r:'♜',R:'♜', n:'♞',N:'♞', b:'♝',B:'♝', q:'♛',Q:'♛', k:'♚',K:'♚' };
const PIECE_SORT = { q:9,Q:9,r:5,R:5,b:3,B:3,n:3,N:3,p:1,P:1,k:0,K:0 };

function CapturedPieces({ pieces, label, color }) {
  const sorted = [...pieces].sort((a,b) => (PIECE_SORT[b]||0)-(PIECE_SORT[a]||0));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label} — Captured</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap: 2, minHeight: 28 }}>
        {sorted.map((p,i) => (
          <span key={i} style={{ fontSize: 18, color: color, opacity: 0.85, lineHeight:1 }}>{PIECE_LABELS[p]}</span>
        ))}
        {sorted.length === 0 && <span style={{ color:'#444', fontSize:12 }}>—</span>}
      </div>
    </div>
  );
}

function PlayerBlock({ name, gold, chaos, captured, capturedLabel, color, active, isWhite, chaosRevealed }) {
  const chaosPct = Math.min(100, chaos);
  return (
    <div style={{
      background: active ? '#1e2030' : '#141618',
      border: `1px solid ${active ? '#daaf3e' : '#2a2c32'}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 12,
      transition: 'all 0.3s',
      boxShadow: active ? '0 0 12px rgba(218,175,62,0.18)' : 'none',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background: isWhite ? '#fff' : '#222', border:'1.5px solid #666' }} />
        <span style={{ color: active ? '#daaf3e' : '#ccc', fontWeight: active ? 700 : 400, fontSize:15 }}>{name}</span>
        {active && <span style={{ marginLeft:'auto', fontSize:11, color:'#daaf3e', background:'rgba(218,175,62,0.12)', padding:'2px 8px', borderRadius:4 }}>Your turn</span>}
      </div>

      {/* Gold — only shown when chaos is revealed */}
      {chaosRevealed && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, animation:'fadeIn 0.5s ease' }}>
          <span style={{ fontSize:14 }}>🪙</span>
          <span style={{ color:'#daaf3e', fontWeight:600, fontSize:15 }}>{gold}</span>
          <span style={{ color:'#666', fontSize:12 }}>gold</span>
        </div>
      )}

      {/* Chaos bar — only shown when chaos is revealed */}
      {chaosRevealed && (
        <div style={{ marginBottom:10, animation:'fadeIn 0.5s ease' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
            <span style={{ fontSize:11, color:'#888' }}>Chaos</span>
            <span style={{ fontSize:11, color:'#cc4444' }}>{Math.round(chaosPct)}%</span>
          </div>
          <div style={{ height:6, background:'#252530', borderRadius:3, overflow:'hidden' }}>
            <div style={{ width:`${chaosPct}%`, height:'100%', background:'linear-gradient(90deg,#b44141,#ff6633)', borderRadius:3, transition:'width 0.4s' }} />
          </div>
        </div>
      )}

      <CapturedPieces pieces={captured} label={capturedLabel} color={color} />
    </div>
  );
}

export function LeftPanel({ gs }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!gs) return;
    const refresh = () => setTick(t => t + 1);
    const u1 = gs.on('stateUpdate', refresh);
    const u2 = gs.on('boardUpdate', refresh);
    const u3 = gs.on('turnStart',   refresh);
    refresh();
    return () => { u1(); u2(); u3(); };
  }, [gs]);

  if (!gs) return (
    <div style={panelStyle}>
      <div style={{ color:'#444', fontSize:13, textAlign:'center', marginTop:60 }}>Waiting for game...</div>
    </div>
  );

  const playerNames   = gs.playerNames;
  const whiteToMove   = gs.whiteToMove;
  const whiteGold     = gs.whiteGold;
  const blackGold     = gs.blackGold;
  const whiteChaos    = gs.whiteChaos;
  const blackChaos    = gs.blackChaos;
  const capturedWhite = gs.capturedWhite;
  const capturedBlack = gs.capturedBlack;
  const turnCount     = gs.turnCount;
  const phaseName     = gs.phaseName;
  const phase         = gs.phase;
  const chaosRevealed = gs.chaosRevealed;

  return (
    <div style={panelStyle}>
      <div style={{ color:'#daaf3e', fontWeight:700, fontSize:14, letterSpacing:'0.1em', marginBottom:16, textTransform:'uppercase' }}>Pawnageddon</div>

      {/* Turn & phase info */}
      <div style={{ background:'#0d0f14', borderRadius:8, padding:'10px 12px', marginBottom:14, border:'1px solid #2a2c32' }}>
        <div style={{ color:'#888', fontSize:11, marginBottom:3 }}>Turn {turnCount} · Phase {phase}</div>
        <div style={{ color:'#cc88ff', fontSize:13, fontWeight:600 }}>{phaseName}</div>
      </div>

      <PlayerBlock name={playerNames?.white || 'White'} gold={whiteGold} chaos={whiteChaos} captured={capturedBlack} capturedLabel="Black" color="#555" active={whiteToMove} isWhite={true} chaosRevealed={chaosRevealed} />
      <PlayerBlock name={playerNames?.black || 'Black'} gold={blackGold} chaos={blackChaos} captured={capturedWhite} capturedLabel="White" color="#ddd" active={!whiteToMove} isWhite={false} chaosRevealed={chaosRevealed} />
    </div>
  );
}

const panelStyle = {
  width: '100%', height: '100%',
  background: '#10121a',
  borderRight: '1px solid #1e2028',
  padding: '20px 14px',
  overflowY: 'auto',
  color: '#eee',
  fontFamily: 'Segoe UI, system-ui, sans-serif',
};

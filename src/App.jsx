import { useState, useEffect } from 'react';
import { PhaserGame } from './components/PhaserGame.jsx';
import { LeftPanel }  from './components/LeftPanel.jsx';
import { RightPanel } from './components/RightPanel.jsx';

export default function App() {
  const [gs, setGs] = useState(null);

  useEffect(() => {
    const handler = (e) => setGs(e.detail);
    window.addEventListener('gameReady', handler);
    return () => window.removeEventListener('gameReady', handler);
  }, []);

  return (
    <div style={{ display:'flex', width:'100vw', height:'100vh', background:'#0f0f13', overflow:'hidden' }}>
      <div style={{ width: 220, flexShrink:0, height:'100%' }}>
        <LeftPanel gs={gs} />
      </div>
      <div style={{ flex:1, height:'100%', position:'relative' }}>
        <PhaserGame onGameReady={setGs} />
      </div>
      <div style={{ width: 250, flexShrink:0, height:'100%' }}>
        <RightPanel gs={gs} />
      </div>
    </div>
  );
}

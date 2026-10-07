
import { useEffect } from 'react';
import { Settings, Gauge, RefreshCw, Activity, Moon, Sun } from 'lucide-react';
import { StatsPanel } from './components/StatsPanel';
import { MotorcycleView } from './components/MotorcycleView';
import { Copilot } from './components/Copilot';
import bikesData from './data/bikes.json';
import { useStore } from './store/useStore';

function App() {
  const { baseBike, setBaseBike, theme, toggleTheme } = useStore();

  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="layout-container">
      <div className="panel-left" style={{ flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <select className="select-base" value={baseBike.id} onChange={(e) => setBaseBike(e.target.value)}>
            {bikesData.map(bike => (
              <option key={bike.id} value={bike.id}>{bike.name}</option>
            ))}
          </select>
          <button className="btn-reset" onClick={toggleTheme} title="Toggle light/dark mode">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <MotorcycleView />
        </div>
        <div style={{ height: '350px', width: '100%', borderTop: '1px solid var(--border-color)' }}>
          <Copilot />
        </div>
      </div>
      <div className="panel-right">
        <div className="header"><h1>ModSim</h1></div>
        <StatsPanel />
      </div>
    </div>
  );
}

export default App;


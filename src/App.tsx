import React from 'react';
import { StatsPanel } from './components/StatsPanel';
import { MotorcycleView } from './components/MotorcycleView';
import bikesData from './data/bikes.json';
import { useStore } from './store/useStore';

function App() {
  const { baseBike, setBaseBike } = useStore();

  return (
    <div className="layout-container">
      <div className="panel-left">
        <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 10 }}>
          <select 
            className="select-base" 
            value={baseBike.id} 
            onChange={(e) => setBaseBike(e.target.value)}
          >
            {bikesData.map(bike => (
              <option key={bike.id} value={bike.id}>{bike.name}</option>
            ))}
          </select>
        </div>
        
        <MotorcycleView />
      </div>

      <div className="panel-right">
        <div className="header">
          <h1>ModSim</h1>
        </div>
        <StatsPanel />
      </div>
    </div>
  );
}

export default App;

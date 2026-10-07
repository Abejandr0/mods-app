import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Settings, Gauge, RefreshCw, Activity } from 'lucide-react';
import { 
  calculateTopSpeedsPerGear, 
  calculateSpeedometerError, 
  calculateRelativeTractionForce 
} from '../engine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function StatsPanel() {
  const { baseBike, modifications, updateSprocket, updateChainring, resetModifications } = useStore();

  const currentSprocket = modifications.sprocket ?? baseBike.transmission.sprocket;
  const currentChainring = modifications.chainring ?? baseBike.transmission.chainring;
  const currentRearTire = modifications.rearTire ?? baseBike.rearTire;

  const currentTransmission = {
    ...baseBike.transmission,
    sprocket: currentSprocket,
    chainring: currentChainring
  };

  const baseTopSpeeds = useMemo(() => calculateTopSpeedsPerGear(baseBike.transmission, baseBike.engine, baseBike.rearTire), [baseBike]);
  const modTopSpeeds = useMemo(() => calculateTopSpeedsPerGear(currentTransmission, baseBike.engine, currentRearTire), [currentTransmission, baseBike.engine, currentRearTire]);

  const speedometerError = useMemo(() => calculateSpeedometerError(baseBike.rearTire, currentRearTire), [baseBike.rearTire, currentRearTire]);
  const forceFactor = useMemo(() => calculateRelativeTractionForce(baseBike.rearTire, baseBike.transmission, currentRearTire, currentTransmission, 0), [baseBike, currentRearTire, currentTransmission]);

  const forceDiffPercent = (forceFactor - 1) * 100;
  const topSpeedBase = baseTopSpeeds[baseTopSpeeds.length - 1];
  const topSpeedMod = modTopSpeeds[modTopSpeeds.length - 1];
  const speedDiffPercent = ((topSpeedMod / topSpeedBase) - 1) * 100;

  const chartData = baseTopSpeeds.map((speed, idx) => ({
    gear: `M${idx + 1}`,
    baseSpeed: Math.round(speed),
    modSpeed: Math.round(modTopSpeeds[idx])
  }));

  const hasModifications = Object.keys(modifications).length > 0;

  return (
    <div className="content-scroll">
      <div className="card">
        <h3 className="card-title"><Settings size={18} /> Transmisión</h3>
        
        <div className="control-group">
          <div className="control-label">
            <span>Piñón (Dientes)</span>
            <span>{currentSprocket}</span>
          </div>
          <input 
            type="range" 
            min="11" max="18" step="1" 
            value={currentSprocket} 
            onChange={(e) => updateSprocket(parseInt(e.target.value))}
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span>Catalina (Dientes)</span>
            <span>{currentChainring}</span>
          </div>
          <input 
            type="range" 
            min="35" max="60" step="1" 
            value={currentChainring} 
            onChange={(e) => updateChainring(parseInt(e.target.value))}
          />
        </div>
        
        <div className="stat-row" style={{marginTop: 16}}>
          <span style={{color: 'var(--text-muted)'}}>Relación Final</span>
          <span className="stat-value">{(currentChainring / currentSprocket).toFixed(2)}</span>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title"><Gauge size={18} /> Rendimiento Teórico</h3>
        
        <div className="stat-row">
          <span>Velocidad Punta (Corte)</span>
          <div className="stat-value">
            {Math.round(topSpeedMod)} <span style={{fontSize: 14, color: 'var(--text-muted)'}}>km/h</span>
            {hasModifications && (
              <span className={`stat-diff ${speedDiffPercent > 0 ? 'diff-positive' : speedDiffPercent < 0 ? 'diff-negative' : 'diff-neutral'}`}>
                {speedDiffPercent > 0 ? '+' : ''}{speedDiffPercent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        <div className="stat-row">
          <span>Aceleración Relativa</span>
          <div className="stat-value">
            {hasModifications ? (
              <span className={`stat-diff ${forceDiffPercent > 0 ? 'diff-positive' : forceDiffPercent < 0 ? 'diff-negative' : 'diff-neutral'}`}>
                {forceDiffPercent > 0 ? '+' : ''}{forceDiffPercent.toFixed(1)}% Fuerza
              </span>
            ) : (
              <span className="stat-diff diff-neutral">Base</span>
            )}
          </div>
        </div>

        <div className="stat-row">
          <span>Error Velocímetro</span>
          <div className="stat-value">
            {hasModifications ? (
              <span className={`stat-diff ${Math.abs(speedometerError) > 3 ? 'diff-negative' : speedometerError !== 0 ? 'diff-positive' : 'diff-neutral'}`}>
                {speedometerError > 0 ? '+' : ''}{speedometerError.toFixed(1)}%
              </span>
            ) : (
              <span className="stat-diff diff-neutral">0%</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
         <h3 className="card-title"><Activity size={18} /> Velocidad por Marcha</h3>
         <div style={{ height: 200, width: '100%', marginTop: 16 }}>
           <ResponsiveContainer width="100%" height="100%">
             <LineChart data={chartData}>
               <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
               <XAxis dataKey="gear" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
               <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
               <Tooltip 
                 contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', borderRadius: 8 }}
                 itemStyle={{ color: 'var(--text-main)' }}
               />
               <Line type="monotone" dataKey="baseSpeed" name="Base (km/h)" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
               <Line type="monotone" dataKey="modSpeed" name="Mod (km/h)" stroke="var(--accent-neutral)" strokeWidth={3} dot={{r: 4, fill: 'var(--bg-panel)', strokeWidth: 2}} activeDot={{r: 6}} />
             </LineChart>
           </ResponsiveContainer>
         </div>
      </div>

      <button className="btn-reset" onClick={resetModifications} disabled={!hasModifications}>
        <RefreshCw size={18} /> Restablecer a original
      </button>
    </div>
  );
}

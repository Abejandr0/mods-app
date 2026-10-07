
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { calculateTireDiameter } from '../engine';

export function MotorcycleView() {
  const { baseBike, modifications } = useStore();

  const currentRearTire = modifications.rearTire ?? baseBike.rearTire;
  const currentSprocket = modifications.sprocket ?? baseBike.transmission.sprocket;
  const currentChainring = modifications.chainring ?? baseBike.transmission.chainring;

  const baseRearDiameter = calculateTireDiameter(baseBike.rearTire);
  const currentRearDiameter = calculateTireDiameter(currentRearTire);
  
  // Escala relativa
  const tireScale = currentRearDiameter / baseRearDiameter;
  const sprocketScale = currentSprocket / baseBike.transmission.sprocket;
  const chainringScale = currentChainring / baseBike.transmission.chainring;

  return (
    <div style={{ position: 'relative', width: 600, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Silueta Base de la Moto */}
      <svg width="600" height="400" viewBox="0 0 600 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 150 200 L 250 150 L 350 150 L 450 200 L 350 250 L 250 250 Z" fill="var(--bg-card)" stroke="var(--border-color)" strokeWidth="4"/>
        <circle cx="450" cy="250" r="60" stroke="var(--text-muted)" strokeWidth="8" fill="transparent" />
      </svg>

      {/* Rueda Trasera (Animada) */}
      <motion.div 
        style={{ position: 'absolute', left: 90, top: 190 }}
        animate={{ scale: tireScale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" stroke="var(--text-main)" strokeWidth="16" fill="transparent" />
          <circle cx="60" cy="60" r="30" fill="var(--border-color)" />
        </svg>
      </motion.div>

      {/* Catalina (Animada) */}
      <motion.div 
        style={{ position: 'absolute', left: 120, top: 220 }}
        animate={{ scale: chainringScale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" stroke="var(--accent-neutral)" strokeWidth="4" strokeDasharray="4 4" fill="transparent" />
        </svg>
      </motion.div>

      {/* Piñón (Animado) */}
      <motion.div 
        style={{ position: 'absolute', left: 280, top: 235 }}
        animate={{ scale: sprocketScale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <svg width="30" height="30" viewBox="0 0 30 30">
          <circle cx="15" cy="15" r="10" stroke="var(--accent-primary)" strokeWidth="4" strokeDasharray="2 2" fill="transparent" />
        </svg>
      </motion.div>

      {/* Cadena (Línea simple) */}
      <svg style={{ position: 'absolute', left: 150, top: 250, pointerEvents: 'none' }} width="145" height="10">
         <line x1="0" y1="0" x2="145" y2="0" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4 2" />
      </svg>
    </div>
  );
}

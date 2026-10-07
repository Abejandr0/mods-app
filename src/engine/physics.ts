import { TireSize, Transmission, EngineSpecs } from './types';
import { calculateTireCircumference } from './tires';

/**
 * Relación de transmisión final (Final Drive Ratio)
 */
export function calculateFinalDriveRatio(sprocket: number, chainring: number): number {
  return chainring / sprocket;
}

/**
 * Calcula la velocidad teórica a una RPM específica en una marcha dada.
 * Velocidad = (RPM / (PrimaryRatio * GearRatio * FinalDriveRatio)) * Circunferencia * (60 / 1,000,000)
 * El resultado está en km/h.
 */
export function calculateSpeedAtRpm(
  rpm: number,
  primaryRatio: number,
  gearRatio: number,
  finalDriveRatio: number,
  rearTire: TireSize
): number {
  const circumferenceMm = calculateTireCircumference(rearTire);
  const engineToWheelRatio = primaryRatio * gearRatio * finalDriveRatio;
  const wheelRpm = rpm / engineToWheelRatio;
  
  // (wheelRpm * 60) da revs por hora.
  // multiplicamos por circunferencia (mm) -> mm por hora.
  // dividimos por 1,000,000 para pasar a km/h.
  return (wheelRpm * circumferenceMm * 60) / 1000000;
}

/**
 * Calcula las velocidades máximas teóricas para cada marcha en el corte de inyección (redline).
 */
export function calculateTopSpeedsPerGear(
  transmission: Transmission,
  engine: EngineSpecs,
  rearTire: TireSize
): number[] {
  const finalDriveRatio = calculateFinalDriveRatio(transmission.sprocket, transmission.chainring);
  return transmission.gearRatios.map(gearRatio => 
    calculateSpeedAtRpm(
      engine.redlineRpm, 
      transmission.primaryRatio, 
      gearRatio, 
      finalDriveRatio, 
      rearTire
    )
  );
}

/**
 * Calcula las RPM necesarias para viajar a una velocidad dada (ej. 100 km/h).
 */
export function calculateRpmAtSpeed(
  speedKmh: number,
  primaryRatio: number,
  gearRatio: number,
  finalDriveRatio: number,
  rearTire: TireSize
): number {
  const circumferenceMm = calculateTireCircumference(rearTire);
  const engineToWheelRatio = primaryRatio * gearRatio * finalDriveRatio;
  
  return (speedKmh * 1000000 * engineToWheelRatio) / (circumferenceMm * 60);
}

/**
 * Modelo simplificado para calcular la velocidad punta limitada por aerodinámica.
 * Se equilibra la potencia en rueda contra la fuerza de arrastre (Drag Force).
 * Potencia requerida (Watts) = 0.5 * rho * Cd * A * v^3
 * Asumiendo pérdida de transmisión del 15% (factor 0.85).
 */
export function calculateMaxAerodynamicSpeed(
  engine: EngineSpecs,
  dragCoefficient: number,
  frontalArea: number
): number {
  // 1 HP = 745.7 Watts
  const powerWatts = engine.maxPowerHp * 745.7 * 0.85; // Potencia a la rueda estimada
  const rho = 1.225; // Densidad del aire a nivel del mar (kg/m^3)
  
  // Despejando v de: P = 0.5 * rho * Cd * A * v^3
  // v^3 = (2 * P) / (rho * Cd * A)
  const vCubed = (2 * powerWatts) / (rho * dragCoefficient * frontalArea);
  const vMetersPerSecond = Math.pow(vCubed, 1/3);
  
  // m/s a km/h
  return vMetersPerSecond * 3.6;
}

/**
 * Fuerza de tracción en rueda relativa (simplificada) para comparar aceleración.
 * Retorna un factor multiplicador de Fuerza, ej. 1.05 = 5% más de fuerza.
 */
export function calculateRelativeTractionForce(
  baseTire: TireSize, baseTransmission: Transmission,
  modTire: TireSize, modTransmission: Transmission,
  gearIndex: number = 0 // Primera marcha por defecto
): number {
  const baseFinalDrive = calculateFinalDriveRatio(baseTransmission.sprocket, baseTransmission.chainring);
  const modFinalDrive = calculateFinalDriveRatio(modTransmission.sprocket, modTransmission.chainring);
  
  const baseEngineToWheelRatio = baseTransmission.primaryRatio * baseTransmission.gearRatios[gearIndex] * baseFinalDrive;
  const modEngineToWheelRatio = modTransmission.primaryRatio * modTransmission.gearRatios[gearIndex] * modFinalDrive;
  
  const baseRadiusMm = calculateTireCircumference(baseTire) / (2 * Math.PI);
  const modRadiusMm = calculateTireCircumference(modTire) / (2 * Math.PI);
  
  const baseForceFactor = baseEngineToWheelRatio / baseRadiusMm;
  const modForceFactor = modEngineToWheelRatio / modRadiusMm;
  
  return modForceFactor / baseForceFactor;
}

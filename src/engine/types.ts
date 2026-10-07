export interface TireSize {
  width: number;       // ej. 140 (mm)
  profile: number;     // ej. 70 (%)
  rim: number;         // ej. 17 (pulgadas)
}

export interface Transmission {
  primaryRatio: number;
  gearRatios: number[]; // Relaciones de 1ra a Nra marcha
  sprocket: number;     // Piñón (dientes)
  chainring: number;    // Catalina (dientes)
}

export interface EngineSpecs {
  displacement: number; // cc
  maxPowerHp: number;   // HP
  maxPowerRpm: number;
  maxTorqueNm: number;  // Nm
  maxTorqueRpm: number;
  redlineRpm: number;
}

export interface MotorcycleBase {
  id: string;
  name: string;
  engine: EngineSpecs;
  transmission: Transmission;
  rearTire: TireSize;
  frontTire: TireSize;
  weightKg: number;     // Peso en vacío / Curb weight
  riderWeightKg: number;
  dragCoefficient: number; // Cd
  frontalArea: number;     // m^2
}

export interface Modifications {
  rearTire?: TireSize;
  frontTire?: TireSize;
  sprocket?: number;
  chainring?: number;
}

export interface CalculatedStats {
  rearTireDiameterMm: number;
  finalDriveRatio: number;
  topSpeedPerGearKmh: number[];
  maxAerodynamicSpeedKmh: number;
  cruisingRpmAt100: number;
  speedometerErrorPercent: number;
  relativeTractionForce: number; // Fuerza de tracción en rueda para aceleración (basado en gearRatio actual) vs base
}

export interface TireSize {
  width: number;
  profile: number;
  rim: number;
}

export interface Transmission {
  primaryRatio: number;
  gearRatios: number[];
  sprocket: number;
  chainring: number;
  chainPitch?: number; // e.g., 520
  chainLinks?: number;
}

export interface EngineSpecs {
  displacement: number;
  maxPowerHp: number;
  maxPowerRpm: number;
  maxTorqueNm: number;
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
  weightKg: number;
  riderWeightKg: number;
  dragCoefficient: number;
  frontalArea: number;
  centerOfGravityHeightM?: number; // Defaults to 0.6 if missing
  wheelbaseM?: number; // Defaults to 1.4 if missing
}

export interface Modifications {
  rearTire?: TireSize;
  frontTire?: TireSize;
  sprocket?: number;
  chainring?: number;
}

export interface TopSpeedResult {
  speedKmh: number;
  limitedBy: 'rpm' | 'aero';
}

export interface AccelerationResult {
  time0To100: number;
  time0To200m: number;
  speedAt200m: number;
  time60To120TopGear: number;
}

export interface ChainResult {
  links: number;
  tensorWarning: boolean;
  warningMessage?: string;
}

export interface TireValidationResult {
  isValid: boolean;
  clearanceChangeMm: number;
  rideHeightChangeMm: number;
  warnings: string[];
}

export interface CruisingResult {
  rpmAt100: number;
  rpmAt120: number;
  relativeConsumptionPercent: number; 
}

export interface CalculatedStats {
  rearTireDiameterMm: number;
  finalDriveRatio: number;
  topSpeedPerGearKmh: number[];
  effectiveTopSpeed: TopSpeedResult;
  cruising: CruisingResult;
  speedometerErrorPercent: number;
  acceleration: AccelerationResult;
  chain: ChainResult;
  rearTireValidation: TireValidationResult;
  frontTireValidation: TireValidationResult;
}

export interface EngineSimulationResult {
  baseStats: CalculatedStats;
  modStats: CalculatedStats;
  percentageChanges: {
    effectiveTopSpeed: number;
    time0To100: number;
    time0To200m: number;
    time60To120TopGear: number;
  };
}

import type { TireSize, Transmission, EngineSpecs, MotorcycleBase, TopSpeedResult, AccelerationResult, CruisingResult } from './types';
import { calculateTireCircumference } from './tires';

const RHO_AIR = 1.225; // kg/m^3
const GRAVITY = 9.81; // m/s^2
const ROLLING_RESISTANCE_COEF = 0.015;
const DRIVETRAIN_EFFICIENCY = 0.85;

export function calculateFinalDriveRatio(sprocket: number, chainring: number): number {
  return chainring / sprocket;
}

export function calculateSpeedAtRpm(rpm: number, primaryRatio: number, gearRatio: number, finalDriveRatio: number, rearTire: TireSize): number {
  const circumferenceMm = calculateTireCircumference(rearTire);
  const engineToWheelRatio = primaryRatio * gearRatio * finalDriveRatio;
  const wheelRpm = rpm / engineToWheelRatio;
  return (wheelRpm * circumferenceMm * 60) / 1000000;
}

export function calculateTopSpeedsPerGear(transmission: Transmission, engine: EngineSpecs, rearTire: TireSize): number[] {
  const finalDriveRatio = calculateFinalDriveRatio(transmission.sprocket, transmission.chainring);
  return transmission.gearRatios.map(gearRatio => 
    calculateSpeedAtRpm(engine.redlineRpm, transmission.primaryRatio, gearRatio, finalDriveRatio, rearTire)
  );
}

export function calculateRpmAtSpeed(speedKmh: number, primaryRatio: number, gearRatio: number, finalDriveRatio: number, rearTire: TireSize): number {
  const circumferenceMm = calculateTireCircumference(rearTire);
  const engineToWheelRatio = primaryRatio * gearRatio * finalDriveRatio;
  return (speedKmh * 1000000 * engineToWheelRatio) / (circumferenceMm * 60);
}

export function calculateMaxAerodynamicSpeed(engine: EngineSpecs, dragCoefficient: number, frontalArea: number): number {
  const powerWatts = engine.maxPowerHp * 745.7 * DRIVETRAIN_EFFICIENCY;
  const vCubed = (2 * powerWatts) / (RHO_AIR * dragCoefficient * frontalArea);
  return Math.pow(vCubed, 1/3) * 3.6; 
}

export function getEffectiveTopSpeed(transmission: Transmission, engine: EngineSpecs, rearTire: TireSize, dragCoefficient: number, frontalArea: number): TopSpeedResult {
  const aeroKmh = calculateMaxAerodynamicSpeed(engine, dragCoefficient, frontalArea);
  const finalDriveRatio = calculateFinalDriveRatio(transmission.sprocket, transmission.chainring);
  const topGearRatio = transmission.gearRatios[transmission.gearRatios.length - 1];
  const rpmKmh = calculateSpeedAtRpm(engine.redlineRpm, transmission.primaryRatio, topGearRatio, finalDriveRatio, rearTire);
  
  if (aeroKmh < rpmKmh) {
    return { speedKmh: aeroKmh, limitedBy: 'aero' };
  }
  return { speedKmh: rpmKmh, limitedBy: 'rpm' };
}

export function getParametricTorque(rpm: number, engine: EngineSpecs): number {
  if (rpm < 1000) return 0;
  if (rpm > engine.redlineRpm) return 0;
  
  const hpToNm = (hp: number, r: number) => (hp * 7120.09) / r; 
  
  const torqueAtMaxPower = hpToNm(engine.maxPowerHp, engine.maxPowerRpm);
  
  if (rpm <= engine.maxTorqueRpm) {
    return engine.maxTorqueNm * (1 - Math.pow((rpm - engine.maxTorqueRpm)/engine.maxTorqueRpm, 2));
  } else {
    const ratio = (rpm - engine.maxTorqueRpm) / (engine.maxPowerRpm - engine.maxTorqueRpm);
    const interpolated = engine.maxTorqueNm - ratio * (engine.maxTorqueNm - torqueAtMaxPower);
    
    if (rpm > engine.maxPowerRpm) {
      const overRatio = (rpm - engine.maxPowerRpm) / (engine.redlineRpm - engine.maxPowerRpm);
      return Math.max(0, torqueAtMaxPower * (1 - Math.pow(overRatio, 2)));
    }
    return interpolated;
  }
}

export function simulateAcceleration(bike: MotorcycleBase, modTransmission: Transmission, modRearTire: TireSize): AccelerationResult {
  const dt = 0.01; 
  let t = 0;
  let v = 0; 
  let x = 0; 
  let gearIndex = 0;
  
  let time0To100 = 0;
  
  const mass = bike.weightKg + bike.riderWeightKg;
  const area = bike.frontalArea;
  const cd = bike.dragCoefficient;
  const tireRadiusM = calculateTireCircumference(modRearTire) / (2 * Math.PI * 1000);
  const finalDrive = calculateFinalDriveRatio(modTransmission.sprocket, modTransmission.chainring);
  
  const maxWheelieForce = mass * GRAVITY * (bike.wheelbaseM || 1.4) / (2 * (bike.centerOfGravityHeightM || 0.6));
  const effectiveMass = mass * 1.05; 
  
  while (x < 200 && t < 30) {
    const gearRatio = modTransmission.gearRatios[gearIndex];
    const totalRatio = modTransmission.primaryRatio * gearRatio * finalDrive;
    
    let rpm = (v * 60) / (2 * Math.PI * tireRadiusM) * totalRatio;
    
    if (rpm < 3000 && gearIndex === 0) rpm = 3000;
    
    if (rpm > bike.engine.maxPowerRpm * 1.05 && gearIndex < modTransmission.gearRatios.length - 1) {
      gearIndex++;
      t += 0.2; 
      continue;
    }
    
    const engineTorque = getParametricTorque(rpm, bike.engine);
    let wheelForce = (engineTorque * totalRatio * DRIVETRAIN_EFFICIENCY) / tireRadiusM;
    
    if (wheelForce > maxWheelieForce) {
      wheelForce = maxWheelieForce;
    }
    
    const drag = 0.5 * RHO_AIR * cd * area * v * v;
    const rolling = mass * GRAVITY * ROLLING_RESISTANCE_COEF;
    
    const netForce = wheelForce - drag - rolling;
    const accel = Math.max(0, netForce / effectiveMass);
    
    v += accel * dt;
    x += v * dt;
    t += dt;
    
    if (v >= (100 / 3.6) && time0To100 === 0) time0To100 = t;
  }
  
  const time0To200m = t;
  const speedAt200m = v * 3.6;
  
  let t60to120 = 0;
  let vTop = 60 / 3.6;
  const topGearIndex = modTransmission.gearRatios.length - 1;
  while (vTop < (120 / 3.6) && t60to120 < 60) {
    const totalRatio = modTransmission.primaryRatio * modTransmission.gearRatios[topGearIndex] * finalDrive;
    const rpm = (vTop * 60) / (2 * Math.PI * tireRadiusM) * totalRatio;
    const engineTorque = getParametricTorque(rpm, bike.engine);
    const wheelForce = (engineTorque * totalRatio * DRIVETRAIN_EFFICIENCY) / tireRadiusM;
    const drag = 0.5 * RHO_AIR * cd * area * vTop * vTop;
    const rolling = mass * GRAVITY * ROLLING_RESISTANCE_COEF;
    const netForce = wheelForce - drag - rolling;
    const accel = Math.max(0, netForce / effectiveMass);
    if(accel === 0) {
       t60to120 = Infinity; 
       break;
    }
    vTop += accel * dt;
    t60to120 += dt;
  }
  
  return {
    time0To100: time0To100 || Infinity,
    time0To200m,
    speedAt200m,
    time60To120TopGear: t60to120
  };
}

export function calculateCruising(bike: MotorcycleBase, modTransmission: Transmission, modRearTire: TireSize): CruisingResult {
  const finalDrive = calculateFinalDriveRatio(modTransmission.sprocket, modTransmission.chainring);
  const topGearRatio = modTransmission.gearRatios[modTransmission.gearRatios.length - 1];

  const rpmAt100 = calculateRpmAtSpeed(100, modTransmission.primaryRatio, topGearRatio, finalDrive, modRearTire);
  const rpmAt120 = calculateRpmAtSpeed(120, modTransmission.primaryRatio, topGearRatio, finalDrive, modRearTire);

  const baseFinalDrive = calculateFinalDriveRatio(bike.transmission.sprocket, bike.transmission.chainring);
  const baseRpmAt100 = calculateRpmAtSpeed(100, bike.transmission.primaryRatio, bike.transmission.gearRatios[bike.transmission.gearRatios.length - 1], baseFinalDrive, bike.rearTire);

  return {
    rpmAt100,
    rpmAt120,
    relativeConsumptionPercent: ((rpmAt100 / baseRpmAt100) - 1) * 100
  };
}

// New function: relative traction force (mod vs base) matching test signature
export function calculateRelativeTractionForce(baseRear: TireSize, baseTransmission: Transmission, modRear: TireSize, modTransmission: Transmission, gearIndex: number = 0): number {
  // Compute final drive ratios
  const baseFinalDrive = calculateFinalDriveRatio(baseTransmission.sprocket, baseTransmission.chainring);
  const modFinalDrive = calculateFinalDriveRatio(modTransmission.sprocket, modTransmission.chainring);

  // Determine gear ratios (use first gear if index out of range)
  const baseGearRatio = baseTransmission.gearRatios[gearIndex] ?? baseTransmission.gearRatios[0];
  const modGearRatio = modTransmission.gearRatios[gearIndex] ?? modTransmission.gearRatios[0];

  // Total drivetrain ratio (primary * gear * final)
  const baseTotalRatio = baseTransmission.primaryRatio * baseGearRatio * baseFinalDrive;
  const modTotalRatio = modTransmission.primaryRatio * modGearRatio * modFinalDrive;

  // Tire radius (both rear tires) – cancels out if same, but include for completeness
  const tireRadiusBase = calculateTireCircumference(baseRear) / (2 * Math.PI * 1000);
  const tireRadiusMod = calculateTireCircumference(modRear) / (2 * Math.PI * 1000);

  // Assuming engine torque is identical for base and mod (tests use same engine), the traction factor simplifies to ratio of total drivetrain ratios adjusted by tire radius.
  return (modTotalRatio / baseTotalRatio) * (tireRadiusBase / tireRadiusMod);
}




import { describe, it, expect } from 'vitest';
import { TireSize, Transmission, EngineSpecs } from '../types';
import { 
  calculateTireDiameter, 
  calculateTireCircumference, 
  calculateSpeedometerError 
} from '../tires';
import {
  calculateFinalDriveRatio,
  calculateSpeedAtRpm,
  calculateRelativeTractionForce
} from '../physics';

describe('Tires module', () => {
  const mt07Rear: TireSize = { width: 180, profile: 55, rim: 17 };

  it('calculates tire diameter correctly', () => {
    // 17 * 25.4 = 431.8
    // 180 * 0.55 = 99
    // 431.8 + (99 * 2) = 629.8
    const diam = calculateTireDiameter(mt07Rear);
    expect(diam).toBeCloseTo(629.8, 1);
  });

  it('calculates tire circumference correctly', () => {
    const circ = calculateTireCircumference(mt07Rear);
    // 629.8 * PI ≈ 1978.57
    expect(circ).toBeCloseTo(1978.57, 1);
  });

  it('calculates speedometer error correctly', () => {
    const original: TireSize = { width: 140, profile: 70, rim: 17 };
    const bigger: TireSize = { width: 150, profile: 70, rim: 17 }; // Más diámetro

    // La llanta más grande avanza más, así que vas más rápido de lo que marca
    const error = calculateSpeedometerError(original, bigger);
    expect(error).toBeGreaterThan(0);
    // Cálculo exacto: original diam = 431.8 + 196 = 627.8
    // bigger diam = 431.8 + 210 = 641.8
    // error = (641.8 / 627.8) - 1 ≈ 2.23%
    expect(error).toBeCloseTo(2.23, 2);
  });
});

describe('Physics module', () => {
  const mt07Transmission: Transmission = {
    primaryRatio: 1.925,
    gearRatios: [2.846, 2.125, 1.631, 1.300, 1.090, 0.964],
    sprocket: 16,
    chainring: 43
  };

  const mt07Rear: TireSize = { width: 180, profile: 55, rim: 17 };

  it('calculates final drive ratio', () => {
    const ratio = calculateFinalDriveRatio(16, 43);
    expect(ratio).toBeCloseTo(2.6875, 4);
  });

  it('calculates speed at rpm correctly', () => {
    const finalDrive = calculateFinalDriveRatio(mt07Transmission.sprocket, mt07Transmission.chainring);
    
    // A 10000 RPM en 6ta marcha
    const topSpeed6th = calculateSpeedAtRpm(
      10000, 
      mt07Transmission.primaryRatio, 
      mt07Transmission.gearRatios[5], 
      finalDrive, 
      mt07Rear
    );

    // Speed ≈ 238 km/h teóricos en el corte
    expect(topSpeed6th).toBeCloseTo(238.03, 1);
  });

  it('calculates relative traction force correctly when sprocket is reduced', () => {
    // Al bajar el piñón (de 16 a 15), la fuerza de tracción debe aumentar
    const modTransmission: Transmission = { ...mt07Transmission, sprocket: 15 };
    
    const forceFactor = calculateRelativeTractionForce(
      mt07Rear, mt07Transmission,
      mt07Rear, modTransmission,
      0 // 1ra marcha
    );

    // Relación original = 43/16 = 2.6875
    // Relación nueva = 43/15 = 2.8666
    // Incremento = 2.8666 / 2.6875 = 1.0666 (6.66% más fuerza)
    expect(forceFactor).toBeCloseTo(1.0666, 3);
  });
});

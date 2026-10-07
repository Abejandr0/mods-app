import type { TireSize, TireValidationResult } from './types';

export const INCH_TO_MM = 25.4;

export function calculateTireDiameter(tire: TireSize): number {
  const rimMm = tire.rim * INCH_TO_MM;
  const sidewallMm = tire.width * (tire.profile / 100);
  return rimMm + (sidewallMm * 2);
}

export function calculateTireCircumference(tire: TireSize): number {
  const diameter = calculateTireDiameter(tire);
  return diameter * Math.PI;
}

export function calculateSpeedometerError(originalTire: TireSize, newTire: TireSize): number {
  const originalCirc = calculateTireCircumference(originalTire);
  const newCirc = calculateTireCircumference(newTire);
  return ((newCirc / originalCirc) - 1) * 100;
}

export function validateTireChange(baseTire: TireSize, modTire: TireSize): TireValidationResult {
  const baseDiam = calculateTireDiameter(baseTire);
  const modDiam = calculateTireDiameter(modTire);
  
  const diamDiff = modDiam - baseDiam;
  const clearanceChangeMm = - (diamDiff / 2); // Si diámetro sube, holgura baja
  const rideHeightChangeMm = diamDiff / 2;    // Si diámetro sube, altura sube
  
  const warnings: string[] = [];
  
  if (Math.abs(modTire.width - baseTire.width) > 20) {
    warnings.push("El cambio de ancho es muy agresivo y podría no asentar bien en el rin original.");
  }
  
  if (clearanceChangeMm < -15) {
    warnings.push("La llanta es considerablemente más grande; podría rozar el basculante o guardabarros.");
  }

  return {
    isValid: true,
    clearanceChangeMm,
    rideHeightChangeMm,
    warnings
  };
}

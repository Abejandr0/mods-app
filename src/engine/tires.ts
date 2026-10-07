import type { TireSize } from './types';

// Convierte pulgadas a milímetros
export const INCH_TO_MM = 25.4;

/**
 * Calcula el diámetro total de la llanta en milímetros.
 * Fórmula: (rim * 25.4) + 2 * (width * profile / 100)
 */
export function calculateTireDiameter(tire: TireSize): number {
  const rimMm = tire.rim * INCH_TO_MM;
  const sidewallMm = tire.width * (tire.profile / 100);
  return rimMm + (sidewallMm * 2);
}

/**
 * Calcula la circunferencia de la llanta en milímetros.
 * Fórmula: diámetro * Pi
 */
export function calculateTireCircumference(tire: TireSize): number {
  const diameter = calculateTireDiameter(tire);
  return diameter * Math.PI;
}

/**
 * Calcula el error porcentual del velocímetro basado en el cambio de diámetro.
 * Si la nueva llanta es más grande, avanzas más distancia por cada revolución.
 * Como el velocímetro lee las revoluciones del piñón/sensor base, a igual RPM 
 * con una llanta más grande, irás MÁS rápido de lo que marca el velocímetro.
 * Error = ((Nueva Circunferencia / Original Circunferencia) - 1) * 100
 */
export function calculateSpeedometerError(originalTire: TireSize, newTire: TireSize): number {
  const originalCirc = calculateTireCircumference(originalTire);
  const newCirc = calculateTireCircumference(newTire);
  return ((newCirc / originalCirc) - 1) * 100;
}

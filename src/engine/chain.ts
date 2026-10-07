import type { Transmission, ChainResult } from './types';

export function calculateChainLinks(transmission: Transmission, distanceBetweenCentersMm: number = 650): number {
  const p = transmission.chainPitch === 520 ? 15.875 : (transmission.chainPitch ? (transmission.chainPitch/100)*25.4 : 15.875);
  const C = distanceBetweenCentersMm;
  const N1 = transmission.sprocket;
  const N2 = transmission.chainring;
  
  const term1 = (2 * C) / p;
  const term2 = (N1 + N2) / 2;
  const term3 = (p * Math.pow(N2 - N1, 2)) / (39.48 * C);
  
  const links = term1 + term2 + term3;
  return Math.ceil(links / 2) * 2;
}

export function validateChainTensor(baseTrans: Transmission, modTrans: Transmission): ChainResult {
  const baseLinks = baseTrans.chainLinks || calculateChainLinks(baseTrans);
  const modLinks = calculateChainLinks(modTrans);
  
  const diff = modLinks - baseLinks;
  // Tolerance of +/- 2 links
  const tensorWarning = Math.abs(diff) > 2;
  
  return {
    links: modLinks,
    tensorWarning,
    warningMessage: tensorWarning ? `La cadena actual podría quedar demasiado ${diff > 0 ? 'corta' : 'larga'}. Ajuste de tensor excedido.` : undefined
  };
}

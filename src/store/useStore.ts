import { create } from 'zustand';
import type { MotorcycleBase, Modifications, TireSize } from '../engine/types';
import bikesData from '../data/bikes.json';

interface ModSimState {
  baseBike: MotorcycleBase;
  modifications: Modifications;
  theme: 'light' | 'dark';
  setBaseBike: (bikeId: string) => void;
  updateRearTire: (tire: Partial<TireSize>) => void;
  updateSprocket: (teeth: number) => void;
  updateChainring: (teeth: number) => void;
  resetModifications: () => void;
  toggleTheme: () => void;
}

const defaultBike = bikesData[0] as MotorcycleBase;

export const useStore = create<ModSimState>((set) => ({
  baseBike: defaultBike,
  modifications: {},
  theme: 'light',
  setBaseBike: (bikeId) => {
    const bike = (bikesData as MotorcycleBase[]).find((b) => b.id === bikeId) || defaultBike;
    set({ baseBike: bike, modifications: {} });
  },

  updateRearTire: (tireUpdate) => set((state) => ({
    modifications: {
      ...state.modifications,
      rearTire: {
        ...(state.modifications.rearTire || state.baseBike.rearTire),
        ...tireUpdate
      }
    }
  })),

  updateSprocket: (teeth) => set((state) => ({
    modifications: {
      ...state.modifications,
      sprocket: teeth
    }
  })),

  updateChainring: (teeth) => set((state) => ({
    modifications: {
      ...state.modifications,
      chainring: teeth
    }
  })),

  resetModifications: () => set({ modifications: {} }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));

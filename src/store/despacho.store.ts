import { create } from 'zustand';

interface DespachoState {
  fechaSeleccionada: string;
  zonaSeleccionada: string | null;
  setFecha: (fecha: string) => void;
  setZona: (zona_id: string | null) => void;
}

function getFechaHoy(): string {
  return new Date().toISOString().split('T')[0];
}

export const useDespachoStore = create<DespachoState>((set) => ({
  fechaSeleccionada: getFechaHoy(),
  zonaSeleccionada: null,
  setFecha: (fecha) => set({ fechaSeleccionada: fecha }),
  setZona: (zona_id) => set({ zonaSeleccionada: zona_id }),
}));

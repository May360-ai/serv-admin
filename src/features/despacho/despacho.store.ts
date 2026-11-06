import { create } from 'zustand';

interface DespachoState {
  fechaSeleccionada: string;
  zonaSeleccionada: string | null;
  setFecha: (fecha: string) => void;
  setZona: (zona_id: string | null) => void;
}

export function getFechaHoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}

export const useDespachoStore = create<DespachoState>((set) => ({
  fechaSeleccionada: '',
  zonaSeleccionada: null,
  setFecha: (fecha) => set({ fechaSeleccionada: fecha }),
  setZona: (zona_id) => set({ zonaSeleccionada: zona_id }),
}));

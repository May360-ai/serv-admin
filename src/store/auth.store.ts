import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Usuario } from '@/types';

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  setAuth: (usuario: Usuario, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      token: null,
      setAuth: (usuario, token) => set({ usuario, token }),
      clearAuth: () => set({ usuario: null, token: null }),
    }),
    {
      name: 'serv-auth',
    }
  )
);

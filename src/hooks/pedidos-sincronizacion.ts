import type { Usuario } from '@/types';

export const INTERVALO_PEDIDOS_MS = 30_000;

/** PATCH de estados no emite eventos; HTTP sigue siendo la fuente de verdad. */
export function sincronizacionPedidos(rol: Usuario['rol'] | undefined) {
  const consultar = rol === 'cliente' || rol === 'proveedor';
  return {
    staleTime: INTERVALO_PEDIDOS_MS,
    gcTime: 0,
    refetchInterval: ({ state }: { state: { status: string } }): number | false =>
      consultar && state.status !== 'error' ? INTERVALO_PEDIDOS_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: consultar ? 'always' as const : false as const,
    refetchOnReconnect: consultar ? 'always' as const : false as const,
  };
}

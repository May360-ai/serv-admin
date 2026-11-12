'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { consultarPedidosAdministracion, consultarDetallePedido, idPedidoValido, type FiltrosAdministracion } from '@/services/pedidos-consultas.service';
import { ContratoPedidosError } from '@/services/pedidos-contrato';
import { ErrorHttp } from '@/lib/error-http';
import { sincronizacionPedidos } from './pedidos-sincronizacion';

export function usePedidosAdministracion(filtros: FiltrosAdministracion) {
  const usuario = useAuthStore(s => s.usuario);
  return useQuery({
    queryKey: ['pedidos', 'administracion', usuario?.id, usuario?.rol, filtros],
    enabled: Boolean(usuario?.id) && usuario?.rol === 'administrador',
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) => {
      if (!usuario?.id || usuario.rol !== 'administrador') throw new ContratoPedidosError('La consulta global requiere una sesión de administrador.');
      return consultarPedidosAdministracion(filtros, signal);
    },
    gcTime: 0, staleTime: 30_000,
    retry: (intentos, error) => !(error instanceof ContratoPedidosError) && !(error instanceof ErrorHttp && error.status && error.status < 500) && intentos < 2,
  });
}

export function useDetallePedido(pedidoId: string) {
  const usuario = useAuthStore(s => s.usuario);
  const autorizado = usuario && ['administrador', 'cliente', 'proveedor', 'repartidor'].includes(usuario.rol);
  return useQuery({
    queryKey: ['pedidos', 'detalle', usuario?.id, usuario?.rol, pedidoId],
    enabled: Boolean(usuario?.id && autorizado && idPedidoValido(pedidoId)),
    queryFn: async ({ signal }: { signal?: AbortSignal } = {}) => {
      if (!autorizado || !usuario?.id) throw new ContratoPedidosError('Tu sesión no permite consultar el detalle.');
      const pedido = await consultarDetallePedido(pedidoId, usuario.rol, signal);
      if ((usuario.rol === 'cliente' && String(pedido.cliente_id) !== String(usuario.id)) ||
        (usuario.rol === 'proveedor' && usuario.proveedor_id != null && String(pedido.proveedores.id) !== String(usuario.proveedor_id)) ||
        (usuario.rol === 'repartidor' && (!pedido.ruta || String(pedido.ruta.repartidor_id) !== String(usuario.id)))) {
        throw new ContratoPedidosError('El pedido recibido no corresponde a esta sesión.');
      }
      return pedido;
    },
    ...sincronizacionPedidos(usuario?.rol),
    retry: (intentos, error) => !(error instanceof ContratoPedidosError) && !(error instanceof ErrorHttp && error.status && error.status < 500) && intentos < 2,
  });
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMemo } from 'react';
import { pedidosService, crearRegistroPedido } from '@/services/pedidos.service';
import { ContratoPedidosError } from '@/services/pedidos-contrato';
import type { ItemCatalogo } from '@/services/items.service';
import { useAuthStore } from '@/store/auth.store';
import { sincronizacionPedidos } from './pedidos-sincronizacion';
import { consultarMisPedidos } from '@/services/seguimiento.service';
import type { FiltrosPedidos, CrearPedidoRequest, CambiarEstadoRequest } from '@/types';

export const PEDIDOS_QUERY_KEY = 'pedidos' as const;

export function usePedidosTienda(filtros?: FiltrosPedidos) {
  const usuario = useAuthStore(s => s.usuario);
  return useQuery({
    queryKey: [PEDIDOS_QUERY_KEY, 'tienda', usuario?.id, usuario?.rol, filtros],
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) => pedidosService.listarPedidosTienda(filtros, signal),
    enabled: usuario?.rol === 'proveedor',
    ...sincronizacionPedidos(usuario?.rol),
  });
}

export function useMisPedidosCliente() {
  const usuario = useAuthStore(s => s.usuario);
  return useQuery({
    queryKey: ['mis-pedidos-cliente', usuario?.id, usuario?.rol],
    enabled: Boolean(usuario?.id) && usuario?.rol === 'cliente',
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) => {
      if (usuario?.rol !== 'cliente' || !usuario.id) throw new ContratoPedidosError('Esta vista requiere una sesión de cliente.');
      return consultarMisPedidos(usuario.id, signal);
    },
    ...sincronizacionPedidos(usuario?.rol),
  });
}

export function useTodosPedidos(filtros?: FiltrosPedidos) {
  const usuario = useAuthStore(s => s.usuario);
  return useQuery({
    // Nombre conservado para despacho; el alcance siempre se decide por rol.
    queryKey: [PEDIDOS_QUERY_KEY, usuario?.id, usuario?.rol, filtros],
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) => pedidosService.listarPedidosPorRol(usuario?.rol, filtros, signal),
    enabled: Boolean(usuario),
    retry: (intentos, error) => !(error instanceof ContratoPedidosError) && intentos < 2,
    ...sincronizacionPedidos(usuario?.rol),
  });
}

export function useCrearPedido(catalogo: ItemCatalogo[]) {
  const queryClient = useQueryClient();
  const usuario = useAuthStore(s => s.usuario);
  const registrar = useMemo(() => crearRegistroPedido(usuario?.id), [usuario?.id]);

  return useMutation({
    mutationFn: (body: CrearPedidoRequest) => registrar(body, usuario, catalogo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PEDIDOS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['mis-pedidos-cliente'] });
      toast.success('Pedido creado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al crear el pedido: ${error.message}`);
    },
  });
}

export function useCambiarEstado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CambiarEstadoRequest }) =>
      pedidosService.cambiarEstado(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PEDIDOS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['mis-pedidos-cliente'] });
      toast.success('Estado actualizado');
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar el estado: ${error.message}`);
    },
  });
}

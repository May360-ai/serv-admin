'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pedidosService } from '@/services/pedidos.service';
import type { FiltrosPedidos, CrearPedidoRequest, CambiarEstadoRequest } from '@/types';

export const PEDIDOS_QUERY_KEY = 'pedidos' as const;

export function usePedidosTienda(filtros?: FiltrosPedidos) {
  return useQuery({
    queryKey: [PEDIDOS_QUERY_KEY, 'tienda', filtros],
    queryFn: () => pedidosService.listarPedidosTienda(filtros),
    staleTime: 30_000,
  });
}

export function useTodosPedidos(filtros?: FiltrosPedidos) {
  return useQuery({
    queryKey: [PEDIDOS_QUERY_KEY, 'todos', filtros],
    queryFn: () => pedidosService.listarTodosPedidos(filtros),
    staleTime: 15_000,
  });
}

export function usePedido(id: string) {
  return useQuery({
    queryKey: [PEDIDOS_QUERY_KEY, id],
    queryFn: () => pedidosService.obtenerPedido(id),
    enabled: Boolean(id),
  });
}

export function useCrearPedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CrearPedidoRequest) => pedidosService.crearPedido(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PEDIDOS_QUERY_KEY] });
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
      toast.success('Estado actualizado');
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar el estado: ${error.message}`);
    },
  });
}

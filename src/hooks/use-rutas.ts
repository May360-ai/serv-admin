'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rutasService } from '@/services/rutas.service';
import type {
  FiltrosRutas,
  ArmarRutasRequest,
  AgregarPedidoARutaRequest,
  TransferirPedidoRequest,
} from '@/types';

export const RUTAS_QUERY_KEY = 'rutas' as const;

export function useRutas(filtros: FiltrosRutas) {
  return useQuery({
    queryKey: [RUTAS_QUERY_KEY, filtros],
    queryFn: () => rutasService.listarRutas(filtros),
    staleTime: 10_000,
    enabled: Boolean(filtros.fecha_entrega),
  });
}

export function useArmarRutas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ArmarRutasRequest) => rutasService.armarRutas(body),
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
      toast.success(
        `Armado completado: ${resultado.rutas_creadas} rutas, ${resultado.pedidos_asignados} pedidos asignados`
      );
    },
    onError: (error: Error) => {
      toast.error(`Error al armar rutas: ${error.message}`);
    },
  });
}

export function useAgregarPedidoARuta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AgregarPedidoARutaRequest) =>
      rutasService.agregarPedidoARuta(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
      toast.success('Pedido asignado a la ruta');
    },
    onError: (error: Error) => {
      toast.error(`Error al asignar pedido: ${error.message}`);
    },
  });
}

export function useTransferirPedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: TransferirPedidoRequest) =>
      rutasService.transferirPedido(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
      toast.success('Pedido transferido exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al transferir pedido: ${error.message}`);
    },
  });
}

export function useRemoverPedidoDeRuta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruta_id, pedido_id }: { ruta_id: string; pedido_id: string }) =>
      rutasService.removerPedidoDeRuta(ruta_id, pedido_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
      toast.success('Pedido removido de la ruta');
    },
    onError: (error: Error) => {
      toast.error(`Error al remover pedido: ${error.message}`);
    },
  });
}

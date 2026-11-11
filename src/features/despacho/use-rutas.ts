'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rutasService } from '@/features/despacho/rutas.service';
import { useAuthStore } from '@/store/auth.store';
import { mensajeErrorDespacho } from './elegibilidad';
import type {
  FiltrosRutas,
  ArmarRutasRequest,
  AgregarPedidoARutaRequest,
  TransferirPedidoRequest,
} from '@/types';

export const RUTAS_QUERY_KEY = 'rutas' as const;
export const REPARTIDORES_QUERY_KEY = 'repartidores-despacho' as const;

export function useDisponibilidadRepartidores(fecha: string, enabled: boolean) {
  const usuario = useAuthStore(s => s.usuario);
  const alcanceGlobal = usuario?.rol === 'administrador';
  const puedeConsultar = alcanceGlobal || (usuario?.rol === 'proveedor' && usuario.proveedor_id != null);
  const consulta = useQuery({
    queryKey: [REPARTIDORES_QUERY_KEY, usuario?.id, usuario?.rol, usuario?.proveedor_id, fecha],
    enabled: enabled && puedeConsultar && Boolean(fecha),
    queryFn: async () => {
      if (!puedeConsultar) throw new Error('No tienes permiso para consultar repartidores');
      const [activos, asignaciones] = await Promise.all([
        rutasService.listarRepartidoresActivos(),
        alcanceGlobal ? rutasService.listarAsignaciones(fecha) : Promise.resolve([]),
      ]);
      return { activos, asignaciones };
    },
    staleTime: 0,
  });
  return { ...consulta, alcanceGlobal, puedeConsultar, proveedorId: usuario?.proveedor_id };
}

export function useReasignarRepartidor(onSuccess: () => void) {
  const client = useQueryClient();
  const actualizar = () => {
    void client.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
    void client.invalidateQueries({ queryKey: [REPARTIDORES_QUERY_KEY] });
  };
  return useMutation({
    mutationFn: ({ rutaId, repartidorId }: { rutaId: string; repartidorId: string }) =>
      rutasService.reasignarRepartidor(rutaId, repartidorId),
    onSuccess: () => {
      actualizar();
      toast.success('Repartidor reasignado correctamente');
      onSuccess();
    },
    onError: (error: Error) => {
      actualizar();
      toast.error(`Error al reasignar: ${mensajeErrorDespacho(error)}`);
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido asignado a la ruta');
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.error(`Error al asignar pedido: ${mensajeErrorDespacho(error)}`);
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

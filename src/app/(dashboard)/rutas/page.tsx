'use client';

import { useState, useCallback } from 'react';
import { Zap, Filter, RefreshCw, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanRutas } from '@/components/rutas/kanban-rutas';
import { PanelPedidosLibres } from '@/components/rutas/panel-pedidos-libres';
import { ModalAjusteRuta } from '@/components/rutas/modal-ajuste-ruta';
import { useRutas, useArmarRutas, RUTAS_QUERY_KEY } from '@/hooks/use-rutas';
import { useTodosPedidos } from '@/hooks/use-pedidos';
import { useDespachoStore } from '@/store/despacho.store';
import { rutasService } from '@/services/rutas.service';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { zonasService } from '@/services/zonas.service';
import type { Ruta, Repartidor } from '@/types';

export default function RutasPage() {
  const queryClient = useQueryClient();
  const { fechaSeleccionada, zonaSeleccionada, setFecha, setZona } = useDespachoStore();
  const [isReordenando, setIsReordenando] = useState(false);
  const [rutaAjustando, setRutaAjustando] = useState<Ruta | null>(null);

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: zonasService.listarZonas,
    staleTime: 300_000,
  });

  const {
    data: rutas = [],
    isLoading: isLoadingRutas,
    refetch: refetchRutas,
  } = useRutas({
    fecha_entrega: fechaSeleccionada,
    zona_id: zonaSeleccionada ?? undefined,
  });

  const {
    data: pedidosPaginados,
    isLoading: isLoadingPedidos,
  } = useTodosPedidos({
    estado: 'aceptado',
    fecha: fechaSeleccionada,
    zona_id: zonaSeleccionada ?? undefined,
  });

  const pedidosLibres = pedidosPaginados?.data.filter(
    (p) => !p.ruta_id
  ) ?? [];

  const { mutate: armarRutas, isPending: armando } = useArmarRutas();

  const handleArmarRutas = () => {
    armarRutas({
      fecha_entrega: fechaSeleccionada,
      zona_id: zonaSeleccionada ?? undefined,
    });
  };

  const handleReordenar = useCallback(
    async (ruta_id: string, nuevaOrden: string[]) => {
      if (isReordenando) return;
      setIsReordenando(true);
      try {
        await rutasService.reordenarPedidos(ruta_id, nuevaOrden);
        queryClient.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
        toast.success('Orden actualizado');
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Error al reordenar';
        toast.error(mensaje);
      } finally {
        setIsReordenando(false);
      }
    },
    [isReordenando, queryClient]
  );

  // Extraer repartidores asignados o disponibles para el selector de ajuste
  const repartidoresDisponibles: Repartidor[] = rutas
    .map((r) => r.repartidor)
    .filter((rep): rep is Repartidor => rep !== undefined);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de Despacho</h1>
          <p className="text-muted-foreground text-sm">
            Gestión y armado de rutas — {rutas.length} ruta(s) activa(s)
          </p>
        </div>
        <Button
          onClick={handleArmarRutas}
          isLoading={armando}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 shadow-md"
          data-cy="btn-armar-rutas"
        >
          <Zap className="h-4 w-4" />
          {armando ? 'Armando rutas...' : 'Disparar Armado Automático'}
        </Button>
      </div>

      {/* Barra de Control */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-lg border border-border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFecha(e.target.value)}
            className="w-40 h-9"
            data-cy="input-fecha-entrega"
          />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={zonaSeleccionada ?? ''}
            onChange={(e) => setZona(e.target.value || null)}
            className="w-40 h-9"
            data-cy="select-zona"
          >
            <option value="">Todas las zonas</option>
            {zonas.map((zona) => (
              <option key={zona.id} value={zona.id}>
                {zona.nombre}
              </option>
            ))}
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchRutas()}
          className="ml-auto gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Layout dividido */}
      <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
        {/* Panel izquierdo: Pedidos pendientes */}
        <div className="w-72 shrink-0 bg-card border border-border rounded-lg p-4 flex flex-col overflow-hidden">
          <PanelPedidosLibres
            pedidos={pedidosLibres}
            rutas={rutas}
            isLoading={isLoadingPedidos}
          />
        </div>

        {/* Área principal: Rutas por repartidor */}
        <div className="flex-1 bg-card border border-border rounded-lg p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Rutas Activas por Repartidor</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Disponible
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                En ruta
              </span>
            </div>
          </div>

          {isLoadingRutas ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-72 h-96 shrink-0 rounded-lg" />
              ))}
            </div>
          ) : (
            <KanbanRutas
              rutas={rutas}
              onReordenar={handleReordenar}
              onAjustar={(r) => setRutaAjustando(r)}
            />
          )}
        </div>
      </div>

      {/* Modal de ajuste manual de ruta */}
      <ModalAjusteRuta
        ruta={rutaAjustando}
        repartidoresDisponibles={repartidoresDisponibles}
        open={Boolean(rutaAjustando)}
        onOpenChange={(open) => {
          if (!open) setRutaAjustando(null);
        }}
      />
    </div>
  );
}

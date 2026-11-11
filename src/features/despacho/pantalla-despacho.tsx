'use client';

import { useState, useCallback, useEffect } from 'react';
import { Route, ChevronLeft, ChevronRight, RefreshCw, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanRutas } from '@/features/despacho/kanban-rutas';
import { PanelPedidosLibres } from '@/features/despacho/panel-pedidos-libres';
import { ModalAjusteRuta } from '@/features/despacho/modal-ajuste-ruta';
import { useRutas, useArmarRutas, RUTAS_QUERY_KEY } from '@/features/despacho/use-rutas';
import { useTodosPedidos } from '@/hooks/use-pedidos';
import { getFechaHoy, useDespachoStore } from '@/features/despacho/despacho.store';
import { rutasService } from '@/features/despacho/rutas.service';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { zonasService } from '@/services/zonas.service';
import type { Ruta } from '@/types';
import { EntregasAtrasadas } from './entregas-atrasadas';

export default function RutasPage() {
  const queryClient = useQueryClient();
  const { fechaSeleccionada, zonaSeleccionada, setFecha, setZona } = useDespachoStore();
  useEffect(() => {
    if (!fechaSeleccionada) setFecha(getFechaHoy());
  }, [fechaSeleccionada, setFecha]);
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
    error: errorRutas,
    refetch: refetchRutas,
  } = useRutas({
    fecha_entrega: fechaSeleccionada,
    zona_id: zonaSeleccionada ?? undefined,
  });

  const {
    data: pedidosPaginados,
    isLoading: isLoadingPedidos,
    refetch: refetchPedidos,
    error: errorPedidos,
  } = useTodosPedidos({

    fecha: fechaSeleccionada,
    zona_id: zonaSeleccionada ?? undefined,
  });

  const pedidosLibres = pedidosPaginados?.data.filter(
    (p) => !p.ruta_id && p.fecha_entrega === fechaSeleccionada && (!zonaSeleccionada || p.zona_id === zonaSeleccionada) && ['pendiente', 'aceptado'].includes(p.estado)
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

  if (!fechaSeleccionada) return <p>Cargando despacho…</p>;

  function moverDia(paso: number) {
    const fecha = new Date(fechaSeleccionada + 'T12:00:00Z');
    fecha.setUTCDate(fecha.getUTCDate() + paso);
    setFecha(fecha.toISOString().slice(0, 10));
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Despacho</h1>
          <p className="text-muted-foreground text-sm">
            Rutas: {rutas.length} · Pedidos asignados: {rutas.reduce((total, ruta) => total + ruta.pedidos.length, 0)}
          </p>
        </div>
        <Button
          onClick={handleArmarRutas}
          isLoading={armando}
          className="font-semibold gap-2"
          data-cy="btn-armar-rutas"
        >
          <Route className="h-4 w-4" />
          {armando ? 'Armando rutas...' : 'Armar rutas'}
        </Button>
      </div>

      {/* Barra de Control */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-lg border border-border">


        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" aria-label="Día anterior" onClick={() => moverDia(-1)}><ChevronLeft size={16} /></Button>
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            aria-label="Fecha de entrega"
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            className="w-36 h-9"
            data-cy="input-fecha-entrega"
          />
          <Button variant="ghost" size="icon" aria-label="Día siguiente" onClick={() => moverDia(1)}><ChevronRight size={16} /></Button>
          <Button variant="outline" size="sm" onClick={() => setFecha(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date()))}>Hoy</Button>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            aria-label="Zona de reparto"
            value={zonaSeleccionada ?? ''}
            onChange={(e) => setZona(e.target.value || null)}
            className="w-36 h-9"
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
          onClick={() => { void refetchRutas(); void refetchPedidos(); }}
          className="ml-auto gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <EntregasAtrasadas zona={zonaSeleccionada} />
      {/* Layout dividido */}
      <div className="flex flex-1 flex-col gap-4 min-h-0 lg:flex-row">
        {/* Panel izquierdo: Pedidos pendientes */}
        <div className="w-full lg:w-72 shrink-0 bg-card border border-border rounded-lg p-4 flex flex-col overflow-hidden">
          {errorPedidos ? <p role="alert">No se pudieron cargar los pedidos. Pulsa Actualizar.</p> : <PanelPedidosLibres
            pedidos={pedidosLibres}
            rutas={rutas}
            isLoading={isLoadingPedidos}
            isLoadingRutas={isLoadingRutas}
            errorRutas={errorRutas}
            onReintentarRutas={() => void refetchRutas()}
          />}
        </div>

        {/* Área principal: Rutas por repartidor */}
        <div className="flex-1 bg-card border border-border rounded-lg p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Rutas por repartidor</h2>
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

          {errorRutas ? (
            <p role="alert" className="text-destructive">No se pudieron cargar las rutas. Pulsa Actualizar para intentarlo de nuevo.</p>
          ) : isLoadingRutas ? (
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
        key={rutaAjustando?.id ?? 'sin-ruta'}
        ruta={rutaAjustando}
        open={Boolean(rutaAjustando)}
        onOpenChange={(open) => {
          if (!open) setRutaAjustando(null);
        }}
      />
    </div>
  );
}

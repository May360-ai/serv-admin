'use client';

import { MapPin, Clock, AlertTriangle, Phone, Package } from 'lucide-react';
import type { Pedido, Ruta } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatHora } from '@/lib/utils';
import { useAgregarPedidoARuta } from '@/features/despacho/use-rutas';
import { esRutaCompatible, mensajeErrorDespacho } from './elegibilidad';

interface PedidoLibreItemProps {
  pedido: Pedido;
  rutas: Ruta[];
}

function PedidoLibreItem({ pedido, rutas }: PedidoLibreItemProps) {
  const { mutate: asignar, isPending, error } = useAgregarPedidoARuta();

  const rutasConCapacidad = rutas.filter(
    (r) => esRutaCompatible(pedido, r)
  );

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 transition-all hover:shadow-sm',
        pedido.ultimo_minuto && 'border-yellow-400 bg-yellow-50/50'
      )}
      data-cy="pedido-libre-item"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{pedido.cliente_nombre}</p>
            {pedido.ultimo_minuto && (
              <Badge variant="warning" className="text-xs py-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Último minuto
              </Badge>
            )}
            {pedido.zona && (
              <Badge variant="outline" className="text-xs py-0">
                {pedido.zona.nombre}
              </Badge>
            )}
          </div>

          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {pedido.cliente_telefono}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {pedido.direccion.calle} {pedido.direccion.numero}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatHora(pedido.ventana_horaria.desde)} - {formatHora(pedido.ventana_horaria.hasta)}
            </div>
          </div>
        </div>
      </div>

      {/* Asignar a ruta */}
      {rutasConCapacidad.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Asignar a:</p>
          <div className="flex flex-wrap gap-1">
            {rutasConCapacidad.map((ruta) => (
              <Button
                key={ruta.id}
                variant="outline"
                size="sm"
                isLoading={isPending}
                onClick={() =>
                  asignar({
                    pedido_id: pedido.id,
                    ruta_id: ruta.id,
                  })
                }
                className="text-xs h-7 px-2"
              >
                {ruta.repartidor?.nombre ?? ruta.nombre} ({ruta.pedidos.length}/{ruta.capacidad_maxima})
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-destructive">{mensajeErrorDespacho(error)}</p>}
      {rutasConCapacidad.length === 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            No hay rutas compatibles con este pedido. Revisa zona, tienda, fecha, estado y capacidad.
          </p>
        </div>
      )}
    </div>
  );
}

interface PanelPedidosLibresProps {
  pedidos: Pedido[];
  rutas: Ruta[];
  isLoading: boolean;
  isLoadingRutas: boolean;
  errorRutas: Error | null;
  onReintentarRutas: () => void;
}

export function PanelPedidosLibres({ pedidos, rutas, isLoading, isLoadingRutas, errorRutas, onReintentarRutas }: PanelPedidosLibresProps) {
  const pedidosOrdenados = [...pedidos].sort((a, b) => {
    // Pedidos de último minuto primero
    if (a.ultimo_minuto && !b.ultimo_minuto) return -1;
    if (!a.ultimo_minuto && b.ultimo_minuto) return 1;
    // Luego por hora de entrega
    return a.ventana_horaria.desde.localeCompare(b.ventana_horaria.desde);
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Pedidos Pendientes</h3>
          <p className="text-xs text-muted-foreground">Sin ruta asignada</p>
        </div>
        <Badge variant={pedidos.length > 0 ? 'warning' : 'secondary'}>
          {pedidos.length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-1">
        {errorRutas ? (
          <p role="alert">No se pudieron cargar las rutas para asignar pedidos. <Button variant="outline" onClick={onReintentarRutas}>Reintentar</Button></p>
        ) : isLoading || isLoadingRutas ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))
        ) : pedidosOrdenados.length === 0 ? (
          <EmptyState
            title="Sin pedidos pendientes"
            description="Todos los pedidos del día están asignados a rutas."
            icon={<Package className="h-8 w-8 text-muted-foreground" />}
          />
        ) : (
          pedidosOrdenados.map((pedido) => (
            <PedidoLibreItem key={pedido.id} pedido={pedido} rutas={rutas} />
          ))
        )}
      </div>
    </div>
  );
}

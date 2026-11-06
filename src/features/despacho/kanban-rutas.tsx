'use client';

import { useState } from 'react';
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  ArrowRight,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import type { Ruta, Pedido } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn, formatHora, getEstadoLabel, getEstadoColor, calcularPorcentajeCapacidad } from '@/lib/utils';
import { useRemoverPedidoDeRuta, useTransferirPedido } from '@/features/despacho/use-rutas';

interface PedidoItemRutaProps {
  pedido: Pedido;
  index: number;
  total: number;
  rutaId: string;
  todasLasRutas: Ruta[];
  onMoverArriba: (pedidoId: string) => void;
  onMoverAbajo: (pedidoId: string) => void;
}

function PedidoItemRuta({
  pedido,
  index,
  total,
  rutaId,
  todasLasRutas,
  onMoverArriba,
  onMoverAbajo,
}: PedidoItemRutaProps) {
  const { mutate: remover, isPending: removiendo } = useRemoverPedidoDeRuta();
  const { mutate: transferir, isPending: transfiriendo } = useTransferirPedido();
  const [showTransfer, setShowTransfer] = useState(false);

  const rutasDestino = todasLasRutas.filter(
    (r) =>
      r.id !== rutaId &&
      r.pedidos.length < r.capacidad_maxima
  );

  return (
    <div
      className="group relative bg-background rounded-md border border-border p-3 hover:border-primary/40 transition-all"
      data-cy="pedido-item-ruta"
    >
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium truncate">{pedido.cliente_nombre}</p>
            {pedido.ultimo_minuto && (
              <Badge variant="warning" className="text-xs py-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Último minuto
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {pedido.direccion.calle} {pedido.direccion.numero}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatHora(pedido.ventana_horaria.desde)}-{formatHora(pedido.ventana_horaria.hasta)}
            </span>
          </div>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs mt-1.5 border', getEstadoColor(pedido.estado))}>
            {getEstadoLabel(pedido.estado)}
          </span>
        </div>

        {/* Controles */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMoverArriba(pedido.id)}
            disabled={index === 0}
            className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mover arriba"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMoverAbajo(pedido.id)}
            disabled={index === total - 1}
            className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mover abajo"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowTransfer(!showTransfer)}
            className="p-0.5 rounded hover:bg-accent"
            aria-label="Transferir"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => remover({ ruta_id: rutaId, pedido_id: pedido.id })}
            disabled={removiendo}
            className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remover"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Dropdown de transferencia */}
      {showTransfer && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1.5">Transferir a ruta:</p>
          {rutasDestino.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No hay rutas con capacidad disponible</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {rutasDestino.map((destRuta) => (
                <button
                  key={destRuta.id}
                  onClick={() => {
                    transferir({
                      pedido_id: pedido.id,
                      ruta_origen_id: rutaId,
                      ruta_destino_id: destRuta.id,
                    });
                    setShowTransfer(false);
                  }}
                  disabled={transfiriendo}
                  className="text-xs bg-secondary hover:bg-accent px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                >
                  {destRuta.nombre} ({destRuta.pedidos.length}/{destRuta.capacidad_maxima})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CardRepartidorProps {
  ruta: Ruta;
  todasLasRutas: Ruta[];
  onReordenar: (ruta_id: string, nuevaOrden: string[]) => void;
  onAjustar?: (ruta: Ruta) => void;
}

function CardRepartidor({ ruta, todasLasRutas, onReordenar, onAjustar }: CardRepartidorProps) {
  const pedidosCount = ruta.pedidos.length;
  const capacidadMaxima = ruta.capacidad_maxima;
  const capacidadLlena = pedidosCount >= capacidadMaxima;
  const porcentaje = calcularPorcentajeCapacidad(pedidosCount, capacidadMaxima);

  const progressVariant =
    porcentaje >= 100
      ? 'danger'
      : porcentaje >= 75
      ? 'warning'
      : 'success';

  const handleMoverArriba = (pedidoId: string) => {
    const ids = ruta.pedidos.map((p) => p.id);
    const idx = ids.indexOf(pedidoId);
    if (idx <= 0) return;
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    onReordenar(ruta.id, ids);
  };

  const handleMoverAbajo = (pedidoId: string) => {
    const ids = ruta.pedidos.map((p) => p.id);
    const idx = ids.indexOf(pedidoId);
    if (idx >= ids.length - 1) return;
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    onReordenar(ruta.id, ids);
  };

  return (
    <Card
      className={cn(
        'min-w-[280px] w-[280px] flex-shrink-0 flex flex-col h-full border-2 transition-colors',
        capacidadLlena ? 'border-destructive/30 bg-destructive/5' : 'border-border'
      )}
      data-cy="card-repartidor"
    >
      <CardHeader className="pb-3">
        {/* Repartidor */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            {ruta.repartidor?.foto_url ? (
              <img
                src={ruta.repartidor.foto_url}
                alt={ruta.repartidor.nombre}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {ruta.repartidor?.nombre ?? ruta.nombre}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  ruta.repartidor?.estado === 'disponible'
                    ? 'bg-green-500'
                    : ruta.repartidor?.estado === 'en_ruta'
                    ? 'bg-orange-500'
                    : 'bg-gray-400'
                )}
              />
              <span className="text-xs text-muted-foreground capitalize">
                {ruta.repartidor?.estado ?? 'sin asignar'}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {ruta.zona && (
              <Badge variant="outline" className="text-xs shrink-0">
                {ruta.zona.nombre}
              </Badge>
            )}
            {onAjustar && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => onAjustar(ruta)}
                title="Ajuste manual de ruta"
                data-cy="btn-ajustar-ruta"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Capacidad */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Capacidad</span>
            <span
              className={cn(
                'font-semibold',
                capacidadLlena ? 'text-destructive' : 'text-foreground'
              )}
            >
              {pedidosCount}/{capacidadMaxima} pedidos
            </span>
          </div>
          <Progress value={pedidosCount} max={capacidadMaxima} variant={progressVariant} />
          {capacidadLlena && (
            <div className="flex items-center gap-1 mt-1.5">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              <span className="text-xs text-destructive font-medium">Capacidad Máxima</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
        {ruta.pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Truck className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Sin pedidos asignados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ruta.pedidos.map((pedido, index) => (
              <PedidoItemRuta
                key={pedido.id}
                pedido={pedido}
                index={index}
                total={ruta.pedidos.length}
                rutaId={ruta.id}
                todasLasRutas={todasLasRutas}
                onMoverArriba={handleMoverArriba}
                onMoverAbajo={handleMoverAbajo}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanRutasProps {
  rutas: Ruta[];
  onReordenar: (ruta_id: string, nuevaOrden: string[]) => void;
  onAjustar?: (ruta: Ruta) => void;
}

export function KanbanRutas({ rutas, onReordenar, onAjustar }: KanbanRutasProps) {
  if (rutas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Truck className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">Sin rutas para este día</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Usa «Armar rutas» para distribuir los pedidos pendientes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin h-full">
      {rutas.map((ruta) => (
        <CardRepartidor
          key={ruta.id}
          ruta={ruta}
          todasLasRutas={rutas}
          onReordenar={onReordenar}
          onAjustar={onAjustar}
        />
      ))}
    </div>
  );
}

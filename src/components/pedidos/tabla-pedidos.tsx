'use client';

import { useContext, useState } from 'react';
import Link from 'next/link';
import { QueryClientContext } from '@tanstack/react-query';
import {
  MoreHorizontal,
  CheckCircle2,
  Truck,
  XCircle,
  Eye,
  Clock,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { pagosService } from '@/services/pagos.service';
import type { Pedido, EstadoPedido } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  cn,
  formatHora,
  formatMoneda,
  getEstadoColor,
  getEstadoLabel,
  truncarTexto,
} from '@/lib/utils';
import { useCambiarEstado } from '@/hooks/use-pedidos';
import { useAuthStore } from '@/store/auth.store';
import { Paginacion, usePaginacion } from '@/components/ui/paginacion';

const ACCIONES_POR_ESTADO: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ['aceptado', 'cancelado'],
  aceptado: ['agendado', 'cancelado'],
  agendado: ['cancelado'],
  en_progreso: ['cancelado'],
  en_camino: [],
  completado: [],
  cancelado: [],
  fallido: [],
};

const ICONO_ACCION: Record<string, React.ElementType> = {
  aceptado: CheckCircle2,
  agendado: Clock,
  en_camino: Truck,
  completado: CheckCircle2,
  cancelado: XCircle,
};

interface AccionesEstadoProps {
  pedido: Pedido;
}

function AccionesEstado({ pedido }: AccionesEstadoProps) {
  const usuario = useAuthStore(s => s.usuario);
  const queryClient = useContext(QueryClientContext);
  const { mutate: cambiarEstado, isPending } = useCambiarEstado();
  const [confirmandoPago, setConfirmandoPago] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const acciones = usuario?.rol === 'proveedor' ? ACCIONES_POR_ESTADO[pedido.estado]
    : usuario?.rol === 'cliente' && pedido.estado === 'pendiente' ? ['cancelado'] as EstadoPedido[] : [];
  const puedeConfirmarPago =
    usuario?.rol === 'proveedor' &&
    !pedido.pago_confirmado &&
    pedido.estado !== 'cancelado';

  if (acciones.length === 0 && !puedeConfirmarPago) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  async function handleConfirmarPago() {
    setConfirmandoPago(true);
    try {
      await pagosService.confirmarPago(pedido.id);
      await queryClient?.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pago confirmado');
      setMenuAbierto(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo confirmar el pago');
    } finally {
      setConfirmandoPago(false);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMenuAbierto(!menuAbierto)}
        className="h-8 w-8"
        data-cy="btn-acciones-pedido"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {menuAbierto && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuAbierto(false)}
          />
          <div className="absolute right-0 top-9 z-20 min-w-40 rounded-md border bg-card shadow-lg py-1">
            {acciones.map((accion) => {
              const Icon = ICONO_ACCION[accion] ?? Eye;
              return (
                <button
                  key={accion}
                  onClick={() => {
                    cambiarEstado({ id: pedido.id, body: { estado: accion } });
                    setMenuAbierto(false);
                  }}
                  disabled={isPending || confirmandoPago}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent',
                    accion === 'cancelado' && 'text-destructive hover:bg-destructive/10'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {getEstadoLabel(accion)}
                </button>
              );
            })}
            {puedeConfirmarPago && (
              <button
                onClick={() => void handleConfirmarPago()}
                disabled={isPending || confirmandoPago}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <CreditCard className="h-3.5 w-3.5" />
                {confirmandoPago ? 'Confirmando...' : 'Confirmar pago'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface TablaPedidosProps {
  pedidos: Pedido[];
  isLoading: boolean;
}

export function TablaPedidos({ pedidos, isLoading }: TablaPedidosProps) {
  const paginado = usePaginacion(pedidos, pedidos.map(p => p.id).join(','));
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <EmptyState
        title="Sin pedidos para mostrar"
        description="No hay pedidos que coincidan con los filtros aplicados. Probá cambiando la fecha o el estado."
        className="py-16"
      />
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-cy="tabla-pedidos">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nº Pedido</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dirección</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Zona</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entrega</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Monto</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginado.datos.map((pedido, index) => (
              <tr
                key={pedido.id}
                className={cn(
                  'border-b border-border transition-colors hover:bg-muted/30',
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      <Link href={`/pedidos/${pedido.id}`} className="underline">#{pedido.numero_pedido}</Link>
                    </span>
                    {pedido.ultimo_minuto && (
                      <Badge variant="warning" className="text-xs py-0">!</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{pedido.cliente_nombre}</p>
                  <p className="text-xs text-muted-foreground">{pedido.cliente_telefono}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs">
                    {truncarTexto(
                      `${pedido.direccion.calle} ${pedido.direccion.numero}`,
                      30
                    )}
                  </p>
                  {pedido.direccion.referencia && (
                    <p className="text-xs text-muted-foreground">
                      {truncarTexto(pedido.direccion.referencia, 25)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {pedido.zona && (
                    <Badge variant="outline" className="text-xs">
                      {pedido.zona.nombre}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium">{pedido.fecha_entrega ? new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil' }).format(new Date(`${pedido.fecha_entrega}T12:00:00-05:00`)) : 'Sin programación'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatHora(pedido.ventana_horaria.desde)} - {formatHora(pedido.ventana_horaria.hasta)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                      getEstadoColor(pedido.estado)
                    )}
                  >
                    {getEstadoLabel(pedido.estado)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold">{formatMoneda(pedido.monto_total)}</span>
                  {pedido.pago_confirmado ? (
                    <p className="text-xs text-green-600">Pagado</p>
                  ) : pedido.estado !== 'cancelado' ? (
                    <p className="text-xs text-yellow-600">Pago pendiente</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <AccionesEstado pedido={pedido} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion {...paginado} />
    </div>
  );
}

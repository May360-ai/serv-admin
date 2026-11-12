'use client';

import Link from 'next/link';
import { PackageCheck, Clock, MapPin, Store, ShoppingBag } from 'lucide-react';
import { useMisPedidosCliente } from '@/hooks/use-pedidos';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatFecha, formatMoneda, getEstadoColor, getEstadoLabel } from '@/lib/utils';

export default function MisPedidosPage() {
  const usuario = useAuthStore(s => s.usuario);
  const { data: pedidos = [], isLoading, isError, error, refetch, isFetching } = useMisPedidosCliente();
  if (!usuario) return <p role="status">Cargando sesión…</p>;
  if (usuario.rol !== 'cliente') return <p role="alert">Esta vista requiere una sesión de cliente.</p>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis Pedidos y Envíos</h1>
          <p className="text-muted-foreground text-sm">
            Estados confirmados por el servidor, con actualización periódica
          </p>
        </div>

        <Link href="/catalogo">
          <Button className="gap-2 bg-primary text-white">
            <ShoppingBag className="h-4 w-4" />
            Explorar Tiendas
          </Button>
        </Link>
      </div>

      {isError && <div role="alert" className="rounded-lg border p-4 text-destructive">
        <p>{error.message}</p>
        {pedidos.length > 0 && <p>Se muestran los últimos estados confirmados; no se pudo actualizar la consulta.</p>}
        <Button variant="outline" isLoading={isFetching} onClick={() => void refetch()}>Reintentar</Button>
      </div>}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : pedidos.length === 0 ? (isError ? null : (
        <EmptyState
          title="No tenés pedidos en curso"
          description="Cuando compres en una tienda de la red SERV, tus envíos aparecerán acá para consultar su estado."
          icon={<PackageCheck className="h-10 w-10 text-muted-foreground" />}
          className="py-16 bg-card border border-dashed rounded-xl"
        />
      )) : (
        <div className="space-y-4">
          {pedidos.map((p) => {
            const estadoNombre = p.estados_pedido.nombre;
            const detalles = p.detalle_pedido ?? [];

            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow overflow-hidden border-border">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-base text-foreground">
                        Pedido #{p.numero_pedido || `PED-${p.id}`}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getEstadoColor(
                          estadoNombre
                        )}`}
                      >
                        {getEstadoLabel(estadoNombre)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Total:</span>
                      <span className="font-bold text-lg text-foreground">
                        {formatMoneda(Number(p.total))}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-3">
                  {/* Tienda */}
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Store className="h-4 w-4 text-primary" />
                    <span>{p.proveedores?.nombre_comercial || 'Tienda Aliada'}</span>
                  </div>

                  {/* Colección de productos comprados */}
                  {detalles.length > 0 && (
                    <div className="p-3 bg-muted/20 rounded-lg space-y-1.5 border border-border/40">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Productos ({detalles.length})
                      </p>
                      <ul className="divide-y divide-border/40 text-xs">
                        {detalles.map((det) => (
                          <li key={det.id} className="py-1 flex items-center justify-between">
                            <span className="text-foreground">
                              <span className="font-bold text-primary mr-1.5">{det.cantidad}x</span>
                              {det.items?.nombre || 'Producto'}
                            </span>
                            <span className="text-muted-foreground font-mono">
                              {formatMoneda(Number(det.subtotal))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Datos de entrega y fecha */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {p.direcciones
                          ? `${p.direcciones.direccion}, ${p.direcciones.ciudad}`
                          : 'Dirección registrada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {p.fecha_programada
                          ? `Entrega: ${formatFecha(p.fecha_programada)}`
                          : p.fecha_creacion ? `Registrado: ${formatFecha(p.fecha_creacion)}` : 'Fecha no informada'}
                      </span>
                    </div>
                  </div>

                  {p.instrucciones_especiales && (
                    <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">
                      Nota: &ldquo;{p.instrucciones_especiales}&rdquo;
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

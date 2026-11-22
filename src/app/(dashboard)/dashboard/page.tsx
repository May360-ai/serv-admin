'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Route,
  Users,
} from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoneda } from '@/lib/utils';
import { ErrorConsulta } from '@/components/ui/error-consulta';
import { useAuthStore } from '@/store/auth.store';
import { esAdministrador } from '@/types/auth';
import { consultarPedidosAdministracion } from '@/services/pedidos-consultas.service';
import { rutasService } from '@/features/despacho/rutas.service';
import { getFechaHoy } from '@/features/despacho/despacho.store';
import Link from 'next/link';

interface MetricaCardProps {
  titulo: string;
  valor: number | string;
  descripcion: string;
  icon: React.ElementType;
  colorClass: string;
  isLoading: boolean;
}

function MetricaCard({ titulo, valor, descripcion, icon: Icon, colorClass, isLoading }: MetricaCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className="text-3xl font-bold">{valor}</p>
            <p className="text-xs text-muted-foreground mt-1">{descripcion}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const usuario = useAuthStore(s => s.usuario);
  const autorizado = esAdministrador(usuario?.rol);
  const { data: metricas, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-metricas', usuario?.id, usuario?.rol],
    queryFn: dashboardService.obtenerMetricas,
    enabled: autorizado,
    gcTime: 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: pedidosRecientesResp, isLoading: cargandoPedidosRecientes } = useQuery({
    queryKey: ['pedidos', 'administracion', 'dashboard-recientes', usuario?.id],
    queryFn: ({ signal }) => consultarPedidosAdministracion({ page: 1, page_size: 5 }, signal),
    enabled: autorizado,
    staleTime: 30_000,
  });

  const { data: rutasHoyResp, isLoading: cargandoRutasHoy } = useQuery({
    queryKey: ['rutas', 'dashboard-hoy', usuario?.id],
    queryFn: () => rutasService.listarRutas({ fecha_entrega: getFechaHoy() }),
    enabled: autorizado,
    staleTime: 30_000,
  });

  const pedidosRecientes =
    pedidosRecientesResp && 'data' in pedidosRecientesResp && Array.isArray(pedidosRecientesResp.data)
      ? pedidosRecientesResp.data
      : [];
  const rutasHoy = Array.isArray(rutasHoyResp) ? rutasHoyResp : [];

  if (!usuario) return <p role="status">Cargando sesión…</p>;
  if (!autorizado) return <p role="alert">Esta vista requiere una sesión de administrador.</p>;
  if (isError) return <ErrorConsulta error={error} reintentar={() => void refetch()} cargando={isFetching} />;

  const metricsConfig = [
    {
      titulo: 'Pedidos Hoy',
      valor: metricas?.pedidos_hoy ?? 0,
      descripcion: 'Total registrado en el día',
      icon: Package,
      colorClass: 'bg-blue-500',
    },
    {
      titulo: 'Pendientes',
      valor: metricas?.pedidos_pendientes ?? 0,
      descripcion: 'Esperando asignación de ruta',
      icon: Clock,
      colorClass: 'bg-yellow-500',
    },
    {
      titulo: 'En Camino',
      valor: metricas?.pedidos_en_camino ?? 0,
      descripcion: 'Siendo entregados ahora',
      icon: Truck,
      colorClass: 'bg-orange-500',
    },
    {
      titulo: 'Completados',
      valor: metricas?.pedidos_completados ?? 0,
      descripcion: 'Entregas exitosas del día',
      icon: CheckCircle2,
      colorClass: 'bg-green-500',
    },
    {
      titulo: 'Rutas Activas',
      valor: metricas?.rutas_activas ?? 0,
      descripcion: 'Rutas en operación',
      icon: Route,
      colorClass: 'bg-purple-500',
    },
    {
      titulo: 'Repartidores',
      valor: metricas?.repartidores_disponibles ?? 0,
      descripcion: 'Disponibles ahora',
      icon: Users,
      colorClass: 'bg-cyan-500',
    },
    {
      titulo: 'Ingresos del Día',
      valor: formatMoneda(metricas?.ingresos_hoy ?? 0),
      descripcion: 'Pedidos pagados confirmados',
      icon: TrendingUp,
      colorClass: 'bg-emerald-500',
    },
    {
      titulo: 'Alertas',
      valor: metricas?.pedidos_pendientes ?? 0,
      descripcion: 'Pedidos que necesitan atención',
      icon: AlertCircle,
      colorClass: 'bg-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumen operativo del día</p>
        <Link href="/pedidos" className="text-sm underline">Supervisar pedidos</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsConfig.map((m) => (
          <MetricaCard key={m.titulo} {...m} isLoading={isLoading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || cargandoPedidosRecientes ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : pedidosRecientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No hay pedidos registrados.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pedidosRecientes.map((p) => (
                  <Link
                    key={p.id}
                    href={`/pedidos/${p.id}`}
                    className="flex items-center justify-between rounded-md border p-2.5 text-sm hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {p.codigo_seguimiento || `PED-${p.id}`} · {p.proveedores.nombre_comercial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.estados_pedido.nombre} · {p.direcciones?.zona?.nombre ?? 'Sin zona'}
                      </p>
                    </div>
                    <span className="font-semibold shrink-0">{formatMoneda(Number(p.total))}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado de Rutas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || cargandoRutasHoy ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rutasHoy.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Route className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Sin rutas programadas para hoy.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rutasHoy.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href="/rutas"
                    className="flex items-center justify-between rounded-md border p-2.5 text-sm hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {r.nombre} · {r.repartidor?.nombre ?? 'Sin repartidor'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.zona?.nombre ?? 'Sin zona'} · {r.pedidos.length}/{r.capacidad_maxima} paradas
                      </p>
                    </div>
                    <span className="text-xs font-medium capitalize shrink-0">{r.estado}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

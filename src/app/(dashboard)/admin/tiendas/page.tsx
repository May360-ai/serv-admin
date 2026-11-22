'use client';

import { useQuery } from '@tanstack/react-query';
import { Store, MapPin, Phone, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { consultarTiendas, RespuestaTiendasInvalida } from './consulta-tiendas';
import { AccionesTienda } from './acciones-tienda';
import { ErrorHttp } from '@/lib/error-http';
import { Paginacion, usePaginacion } from '@/components/ui/paginacion';

export default function AdminTiendasPage() {
  const { data: tiendas = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-tiendas'],
    queryFn: consultarTiendas,
  });
  const paginado = usePaginacion(tiendas, '', 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tiendas</h1>
        <p className="text-muted-foreground text-sm">
          Aprueba tiendas nuevas antes de que publiquen su catálogo y suspende las que incumplan.
        </p>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Cargando tiendas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          role="alert"
          title={error instanceof RespuestaTiendasInvalida ? 'Respuesta inesperada' : 'No se pudieron cargar las tiendas'}
          description={error instanceof RespuestaTiendasInvalida || error instanceof ErrorHttp
            ? error.message
            : 'Ocurrió un error al consultar las tiendas. Vuelve a intentarlo.'}
          icon={<AlertCircle className="h-10 w-10 text-destructive" />}
          action={(!(error instanceof ErrorHttp) || error.reintentable) ? <Button variant="outline" onClick={() => void refetch()} isLoading={isFetching}>Reintentar</Button> : undefined}
          className="py-16 bg-card border border-dashed rounded-lg"
        />
      ) : tiendas.length === 0 ? (
        <EmptyState
          title="Sin tiendas registradas"
          description="Aún no hay tiendas asociadas en la plataforma."
          icon={<Store className="h-10 w-10 text-muted-foreground" />}
          className="py-16 bg-card border border-dashed rounded-lg"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginado.datos.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{t.nombre_comercial}</CardTitle>
                    <p className="text-xs text-muted-foreground truncate">{t.propietario?.email}</p>
                  </div>
                  <Badge variant={t.estado !== 'activo' ? 'secondary' : t.es_verificado ? 'success' : 'warning'}>
                    {t.estado !== 'activo' ? 'Suspendida' : t.es_verificado ? 'Aprobada' : 'Por aprobar'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {t.propietario?.telefono && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.propietario.telefono}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.sucursales_activas} sucursal(es) activa(s) · {t.productos} producto(s) · {t.pedidos} pedido(s)</span>
                </div>
                <p>{t.visible_en_catalogo ? 'Visible en el catálogo de clientes.' : 'No visible en el catálogo: requiere aprobación, cuenta activa y una sucursal activa.'}</p>
                <AccionesTienda tienda={t} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Paginacion {...paginado} />
    </div>
  );
}

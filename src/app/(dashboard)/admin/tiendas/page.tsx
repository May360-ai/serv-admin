'use client';

import { useQuery } from '@tanstack/react-query';
import { Store, MapPin, Phone, CheckCircle, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { Tienda } from '@/types';

export default function AdminTiendasPage() {
  const { data: tiendas = [], isLoading } = useQuery<Tienda[]>({
    queryKey: ['admin-tiendas'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Tienda[] }>('/api/proveedores');
      return data?.data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Supervisión Global de Tiendas</h1>
        <p className="text-muted-foreground text-sm">
          Todas las tiendas y negocios registrados en la plataforma SERV
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : tiendas.length === 0 ? (
        <EmptyState
          title="Sin tiendas registradas"
          description="Aún no hay tiendas asociadas en la plataforma."
          icon={<Store className="h-10 w-10 text-muted-foreground" />}
          className="py-16 bg-card border border-dashed rounded-lg"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiendas.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{t.nombre_comercial}</CardTitle>
                    <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                  </div>
                  <Badge variant={t.activa ? 'success' : 'secondary'}>
                    {t.activa ? 'Activa' : 'Pausada'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {t.direccion && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.direccion}</span>
                  </div>
                )}
                {t.telefono && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.telefono}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Plus, Bike, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { Repartidor } from '@/types';

export default function AdminRepartidoresPage() {
  const [modalOpen, setModalOpen] = useState(false);

  // Lista de repartidores activos
  const repartidores: Repartidor[] = [
    {
      id: '1',
      nombre: 'Lucas Benítez',
      telefono: '+54 11 5566-7788',
      estado: 'disponible',
      vehiculo: 'Moto Honda Wave 110cc',
    },
    {
      id: '2',
      nombre: 'Martín Paredes',
      telefono: '+54 11 2233-4455',
      estado: 'en_ruta',
      vehiculo: 'Moto Yamaha YBR 125cc',
    },
    {
      id: '3',
      nombre: 'Gonzalo Silva',
      telefono: '+54 11 9988-1122',
      estado: 'disponible',
      vehiculo: 'Furgoneta Fiorino',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Repartidores</h1>
          <p className="text-muted-foreground text-sm">
            Monitoreo y alta de conductores para la flota de última milla
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Repartidor
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repartidores.map((rep) => (
          <Card key={rep.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bike className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{rep.nombre}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{rep.telefono}</p>
                </div>
                <Badge variant={rep.estado === 'disponible' ? 'success' : 'warning'}>
                  {rep.estado === 'disponible' ? 'Disponible' : 'En Ruta'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Vehículo registrado:</p>
                <p className="mt-0.5">{rep.vehiculo ?? 'Sin especificar'}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

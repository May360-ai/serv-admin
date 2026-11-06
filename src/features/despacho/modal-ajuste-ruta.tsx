'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Ruta, Repartidor } from '@/types';
import { rutasService } from '@/features/despacho/rutas.service';
import { RUTAS_QUERY_KEY } from '@/features/despacho/use-rutas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ModalAjusteRutaProps {
  ruta: Ruta | null;
  repartidoresDisponibles: Repartidor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalAjusteRuta({
  ruta,
  repartidoresDisponibles,
  open,
  onOpenChange,
}: ModalAjusteRutaProps) {
  const queryClient = useQueryClient();
  const [repartidorId, setRepartidorId] = useState<string>(
    ruta?.repartidor_id ?? ''
  );

  const { mutate: reasignar, isPending } = useMutation({
    mutationFn: async ({
      rutaId,
      nuevoRepartidorId,
    }: {
      rutaId: string;
      nuevoRepartidorId: string;
    }) => {
      return rutasService.reasignarRepartidor(rutaId, nuevoRepartidorId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RUTAS_QUERY_KEY] });
      toast.success('Repartidor reasignado correctamente');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Error al reasignar: ${error.message}`);
    },
  });

  if (!ruta) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repartidorId) {
      toast.error('Seleccioná un repartidor');
      return;
    }
    reasignar({ rutaId: ruta.id, nuevoRepartidorId: repartidorId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Ajuste Manual de Ruta</DialogTitle>
          <DialogDescription>
            Reasignar repartidor o gestionar capacidad para {ruta.nombre}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <p className="font-semibold text-foreground">Estado actual:</p>
            <p className="text-muted-foreground">
              Pedidos asignados: {ruta.pedidos.length} / {ruta.capacidad_maxima}
            </p>
            <p className="text-muted-foreground">
              Repartidor actual: {ruta.repartidor?.nombre ?? 'Sin asignar'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="select-repartidor">Reasignar a Repartidor</Label>
            <Select
              id="select-repartidor"
              value={repartidorId}
              onChange={(e) => setRepartidorId(e.target.value)}
              data-cy="select-repartidor-ajuste"
            >
              <option value="">Seleccionar repartidor disponible</option>
              {repartidoresDisponibles.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.nombre} ({rep.vehiculo ?? 'Moto'}) - {rep.estado}
                </option>
              ))}
            </Select>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              <strong>Control de concurrencia:</strong> Si otro despachador
              modificó esta ruta recientemente, los cambios se validarán antes
              de aplicar la asignación.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isPending}
              data-cy="btn-confirmar-ajuste-ruta"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Guardar Ajustes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

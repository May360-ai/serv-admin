'use client';

import { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Ruta } from '@/types';
import { useDisponibilidadRepartidores, useReasignarRepartidor } from './use-rutas';
import { mensajeErrorDespacho, repartidoresElegibles } from './elegibilidad';
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalAjusteRuta({
  ruta,
  open,
  onOpenChange,
}: ModalAjusteRutaProps) {
  const [repartidorId, setRepartidorId] = useState('');
  const consulta = useDisponibilidadRepartidores(ruta?.fecha_entrega ?? '', open && ruta?.estado === 'armando');
  const { mutate: reasignar, isPending, error, reset } = useReasignarRepartidor(() => onOpenChange(false));

  if (!ruta) return null;

  const rutaPropia = consulta.alcanceGlobal || (consulta.proveedorId != null &&
    ruta.proveedor_id != null && String(ruta.proveedor_id) === String(consulta.proveedorId));
  const candidatos = consulta.data && consulta.puedeConsultar && rutaPropia
    ? consulta.alcanceGlobal
      ? repartidoresElegibles(consulta.data.activos, consulta.data.asignaciones, ruta)
      : consulta.data.activos.filter(rep => rep.id !== String(ruta.repartidor_id))
    : [];
  const puedeElegir = Boolean(ruta.id && ruta.fecha_entrega) && ruta.estado === 'armando' &&
    consulta.puedeConsultar && rutaPropia &&
    !consulta.isPending && !consulta.isFetching && !consulta.isError && !isPending;

  const actualizarCandidatos = () => {
    setRepartidorId('');
    reset();
    void consulta.refetch();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeElegir || !candidatos.some(rep => rep.id === repartidorId)) {
      toast.error('Seleccioná un candidato válido para esta ruta');
      return;
    }
    reasignar({ rutaId: ruta.id, repartidorId });
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
            {ruta.estado !== 'armando' ? <p role="alert">La ruta ya salió o está cerrada; no admite reasignación.</p>
              : !consulta.puedeConsultar || !rutaPropia ? <p role="alert">No tienes permiso para reasignar esta ruta o faltan los datos de su tienda.</p>
              : consulta.isError ? <p role="alert">No se pudieron consultar los candidatos. {consulta.error?.message} <Button type="button" variant="outline" onClick={actualizarCandidatos}>Reintentar</Button></p>
              : consulta.isPending || consulta.isFetching ? <p role="status">{consulta.alcanceGlobal ? 'Consultando repartidores y asignaciones del día…' : 'Consultando repartidores activos…'}</p>
              : candidatos.length === 0 ? <p role="status">{consulta.alcanceGlobal ? 'No hay otros repartidores activos libres para esta fecha.' : 'No hay otros repartidores activos para seleccionar.'}</p> : null}
            {consulta.puedeConsultar && rutaPropia && !consulta.alcanceGlobal && <p className="text-xs text-muted-foreground">Los candidatos están activos. Su disponibilidad para esta fecha se verifica al confirmar; no se consultan asignaciones de otras tiendas.</p>}
            <Label htmlFor="select-repartidor">Reasignar a Repartidor</Label>
            <Select
              id="select-repartidor"
              value={repartidorId}
              onChange={(e) => { setRepartidorId(e.target.value); reset(); }}
              data-cy="select-repartidor-ajuste"
              disabled={!puedeElegir || candidatos.length === 0}
            >
              <option value="">{consulta.alcanceGlobal ? 'Seleccionar repartidor disponible' : 'Seleccionar repartidor activo'}</option>
              {puedeElegir && candidatos.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.nombre} {rep.apellido} · {consulta.alcanceGlobal ? `Libre el ${ruta.fecha_entrega}` : 'Activo · disponibilidad al confirmar'}
                </option>
              ))}
            </Select>
          </div>

          {error && <div role="alert" className="text-sm text-destructive">
            <p>{mensajeErrorDespacho(error)}</p>
            {consulta.puedeConsultar && rutaPropia && <Button type="button" variant="outline" onClick={actualizarCandidatos} disabled={isPending || consulta.isFetching}>Actualizar candidatos</Button>}
          </div>}

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
              disabled={!puedeElegir || !candidatos.some(rep => rep.id === repartidorId)}
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

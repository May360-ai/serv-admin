'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { aprobarTienda, cambiarEstadoTienda, type TiendaAdmin } from './consulta-tiendas';

export function AccionesTienda({ tienda }: { tienda: TiendaAdmin }) {
  const client = useQueryClient();
  const refrescar = () => { void client.invalidateQueries({ queryKey: ['admin-tiendas'] }); };
  const aprobacion = useMutation({ mutationFn: (valor: boolean) => aprobarTienda(tienda.id, valor), onSuccess: refrescar });
  const estado = useMutation({ mutationFn: (valor: 'activo' | 'inactivo') => cambiarEstadoTienda(tienda.id, valor), onSuccess: refrescar });
  const ocupado = aprobacion.isPending || estado.isPending;
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Button size="sm" variant={tienda.es_verificado ? 'outline' : 'default'} disabled={ocupado}
        onClick={() => aprobacion.mutate(!tienda.es_verificado)}>
        {tienda.es_verificado ? 'Retirar aprobación' : 'Aprobar tienda'}
      </Button>
      <Button size="sm" variant="outline" disabled={ocupado}
        onClick={() => estado.mutate(tienda.estado === 'activo' ? 'inactivo' : 'activo')}>
        {tienda.estado === 'activo' ? 'Suspender cuenta' : 'Reactivar cuenta'}
      </Button>
      {(aprobacion.isError || estado.isError) && (
        <p role="alert" className="w-full text-destructive">{(aprobacion.error ?? estado.error)?.message}</p>
      )}
    </div>
  );
}

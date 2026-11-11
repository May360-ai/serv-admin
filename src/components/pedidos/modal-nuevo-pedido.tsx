'use client';

import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { zonasService } from '@/services/zonas.service';
import { itemsService } from '@/services/items.service';
import { nuevoPedidoSchema } from '@/services/pedidos-contrato';
import { useCrearPedido } from '@/hooks/use-pedidos';
import { useAuthStore } from '@/store/auth.store';
import type { CrearPedidoRequest } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ModalNuevoPedidoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalNuevoPedido({ open, onOpenChange }: ModalNuevoPedidoProps) {
  const usuario = useAuthStore(s => s.usuario);
  const permitido = usuario?.rol === 'cliente';
  const zonas = useQuery({ queryKey: ['zonas'], queryFn: zonasService.listarZonas, enabled: open && permitido });
  const catalogo = useQuery({ queryKey: ['catalogo-items', 'pedido-manual'], queryFn: () => itemsService.listarCatalogo(), enabled: open && permitido });
  const { mutate: crearPedido, isPending, error } = useCrearPedido(catalogo.data ?? []);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<CrearPedidoRequest>({
    resolver: zodResolver(nuevoPedidoSchema),
    defaultValues: { items_comprados: [], fecha_entrega: '', hora_entrega: '',
      direccion: { nombre_ubicacion: '', direccion: '', ciudad: '' } },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items_comprados' });
  const proveedor = useWatch({ control, name: 'proveedor_id' });
  const productos = (catalogo.data ?? []).filter(item => item.proveedor_id === proveedor && item.activo);
  const tiendas = [...new Map((catalogo.data ?? []).map(item => [item.proveedor_id, item.proveedores?.nombre_comercial || `Tienda #${item.proveedor_id}`])).entries()];
  const onSubmit = (datos: CrearPedidoRequest) => {
    crearPedido(datos, { onSuccess: () => { reset(); onOpenChange(false); } });
  };
  const errorValidacion = errors.proveedor_id?.message || errors.items_comprados?.root?.message || errors.items_comprados?.message ||
    errors.fecha_entrega?.message || errors.hora_entrega?.message;
  const cargando = zonas.isPending || catalogo.isPending;
  const errorConsulta = zonas.isError || catalogo.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Nuevo pedido</DialogTitle>
          <DialogDescription>{permitido ? 'El pedido se registra para tu cuenta de cliente. El servidor confirma precios y stock.' : 'El registro en nombre de otro cliente no está disponible para tu rol.'}</DialogDescription>
        </DialogHeader>
        {permitido && <>
          {cargando && <p role="status">Cargando catálogo y zonas…</p>}
          {errorConsulta && <p role="alert">No se pudieron cargar el catálogo o las zonas. <Button variant="outline" onClick={() => { void zonas.refetch(); void catalogo.refetch(); }}>Reintentar</Button></p>}
          {!cargando && !errorConsulta && (!tiendas.length || !zonas.data?.length) && <p role="status">No hay catálogo o zonas disponibles para registrar un pedido.</p>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <fieldset disabled={isPending || cargando || errorConsulta} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="proveedor-pedido">Tienda *</Label>
                <Select id="proveedor-pedido" {...register('proveedor_id', { valueAsNumber: true, onChange: () => replace([]) })}>
                  <option value="">Selecciona una tienda</option>
                  {tiendas.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Productos y cantidades *</Label>
                {fields.map((field, index) => <div key={field.id} className="flex gap-2">
                  <Select aria-label={`Producto ${index + 1}`} {...register(`items_comprados.${index}.item_id`, { valueAsNumber: true })}>
                    {productos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                  </Select>
                  <Input aria-label={`Cantidad ${index + 1}`} type="number" min={1} step={1} {...register(`items_comprados.${index}.cantidad`, { valueAsNumber: true })} />
                  <Button type="button" variant="outline" onClick={() => remove(index)}>Quitar</Button>
                  {errors.items_comprados?.[index] && <p role="alert">Selecciona un producto y una cantidad entera positiva.</p>}
                </div>)}
                <Button type="button" variant="outline" disabled={!productos.length} onClick={() => append({ item_id: productos[0].id, cantidad: 1 })}>Agregar producto</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="fecha-pedido">Fecha de entrega *</Label><Input id="fecha-pedido" type="date" {...register('fecha_entrega')} /></div>
                <div><Label htmlFor="hora-pedido">Hora de entrega (Ecuador) *</Label><Input id="hora-pedido" type="time" {...register('hora_entrega')} /></div>
              </div>
              <div><Label htmlFor="nombre-direccion">Nombre de ubicación *</Label><Input id="nombre-direccion" {...register('direccion.nombre_ubicacion')} />{errors.direccion?.nombre_ubicacion && <p role="alert">{errors.direccion.nombre_ubicacion.message}</p>}</div>
              <div><Label htmlFor="direccion-pedido">Dirección completa *</Label><Input id="direccion-pedido" {...register('direccion.direccion')} />{errors.direccion?.direccion && <p role="alert">{errors.direccion.direccion.message}</p>}</div>
              <div><Label htmlFor="ciudad-pedido">Ciudad *</Label><Input id="ciudad-pedido" {...register('direccion.ciudad')} />{errors.direccion?.ciudad && <p role="alert">{errors.direccion.ciudad.message}</p>}</div>
              <div><Label htmlFor="zona-pedido">Zona *</Label><Select id="zona-pedido" {...register('direccion.zona_id', { valueAsNumber: true })}>
                <option value="">Selecciona una zona</option>
                {zonas.data?.map(zona => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}
              </Select>{errors.direccion?.zona_id && <p role="alert">Selecciona una zona válida.</p>}</div>
              <div><Label htmlFor="referencia-pedido">Referencia</Label><Input id="referencia-pedido" {...register('direccion.referencia')} /></div>
              <div><Label htmlFor="notas-pedido">Instrucciones de entrega</Label><Textarea id="notas-pedido" {...register('instrucciones_especiales')} /></div>
              {errorValidacion && <p role="alert">{errorValidacion}</p>}
              {error && <p role="alert" className="text-destructive">{error.message}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" isLoading={isPending} disabled={!tiendas.length || !zonas.data?.length || isPending} data-cy="btn-crear-pedido">Crear pedido</Button>
              </DialogFooter>
            </fieldset>
          </form>
        </>}
      </DialogContent>
    </Dialog>
  );
}

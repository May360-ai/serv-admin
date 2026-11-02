'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { zonasService } from '@/services/zonas.service';
import { useCrearPedido } from '@/hooks/use-pedidos';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const nuevoPedidoSchema = z.object({
  cliente_nombre: z.string().min(2, 'Nombre requerido'),
  cliente_telefono: z.string().min(6, 'Teléfono inválido'),
  fecha_entrega: z.string().min(1, 'Fecha requerida'),
  ventana_desde: z.string().min(1, 'Hora de inicio requerida'),
  ventana_hasta: z.string().min(1, 'Hora de fin requerida'),
  zona_id: z.string().min(1, 'Zona requerida'),
  calle: z.string().min(2, 'Calle requerida'),
  numero: z.string().min(1, 'Número requerido'),
  ciudad: z.string().min(2, 'Ciudad requerida'),
  referencia: z.string().optional(),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
  monto_total: z.number({ invalid_type_error: 'Monto inválido' }).positive('Monto debe ser positivo'),
  notas: z.string().optional(),
});

type NuevoPedidoForm = z.infer<typeof nuevoPedidoSchema>;

interface ModalNuevoPedidoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalNuevoPedido({ open, onOpenChange }: ModalNuevoPedidoProps) {
  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: zonasService.listarZonas,
    staleTime: 300_000,
  });

  const { mutate: crearPedido, isPending } = useCrearPedido();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<NuevoPedidoForm>({
    resolver: zodResolver(nuevoPedidoSchema),
    defaultValues: {
      fecha_entrega: '',
      ciudad: '',
    },
  });

  // Asignar fecha actual en el cliente para evitar mismatch de hidratación y bloqueo de prerender en Next.js
  useEffect(() => {
    if (open) {
      setValue('fecha_entrega', new Date().toISOString().split('T')[0]);
    }
  }, [open, setValue]);

  const onSubmit = (data: NuevoPedidoForm) => {
    crearPedido(
      {
        cliente_nombre: data.cliente_nombre,
        cliente_telefono: data.cliente_telefono,
        fecha_entrega: data.fecha_entrega,
        ventana_horaria: {
          desde: data.ventana_desde,
          hasta: data.ventana_hasta,
        },
        zona_id: data.zona_id,
        direccion: {
          calle: data.calle,
          numero: data.numero,
          ciudad: data.ciudad,
          zona_id: data.zona_id,
          referencia: data.referencia,
          latitud: data.latitud ?? 0,
          longitud: data.longitud ?? 0,
        },
        notas: data.notas,
        monto_total: data.monto_total,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Nuevo Pedido</DialogTitle>
          <DialogDescription>
            Registrá un pedido manualmente (mostrador / call center)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cliente_nombre">Nombre del cliente *</Label>
              <Input
                id="cliente_nombre"
                placeholder="Ana Gómez"
                data-cy="input-cliente-nombre"
                {...register('cliente_nombre')}
              />
              {errors.cliente_nombre && (
                <p className="text-xs text-destructive">{errors.cliente_nombre.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente_telefono">Teléfono *</Label>
              <Input
                id="cliente_telefono"
                placeholder="+54 11 1234-5678"
                {...register('cliente_telefono')}
              />
              {errors.cliente_telefono && (
                <p className="text-xs text-destructive">{errors.cliente_telefono.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fecha_entrega">Fecha de entrega *</Label>
              <Input
                id="fecha_entrega"
                type="date"
                data-cy="input-fecha-entrega-pedido"
                {...register('fecha_entrega')}
              />
              {errors.fecha_entrega && (
                <p className="text-xs text-destructive">{errors.fecha_entrega.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ventana_desde">Ventana desde *</Label>
              <Input id="ventana_desde" type="time" {...register('ventana_desde')} />
              {errors.ventana_desde && (
                <p className="text-xs text-destructive">{errors.ventana_desde.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ventana_hasta">Ventana hasta *</Label>
              <Input id="ventana_hasta" type="time" {...register('ventana_hasta')} />
              {errors.ventana_hasta && (
                <p className="text-xs text-destructive">{errors.ventana_hasta.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="zona_id">Zona *</Label>
            <Select
              id="zona_id"
              placeholder="Seleccioná una zona"
              data-cy="select-zona-pedido"
              {...register('zona_id')}
            >
              {zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </Select>
            {errors.zona_id && (
              <p className="text-xs text-destructive">{errors.zona_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="calle">Calle *</Label>
              <Input
                id="calle"
                placeholder="Av. Corrientes"
                data-cy="input-direccion"
                {...register('calle')}
              />
              {errors.calle && (
                <p className="text-xs text-destructive">{errors.calle.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número *</Label>
              <Input id="numero" placeholder="1234" {...register('numero')} />
              {errors.numero && (
                <p className="text-xs text-destructive">{errors.numero.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ciudad">Ciudad *</Label>
              <Input id="ciudad" placeholder="Buenos Aires" {...register('ciudad')} />
              {errors.ciudad && (
                <p className="text-xs text-destructive">{errors.ciudad.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referencia">Referencia</Label>
              <Input id="referencia" placeholder="Piso 3, depto B" {...register('referencia')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto_total">Monto total *</Label>
            <Input
              id="monto_total"
              type="number"
              step="0.01"
              placeholder="15000"
              {...register('monto_total', { valueAsNumber: true })}
            />
            {errors.monto_total && (
              <p className="text-xs text-destructive">{errors.monto_total.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas adicionales</Label>
            <Textarea
              id="notas"
              placeholder="Instrucciones especiales, preferencias de entrega..."
              {...register('notas')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending} data-cy="btn-crear-pedido">
              <Plus className="h-4 w-4 mr-1" />
              Crear Pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

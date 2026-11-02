'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { proveedoresService } from '@/services/proveedores.service';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const tiendaConfigSchema = z.object({
  nombre_comercial: z.string().min(2, 'Nombre comercial requerido'),
  descripcion: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  hora_apertura: z.string().min(1, 'Hora de apertura requerida'),
  hora_cierre: z.string().min(1, 'Hora de cierre requerida'),
});

type TiendaConfigForm = z.infer<typeof tiendaConfigSchema>;

export default function TiendaConfiguracionPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const queryClient = useQueryClient();

  const { data: tienda, isLoading } = useQuery({
    queryKey: ['mi-tienda', usuario?.proveedor_id, usuario?.id],
    queryFn: () => proveedoresService.obtenerMiTienda(usuario?.proveedor_id, usuario?.id),
    enabled: Boolean(usuario),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TiendaConfigForm>({
    resolver: zodResolver(tiendaConfigSchema),
    defaultValues: {
      nombre_comercial: '',
      descripcion: '',
      direccion: '',
      telefono: '',
      hora_apertura: '09:00',
      hora_cierre: '20:00',
    },
  });

  // Sincronizar el formulario cuando los datos de la tienda llegan del backend
  useEffect(() => {
    if (tienda) {
      // Extraer hora formateada HH:mm de los horarios guardados en backend
      const primerHorario = tienda.horarios_atencion?.[0];
      let ap = '09:00';
      let ci = '20:00';

      if (primerHorario?.hora_apertura) {
        const raw = String(primerHorario.hora_apertura);
        const match = raw.match(/T(\d{2}:\d{2})/);
        ap = match ? match[1] : (raw.length === 5 ? raw : '09:00');
      }
      if (primerHorario?.hora_cierre) {
        const raw = String(primerHorario.hora_cierre);
        const match = raw.match(/T(\d{2}:\d{2})/);
        ci = match ? match[1] : (raw.length === 5 ? raw : '20:00');
      }

      reset({
        nombre_comercial: tienda.nombre_comercial ?? '',
        descripcion: tienda.descripcion ?? '',
        direccion: (tienda.direcciones as { direccion?: string } | undefined)?.direccion ?? '',
        telefono: '',
        hora_apertura: ap,
        hora_cierre: ci,
      });
    }
  }, [tienda, reset]);

  const { mutate: guardarConfig, isPending } = useMutation({
    mutationFn: async (formData: TiendaConfigForm) => {
      // 1. Actualizar perfil de la tienda (nombre, descripción)
      await proveedoresService.actualizarMiTienda({
        nombre_comercial: formData.nombre_comercial,
        descripcion: formData.descripcion,
      });

      // 2. Configurar horarios comerciales lunes a sábado (días 1 al 6)
      const diasSemana = [1, 2, 3, 4, 5, 6];
      await proveedoresService.configurarHorarios(
        diasSemana.map((dia) => ({
          dia_semana: dia,
          apertura: formData.hora_apertura,
          cierre: formData.hora_cierre,
          activo: true,
        }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-tienda'] });
      toast.success('Configuración y horarios guardados exitosamente');
    },
    onError: (err: Error) => {
      toast.error(`Error al guardar: ${err.message}`);
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración de Tienda</h1>
        <p className="text-muted-foreground text-sm">
          {isLoading ? 'Cargando datos de la tienda...' : 'Personalizá los datos de tu negocio y tus ventanas horarias de despacho'}
        </p>
      </div>

      <form onSubmit={handleSubmit((d) => guardarConfig(d))} className="space-y-6">
        {/* Perfil del negocio */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Datos de la Tienda</CardTitle>
            </div>
            <CardDescription>
              Esta información será visible para tus clientes y despachadores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre_comercial">Nombre Comercial *</Label>
              <Input
                id="nombre_comercial"
                placeholder="Florería San Valentín"
                {...register('nombre_comercial')}
              />
              {errors.nombre_comercial && (
                <p className="text-xs text-destructive">{errors.nombre_comercial.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Descripción del Negocio</Label>
              <Textarea
                id="descripcion"
                placeholder="Especialistas en arreglos florales y regalos express con logística asegurada."
                {...register('descripcion')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="direccion">Dirección del Local / Depósito</Label>
                <Input
                  id="direccion"
                  placeholder="Av. Santa Fe 3200"
                  {...register('direccion')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono de Contacto</Label>
                <Input
                  id="telefono"
                  placeholder="+54 11 4455-6677"
                  {...register('telefono')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Horarios de despacho */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Horarios de Atención y Despacho</CardTitle>
            </div>
            <CardDescription>
              Definí el rango en el que tu tienda acepta y procesa salidas de reparto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="hora_apertura">Hora de Inicio de Despacho *</Label>
                <Input
                  id="hora_apertura"
                  type="time"
                  {...register('hora_apertura')}
                />
                {errors.hora_apertura && (
                  <p className="text-xs text-destructive">{errors.hora_apertura.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hora_cierre">Hora Límite de Entrega *</Label>
                <Input
                  id="hora_cierre"
                  type="time"
                  {...register('hora_cierre')}
                />
                {errors.hora_cierre && (
                  <p className="text-xs text-destructive">{errors.hora_cierre.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isPending} className="gap-2">
            <Save className="h-4 w-4" />
            Guardar Configuración
          </Button>
        </div>
      </form>
    </div>
  );
}

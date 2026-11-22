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
import { ErrorConsulta } from '@/components/ui/error-consulta';
import { SucursalesManager } from '@/features/tienda/sucursales-manager';

const tiendaConfigSchema = z.object({
  nombre_comercial: z.string().min(2, 'Nombre comercial requerido'),
  descripcion: z.string().optional(),
  telefono: z.string().optional(),
  hora_apertura: z.string().min(1, 'Hora de apertura requerida'),
  hora_cierre: z.string().min(1, 'Hora de cierre requerida'),
  atencion_domingo: z.boolean().optional(),
});

type TiendaConfigForm = z.infer<typeof tiendaConfigSchema>;

export default function TiendaConfiguracionPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const queryClient = useQueryClient();

  const { data: tienda, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['mi-tienda', usuario?.proveedor_id, usuario?.id, usuario?.rol],
    queryFn: () => proveedoresService.obtenerMiTienda(usuario?.proveedor_id, usuario?.id),
    enabled: usuario?.rol === 'proveedor',
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
      telefono: '',
      hora_apertura: '09:00',
      hora_cierre: '20:00',
      atencion_domingo: false,
    },
  });

  // Sincronizar el formulario cuando los datos de la tienda llegan del backend
  useEffect(() => {
    if (tienda) {
      const horarios = (tienda.horarios_atencion ?? []) as Array<{
        dia_semana?: number;
        hora_apertura?: string;
        hora_cierre?: string;
        esta_abierto?: boolean;
      }>;
      const primerHorario = horarios.find((h) => h.dia_semana !== 0) ?? horarios[0];
      const horarioDomingo = horarios.find((h) => h.dia_semana === 0);
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
        telefono: (tienda as { telefono?: string | null }).telefono ?? '',
        hora_apertura: ap,
        hora_cierre: ci,
        atencion_domingo: Boolean(horarioDomingo?.esta_abierto),
      });
    }
  }, [tienda, reset]);

  const { mutate: guardarConfig, isPending } = useMutation({
    mutationFn: async (formData: TiendaConfigForm) => {
      // 1. Actualizar perfil de la tienda (nombre, descripción, teléfono)
      await proveedoresService.actualizarMiTienda({
        nombre_comercial: formData.nombre_comercial,
        descripcion: formData.descripcion,
        ...(formData.telefono?.trim() ? { telefono: formData.telefono.trim() } : {}),
      } as Parameters<typeof proveedoresService.actualizarMiTienda>[0]);

      // 2. Configurar horarios comerciales lunes a sábado y opción de domingo
      const horarios = [1, 2, 3, 4, 5, 6].map((dia) => ({
        dia_semana: dia,
        apertura: formData.hora_apertura,
        cierre: formData.hora_cierre,
        activo: true,
      }));
      horarios.push({
        dia_semana: 0,
        apertura: formData.hora_apertura,
        cierre: formData.hora_cierre,
        activo: Boolean(formData.atencion_domingo),
      });
      await proveedoresService.configurarHorarios(horarios);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-tienda'] });
      toast.success('Configuración y horarios guardados exitosamente');
    },
    onError: (err: Error) => {
      toast.error(`Error al guardar: ${err.message}`);
    },
  });

  if (!usuario) return <p role="status">Cargando sesión…</p>;
  if (usuario.rol !== 'proveedor') return <p role="alert">Esta vista requiere una sesión de proveedor.</p>;
  if (isLoading) return <p role="status">Cargando datos de la tienda…</p>;
  if (isError) return <ErrorConsulta error={error} reintentar={() => void refetch()} cargando={isFetching} />;
  if (!tienda) return <p role="status">No hay una tienda vinculada a esta sesión.</p>;

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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono de Contacto</Label>
                <Input
                  id="telefono"
                  placeholder="+593 99 123 4567"
                  {...register('telefono')}
                />
              </div>

              <div className="flex items-center rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Las direcciones y puntos de retiro se configuran abajo en Sucursales y retiros.
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
          <CardContent className="space-y-4">
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

            <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
              <input type="checkbox" {...register('atencion_domingo')} />
              <span className="text-sm font-medium">Atención los domingos</span>
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isPending} className="gap-2">
            <Save className="h-4 w-4" />
            Guardar Configuración
          </Button>
        </div>
      </form>
      <SucursalesManager />
    </div>
  );
}

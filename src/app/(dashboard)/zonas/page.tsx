'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Package, Users, Pencil } from 'lucide-react';
import { zonasService } from '@/services/zonas.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { Zona, ApiResponse } from '@/types';
import { ErrorConsulta } from '@/components/ui/error-consulta';
import { EditorPoligono, type PoligonoZona } from '@/components/zonas/editor-poligono';
import { useAuthStore } from '@/store/auth.store';
import { esAdministrador } from '@/types/auth';

const formatoEnvio = (valor?: number) => valor == null ? '—' : `$${valor.toFixed(2)}`;

const zonaSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  descripcion: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hexadecimal inválido'),
  capacidad_maxima: z.number({ error: 'Capacidad requerida' }).int().min(1).max(20),
  costo_envio: z.number({ error: 'Costo de envío requerido' }).min(0).max(100)
    .refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Usa hasta dos decimales'),
  poligono: z.custom<PoligonoZona>(esPoligono, 'Dibuja el área de cobertura.'),
  activa: z.boolean().optional(),
});

type ZonaForm = z.infer<typeof zonaSchema>;

function esPoligono(value: unknown): value is PoligonoZona {
  if (!value || typeof value !== 'object') return false;
  const poligono = value as PoligonoZona;
  return poligono.type === 'Polygon' && Array.isArray(poligono.coordinates?.[0]) && poligono.coordinates[0].length >= 4;
}

const COLORES_PREDEFINIDOS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

interface ModalZonaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zona: Zona | null;
}

function ModalNuevaZona({ open, onOpenChange, zona }: ModalZonaProps) {
  const queryClient = useQueryClient();

  const { mutate: crearZona, isPending } = useMutation({
    mutationFn: async (data: ZonaForm) => {
      const resp = zona
        ? await apiClient.patch<ApiResponse<Zona>>(`/api/zonas/${zona.id}`, data)
        : await apiClient.post<ApiResponse<Zona>>('/api/zonas', { ...data, activa: true });
      return resp.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zonas'] });
      toast.success(zona ? 'Zona actualizada' : 'Zona creada');
      onOpenChange(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ZonaForm>({
    resolver: zodResolver(zonaSchema),
    defaultValues: {
      color: '#3B82F6',
      capacidad_maxima: 4,
      costo_envio: 2.5,
      poligono: null as unknown as PoligonoZona,
    },
  });

  useEffect(() => {
    if (open) reset(zona ? { nombre: zona.nombre, descripcion: zona.descripcion ?? '', color: zona.color,
      capacidad_maxima: zona.capacidad_maxima, costo_envio: zona.costo_envio ?? 2.5, poligono: zona.poligono ?? null as unknown as PoligonoZona, activa: zona.activa }
      : { nombre: '', descripcion: '', color: '#3B82F6', capacidad_maxima: 4, costo_envio: 2.5, poligono: null as unknown as PoligonoZona, activa: true });
  }, [open, zona, reset]);

  const colorActual = watch('color');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{zona ? 'Editar zona' : 'Nueva zona'}</DialogTitle>
          <DialogDescription>Dibuja el área exacta donde se aceptan entregas.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => crearZona(d))} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="nombre-zona">Nombre *</Label>
            <Input id="nombre-zona" placeholder="Zona Norte" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Área en el mapa *</Label>
            <EditorPoligono value={watch('poligono') ?? null} onChange={value => setValue('poligono', value as PoligonoZona, { shouldValidate: true })} />
            {errors.poligono && <p role="alert" className="text-xs text-destructive">{errors.poligono.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion-zona">Descripción</Label>
            <Input
              id="descripcion-zona"
              placeholder="Barrios incluidos: Palermo, Belgrano..."
              {...register('descripcion')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color identificador</Label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2 flex-wrap">
                {COLORES_PREDEFINIDOS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color)}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: color,
                      borderColor: colorActual === color ? '#000' : 'transparent',
                    }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
              <Input
                type="color"
                className="h-9 w-16 p-1 cursor-pointer"
                {...register('color')}
              />
            </div>
            {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="capacidad-zona">Capacidad máxima por ruta *</Label>
            <Input
              id="capacidad-zona"
              type="number"
              min={1}
              max={20}
              placeholder="4"
              {...register('capacidad_maxima', { valueAsNumber: true })}
            />
            {errors.capacidad_maxima && (
              <p className="text-xs text-destructive">{errors.capacidad_maxima.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Número máximo de pedidos por salida en esta zona (recomendado: 4). Un repartidor puede hacer varias salidas al día.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="costo-envio-zona">Costo de envío (USD) *</Label>
            <Input id="costo-envio-zona" type="number" min={0} max={100} step="0.01"
              {...register('costo_envio', { valueAsNumber: true })} />
            {errors.costo_envio && <p className="text-xs text-destructive">{errors.costo_envio.message}</p>}
            <p className="text-xs text-muted-foreground">Se cobra al cliente en cada pedido con destino en esta zona.</p>
          </div>

          {zona && (
            <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
              <input type="checkbox" {...register('activa')} />
              <span className="text-sm font-medium">Zona activa</span>
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              <Plus className="h-4 w-4 mr-1" />
              {zona ? 'Guardar zona' : 'Crear zona'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CardZonaProps {
  zona: Zona;
  onEdit: (zona: Zona) => void;
}

function CardZona({ zona, onEdit }: CardZonaProps) {
  return (
    <Card className="hover:shadow-md transition-shadow" data-cy="card-zona">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${zona.color}20`, border: `2px solid ${zona.color}` }}
          >
            <MapPin className="h-5 w-5" style={{ color: zona.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{zona.nombre}</CardTitle>
            {zona.descripcion && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{zona.descripcion}</p>
            )}
          </div>
          <Badge variant={zona.activa ? 'success' : 'secondary'}>
            {zona.activa ? 'Activa' : 'Inactiva'}
          </Badge>
          <Button type="button" variant="outline" size="icon" aria-label={`Editar ${zona.nombre}`} onClick={() => onEdit(zona)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Pedidos activos</p>
              <p className="text-sm font-semibold">{zona.pedidos_count ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Cap. máxima/ruta</p>
              <p className="text-sm font-semibold">{zona.capacidad_maxima} pedidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Envío</p>
              <p className="text-sm font-semibold">{formatoEnvio(zona.costo_envio)}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{zona.poligono ? 'Área marcada en el mapa' : 'Falta dibujar el área en el mapa'}</p>
      </CardContent>
    </Card>
  );
}

export default function ZonasPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const autorizado = esAdministrador(usuario?.rol);
  const [modalOpen, setModalOpen] = useState(false);
  const [zonaEditada, setZonaEditada] = useState<Zona | null>(null);

  const { data: zonas = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['zonas'],
    queryFn: zonasService.listarZonas,
    enabled: autorizado,
    staleTime: 60_000,
  });

  if (!usuario) return <p role="status">Cargando sesión…</p>;
  if (!autorizado) return <p role="alert">Esta vista requiere una sesión de administrador.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zonas de Entrega</h1>
          <p className="text-muted-foreground text-sm">
            Definí y gestioná las zonas geográficas de tu operación
          </p>
        </div>
        <Button onClick={() => { setZonaEditada(null); setModalOpen(true); }} data-cy="btn-nueva-zona">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Zona
        </Button>
      </div>

      {isError ? <ErrorConsulta error={error} reintentar={() => void refetch()} cargando={isFetching} /> : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : zonas.length === 0 ? (
        <EmptyState
          title="Sin zonas definidas"
          description="Creá tu primera zona geográfica para comenzar a organizar tus entregas."
          icon={<MapPin className="h-10 w-10 text-muted-foreground" />}
          action={
          <Button onClick={() => { setZonaEditada(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primera zona
            </Button>
          }
          className="py-20 bg-card border border-dashed border-border rounded-lg"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zonas.map((zona) => (
            <CardZona key={zona.id} zona={zona} onEdit={zona => { setZonaEditada(zona); setModalOpen(true); }} />
          ))}
        </div>
      )}

      <ModalNuevaZona open={modalOpen} onOpenChange={setModalOpen} zona={zonaEditada} />
    </div>
  );
}

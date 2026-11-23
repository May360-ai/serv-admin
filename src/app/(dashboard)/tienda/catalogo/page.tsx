'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { RoleGuard } from '@/components/auth/role-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatMoneda } from '@/lib/utils';
import type { Categoria } from '@/types';
import { itemsService, type ItemCatalogo } from '@/services/items.service';
import { proveedoresService } from '@/services/proveedores.service';
import { zonasService } from '@/services/zonas.service';
import { ErrorConsulta } from '@/components/ui/error-consulta';
import { Paginacion, usePaginacion } from '@/components/ui/paginacion';
import { EdicionProducto, ImagenProducto } from '@/components/pedidos/producto-edicion';
import { ResenasProducto } from '@/components/pedidos/valoraciones';

const medidaOpcionalSchema = z
  .string()
  .optional()
  .refine(
    (v) => !v?.trim() || (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 10000),
    'Debe ser un número mayor a 0'
  );

const nuevoItemSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  codigo: z.string().max(50, 'Máximo 50 caracteres').optional(),
  descripcion: z.string().optional(),
  categoria_id: z.string().min(1, 'Debes seleccionar una categoría'),
  precio: z
    .number({ error: 'Ingresá un precio válido' })
    .positive('El precio debe ser mayor a 0'),
  inventario_stock: z
    .number({ error: 'Ingresá una cantidad de stock válida' })
    .int()
    .min(0, 'El stock no puede ser negativo'),
  peso_kg: medidaOpcionalSchema,
  largo_cm: medidaOpcionalSchema,
  ancho_cm: medidaOpcionalSchema,
  alto_cm: medidaOpcionalSchema,
});

type NuevoItemForm = z.infer<typeof nuevoItemSchema>;

export default function CatalogoPage() {
  const queryClient = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const [modalOpen, setModalOpen] = useState(false);

  // Categorías para el selector
  const consultaCategorias = useQuery<Categoria[]>({
    queryKey: ['categorias-datos'],
    queryFn: zonasService.listarCategorias,
    staleTime: 300_000,
  });

  // Lista de productos del proveedor
  const consultaItems = useQuery<ItemCatalogo[]>({
    queryKey: ['items-tienda', usuario?.proveedor_id, usuario?.id, usuario?.rol],
    queryFn: async () => {
      const tienda = await proveedoresService.obtenerMiTienda(usuario?.proveedor_id, usuario?.id);
      if (!tienda) throw new Error('No hay una tienda vinculada a esta sesión.');
      const productos = await itemsService.listarMiTienda();
      if (productos.some(item => String(item.proveedor_id) !== String(tienda.id))) {
        throw new Error('El catálogo recibido no corresponde a esta tienda.');
      }
      return productos;
    },
    enabled: usuario?.rol === 'proveedor',
  });
  const { data: categorias = [] } = consultaCategorias;
  const { data: items = [], isLoading } = consultaItems;
  const paginado = usePaginacion(items, String(usuario?.id), 12);

  const { mutate: crearItem, isPending } = useMutation({
    mutationFn: async (body: NuevoItemForm) => {
      const payload = {
        nombre: body.nombre.trim(),
        ...(body.codigo?.trim() ? { codigo: body.codigo.trim() } : {}),
        descripcion: body.descripcion,
        precio: body.precio,
        inventario_stock: body.inventario_stock,
        ...(body.peso_kg?.trim() ? { peso_kg: Number(body.peso_kg) } : {}),
        ...(body.largo_cm?.trim() ? { largo_cm: Number(body.largo_cm) } : {}),
        ...(body.ancho_cm?.trim() ? { ancho_cm: Number(body.ancho_cm) } : {}),
        ...(body.alto_cm?.trim() ? { alto_cm: Number(body.alto_cm) } : {}),
        categoria_id: Number(body.categoria_id),
        es_servicio: false,
      };
      const { data } = await apiClient.post('/api/items', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items-tienda'] });
      toast.success('Producto creado y publicado en tu catálogo');
      setModalOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(`Error al crear producto: ${err.message}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NuevoItemForm>({
    resolver: zodResolver(nuevoItemSchema),
    defaultValues: {
      precio: 0,
      inventario_stock: 10,
      categoria_id: '',
    },
  });

  const onSubmit = (formData: NuevoItemForm) => {
    crearItem(formData);
  };

  if (!usuario) return <p role="status">Cargando sesión…</p>;
  if (usuario.rol !== 'proveedor') return <p role="alert">Esta vista requiere una sesión de proveedor.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-muted-foreground text-sm">
            Gestioná los productos y servicios disponibles para despacho en tu tienda
          </p>
        </div>

        {/* Botón protegido por RoleGuard */}
        <RoleGuard allowedRoles={['proveedor']}>
          <Button
            onClick={() => setModalOpen(true)}
            data-cy="btn-nuevo-producto"
            disabled={consultaItems.isError || consultaCategorias.isError || consultaCategorias.isLoading}
            className="gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Crear Producto
          </Button>
        </RoleGuard>
      </div>

      {/* Lista de Productos */}
      {consultaCategorias.isLoading && <p role="status">Cargando categorías…</p>}
      {consultaCategorias.isError && <ErrorConsulta error={consultaCategorias.error} reintentar={() => void consultaCategorias.refetch()} cargando={consultaCategorias.isFetching} />}
      {consultaItems.isError ? <ErrorConsulta error={consultaItems.error} reintentar={() => void consultaItems.refetch()} cargando={consultaItems.isFetching} /> : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Tu catálogo está vacío"
          description="Comenzá publicando flores, regalos o combos para tus entregas de última milla."
          icon={<Package className="h-10 w-10 text-muted-foreground" />}
          action={
            <RoleGuard allowedRoles={['proveedor']}>
              <Button onClick={() => setModalOpen(true)} className="gap-2" disabled={consultaCategorias.isError || consultaCategorias.isLoading}>
                <Plus className="h-4 w-4" />
                Agregar mi primer producto
              </Button>
            </RoleGuard>
          }
          className="py-16 bg-card border border-dashed rounded-lg"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginado.datos.map((prod) => (
            <Card key={prod.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{prod.nombre}</CardTitle>
                    {prod.codigo && <p className="text-xs text-muted-foreground">Código: {prod.codigo}</p>}
                    {prod.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {prod.descripcion}
                      </p>
                    )}
                  </div>
                  <Badge variant={prod.activo !== false ? 'success' : 'secondary'}>
                    {prod.activo !== false ? 'Disponible' : 'Pausado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ImagenProducto producto={prod} />
                <div className="flex items-center justify-between text-sm pt-3 border-t border-border">
                  <span className="font-bold text-foreground">
                    {formatMoneda(Number(prod.precio))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {prod.es_servicio ? 'Servicio' : `Stock: ${prod.inventario_stock ?? 0} un.`}
                  </span>
                </div>
                {(prod.peso_kg != null || prod.largo_cm != null || prod.ancho_cm != null || prod.alto_cm != null) && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {prod.peso_kg != null ? `Peso: ${Number(prod.peso_kg)} kg` : ''}
                    {prod.peso_kg != null && (prod.largo_cm != null || prod.ancho_cm != null || prod.alto_cm != null) ? ' · ' : ''}
                    {(prod.largo_cm != null || prod.ancho_cm != null || prod.alto_cm != null)
                      ? `Dim: ${prod.largo_cm ?? '-'} x ${prod.ancho_cm ?? '-'} x ${prod.alto_cm ?? '-'} cm`
                      : ''}
                  </p>
                )}
                {(prod.variaciones_item?.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {prod.variaciones_item?.map(v => (
                      <li key={v.id}>{v.nombre_variacion}{v.stock != null ? ` · stock ${v.stock}` : ''}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2"><EdicionProducto producto={prod} /><ResenasProducto itemId={prod.id} /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Nuevo Producto */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent onClose={() => setModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo Producto para Despacho</DialogTitle>
            <DialogDescription>
              Cargá los detalles del producto que estará disponible en tu tienda
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-nombre">Nombre del Producto *</Label>
                <Input
                  id="prod-nombre"
                  placeholder="Ramo 12 Rosas Rojas"
                  {...register('nombre')}
                />
                {errors.nombre && (
                  <p className="text-xs text-destructive">{errors.nombre.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-codigo">Código / SKU (opcional)</Label>
                <Input
                  id="prod-codigo"
                  placeholder="RAMO-12R"
                  maxLength={50}
                  {...register('codigo')}
                />
                {errors.codigo && (
                  <p className="text-xs text-destructive">{errors.codigo.message}</p>
                )}
              </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-categoria">Categoría *</Label>
              <Select
                id="prod-categoria"
                placeholder="Seleccioná una categoría"
                {...register('categoria_id')}
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </Select>
              {errors.categoria_id && (
                <p className="text-xs text-destructive">{errors.categoria_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Descripción</Label>
              <Textarea
                id="prod-desc"
                placeholder="Incluye tarjeta dedicatoria y florero de vidrio..."
                {...register('descripcion')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-precio">Precio ($) *</Label>
                <Input
                  id="prod-precio"
                  type="number"
                  step="0.01"
                  placeholder="25000"
                  {...register('precio', { valueAsNumber: true })}
                />
                {errors.precio && (
                  <p className="text-xs text-destructive">{errors.precio.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-stock">Stock Inicial *</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  placeholder="15"
                  {...register('inventario_stock', { valueAsNumber: true })}
                />
                {errors.inventario_stock && (
                  <p className="text-xs text-destructive">{errors.inventario_stock.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="prod-peso">Peso (kg)</Label>
                <Input id="prod-peso" type="number" step="0.01" min="0.01" placeholder="0.50" {...register('peso_kg')} />
                {errors.peso_kg && <p className="text-xs text-destructive">{errors.peso_kg.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="prod-largo">Largo (cm)</Label>
                <Input id="prod-largo" type="number" step="0.1" min="0.1" placeholder="30" {...register('largo_cm')} />
                {errors.largo_cm && <p className="text-xs text-destructive">{errors.largo_cm.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="prod-ancho">Ancho (cm)</Label>
                <Input id="prod-ancho" type="number" step="0.1" min="0.1" placeholder="20" {...register('ancho_cm')} />
                {errors.ancho_cm && <p className="text-xs text-destructive">{errors.ancho_cm.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="prod-alto">Alto (cm)</Label>
                <Input id="prod-alto" type="number" step="0.1" min="0.1" placeholder="15" {...register('alto_cm')} />
                {errors.alto_cm && <p className="text-xs text-destructive">{errors.alto_cm.message}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isPending} disabled={consultaCategorias.isError || consultaCategorias.isLoading} className="gap-2">
                <Check className="h-4 w-4" />
                Guardar Producto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Paginacion {...paginado} />
    </div>
  );
}

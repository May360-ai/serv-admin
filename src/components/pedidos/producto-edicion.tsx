'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ItemCatalogo } from '@/services/items.service';
import { apiClient, BASE_URL } from '@/lib/api-client';
import { prepararFoto } from '@/lib/preparar-foto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ImagenProducto({ producto }: { producto: ItemCatalogo }) {
  const src = producto.foto_producto ? `${BASE_URL}/api/items/${producto.id}/foto?v=${encodeURIComponent(producto.foto_producto.actualizada_en)}` : producto.imagen_url;
  return src ? <Image unoptimized src={src} width={640} height={480} alt={`Referencia de ${producto.nombre}`} className="h-44 w-full rounded-md object-contain" /> : null;
}

export function EdicionProducto({ producto }: { producto: ItemCatalogo }) {
  const [open, setOpen] = useState(false);
  const [anterior, setAnterior] = useState<number | null>(null);
  const [stock, setStock] = useState(''); const [motivo, setMotivo] = useState('');
  const client = useQueryClient();
  const actualizar = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['items-tienda'] }), client.invalidateQueries({ queryKey: ['catalogo-items'] })]); };
  const guardar = useMutation({ mutationFn: async () => {
    const nuevo = Number(stock); if (!stock.trim() || !Number.isSafeInteger(nuevo) || nuevo < 0) throw new Error('Indica un stock entero no negativo.');
    await apiClient.patch(`/api/items/${producto.id}/stock`, { stock_actual: anterior, stock_nuevo: nuevo, motivo: motivo.trim() });
  }, onSuccess: actualizar });
  const foto = useMutation({ mutationFn: async (file: File) => apiClient.put(`/api/items/${producto.id}/foto`, await prepararFoto(file), { headers: { 'Content-Type': 'image/jpeg' } }), onSuccess: actualizar });
  const cargar = () => { setAnterior(producto.inventario_stock); setStock(String(producto.inventario_stock ?? 0)); guardar.reset(); };
  return <><Button variant="outline" onClick={() => { cargar(); setMotivo(''); foto.reset(); setOpen(true); }}>Editar producto</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100vw-2rem)] sm:w-[32rem]" onClose={() => setOpen(false)} aria-labelledby={`editar-${producto.id}`}>
      <DialogHeader><DialogTitle id={`editar-${producto.id}`}>{producto.nombre}</DialogTitle></DialogHeader>
      <DatosProducto producto={producto} onGuardado={actualizar} />
      <ImagenProducto producto={producto} />
      <label className="my-3 block">Imagen de referencia<input className="mt-2 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" disabled={foto.isPending} onChange={e => { const file = e.target.files?.[0]; if (file) foto.mutate(file); e.target.value = ''; }} /></label>
      {foto.isPending && <p role="status">Guardando imagen…</p>}{foto.isError && <p role="alert">{foto.error.message}</p>}{foto.isSuccess && <p role="status">Imagen guardada.</p>}
      {!producto.es_servicio && <form className="mt-4 space-y-3 border-t pt-3" onSubmit={e => { e.preventDefault(); guardar.mutate(); }}>
        <p>Stock al iniciar el ajuste: {anterior ?? 'Sin control de inventario'}</p>
        <label className="block">Stock nuevo<Input type="number" value={stock} min={0} max={2147483647} step={1} required disabled={guardar.isPending} onChange={e => { setStock(e.target.value); guardar.reset(); }} /></label>
        <label className="block">Motivo del ajuste<Input value={motivo} minLength={3} maxLength={255} required disabled={guardar.isPending} onChange={e => setMotivo(e.target.value)} /></label>
        <p className="text-sm">Si entra una compra mientras editas, el servidor rechazará el ajuste para que revises el stock nuevo.</p>
        {guardar.isError && <p role="alert">{guardar.error.message}</p>}{guardar.isSuccess && <p role="status">Stock actualizado.</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" isLoading={guardar.isPending}>Guardar stock</Button><Button type="button" variant="outline" onClick={cargar}>Cargar stock actual</Button></div>
      </form>}
      {!producto.es_servicio && producto.variaciones_item?.map(v => (
        <StockVariacion key={v.id} itemId={producto.id} variacion={v} onGuardado={actualizar} />
      ))}
    </DialogContent></Dialog>
  </>;
}

// Nombre, descripción, precio y estado. Los pedidos ya creados conservan su precio.
function DatosProducto({ producto, onGuardado }: { producto: ItemCatalogo; onGuardado: () => Promise<void> }) {
  const [nombre, setNombre] = useState(producto.nombre);
  const [descripcion, setDescripcion] = useState(producto.descripcion ?? '');
  const [precio, setPrecio] = useState(String(Number(producto.precio)));
  const [activo, setActivo] = useState(producto.activo !== false);
  const guardar = useMutation({ mutationFn: async () => {
    const valor = Number(precio);
    if (!Number.isFinite(valor) || valor < 0 || Math.round(valor * 100) !== valor * 100) throw new Error('Indica un precio con hasta dos decimales.');
    await apiClient.patch(`/api/items/${producto.id}`, { nombre: nombre.trim(), descripcion: descripcion.trim() || null, precio: valor, activo });
  }, onSuccess: onGuardado });
  return <form className="mb-4 space-y-3 border-b pb-3" onSubmit={e => { e.preventDefault(); guardar.mutate(); }}>
    <label className="block">Nombre<Input value={nombre} minLength={2} maxLength={150} required disabled={guardar.isPending} onChange={e => setNombre(e.target.value)} /></label>
    <label className="block">Descripción<Input value={descripcion} maxLength={2000} disabled={guardar.isPending} onChange={e => setDescripcion(e.target.value)} /></label>
    <label className="block">Precio base<Input type="number" value={precio} min={0} step="0.01" required disabled={guardar.isPending} onChange={e => setPrecio(e.target.value)} /></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={activo} disabled={guardar.isPending} onChange={e => setActivo(e.target.checked)} />Disponible en el catálogo</label>
    {guardar.isError && <p role="alert">{guardar.error.message}</p>}{guardar.isSuccess && <p role="status">Producto actualizado.</p>}
    <Button type="submit" isLoading={guardar.isPending}>Guardar datos</Button>
  </form>;
}

type Variacion = NonNullable<ItemCatalogo['variaciones_item']>[number];

function StockVariacion({ itemId, variacion, onGuardado }: { itemId: number; variacion: Variacion; onGuardado: () => Promise<void> }) {
  const anterior = variacion.stock ?? null;
  const [stock, setStock] = useState(String(anterior ?? 0));
  const [motivo, setMotivo] = useState('');
  const guardar = useMutation({ mutationFn: async () => {
    const nuevo = Number(stock);
    if (!stock.trim() || !Number.isSafeInteger(nuevo) || nuevo < 0) throw new Error('Indica un stock entero no negativo.');
    await apiClient.patch(`/api/items/${itemId}/variaciones/${variacion.id}/stock`, { stock_actual: anterior, stock_nuevo: nuevo, motivo: motivo.trim() });
  }, onSuccess: onGuardado });
  return <form className="mt-4 space-y-2 border-t pt-3" onSubmit={e => { e.preventDefault(); guardar.mutate(); }}>
    <p className="font-medium">Variación: {variacion.nombre_variacion}</p>
    <p className="text-sm">Stock actual: {anterior ?? 'usa el stock del producto'}</p>
    <label className="block">Stock nuevo<Input type="number" value={stock} min={0} step={1} required disabled={guardar.isPending} onChange={e => setStock(e.target.value)} /></label>
    <label className="block">Motivo del ajuste<Input value={motivo} minLength={3} maxLength={200} required disabled={guardar.isPending} onChange={e => setMotivo(e.target.value)} /></label>
    {guardar.isError && <p role="alert">{guardar.error.message}</p>}{guardar.isSuccess && <p role="status">Stock de la variación actualizado.</p>}
    <Button type="submit" variant="outline" isLoading={guardar.isPending}>Guardar stock de variación</Button>
  </form>;
}

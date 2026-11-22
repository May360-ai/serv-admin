'use client';

import { useEffect, useRef, useState } from 'react';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Store } from 'lucide-react';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { zonasService } from '@/services/zonas.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const sucursalSchema = z.object({ id: z.string(), nombre: z.string(), direccion: z.string(), latitud: z.number(), longitud: z.number(), activa: z.boolean(), zonas: z.array(z.object({ id: z.string(), nombre: z.string() })) });
const respuesta = z.object({ success: z.literal(true), data: z.array(sucursalSchema) });
type Sucursal = z.infer<typeof sucursalSchema>;
type Punto = { latitud: number; longitud: number };

function MapaSucursal({ value, onChange }: { value: Punto | null; onChange: (punto: Punto) => void }) {
  const nodo = useRef<HTMLDivElement>(null);
  const marcador = useRef<CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const puntoInicial = useRef(value);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    let mapa: LeafletMap | null = null;
    let desmontado = false;
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (desmontado || !nodo.current) return;
      const initial = puntoInicial.current;
      mapa = L.map(nodo.current).setView(initial ? [initial.latitud, initial.longitud] : [-1.249, -78.615], initial ? 16 : 13);
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mapa);
      if (initial) marcador.current = L.circleMarker([initial.latitud, initial.longitud], { radius: 9, color: '#913813', fillOpacity: 0.85 }).addTo(mapa);
      mapa.on('click', e => {
        const punto = { latitud: e.latlng.lat, longitud: e.latlng.lng };
        if (marcador.current) marcador.current.setLatLng(e.latlng);
        else marcador.current = L.circleMarker(e.latlng, { radius: 9, color: '#913813', fillOpacity: 0.85 }).addTo(mapa!);
        onChangeRef.current(punto);
      });
      requestAnimationFrame(() => mapa?.invalidateSize());
    });
    return () => { desmontado = true; mapa?.remove(); marcador.current = null; };
  }, []);
  return <div ref={nodo} role="region" aria-label="Mapa del punto de retiro de la sucursal" className="isolate h-64 w-full rounded-md bg-muted" />;
}

function FormSucursal({ sucursal, zonas, onClose }: { sucursal: Sucursal | null; zonas: Awaited<ReturnType<typeof zonasService.listarZonas>>; onClose: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(sucursal?.nombre ?? '');
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? '');
  const [punto, setPunto] = useState<Punto | null>(sucursal ? { latitud: sucursal.latitud, longitud: sucursal.longitud } : null);
  const [zonaIds, setZonaIds] = useState(sucursal?.zonas.map(z => z.id) ?? []);
  const [activa, setActiva] = useState(sucursal?.activa ?? true);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!punto || !zonaIds.length) throw new Error('Marca el punto y selecciona al menos una zona.');
      const body = sucursal
        ? { nombre, direccion, ...punto, zona_ids: zonaIds.map(Number), activa }
        : { nombre, direccion, ...punto, zona_ids: zonaIds.map(Number) };
      return sucursal
        ? apiClient.patch(`/api/sucursales/${sucursal.id}`, body)
        : apiClient.post('/api/sucursales', body);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sucursales'] }); toast.success('Sucursal guardada.'); onClose(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const disponibles = zonas.filter(z => z.activa && z.poligono);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" onClose={onClose}>
      <DialogHeader><DialogTitle>{sucursal ? 'Editar sucursal' : 'Agregar sucursal'}</DialogTitle><DialogDescription>Marca dónde se recoge el pedido y las zonas que atiende esta sede.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="sucursal-nombre">Nombre de sucursal</Label><Input id="sucursal-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} /></div>
        <div className="space-y-1.5"><Label htmlFor="sucursal-direccion">Dirección de retiro</Label><Input id="sucursal-direccion" value={direccion} onChange={e => setDireccion(e.target.value)} maxLength={255} /></div>
        <div className="space-y-2"><Label>Punto de retiro en el mapa</Label><MapaSucursal value={punto} onChange={setPunto} />{punto && <p className="text-xs text-muted-foreground">{punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}</p>}</div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Zonas que atiende</legend>
          {!disponibles.length && <p className="text-sm text-destructive">Primero dibuja las zonas de cobertura en administración.</p>}
          {disponibles.map(z => <label key={z.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3">
            <input type="checkbox" checked={zonaIds.includes(z.id)} onChange={e => setZonaIds(ids => e.target.checked ? [...new Set([...ids, z.id])] : ids.filter(id => id !== z.id))} />
            <span>{z.nombre}</span>
          </label>)}
        </fieldset>
        {sucursal && (
          <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
            <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />
            <span className="text-sm font-medium">Sucursal activa</span>
          </label>
        )}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!nombre.trim() || !direccion.trim() || !punto || !zonaIds.length}>Guardar sucursal</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function SucursalesManager() {
  const [editando, setEditando] = useState<Sucursal | null>(null);
  const [nueva, setNueva] = useState(false);
  const listado = useQuery({ queryKey: ['sucursales'], queryFn: async () => {
    const { data } = await apiClient.get<unknown>('/api/sucursales');
    const parsed = respuesta.safeParse(data);
    if (!parsed.success) throw new Error('Respuesta de sucursales inesperada.');
    return parsed.data.data;
  } });
  const zonas = useQuery({ queryKey: ['zonas'], queryFn: zonasService.listarZonas });
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Sucursales y retiros</CardTitle><p className="mt-1 text-sm text-muted-foreground">Asocia cada sede con las zonas que cubre.</p></div>
      <Button onClick={() => setNueva(true)}><Plus className="mr-2 h-4 w-4" />Agregar sucursal</Button></CardHeader>
    <CardContent className="space-y-3">
      {listado.isPending && <p role="status">Cargando sucursales…</p>}
      {listado.isError && <p role="alert">{listado.error.message}</p>}
      {listado.data?.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay sucursales. Agrega una para poder recibir pedidos en zonas dibujadas.</p>}
      {listado.data?.map(s => <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">{s.nombre}</p>
            <Badge variant={s.activa ? 'success' : 'secondary'}>{s.activa ? 'Activa' : 'Inactiva'}</Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{s.direccion}</p>
          <p className="text-xs text-muted-foreground">Zonas: {s.zonas.map(z => z.nombre).join(', ')}</p>
        </div>
        <Button variant="outline" size="icon" aria-label={`Editar ${s.nombre}`} onClick={() => setEditando(s)}><Pencil className="h-4 w-4" /></Button>
      </div>)}
    </CardContent>
    {zonas.data && (nueva || editando) && <FormSucursal key={editando?.id ?? 'new'} sucursal={editando} zonas={zonas.data} onClose={() => { setNueva(false); setEditando(null); }} />}
  </Card>;
}

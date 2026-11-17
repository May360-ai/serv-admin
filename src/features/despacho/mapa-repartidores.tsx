'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiClient } from '@/lib/api-client';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import type { Ruta } from '@/types';

const respuestaUbicacion = z.object({ data: z.object({
  ultima_latitud: z.number().min(-90).max(90),
  ultima_longitud: z.number().min(-180).max(180),
  ubicacion_actualizada: z.string().refine(value => Number.isFinite(Date.parse(value))),
}).nullable() });

function Mapa({ latitud, longitud }: { latitud: number; longitud: number }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [capas, setCapas] = useState<{ mapa: LeafletMap; marcador: CircleMarker }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    let mapa: LeafletMap | undefined;
    let desmontado = false;
    void import('leaflet').then(L => {
      if (desmontado) return;
      mapa = L.map(nodo, { scrollWheelZoom: false });
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      const marcador = L.circleMarker([0, 0], { radius: 9, color: '#fff', weight: 3, fillColor: '#0759b9', fillOpacity: 1 }).addTo(mapa);
      setCapas({ mapa, marcador });
    }).catch(() => { if (!desmontado) setError(true); });
    return () => {
      desmontado = true;
      mapa?.remove();
    };
  }, []);

  useEffect(() => {
    if (!capas) return;
    const punto: [number, number] = [latitud, longitud];
    capas.marcador.setLatLng(punto);
    capas.mapa.setView(punto, capas.mapa.getZoom() ?? 16);
  }, [capas, latitud, longitud]);

  return <>
    {error && <p role="alert">No se pudo abrir el mapa.</p>}
    <div ref={contenedor} role="region" aria-label="Mapa de la ubicación del repartidor" className="isolate h-80 w-full rounded-lg bg-muted" />
  </>;
}

export function MapaRepartidores({ rutas }: { rutas: Ruta[] }) {
  const usuario = useAuthStore(state => state.usuario);
  const [ahora, setAhora] = useState(() => Date.now());
  const [seleccion, setSeleccion] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setAhora(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  const activas = rutas.filter(ruta => ruta.estado === 'en_ruta');
  const rutaId = activas.find(ruta => ruta.id === seleccion)?.id ?? activas[0]?.id;
  const { data: punto, isError, isPending } = useQuery({
    queryKey: ['ubicacion-ruta', usuario?.id, usuario?.proveedor_id, rutaId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<unknown>(`/api/rutas/${rutaId}/ubicacion`, { signal });
      return respuestaUbicacion.parse(data).data;
    },
    enabled: Boolean(usuario && rutaId),
    refetchInterval: 5000,
  });
  const reciente = punto && ahora - Date.parse(punto.ubicacion_actualizada) < 60_000;

  return <section aria-labelledby="titulo-mapa-rutas" className="space-y-3 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="titulo-mapa-rutas" className="text-lg font-semibold">Mapa de repartidores</h2>
      {rutaId && <Select className="w-auto max-w-full" aria-label="Ruta que se muestra en el mapa" value={rutaId} onChange={e => setSeleccion(e.target.value)}>
        {activas.map(ruta => <option key={ruta.id} value={ruta.id}>{ruta.nombre}</option>)}
      </Select>}
    </div>
    {!rutaId ? <p>No hay rutas en curso para estos filtros.</p>
      : isError ? <p role="alert">No se pudo consultar la ubicación.</p>
      : isPending ? <p role="status">Consultando ubicación…</p>
      : !punto || !reciente ? <p>Esperando una ubicación reciente del repartidor.</p>
      : <>
        <Mapa key={rutaId} latitud={punto.ultima_latitud} longitud={punto.ultima_longitud} />
        <p className="text-sm text-muted-foreground">
          Última señal a las {new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', timeStyle: 'medium' }).format(new Date(punto.ubicacion_actualizada))}
        </p>
      </>}
  </section>;
}

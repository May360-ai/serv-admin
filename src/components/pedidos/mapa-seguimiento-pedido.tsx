'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const respuestaUbicacionPedido = z.object({
  data: z.object({
    ultima_latitud: z.number().min(-90).max(90),
    ultima_longitud: z.number().min(-180).max(180),
    ubicacion_actualizada: z.string().refine(value => Number.isFinite(Date.parse(value))),
    ruta_id: z.string().min(1),
    orden_en_ruta: z.number().int().positive().nullable().optional(),
    destino: z.object({
      latitud: z.number().min(-90).max(90),
      longitud: z.number().min(-180).max(180),
    }).nullable().optional(),
  }).nullable(),
});

function MapaEnVivo({
  repartidor,
  destino,
}: {
  repartidor: { latitud: number; longitud: number };
  destino?: { latitud: number; longitud: number } | null;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [capas, setCapas] = useState<{
    mapa: LeafletMap;
    marcadorRepartidor: CircleMarker;
    marcadorDestino: CircleMarker;
  }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    let mapa: LeafletMap | undefined;
    let desmontado = false;
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (desmontado) return;
      mapa = L.map(nodo, { scrollWheelZoom: false });
      L.tileLayer(
        process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        },
      ).addTo(mapa);
      const marcadorDestino = L.circleMarker([0, 0], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: '#dc2626',
        fillOpacity: 0.95,
      }).bindTooltip('Punto de entrega');
      const marcadorRepartidor = L.circleMarker([0, 0], {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: '#0759b9',
        fillOpacity: 1,
      }).bindTooltip('Repartidor').addTo(mapa);
      setCapas({ mapa, marcadorRepartidor, marcadorDestino });
    }).catch(() => {
      if (!desmontado) setError(true);
    });
    return () => {
      desmontado = true;
      mapa?.remove();
    };
  }, []);

  useEffect(() => {
    if (!capas) return;
    const puntoRepartidor: [number, number] = [repartidor.latitud, repartidor.longitud];
    capas.marcadorRepartidor.setLatLng(puntoRepartidor);
    if (destino) {
      const puntoDestino: [number, number] = [destino.latitud, destino.longitud];
      capas.marcadorDestino.setLatLng(puntoDestino);
      if (!capas.mapa.hasLayer(capas.marcadorDestino)) {
        capas.marcadorDestino.addTo(capas.mapa);
      }
      capas.mapa.fitBounds([puntoRepartidor, puntoDestino], { padding: [36, 36], maxZoom: 16 });
    } else {
      if (capas.mapa.hasLayer(capas.marcadorDestino)) {
        capas.mapa.removeLayer(capas.marcadorDestino);
      }
      capas.mapa.setView(puntoRepartidor, capas.mapa.getZoom() ?? 16);
    }
  }, [capas, repartidor.latitud, repartidor.longitud, destino]);

  return (
    <>
      {error && <p role="alert">No se pudo cargar el mapa en vivo.</p>}
      <div ref={contenedor} role="region" aria-label="Mapa de seguimiento en vivo del repartidor" className="isolate h-72 w-full rounded-lg bg-muted" />
    </>
  );
}

export function MapaSeguimientoPedido({ pedidoId }: { pedidoId: string }) {
  const usuario = useAuthStore(s => s.usuario);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setAhora(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: punto, isError, isPending } = useQuery({
    queryKey: ['ubicacion-pedido', usuario?.id, pedidoId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<unknown>(`/api/pedidos/${pedidoId}/ubicacion`, { signal });
      return respuestaUbicacionPedido.parse(data).data;
    },
    enabled: Boolean(usuario && pedidoId),
    refetchInterval: 5000,
  });

  const reciente = Boolean(punto && ahora - Date.parse(punto.ubicacion_actualizada) < 60_000);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguimiento en vivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isError ? (
          <p role="alert">No se pudo consultar la ubicación del repartidor.</p>
        ) : isPending ? (
          <p role="status">Consultando ubicación del repartidor…</p>
        ) : !punto || !reciente ? (
          <p role="status" className="text-sm text-muted-foreground">
            Esperando señal reciente del repartidor en ruta.
          </p>
        ) : (
          <>
            <MapaEnVivo
              repartidor={{ latitud: punto.ultima_latitud, longitud: punto.ultima_longitud }}
              destino={punto.destino}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Última señal a las{' '}
                {new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', timeStyle: 'medium' }).format(
                  new Date(punto.ubicacion_actualizada),
                )}
              </span>
              <span>Azul: repartidor · Rojo: destino</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

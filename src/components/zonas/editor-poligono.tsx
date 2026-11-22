'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng, Map as LeafletMap, Polygon } from 'leaflet';
import { Button } from '@/components/ui/button';

export type PoligonoZona = { type: 'Polygon'; coordinates: number[][][] };

export function EditorPoligono({ value, onChange }: { value: PoligonoZona | null; onChange: (value: PoligonoZona | null) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const vertices = useRef<LatLng[]>([]);
  const linea = useRef<Polygon | null>(null);
  const valorRef = useRef(value);
  const cambioRef = useRef(onChange);
  const [cantidad, setCantidad] = useState(value?.coordinates[0]?.length ? value.coordinates[0].length - 1 : 0);
  const [error, setError] = useState('');
  useEffect(() => { valorRef.current = value; cambioRef.current = onChange; }, [value, onChange]);

  useEffect(() => {
    let desmontado = false;
    let mapa: LeafletMap | null = null;
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (desmontado || !contenedor.current) return;
      mapa = L.map(contenedor.current).setView([-1.249, -78.615], 13);
      mapaRef.current = mapa;
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on('tileerror', () => setError('No se pudieron cargar las teselas del mapa.')).addTo(mapa);
      const dibujar = () => {
        if (!mapa) return;
        linea.current?.remove();
        linea.current = L.polygon(vertices.current, { color: '#913813', weight: 3, fillOpacity: 0.16 }).addTo(mapa);
      };
      const original = valorRef.current?.coordinates[0];
      if (original?.length) {
        vertices.current = original.slice(0, -1).map(([lng, lat]) => L.latLng(lat, lng));
        dibujar();
        mapa.fitBounds(linea.current!.getBounds(), { padding: [16, 16] });
      }
      mapa.on('click', e => {
        if (vertices.current.length >= 3 && valorRef.current) {
          vertices.current = [];
          cambioRef.current(null);
        }
        vertices.current = [...vertices.current, e.latlng];
        setCantidad(vertices.current.length);
        setError('');
        dibujar();
      });
      requestAnimationFrame(() => mapa?.invalidateSize());
    }).catch(() => setError('No se pudo abrir el editor de zonas.'));
    return () => { desmontado = true; mapaRef.current = null; mapa?.remove(); };
  }, []);

  function cerrar() {
    if (vertices.current.length < 3) return;
    const anillo = vertices.current.map(p => [p.lng, p.lat]);
    anillo.push([...anillo[0]]);
    const poligono = { type: 'Polygon' as const, coordinates: [anillo] };
    cambioRef.current(poligono);
    setCantidad(vertices.current.length);
    setError('');
  }

  function deshacer() {
    if (!vertices.current.length) return;
    vertices.current = vertices.current.slice(0, -1);
    setCantidad(vertices.current.length);
    valorRef.current = null;
    cambioRef.current(null);
    linea.current?.remove();
    linea.current = null;
    if (vertices.current.length && mapaRef.current) {
      void import('leaflet').then(L => { if (mapaRef.current) linea.current = L.polygon(vertices.current, { color: '#913813', weight: 3, fillOpacity: 0.16 }).addTo(mapaRef.current); });
    }
  }

  function limpiar() {
    vertices.current = [];
    setCantidad(0);
    linea.current?.remove();
    linea.current = null;
    cambioRef.current(null);
  }

  return <div className="space-y-2">
    <div ref={contenedor} role="region" aria-label="Mapa para dibujar una zona" className="isolate h-72 w-full rounded-md bg-muted" />
    <p className="text-sm text-muted-foreground">Toca el mapa para marcar el contorno. Cierra el área al completar al menos tres puntos.</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={deshacer} disabled={!cantidad}>Deshacer punto</Button>
      <Button type="button" variant="outline" onClick={limpiar} disabled={!cantidad}>Limpiar área</Button>
      <Button type="button" onClick={cerrar} disabled={cantidad < 3 || Boolean(value)}>Guardar contorno</Button>
    </div>
    <p className="text-xs" role="status">{value ? 'Contorno listo para guardar.' : `${cantidad} puntos marcados.`}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

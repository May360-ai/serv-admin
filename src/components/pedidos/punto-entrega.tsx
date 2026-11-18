'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { zonasService } from '@/services/zonas.service';
import { Button } from '@/components/ui/button';

export type PuntoEntrega = { latitud: number; longitud: number };

export function PuntoEntrega({ value, onChange }: { value: PuntoEntrega | null; onChange: (value: PuntoEntrega | null) => void }) {
  const cobertura = useQuery({ queryKey: ['cobertura-entrega'], queryFn: zonasService.coberturaEntrega });
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaActual = useRef<LeafletMap | null>(null);
  const seleccionar = useRef<(punto: PuntoEntrega) => void>(() => {});
  const vivo = useRef(false);
  const inicial = useRef(value);
  const [candidato, setCandidato] = useState<PuntoEntrega | null>(value);
  const [listo, setListo] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [errorMapa, setErrorMapa] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => {
    const nodo = contenedor.current;
    const area = cobertura.data;
    if (!nodo || !area) return;
    let mapa: LeafletMap | undefined;
    let marcador: CircleMarker | undefined;
    let desmontado = false;
    void import('leaflet').then(L => {
      if (desmontado) return;
      const centro = L.latLng(area.centro.latitud, area.centro.longitud);
      mapa = L.map(nodo).setView(centro, 14);
      mapaActual.current = mapa;
      L.circle(centro, { radius: area.radio_km * 1000, color: '#913813', weight: 1, fillOpacity: 0.03 }).addTo(mapa);
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on('tileerror', () => { if (!desmontado) setErrorMapa(true); }).addTo(mapa);
      if (inicial.current) {
        const posicion = L.latLng(inicial.current.latitud, inicial.current.longitud);
        marcador = L.circleMarker(posicion, { radius: 10, color: '#913813', fillOpacity: 0.85 }).addTo(mapa);
        mapa.setView(posicion, 17);
      }
      seleccionar.current = punto => {
        if (!mapa) return;
        onChange(null);
        const posicion = L.latLng(punto.latitud, punto.longitud);
        if (marcador) marcador.setLatLng(posicion);
        else marcador = L.circleMarker(posicion, { radius: 10, color: '#913813', fillOpacity: 0.85 }).addTo(mapa);
        if (centro.distanceTo(posicion) > area.radio_km * 1000) {
          setCandidato(null);
          setError(`El punto está fuera del área de reparto de ${area.radio_km} km alrededor de Ambato.`);
        } else {
          setCandidato(punto);
          setError('');
        }
      };
      mapa.on('click', event => seleccionar.current({ latitud: event.latlng.lat, longitud: event.latlng.lng }));
      setListo(true);
    }).catch(() => { if (!desmontado) setErrorMapa(true); });
    return () => { desmontado = true; mapaActual.current = null; seleccionar.current = () => {}; mapa?.remove(); };
  }, [cobertura.data, onChange, revision]);

  const usarGps = () => {
    if (!navigator.geolocation) { setError('Tu navegador no ofrece ubicación. Marca el destino en el mapa.'); return; }
    onChange(null);
    setCandidato(null);
    setBuscando(true);
    setError('');
    navigator.geolocation.getCurrentPosition(posicion => {
      if (!vivo.current) return;
      setBuscando(false);
      const punto = { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
      mapaActual.current?.setView([punto.latitud, punto.longitud], 17);
      seleccionar.current(punto);
    }, fallo => {
      if (!vivo.current) return;
      setBuscando(false);
      setError(fallo.code === 1 ? 'No diste permiso de ubicación. Puedes marcar el destino en el mapa.' : 'No se pudo obtener tu ubicación. Marca el destino en el mapa.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  return <section className="min-w-0 space-y-3" aria-label="Punto de entrega">
    <h3 className="text-sm font-medium">Punto de entrega en el mapa *</h3>
    <p className="text-sm">Usa tu ubicación o toca el lugar de entrega. Revisa el punto antes de confirmarlo; el GPS puede ser aproximado.</p>
    {cobertura.isPending && <p role="status">Cargando área de reparto…</p>}
    {cobertura.isError && <p role="alert">No se pudo cargar el área de reparto. <Button type="button" variant="outline" onClick={() => void cobertura.refetch()}>Reintentar</Button></p>}
    {cobertura.data && <>
      <p className="text-sm">Reparto en {cobertura.data.ciudad}: hasta {cobertura.data.radio_km} km desde el centro. La zona se selecciona más abajo.</p>
      <div ref={contenedor} role="region" aria-label="Mapa para seleccionar el destino" className="isolate h-72 w-full rounded-md bg-muted" />
      {!listo && !errorMapa && <p role="status">Abriendo mapa…</p>}
      {errorMapa && <p role="alert">No se pudo cargar el mapa completo. <Button type="button" variant="outline" onClick={() => {
        inicial.current = null; onChange(null); setCandidato(null); setListo(false); setErrorMapa(false); setRevision(n => n + 1);
      }}>Reintentar mapa</Button></p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={!listo || buscando} isLoading={buscando} onClick={usarGps}>Usar mi ubicación</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={!listo || buscando} onClick={() => {
          const centro = mapaActual.current?.getCenter();
          if (centro) seleccionar.current({ latitud: centro.lat, longitud: centro.lng });
        }}>Usar el centro del mapa</Button>
      </div>
      <p className="text-sm">También puedes mover el mapa con las flechas y elegir su centro con el botón.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    {candidato && <p className="text-sm" role="status">{value ? 'Destino confirmado' : 'Punto por confirmar'}: {candidato.latitud.toFixed(6)}, {candidato.longitud.toFixed(6)}</p>}
    <Button type="button" variant="outline" className="min-h-11" disabled={!candidato || buscando || !!value || errorMapa} onClick={() => onChange(candidato)}>Confirmar punto de entrega</Button>
  </section>;
}

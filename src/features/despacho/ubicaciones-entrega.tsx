'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Pedido, Ruta } from '@/types';

type Punto = { latitud: number; longitud: number };

function puntoPedido(pedido: Pedido): Punto | null {
  const { latitud, longitud } = pedido.direccion;
  return typeof latitud === 'number' && Number.isFinite(latitud) && typeof longitud === 'number' && Number.isFinite(longitud)
    ? { latitud, longitud } : null;
}

function EditorPunto({ ruta, pedido, centro, cerrar }: { ruta: Ruta; pedido: Pedido; centro: Punto; cerrar: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const marcador = useRef<CircleMarker | null>(null);
  const mapaActual = useRef<LeafletMap | null>(null);
  const inicio = useRef({ centro, punto: puntoPedido(pedido) });
  const [mapaListo, setMapaListo] = useState(false);
  const [punto, setPunto] = useState<Punto | null>(() => puntoPedido(pedido));
  const [errorMapa, setErrorMapa] = useState(false);
  const client = useQueryClient();
  const guardar = useMutation({
    mutationFn: async () => {
      if (!punto) throw new Error('Marca la ubicación de entrega en el mapa.');
      await apiClient.patch(`/api/rutas/${ruta.id}/pedidos/${pedido.id}/ubicacion`, punto);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['rutas'] });
      cerrar();
    },
  });
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    let mapa: LeafletMap | undefined;
    let desmontado = false;
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (desmontado) return;
      const datos = inicio.current;
      mapa = L.map(nodo).setView([datos.centro.latitud, datos.centro.longitud], 15);
      mapaActual.current = mapa;
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      const colocar = (latitud: number, longitud: number) => {
        if (!mapa) return;
        if (marcador.current) marcador.current.setLatLng([latitud, longitud]);
        else marcador.current = L.circleMarker([latitud, longitud], { radius: 9, color: '#913813', fillOpacity: 0.8 }).addTo(mapa);
        setPunto({ latitud, longitud });
      };
      const inicial = datos.punto;
      if (inicial) {
        marcador.current = L.circleMarker([inicial.latitud, inicial.longitud], { radius: 9, color: '#913813', fillOpacity: 0.8 }).addTo(mapa);
      }
      mapa.on('click', event => colocar(event.latlng.lat, event.latlng.lng));
      setMapaListo(true);
    }).catch(() => { if (!desmontado) setErrorMapa(true); });
    return () => {
      desmontado = true;
      marcador.current = null;
      mapaActual.current = null;
      mapa?.remove();
    };
  }, []);
  return <div className="space-y-3">
    <p className="font-medium">{pedido.direccion.calle}, {pedido.direccion.ciudad}</p>
    <p className="text-sm">Toca en el mapa el lugar exacto de entrega y guarda la ubicación.</p>
    <div ref={contenedor} role="region" aria-label="Seleccionar ubicación de la entrega" className="isolate h-72 w-full rounded-md bg-muted" />
    <Button variant="outline" disabled={!mapaListo || guardar.isPending} onClick={() => {
      const mapa = mapaActual.current;
      if (mapa) mapa.fire('click', { latlng: mapa.getCenter() });
    }}>Usar el centro del mapa</Button>
    {errorMapa && <p role="alert">No se pudo abrir el mapa.</p>}
    {punto && <p className="text-sm">Punto seleccionado · {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}</p>}
    {guardar.isError && <p role="alert">{guardar.error.message}</p>}
    <div className="flex gap-2">
      <Button disabled={!punto || errorMapa} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>Guardar ubicación</Button>
      <Button variant="outline" disabled={guardar.isPending} onClick={cerrar}>Cancelar</Button>
    </div>
  </div>;
}

export function UbicacionesEntrega({ rutas }: { rutas: Ruta[] }) {
  const [abierto, setAbierto] = useState(false);
  const [id, setId] = useState('');
  const opciones = rutas.filter(ruta => ['armando', 'en_ruta'].includes(ruta.estado))
    .flatMap(ruta => ruta.pedidos.filter(p => !['completado', 'cancelado', 'fallido'].includes(p.estado))
      .map(pedido => ({ ruta, pedido })));
  const seleccion = opciones.find(opcion => opcion.pedido.id === id) ??
    opciones.find(opcion => !puntoPedido(opcion.pedido)) ?? opciones[0];
  const centro = seleccion && (puntoPedido(seleccion.pedido) ??
    opciones.map(opcion => puntoPedido(opcion.pedido)).find(punto => punto != null) ??
    { latitud: -1.249, longitud: -78.615 });
  return <>
    <Button variant="outline" disabled={!opciones.length} onClick={() => setAbierto(true)}>Ubicaciones de entrega</Button>
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-[38rem] sm:max-w-[38rem]" aria-labelledby="titulo-ubicaciones">
        <DialogHeader><DialogTitle id="titulo-ubicaciones">Ubicaciones de entrega</DialogTitle></DialogHeader>
        {abierto && seleccion && centro && <div className="space-y-4">
          <label className="block space-y-1">Entrega
            <Select value={seleccion.pedido.id} onChange={event => setId(event.target.value)}>
              {opciones.map(opcion => <option key={opcion.pedido.id} value={opcion.pedido.id}>
                {opcion.pedido.numero_pedido} · {opcion.pedido.cliente_nombre} · {opcion.ruta.nombre}
              </option>)}
            </Select>
          </label>
          <EditorPunto key={seleccion.pedido.id} ruta={seleccion.ruta} pedido={seleccion.pedido} centro={centro} cerrar={() => setAbierto(false)} />
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}

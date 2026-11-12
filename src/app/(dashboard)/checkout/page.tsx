'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zonasService } from '@/services/zonas.service';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Truck,
  MapPin,
  FileText,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCarritoStore } from '@/store/carrito.store';
import { crearRegistroPedido } from '@/services/pedidos.service';
import { itemsService } from '@/services/items.service';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatMoneda } from '@/lib/utils';

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const usuario = useAuthStore(s => s.usuario);
  const registrar = useMemo(() => crearRegistroPedido(usuario?.id), [usuario?.id]);
  const {
    items,
    proveedor_id,
    nombre_tienda,
    removerItem,
    actualizarCantidad,
    vaciarCarrito,
    obtenerSubtotal,
    obtenerCostoEnvio,
    obtenerTotal,
  } = useCarritoStore();

  const [zona, setZona] = useState('');
  const { data: zonas = [] } = useQuery({ queryKey: ['zonas'], queryFn: zonasService.listarZonas });
  const [calle, setCalle] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [referencia, setReferencia] = useState('');
  const [horaEntrega, setHoraEntrega] = useState('12:00');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [enviando, setEnviando] = useState(false);

  const subtotal = obtenerSubtotal();
  const costoEnvio = obtenerCostoEnvio();
  const total = obtenerTotal();

  const handleConfirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Tu carrito está vacío');
      return;
    }

    if (!calle.trim()) {
      toast.error('Por favor ingresá la dirección de entrega');
      return;
    }

    setEnviando(true);

    try {
      const proveedor = Number(proveedor_id ?? items[0]?.proveedor_id);
      const catalogo = await itemsService.listarCatalogo({ proveedor_id: proveedor });
      const pedido = await registrar({
        proveedor_id: proveedor,
        direccion: { nombre_ubicacion: 'Entrega Pedido', direccion: calle,
          referencia: referencia.trim() || undefined, ciudad, zona_id: Number(zona) },
        fecha_entrega: fechaEntrega, hora_entrega: horaEntrega,
        instrucciones_especiales: instrucciones.trim() || undefined,
        items_comprados: items.map(i => ({ item_id: Number(i.item_id), cantidad: i.cantidad })),
      }, usuario, catalogo);

      void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      void queryClient.invalidateQueries({ queryKey: ['mis-pedidos-cliente'] });
      toast.success(pedido.ruta_id ? 'Pedido asignado a una ruta de entrega.' : 'Pedido registrado, pendiente de asignación.');
      vaciarCarrito();
      router.push('/mis-pedidos');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al procesar el pedido';
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Tu carrito está vacío</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Explorá el catálogo de nuestras tiendas aliadas y sumá productos a tu pedido.
        </p>
        <div className="pt-2">
          <Link href="/catalogo">
            <Button className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Explorar Catálogo
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/catalogo"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al catálogo
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Confirmar Pedido</h1>
          <p className="text-muted-foreground text-sm">
            Tienda: <span className="font-semibold text-foreground">{nombre_tienda || 'Tienda SERV'}</span>
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={vaciarCarrito}
          className="text-destructive hover:bg-destructive/10"
        >
          Vaciar carrito
        </Button>
      </div>

      <form onSubmit={handleConfirmarPedido} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Colección de Productos y Dirección */}
        <div className="lg:col-span-2 space-y-6">
          {/* Colección de productos en el pedido */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Colección de Productos ({items.length})
              </CardTitle>
              <CardDescription>
                Podés ajustar cantidades o quitar ítems antes de confirmar
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.item_id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoneda(item.precio)} c/u
                    </p>
                  </div>

                  {/* Controles de cantidad */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => actualizarCantidad(item.item_id, item.cantidad - 1)}
                      className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => actualizarCantidad(item.item_id, item.cantidad + 1)}
                      className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Subtotal del item */}
                  <div className="text-right min-w-[70px]">
                    <p className="text-sm font-bold text-foreground">
                      {formatMoneda(item.precio * item.cantidad)}
                    </p>
                  </div>

                  {/* Botón eliminar */}
                  <button
                    type="button"
                    onClick={() => removerItem(item.item_id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Datos de Entrega */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Datos de Entrega y Programación
              </CardTitle>
              <CardDescription>
                Indicá dónde y cuándo deseás recibir los productos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="calle">Dirección de Entrega (Calle y Número) *</Label>
                <Input
                  id="calle"
                  value={calle}
                  onChange={(e) => setCalle(e.target.value)}
                  placeholder="Av. Corrientes 1500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ciudad">Ciudad *</Label>
                  <Input
                    id="ciudad"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    placeholder="Buenos Aires"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="referencia">Piso / Depto / Referencia</Label>
                  <Input
                    id="referencia"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Piso 4, Depto B"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="zona">Zona de reparto</Label>
                <select id="zona" required value={zona} onChange={e => setZona(e.target.value)} className="w-full border rounded-md p-2">
                  <option value="">Selecciona una zona</option>
                  {zonas.filter(z => z.activa).map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
                <Label htmlFor="hora_entrega">Hora de entrega en Ambato</Label>
                <Input id="hora_entrega" type="time" value={horaEntrega} onChange={e => setHoraEntrega(e.target.value)} required />
                <Label htmlFor="fecha_entrega">Fecha Programada de Entrega *</Label>
                <div className="relative">
                  <Input
                    id="fecha_entrega"
                    type="date"
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instrucciones">Instrucciones Especiales para el Repartidor</Label>
                <Textarea
                  id="instrucciones"
                  value={instrucciones}
                  onChange={(e) => setInstrucciones(e.target.value)}
                  placeholder="Ej: Tocar timbre 4B, dejar en recepción o llamar al llegar..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Resumen de Pago */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Resumen del Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal productos</span>
                  <span className="font-medium text-foreground">{formatMoneda(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    Costo de envío estándar
                  </span>
                  <span className="font-medium text-foreground">{formatMoneda(costoEnvio)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary text-xl">{formatMoneda(total)}</span>
                </div>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">💡 Logística de Última Milla SERV</p>
                <p>
                  El pedido será agrupado en las rutas de reparto optimizadas de la tienda y se notificará en tiempo real.
                </p>
              </div>

              <Button
                type="submit"
                isLoading={enviando}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 text-base gap-2 shadow-sm"
              >
                <CheckCircle2 className="h-5 w-5" />
                Confirmar y Realizar Pedido
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ShoppingCart,
  Store,
  Star,
  Package,
  Plus,
  Check,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { itemsService, type ItemCatalogo } from '@/services/items.service';
import { useCarritoStore } from '@/store/carrito.store';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoneda } from '@/lib/utils';

export default function CatalogoClientePage() {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null);

  const { data: items = [], isLoading: cargandoItems } = useQuery<ItemCatalogo[]>({
    queryKey: ['catalogo-items', categoriaSeleccionada],
    queryFn: () =>
      itemsService.listarCatalogo({
        categoria_id: categoriaSeleccionada ?? undefined,
      }),
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['catalogo-categorias'],
    queryFn: itemsService.listarCategorias,
  });

  const { items: cartItems, agregarItem, obtenerTotalItems, obtenerTotal } = useCarritoStore();

  const totalItemsEnCarrito = obtenerTotalItems();
  const totalCarrito = obtenerTotal();

  // Filtro de búsqueda por texto en cliente
  const itemsFiltrados = items.filter((item) => {
    const texto = `${item.nombre} ${item.descripcion ?? ''} ${item.proveedores?.nombre_comercial ?? ''}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const handleAgregar = (item: ItemCatalogo) => {
    const precioNumerico = Number(item.precio);
    agregarItem(
      {
        item_id: item.id,
        nombre: item.nombre,
        precio: precioNumerico,
        proveedor_id: item.proveedor_id,
        nombre_tienda: item.proveedores?.nombre_comercial || 'Tienda SERV',
        inventario_stock: item.inventario_stock,
        imagen_url: item.imagen_url,
      },
      1
    );
    toast.success(`"${item.nombre}" agregado al carrito`);
  };

  return (
    <div className="space-y-6 pb-24 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-muted-foreground text-sm">
            Explorá los productos de las tiendas aliadas y armá tu pedido
          </p>
        </div>

        {totalItemsEnCarrito > 0 && (
          <Link href="/checkout">
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <ShoppingCart className="h-4 w-4" />
              <span>Ver Carrito ({totalItemsEnCarrito})</span>
              <span className="font-bold border-l border-emerald-500 pl-2">
                {formatMoneda(totalCarrito)}
              </span>
            </Button>
          </Link>
        )}
      </div>

      {/* Buscador y Categorías */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto, regalo, tienda..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* Categorías Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoriaSeleccionada(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border ${
              categoriaSeleccionada === null
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            Todas las categorías
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoriaSeleccionada(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border ${
                categoriaSeleccionada === cat.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Productos */}
      {cargandoItems ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <Card className="border-dashed py-16 text-center">
          <CardContent className="flex flex-col items-center justify-center">
            <Package className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No encontramos productos</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {busqueda
                ? `No hay coincidencias para "${busqueda}". Probá con otro término.`
                : 'Aún no hay productos publicados en esta categoría.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {itemsFiltrados.map((item) => {
            const enCarrito = cartItems.find((c) => c.item_id === item.id);
            const stock = item.inventario_stock ?? 0;
            const sinStock = !item.es_servicio && stock <= 0;

            return (
              <Card
                key={item.id}
                className="overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow border-border"
              >
                <div className="p-5 space-y-3">
                  {/* Tienda header */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        {item.proveedores?.nombre_comercial || 'Tienda Aliada'}
                      </span>
                    </div>
                    {item.proveedores?.rating_promedio && (
                      <span className="flex items-center gap-1 text-amber-600 font-semibold shrink-0">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {Number(item.proveedores.rating_promedio).toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Nombre y descripción */}
                  <div>
                    <h3 className="font-semibold text-base text-foreground leading-snug line-clamp-1">
                      {item.nombre}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-8">
                      {item.descripcion || 'Sin descripción detallada.'}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 pt-1">
                    {item.es_servicio ? (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Servicio
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200">
                        Stock: {stock}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Footer con precio y botón */}
                <div className="px-5 py-3.5 bg-muted/20 border-t border-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Precio
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {formatMoneda(Number(item.precio))}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    disabled={sinStock}
                    onClick={() => handleAgregar(item)}
                    className={`gap-1.5 ${
                      enCarrito
                        ? 'bg-primary text-white'
                        : 'bg-primary/90 hover:bg-primary text-white'
                    }`}
                  >
                    {enCarrito ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>En carrito ({enCarrito.cantidad})</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar</span>
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Bar inferior cuando hay productos en el carrito */}
      {totalItemsEnCarrito > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-xl z-40 bg-foreground text-background dark:bg-card dark:text-foreground rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">
                {totalItemsEnCarrito} {totalItemsEnCarrito === 1 ? 'producto' : 'productos'} en tu pedido
              </p>
              <p className="text-xs opacity-75 mt-0.5">
                Total estimado: <span className="font-bold">{formatMoneda(totalCarrito)}</span> (incluye envío)
              </p>
            </div>
          </div>

          <Link href="/checkout">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm">
              Ir al Checkout →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

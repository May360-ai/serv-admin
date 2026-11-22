import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  item_id: number;
  variacion_item_id?: number;
  variacion_nombre?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  proveedor_id: number;
  nombre_tienda?: string;
  inventario_stock?: number | null;
  imagen_url?: string | null;
}

function mismaLinea(a: CartItem, item_id: number, variacion_item_id?: number) {
  return a.item_id === item_id && (a.variacion_item_id ?? null) === (variacion_item_id ?? null);
}

interface CarritoState {
  items: CartItem[];
  proveedor_id: number | null;
  nombre_tienda: string | null;
  agregarItem: (item: Omit<CartItem, 'cantidad'>, cantidad?: number) => void;
  removerItem: (item_id: number, variacion_item_id?: number) => void;
  actualizarCantidad: (item_id: number, cantidad: number, variacion_item_id?: number) => void;
  vaciarCarrito: () => void;
  obtenerTotalItems: () => number;
  obtenerSubtotal: () => number;
  obtenerCostoEnvio: () => number;
  obtenerTotal: () => number;
}

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set, get) => ({
      items: [],
      proveedor_id: null,
      nombre_tienda: null,

      agregarItem: (nuevoItem, cantidad = 1) => {
        const { items, proveedor_id } = get();

        // Si el carrito tiene productos de otra tienda, reemplaza por la nueva tienda
        if (proveedor_id !== null && proveedor_id !== nuevoItem.proveedor_id && items.length > 0) {
          set({
            items: [{ ...nuevoItem, cantidad }],
            proveedor_id: nuevoItem.proveedor_id,
            nombre_tienda: nuevoItem.nombre_tienda || null,
          });
          return;
        }

        const indexExistente = items.findIndex((i) => mismaLinea(i, nuevoItem.item_id, nuevoItem.variacion_item_id));

        if (indexExistente >= 0) {
          const actual = items[indexExistente];
          const stockMax = actual.inventario_stock ?? 999;
          const nuevaCantidad = Math.min(actual.cantidad + cantidad, stockMax);

          const nuevosItems = [...items];
          nuevosItems[indexExistente] = { ...actual, cantidad: nuevaCantidad };
          set({ items: nuevosItems });
        } else {
          set({
            items: [...items, { ...nuevoItem, cantidad }],
            proveedor_id: nuevoItem.proveedor_id,
            nombre_tienda: nuevoItem.nombre_tienda || null,
          });
        }
      },

      removerItem: (item_id, variacion_item_id) => {
        const nuevosItems = get().items.filter((i) => !mismaLinea(i, item_id, variacion_item_id));
        set({
          items: nuevosItems,
          proveedor_id: nuevosItems.length === 0 ? null : get().proveedor_id,
          nombre_tienda: nuevosItems.length === 0 ? null : get().nombre_tienda,
        });
      },

      actualizarCantidad: (item_id, cantidad, variacion_item_id) => {
        if (cantidad <= 0) {
          get().removerItem(item_id, variacion_item_id);
          return;
        }
        const nuevosItems = get().items.map((i) => {
          if (mismaLinea(i, item_id, variacion_item_id)) {
            const stockMax = i.inventario_stock ?? 999;
            return { ...i, cantidad: Math.min(cantidad, stockMax) };
          }
          return i;
        });
        set({ items: nuevosItems });
      },

      vaciarCarrito: () => {
        set({ items: [], proveedor_id: null, nombre_tienda: null });
      },

      obtenerTotalItems: () => {
        return get().items.reduce((total, item) => total + item.cantidad, 0);
      },

      obtenerSubtotal: () => {
        return get().items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
      },

      obtenerCostoEnvio: () => {
        return get().items.length > 0 ? 2.50 : 0;
      },

      obtenerTotal: () => {
        return get().obtenerSubtotal() + get().obtenerCostoEnvio();
      },
    }),
    {
      name: 'serv_carrito',
    }
  )
);

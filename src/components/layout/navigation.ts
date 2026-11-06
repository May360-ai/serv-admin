import {
  MapPin,
  Users,
  Store,
  BarChart3,
  Package,
  Route,
  ShoppingBag,
  Settings,
  MessageSquare,
  PackageCheck,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types/auth';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_MENU: NavItem[] = [
  { href: '/admin/metricas', label: 'Supervisión Global', icon: BarChart3 },
  { href: '/admin/zonas', label: 'Zonas de Reparto', icon: MapPin },
  { href: '/admin/repartidores', label: 'Gestión Repartidores', icon: Users },
  { href: '/admin/tiendas', label: 'Tiendas Registradas', icon: Store },
];

export const MENU_BY_ROLE: Record<Role, NavItem[]> = {
  admin: ADMIN_MENU,
  administrador: ADMIN_MENU,
  proveedor: [
    { href: '/tienda/rutas', label: 'Despacho', icon: Route },
    { href: '/tienda/pedidos', label: 'Pedidos', icon: Package },
    { href: '/tienda/catalogo', label: 'Catálogo', icon: ShoppingBag },
    { href: '/tienda/configuracion', label: 'Configuración', icon: Settings },
    { href: '/chat', label: 'Mensajes', icon: MessageSquare },
  ],
  cliente: [
    { href: '/catalogo', label: 'Explorar Catálogo', icon: ShoppingBag },
    { href: '/mis-pedidos', label: 'Mis Pedidos', icon: PackageCheck },
    { href: '/checkout', label: 'Mi Carrito', icon: ShoppingCart },
    { href: '/chat', label: 'Soporte y Chat', icon: MessageSquare },
  ],
  repartidor: [
    { href: '/entregas', label: 'Mis entregas', icon: Route },
    { href: '/chat', label: 'Chat de Pedido', icon: MessageSquare },
  ],
};

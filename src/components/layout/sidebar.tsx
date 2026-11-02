'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  LogOut,
  X,
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
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

const ADMIN_BADGE = {
  label: 'Administrador',
  className: 'bg-purple-100 text-purple-800 border-purple-200',
};

// Menús segmentados estrictamente por rol
const MENU_BY_ROLE: Record<Role, NavItem[]> = {
  admin: ADMIN_MENU,
  administrador: ADMIN_MENU,
  proveedor: [
    { href: '/tienda/rutas', label: 'Despacho y Rutas', icon: Route },
    { href: '/tienda/pedidos', label: 'Bandeja de Pedidos', icon: Package },
    { href: '/tienda/catalogo', label: 'Catálogo de Productos', icon: ShoppingBag },
    { href: '/tienda/configuracion', label: 'Configuración Tienda', icon: Settings },
    { href: '/chat', label: 'Chat en Vivo', icon: MessageSquare },
  ],
  cliente: [
    { href: '/catalogo', label: 'Explorar Catálogo', icon: ShoppingBag },
    { href: '/mis-pedidos', label: 'Mis Pedidos', icon: PackageCheck },
    { href: '/checkout', label: 'Mi Carrito', icon: ShoppingCart },
    { href: '/chat', label: 'Soporte y Chat', icon: MessageSquare },
  ],
  repartidor: [
    { href: '/rutas', label: 'Mis Entregas', icon: Route },
    { href: '/chat', label: 'Chat de Pedido', icon: MessageSquare },
  ],
};

const ROLE_BADGE_STYLE: Record<Role, { label: string; className: string }> = {
  admin: ADMIN_BADGE,
  administrador: ADMIN_BADGE,
  proveedor: {
    label: 'Tienda / Despacho',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  cliente: {
    label: 'Cliente',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  repartidor: {
    label: 'Repartidor',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const usuario = useAuthStore((s) => s.usuario);
  const rol = (usuario?.rol as Role | undefined) ?? 'proveedor';

  const navItems = MENU_BY_ROLE[rol] ?? MENU_BY_ROLE.proveedor;
  const roleBadge = ROLE_BADGE_STYLE[rol] ?? ROLE_BADGE_STYLE.proveedor;

  const handleLogout = () => {
    authService.logout();
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 w-64 transform bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out',
        'lg:relative lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
          <Truck className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground leading-none">SERV</p>
          <p className="text-xs text-muted-foreground leading-none mt-1">Última Milla</p>
        </div>
        <button
          className="lg:hidden p-1 rounded-md text-muted-foreground hover:bg-muted"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Badge Indicator */}
      <div className="px-6 py-3 border-b border-border/60 bg-muted/20">
        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">
          Módulo Activo
        </p>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
            roleBadge.className
          )}
        >
          {roleBadge.label}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={onClose}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Footer Profile */}
      <div className="border-t border-border p-4 bg-muted/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
            {usuario?.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{usuario?.nombre ?? 'Cargando...'}</p>
            <p className="text-xs text-muted-foreground truncate">{usuario?.email ?? ''}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

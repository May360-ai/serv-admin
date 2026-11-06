'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Route, LogOut, X } from 'lucide-react';
import { MENU_BY_ROLE } from './navigation';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/auth';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const usuario = useAuthStore((s) => s.usuario);
  const rol = (usuario?.rol as Role | undefined) ?? 'proveedor';

  const navItems = MENU_BY_ROLE[rol] ?? MENU_BY_ROLE.proveedor;

  const handleLogout = () => {
    authService.logout();
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 w-56 transform bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out',
        'lg:relative lg:translate-x-0',
        open ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <Route className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-black tracking-tighter leading-none">SERV</p>
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

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-7">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold'
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
            <p className="text-xs text-muted-foreground truncate">{usuario?.email || (rol === 'proveedor' ? 'Tienda' : rol)}</p>
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

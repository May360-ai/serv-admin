'use client';

import React from 'react';
import { useAuthStore } from '@/store/auth.store';
import type { Role } from '@/types/auth';

interface RoleGuardProps {
  allowedRoles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Hook para consultar y verificar roles del usuario autenticado en cualquier componente.
 */
export function useRole() {
  const usuario = useAuthStore((s) => s.usuario);
  const rol = (usuario?.rol as Role | undefined) ?? null;

  const hasRole = (roles: Role | Role[]): boolean => {
    if (!rol) return false;
    const arrayRoles = Array.isArray(roles) ? roles : [roles];
    const rolNormalizado = rol === 'administrador' ? 'admin' : rol;
    return arrayRoles.some((r) => (r === 'administrador' ? 'admin' : r) === rolNormalizado);
  };

  return {
    rol,
    hasRole,
    isAdmin: rol === 'admin' || rol === 'administrador',
    isProveedor: rol === 'proveedor',
    isCliente: rol === 'cliente',
    isRepartidor: rol === 'repartidor',
    isAuthenticated: Boolean(usuario),
  };
}

/**
 * Componente Wrapper para visibilidad condicional de botones, secciones o modales según el rol.
 *
 * @example
 * <RoleGuard allowedRoles={['proveedor']}>
 *   <Button>Crear Nuevo Producto</Button>
 * </RoleGuard>
 */
export function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { hasRole } = useRole();

  if (!hasRole(allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

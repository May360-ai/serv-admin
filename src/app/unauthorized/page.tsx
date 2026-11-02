'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Home, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { DEFAULT_ROLE_REDIRECT, type Role } from '@/types/auth';

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const usuario = useAuthStore((s) => s.usuario);

  const from = searchParams.get('from') ?? 'este módulo';
  const role = (searchParams.get('role') as Role | null) ?? usuario?.rol;

  const redirectUrl = role && DEFAULT_ROLE_REDIRECT[role] ? DEFAULT_ROLE_REDIRECT[role] : '/login';

  return (
    <Card className="max-w-md w-full shadow-2xl border-destructive/20 text-center">
      <CardHeader className="pb-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-3">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">Acceso Restringido</CardTitle>
        <CardDescription className="text-sm mt-1">
          No contás con los privilegios suficientes para ingresar a{' '}
          <span className="font-semibold text-foreground">{from}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {role && (
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Rol actual:{' '}
            <span className="font-semibold text-foreground uppercase tracking-wider">{role}</span>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => router.push(redirectUrl)}
            className="w-full gap-2"
          >
            <Home className="h-4 w-4" />
            Ir a mi panel principal
          </Button>

          <Button
            variant="outline"
            onClick={() => router.back()}
            className="w-full gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la página anterior
          </Button>

          <button
            onClick={() => authService.logout()}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 pt-2 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión e ingresar con otra cuenta
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-50 via-background to-orange-50">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <UnauthorizedContent />
      </Suspense>
    </div>
  );
}

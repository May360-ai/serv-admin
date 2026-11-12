import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Role } from '@/types/auth';

// Rutas públicas que no requieren autenticación
const PUBLIC_PREFIXES = ['/login', '/registro', '/unauthorized'];

// Rutas con acceso restringido estricto por rol
const ROLE_REQUIRED_ROUTES: { prefix: string; roles: Role[] }[] = [
  { prefix: '/pedidos', roles: ['administrador', 'cliente', 'proveedor', 'repartidor'] },
  { prefix: '/entregas', roles: ['repartidor'] },
  { prefix: '/admin', roles: ['admin', 'administrador'] },
  { prefix: '/tienda', roles: ['proveedor'] },
  { prefix: '/catalogo', roles: ['cliente', 'admin', 'administrador'] },
  { prefix: '/mis-pedidos', roles: ['cliente', 'admin', 'administrador'] },
  { prefix: '/seguimiento', roles: ['cliente', 'admin', 'administrador'] },
  { prefix: '/checkout', roles: ['cliente'] },
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. Ignorar assets estáticos, favicon y Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Permitir acceso a rutas públicas
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // 3. Validar presencia del token JWT en cookies
  const tokenCookie = request.cookies.get('serv_token')?.value;
  if (!tokenCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // El rol solo se acepta después de verificar el JWT en la API.
  let userRole: Role | undefined;
  try {
    const baseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const session = await fetch(new URL('/api/auth/sesion', baseUrl), {
      headers: { Authorization: `Bearer ${tokenCookie}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (session.ok) userRole = (await session.json()).rol_nombre;
  } catch {
    userRole = undefined;
  }

  if (!userRole) {
    // Token malformado o inválido: forzar nuevo login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'session_expired');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('serv_token');
    response.cookies.delete('serv_role');
    return response;
  }

  // 5. Redirección inteligente de raíz o dashboard según rol
  if (pathname === '/' || pathname === '/dashboard') {
    if (userRole === 'admin' || userRole === 'administrador') {
      return NextResponse.redirect(new URL('/admin/metricas', request.url));
    }
    if (userRole === 'proveedor') {
      return NextResponse.redirect(new URL('/tienda/rutas', request.url));
    }
    if (userRole === 'repartidor') return NextResponse.redirect(new URL('/entregas', request.url));
    if (userRole === 'cliente') {
      return NextResponse.redirect(new URL('/catalogo', request.url));
    }
  }

  // 6. Validar permisos de acceso según matriz RBAC
  for (const rule of ROLE_REQUIRED_ROUTES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      if (!rule.roles.includes(userRole)) {
        const unauthorizedUrl = new URL('/unauthorized', request.url);
        unauthorizedUrl.searchParams.set('from', pathname);
        unauthorizedUrl.searchParams.set('role', userRole);
        return NextResponse.redirect(unauthorizedUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

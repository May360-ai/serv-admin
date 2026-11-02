import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Role } from '@/types/auth';

// Rutas públicas que no requieren autenticación
const PUBLIC_PREFIXES = ['/login', '/registro', '/unauthorized'];

// Rutas con acceso restringido estricto por rol
const ROLE_REQUIRED_ROUTES: { prefix: string; roles: Role[] }[] = [
  { prefix: '/admin', roles: ['admin', 'administrador'] },
  { prefix: '/tienda', roles: ['proveedor'] },
  { prefix: '/catalogo', roles: ['cliente', 'admin', 'administrador'] },
  { prefix: '/mis-pedidos', roles: ['cliente', 'admin', 'administrador'] },
  { prefix: '/seguimiento', roles: ['cliente', 'admin', 'administrador'] },
  { prefix: '/checkout', roles: ['cliente'] },
];

/**
 * Decodifica de forma segura el payload del JWT en el Edge runtime sin dependencias externas.
 */
function decodeJwtPayload(token: string): { rol?: Role; rol_nombre?: Role } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as { rol?: Role; rol_nombre?: Role };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 1. Ignorar assets estáticos, favicon y Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
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

  // 4. Extraer el rol del usuario (desde la cookie de rol o decodificando el JWT)
  const roleCookie = request.cookies.get('serv_role')?.value as Role | undefined;
  const jwtPayload = decodeJwtPayload(tokenCookie);
  const userRole = roleCookie ?? jwtPayload?.rol_nombre ?? jwtPayload?.rol;

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

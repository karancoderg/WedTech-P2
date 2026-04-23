import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  '/:locale/dashboard(.*)',
  '/:locale/wedding(.*)',
  '/dashboard(.*)',
  '/wedding(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  console.log("Proxy hit path:", pathname);

  // Skip intl middleware for API routes
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users on protected routes to landing page
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Extract locale from path (e.g. /en/wedding/... → "en")
      const localeMatch = pathname.match(/^\/([a-z]{2})\//);
      const locale = localeMatch?.[1] || 'en';
      const landingUrl = new URL(`/${locale}`, req.url);
      landingUrl.searchParams.set('auth', 'required');
      return NextResponse.redirect(landingUrl);
    }
  }

  // Handle localization
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

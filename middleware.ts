import { NextRequest, NextResponse } from "next/server";
import { resolveMiddlewareSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const { response, user, role } = await resolveMiddlewareSession(request);

  response.headers.set("x-next-pathname", url.pathname);

  const pathname = url.pathname;
  const isHomePage = pathname === "/";
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";
  const isPasswordFlowPage =
    pathname === "/reset-password" || pathname === "/email-verified";
  const isSupplierRoute =
    pathname === "/supplier" || pathname.startsWith("/supplier/");
  const isRetailerRoute =
    pathname === "/retailer" || pathname.startsWith("/retailer/");
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

  if (isPasswordFlowPage) {
    return response;
  }

  if (
    !isHomePage &&
    !isAuthPage &&
    !isSupplierRoute &&
    !isRetailerRoute &&
    !isAdminRoute
  ) {
    return response;
  }

  if (!role || !user) {
    if (isHomePage) {
      return NextResponse.redirect(new URL("/login", url.origin));
    }
    if (isAuthPage) return response;
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const dashboardPath =
    role === "admin"
      ? "/admin"
      : role === "supplier"
        ? "/supplier"
        : "/retailer";

  if (isAdminRoute) {
    if (role !== "admin") {
      const fallback =
        role === "supplier" ? "/supplier" : "/retailer";
      return NextResponse.redirect(new URL(fallback, url.origin));
    }
    return response;
  }

  if (isAuthPage || isHomePage) {
    return NextResponse.redirect(new URL(dashboardPath, url.origin));
  }

  if (isSupplierRoute && role !== "supplier") {
    if (role === "admin") {
      return NextResponse.redirect(new URL("/admin", url.origin));
    }
    return NextResponse.redirect(new URL("/retailer", url.origin));
  }

  if (isRetailerRoute && role !== "retailer") {
    if (role === "admin") {
      return NextResponse.redirect(new URL("/admin", url.origin));
    }
    return NextResponse.redirect(new URL("/supplier", url.origin));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

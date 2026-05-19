import { NextRequest, NextResponse } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

async function getUserRole(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  return userRow?.role ?? null;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const response = await updateSupabaseSession(request);

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

  const role = await getUserRole(request, response);

  if (!role) {
    // Unauthenticated: always send root to login.
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

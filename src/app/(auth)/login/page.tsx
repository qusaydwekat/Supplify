"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createLoginSchema, type LoginInput } from "@/lib/validations/auth";
import { loginUser } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const tV = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(createLoginSchema(tV)) });

  const onSubmit = handleSubmit(async (values) => {
    const res = await loginUser(values);
    if (res.error || (res as any).errorKey) {
      const key = (res as any).errorKey as string | null | undefined;
      if (key) toast.error(tErr(key));
      else toast.error(res.error);
      return;
    }
    toast.success(t("loginSuccess"));
    const role = res.data?.role ?? null;
    const dash =
      role === "admin"
        ? "/admin"
        : role === "supplier"
        ? "/supplier"
        : role === "retailer"
        ? "/retailer"
        : "/";
    window.location.assign(dash);
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-xl shadow-slate-900/10 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("loginTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("loginSubtitle")}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="form-label" htmlFor="login-identifier">
              {t("loginIdentifier")}
            </label>
            <Input
              id="login-identifier"
              className="mt-1.5"
              type="text"
              autoComplete="username"
              placeholder={t("loginIdentifierPlaceholder")}
              {...register("identifier")}
            />
            {errors.identifier ? (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.identifier.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="form-label" htmlFor="login-password">
              {t("password")}
            </label>
            <Input
              id="login-password"
              className="mt-1.5"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
            <p className="mt-2 text-end text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-primary hover:underline"
              >
                {t("forgotPasswordLink")}
              </Link>
            </p>
          </div>

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("signingIn") : t("signIn")}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("newToApp")}{" "}
          <Link
            href="/register"
            className="font-semibold text-primary hover:underline"
          >
            {t("createAccountLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}

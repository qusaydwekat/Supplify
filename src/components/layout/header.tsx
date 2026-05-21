"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";

type Props = {
  title?: string;
  role: "supplier" | "retailer";
  businessName: string;
  onOpenMenu?: () => void;
};

export function Header({ title, role, businessName, onOpenMenu }: Props) {
  const t = useTranslations("Header");

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/75 sm:h-16 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onOpenMenu ? (
          <button
            type="button"
            onClick={onOpenMenu}
            className="-ms-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition hover:bg-muted md:hidden"
            aria-label={t("menu")}
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title ?? (role === "supplier" ? t("supplier") : t("retailer"))}
          {" - "}
          {businessName
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        <NotificationBell role={role} />
      </div>
    </header>
  );
}

"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cancelOrderByRetailer,
  confirmModifiedOrder,
} from "@/lib/actions/orders";
import type { OrderStatus } from "@/lib/validations/order";

type Props = {
  orderId: string;
  status: OrderStatus;
};

export function RetailerOrderPanel({ orderId, status }: Props) {
  const t = useTranslations("RetailerOrderPanel");
  const tErr = useTranslations("Errors");
  const [pending, start] = useTransition();

  function run(
    successKey: "toastCancelled" | "toastConfirmed",
    fn: () => Promise<{
      error: string | null
      errorKey?: string | null
      errorParams?: Record<string, string | number> | null
      creditWarning?: { messageKey: "creditLimitExceeded"; params: Record<string, string | number> }
    }>
  ) {
    start(async () => {
      const r = await fn();
      if (r.error) {
        if (r.errorKey) toast.error(tErr(r.errorKey, r.errorParams ?? undefined));
        else toast.error(r.error);
      } else {
        if (r.creditWarning) {
          toast.warning(tErr(r.creditWarning.messageKey, r.creditWarning.params));
        }
        toast.success(t(successKey));
      }
    });
  }

  if (status === "pending") {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("actions")}</h2>
        <p className="mt-1 text-xs text-slate-600">{t("pendingHint")}</p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={pending}
          onClick={() =>
            run("toastCancelled", () => cancelOrderByRetailer(orderId))
          }
        >
          {t("cancelOrder")}
        </Button>
      </div>
    );
  }

  if (status === "modified") {
    return (
      <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm ring-1 ring-violet-100 sm:p-6">
        <h2 className="text-base font-semibold leading-snug text-slate-900">
          {t("modifiedTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("modifiedHint")}</p>
        <Button
          type="button"
          className="mt-5 h-12 w-full text-base sm:h-11 sm:w-auto sm:text-sm"
          disabled={pending}
          onClick={() =>
            run("toastConfirmed", () => confirmModifiedOrder(orderId))
          }
        >
          {t("confirmOrder")}
        </Button>
      </div>
    );
  }

  return null;
}

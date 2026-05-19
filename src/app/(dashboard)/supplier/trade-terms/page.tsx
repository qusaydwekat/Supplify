import { getTranslations } from "next-intl/server";
import { TradeTermsManager } from "@/components/supplier/trade-terms-manager";
import { getSupplierTradeTermsPartners } from "@/lib/data/trade-terms-list";

export default async function SupplierTradeTermsPage() {
  const t = await getTranslations("TradeTermsPage");
  const tCommon = await getTranslations("Common");
  const res = await getSupplierTradeTermsPartners();
  if ("error" in res) {
    return (
      <p className="text-sm text-red-600">
        {tCommon("loadErrorDetails", { details: res.error })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      <TradeTermsManager
        partners={res.partners}
        currencyCode={res.currencyCode}
      />
    </div>
  );
}

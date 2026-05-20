import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // FormData + image uploads exceed the default 1 MB limit and surface as "Failed to fetch".
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // Keep a single Node copy of react-pdf (avoids Font.register vs renderToBuffer using different stores).
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/font",
    "@react-pdf/layout",
    "@react-pdf/render",
    "@react-pdf/pdfkit",
    "@react-pdf/primitives",
    "@react-pdf/textkit",
    "@react-pdf/fns",
    "@react-pdf/png-js",
    "@react-pdf/reconciler",
  ],
};

export default withNextIntl(nextConfig);

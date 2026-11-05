import { SITE } from "@/lib/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/result", "/example"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

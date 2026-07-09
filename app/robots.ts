import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/apply", "/sign-in", "/sign-up", "/terms", "/privacy", "/refund-policy", "/p/", "/c/", "/bio/"],
        disallow: ["/dashboard/", "/api/", "/admin/"],
      },
    ],
    sitemap: "https://contentflywheel.co.uk/sitemap.xml",
  };
}

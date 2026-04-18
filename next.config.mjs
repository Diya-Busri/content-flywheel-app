/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      // Vercel Blob — used for all uploaded/generated assets
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // fal.ai CDN — generated images before re-hosting (fallback)
      { protocol: "https", hostname: "v2.fal.media" },
      { protocol: "https", hostname: "fal.media" },
      // Printify product images
      { protocol: "https", hostname: "images.printify.com" },
      // Unsplash (used elsewhere in the app)
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
  experimental: {
    serverComponentsExternalPackages: [
      "puppeteer",
      "puppeteer-core",
      "@sparticuz/chromium-min",
      "@ffmpeg-installer/ffmpeg",
      "ffmpeg-static",
      "ffprobe-static",
      "fluent-ffmpeg",
    ],
    // Ensure chromium-min binary files (fonts.tar.br etc.) are included in the
    // Puppeteer routes — Vercel's file tracer misses binary assets in bin/
    outputFileTracingIncludes: {
      "/api/templates/viral/export": [
        "./node_modules/@sparticuz/chromium-min/**/*",
      ],
      "/api/templates/kinetic/export": [
        "./node_modules/@sparticuz/chromium-min/**/*",
      ],
    },
    // Exclude puppeteer from API routes that don't use it (reduces deploy bundle; avoids "Deploying outputs" internal error)
    outputFileTracingExcludes: {
      "/api/video-guide/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/library/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/stripe/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/goals/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/ugc-lab/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/digital-products/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/tiktok-shop/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/chat/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/webhooks/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/elevenlabs/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/user/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/script-checker/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/niches/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/brand-profile/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/video-timeline/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/hooks-ctas/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/debug/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/onboarding/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/reviews/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/realtime-session/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/unsplash-photos/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/generate-image/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/download-image/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/proxy-image/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/generate-thumbnail/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/tts/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/product-sales-guide/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/video-guide/unlock/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/videos/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/auto-design/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/generate-notion-template/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/extract-pdf-text/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/test-heygen/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/db-test/**": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/checkout": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/stripe-checkout": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/stripe-portal": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/generate-pdf": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/regenerate-section": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/export": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/generate": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/suggestions": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/process": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/apply-design": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/generate-section-content": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/marketing-assets": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/cover-thumbnail": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/platform-copy": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/products/pricing-recommendation": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/video/status": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/video/generate": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/video/tiktokshop": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
      "/api/generate-video": ["**/node_modules/puppeteer/**", "**/node_modules/puppeteer-core/**"],
    },
  },
  webpack: (config, { isServer }) => {
    config.cache = false; // Disable webpack cache on Windows (avoids ENOENT rename errors)
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
      };
    }
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        "puppeteer",
        "puppeteer-core",
        "@sparticuz/chromium-min",
        "@ffmpeg-installer/ffmpeg",
        "ffmpeg-static",
        "ffprobe-static",
        "fluent-ffmpeg",
      ];
    }
    return config;
  },
};

export default nextConfig;

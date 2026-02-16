/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverComponentsExternalPackages: ["puppeteer"],
  },
  webpack: (config, { isServer }) => {
    config.cache = false; // Disable webpack cache on Windows (avoids ENOENT rename errors)
    if (isServer) {
      config.externals = [...(config.externals || []), "puppeteer"];
    }
    return config;
  },
};

export default nextConfig;

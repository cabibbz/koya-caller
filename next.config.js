const { withSentryConfig } = require("@sentry/nextjs");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
const createNextIntlPlugin = require("next-intl/plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip ESLint during builds (use separate lint command instead)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Generate unique build ID to prevent stale cache issues
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  // Webpack config to handle chunk caching
  webpack: (config, { dev }) => {
    if (dev) {
      // In development, use content hash for better cache invalidation
      config.output.chunkFilename = 'static/chunks/[name].[contenthash].js';
    }
    return config;
  },
  // Transpile the Retell SDK to fix webpack bundling issues
  transpilePackages: ["retell-client-js-sdk"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.retellai.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://api.retellai.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.retellai.com wss://api.retellai.com https://*.livekit.cloud wss://*.livekit.cloud https://api.stripe.com https://api.twilio.com https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self' https://js.stripe.com",
              "media-src 'self' https://*.supabase.co blob:",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Upload source maps to Sentry for better stack traces
  // Requires SENTRY_AUTH_TOKEN environment variable
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in production builds
  dryRun: process.env.NODE_ENV !== "production",
  // Hide source maps from browser devtools in production
  hideSourceMaps: true,
  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
};

// Create next-intl plugin
const withNextIntl = createNextIntlPlugin();

// Chain the config wrappers: Sentry -> BundleAnalyzer -> NextIntl -> nextConfig
module.exports = withSentryConfig(
  withBundleAnalyzer(withNextIntl(nextConfig)),
  sentryWebpackPluginOptions
);

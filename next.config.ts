import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preferences were renamed to Profile; keep old links working with a real server redirect.
  async redirects() {
    return [{ source: "/preferences", destination: "/profile", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "m.media-amazon.com" },
    ],
  },
};

export default nextConfig;

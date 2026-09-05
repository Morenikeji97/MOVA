import type { NextConfig } from "next";

// Allow <Image> to load public objects from the project's Supabase Storage
// (e.g. vehicle-photos). Derived from the same env var the Supabase clients use.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        // The homepage renders a per-viewer header nav (signed-in Dashboard vs
        // signed-out Sign in / Create account). `private` + `no-store` stop any
        // shared CDN/proxy from caching one visitor's copy and serving it to
        // another. Matches the document and the RSC request for "/".
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

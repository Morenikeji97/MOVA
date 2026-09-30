import type { MetadataRoute } from "next";

/** Web app manifest (served at /manifest.webmanifest). Icons from public/brand/. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ShipMova",
    short_name: "ShipMova",
    description: "American cars. Global buyers.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

/**
 * Homepage photos (redesign PR B). TEMPORARY AI-generated images until the
 * founder supplies real ones (docs/LAUNCH-BLOCKERS.md): replace each file in
 * public/images/home/ (same size, WebP) and update its path here — this is
 * the only place they're named.
 */
export const HOME_IMAGES = {
  /** Hero, right ~64% on desktop; full-bleed behind the text on phones. */
  heroDesktop: { src: "/images/home/hero-TEMP-AI-1600x1000.webp", width: 1600, height: 1000 },
  heroPhone: { src: "/images/home/hero-TEMP-AI-800x1000.webp", width: 800, height: 1000 },
  roleBuy: { src: "/images/home/role-buy-TEMP-AI-800x500.webp", width: 800, height: 500 },
  roleSell: { src: "/images/home/role-sell-TEMP-AI-800x500.webp", width: 800, height: 500 },
  roleShipper: { src: "/images/home/role-shipper-TEMP-AI-800x500.webp", width: 800, height: 500 },
  roleInspector: { src: "/images/home/role-inspector-TEMP-AI-800x500.webp", width: 800, height: 500 },
} as const;

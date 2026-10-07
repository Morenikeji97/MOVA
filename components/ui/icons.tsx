import type { SVGProps } from "react";

/**
 * ShipMova line icons (design system, redesign PR A): inline SVG, 24×24,
 * 1.75 stroke, currentColor — no icon font, no emoji. Decorative by default
 * (aria-hidden); pass a `title` when an icon carries meaning on its own.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; title?: string };

function Svg({ size = 20, title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function MenuIcon(p: IconProps) {
  return <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
}
export function CloseIcon(p: IconProps) {
  return <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
}
export function SearchIcon(p: IconProps) {
  return <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Svg>;
}
export function ChevronDownIcon(p: IconProps) {
  return <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
}
export function ArrowRightIcon(p: IconProps) {
  return <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
}
export function CheckIcon(p: IconProps) {
  return <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
}
/** Verified sellers. */
export function ShieldCheckIcon(p: IconProps) {
  return <Svg {...p}><path d="M12 3l7 3v5.5c0 4.3-2.9 8.1-7 9.5-4.1-1.4-7-5.2-7-9.5V6l7-3z" /><path d="M8.8 12.2l2.2 2.2 4.3-4.4" /></Svg>;
}
/** Title checked. */
export function DocumentCheckIcon(p: IconProps) {
  return <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5" /><path d="M9 14.5l2 2 4-4" /></Svg>;
}
/** Independent inspections. */
export function ClipboardCheckIcon(p: IconProps) {
  return <Svg {...p}><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 4.5V3.5h6v1" /><path d="M9 13l2 2 4-4" /></Svg>;
}
/** Payments held by Escrow.com. */
export function LockIcon(p: IconProps) {
  return <Svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Svg>;
}
/** Shipping. */
export function ShipIcon(p: IconProps) {
  return <Svg {...p}><path d="M3 15l1.8 4.2c.2.5.7.8 1.2.8h12c.5 0 1-.3 1.2-.8L21 15H3z" /><path d="M6 15V9h12v6" /><path d="M12 9V4M9.5 6h5" /></Svg>;
}
export function CarIcon(p: IconProps) {
  return <Svg {...p}><path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5" /><path d="M3.5 16.5h17" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /><path d="M5 12h14" /></Svg>;
}
export function TagIcon(p: IconProps) {
  return <Svg {...p}><path d="M3 12V4h8l9.5 9.5-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1.3" /></Svg>;
}
export function UserIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></Svg>;
}
export function GlobeIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z" /></Svg>;
}
export function ChatIcon(p: IconProps) {
  return <Svg {...p}><path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.6A7.5 7.5 0 1 1 20 12z" /></Svg>;
}

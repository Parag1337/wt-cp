import type { Metadata } from "next";

/**
 * Root of the owner dashboard. Public page metadata is set here; the session
 * guard lives in the `(dashboard)` group so `/admin/login` can render without one.
 */
export const metadata: Metadata = {
  title: {
    default: "Owner Dashboard | Jay Hari Krushi Seva Kendra",
    template: "%s | Owner Dashboard",
  },
  description: "Manage products, stock, orders and customer inquiries.",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

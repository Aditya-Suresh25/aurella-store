import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";

const links = [["Overview", "/admin"], ["Products", "/admin/products"], ["Categories", "/admin/categories"], ["Orders", "/admin/orders"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand">AUREL <span>ADMIN</span></Link>
      <nav aria-label="Admin navigation">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <Link href="/" className="admin-store-link">← Return to storefront</Link>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}

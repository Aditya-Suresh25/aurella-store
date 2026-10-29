import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartCountLink } from "@/app/cart-store";
import { AccountControl } from "@/app/account-control";
import {
  formatProductPrice,
  getCategoryBySlug,
  getProductsByCategoryId,
} from "@/db/queries";

export const dynamic = "force-dynamic";

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={diagonal ? "icon icon--diagonal" : "icon"}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d={diagonal ? "M6 14 14 6M6 6h8v8" : "M3.5 10h12m-5-5 5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none">
      <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const products = await getProductsByCategoryId(category.id);

  return (
    <>
      <header className="site-header">
        <div className="utility-bar page-shell">
          <span>Complimentary shipping on orders over $250</span>
          <Link href="/#footer">A little more about us</Link>
        </div>
        <div className="nav-row page-shell">
          <nav aria-label="Main navigation" className="nav-links nav-desktop">
            <Link className="nav-link" href="/collections/clothing" aria-current={slug === "clothing" ? "page" : undefined}>Clothing</Link>
            <Link className="nav-link" href="/collections/bags" aria-current={slug === "bags" ? "page" : undefined}>Bags</Link>
            <Link className="nav-link" href="/collections/objects" aria-current={slug === "objects" ? "page" : undefined}>Objects</Link>
          </nav>

          <details className="mobile-menu">
            <summary aria-label="Open menu"><MenuIcon /><span className="sr-only">Menu</span></summary>
            <nav aria-label="Mobile navigation" className="mobile-menu-panel">
              <Link href="/collections/clothing">Clothing</Link>
              <Link href="/collections/bags">Bags</Link>
              <Link href="/collections/objects">Objects</Link>
              <Link href="/new-arrivals">New arrivals</Link>
            </nav>
          </details>

          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <div className="header-actions">
            <Link className="header-search nav-link" href="/new-arrivals">New arrivals</Link>
            <AccountControl />
            <CartCountLink />
          </div>
        </div>
      </header>

      <main id="top">
        <nav className="product-breadcrumb page-shell" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{category.name}</span>
        </nav>

        <section className="hero collection-hero" aria-labelledby="collection-title">
          <Image
            className="hero-image"
            src={category.imageUrl}
            alt={category.imageAlt}
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-shade" />
          <div className="hero-content page-shell">
            <p className="hero-kicker">Explore the collection</p>
            <h1 id="collection-title" className="hero-title">{category.name}</h1>
            <p className="hero-description">{category.note}</p>
          </div>
        </section>

        <section className="section-space page-shell collection-products" aria-labelledby="collection-products-title">
          <div className="section-heading collection-heading">
            <div>
              <p className="eyebrow">Considered pieces for every day</p>
              <h2 id="collection-products-title" className="type-heading">The {category.name.toLowerCase()} collection</h2>
            </div>
            <p className="new-arrivals-count">{products.length} {products.length === 1 ? "piece" : "pieces"}</p>
          </div>

          {products.length > 0 ? (
            <div className="product-grid">
              {products.map((product) => (
                <article className="product-card" key={product.slug}>
                  <Link href={`/products/${product.slug}`} className="product-link" aria-label={`Discover ${product.name}`}>
                    <div className="media-frame product-media">
                      <Image
                        src={product.imageUrl}
                        alt={product.imageAlt}
                        fill
                        sizes="(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 25vw"
                      />
                      {product.badge && <span className="product-tag">{product.badge}</span>}
                      <span className="product-discover">Discover <ArrowIcon diagonal /></span>
                    </div>
                    <div className="product-caption">
                      <span className="product-category">{product.descriptor}</span>
                      <span className="product-name-row">
                        <span>{product.name}</span>
                        <span>{formatProductPrice(product.priceCents, product.currency)}</span>
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="new-arrivals-empty">
              <p className="type-heading">A new chapter is on its way.</p>
              <p>There are no pieces in this collection just yet. Discover the latest from our studio.</p>
              <Link className="text-link" href="/new-arrivals">Explore new arrivals <ArrowIcon /></Link>
            </div>
          )}
        </section>
      </main>

      <footer className="new-arrivals-footer">
        <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
        <p>Well made things for the everyday.</p>
        <Link className="text-link" href="/new-arrivals">Discover new arrivals <ArrowIcon /></Link>
      </footer>
    </>
  );
}

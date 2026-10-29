import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "@/app/newsletter-form";
import { CartCountLink } from "@/app/cart-store";
import { AccountControl } from "@/app/account-control";
import { formatProductPrice, getHomepageProducts, getStorefrontCategories } from "@/db/queries";

export const dynamic = "force-dynamic";

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={diagonal ? "icon icon--diagonal" : "icon"}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d={diagonal ? "M6 14 14 6M6 6h8v8" : "M3.5 10h12m-5-5 5 5-5 5"} stroke="currentColor" strokeWidth="1.25" />
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

export default async function Home() {
  const [products, categories] = await Promise.all([
    getHomepageProducts(),
    getStorefrontCategories(),
  ]);

  return (
    <>
      <header className="site-header">
        <div className="utility-bar page-shell">
          <span>Complimentary shipping on orders over $250</span>
          <a href="#footer">A little more about us</a>
        </div>
        <div className="nav-row page-shell">
          <nav aria-label="Main navigation" className="nav-links nav-desktop">
            <Link className="nav-link" href="/collections/clothing">Clothing</Link>
            <Link className="nav-link" href="/collections/bags">Bags</Link>
            <Link className="nav-link" href="/collections/objects">Objects</Link>
          </nav>

          <details className="mobile-menu">
            <summary aria-label="Open menu"><MenuIcon /><span className="sr-only">Menu</span></summary>
            <nav aria-label="Mobile navigation" className="mobile-menu-panel">
              <Link href="/collections/clothing">Clothing</Link>
              <Link href="/collections/bags">Bags</Link>
              <Link href="/collections/objects">Objects</Link>
              <a href="#journal">Our point of view</a>
            </nav>
          </details>

          <a className="wordmark" href="#top" aria-label="Aurel home">AUREL</a>
          <div className="header-actions">
            <a className="header-search nav-link" href="/new-arrivals">New arrivals</a>
            <AccountControl />
            <CartCountLink />
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <Image
            className="hero-image"
            src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=2400&q=90"
            alt="A model wearing a fluid, tailored look in the last light of day"
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-shade" />
          <div className="hero-content page-shell">
            <p className="hero-kicker">The Spring / Summer collection</p>
            <h1 id="hero-title" className="hero-title">A season<br />in its own time.</h1>
            <p className="hero-description">Pieces for getting dressed without overthinking it.</p>
            <a className="button button--light" href="#new-arrivals">Explore the collection <ArrowIcon /></a>
          </div>
          <a className="hero-scroll" href="#new-arrivals">Scroll to discover <span>↓</span></a>
        </section>

        <section className="intro-strip" aria-label="Our approach">
          <p>Made with care. Worn on repeat.</p>
          <span aria-hidden="true">✳</span>
          <p>Good things take a little time.</p>
        </section>

        <section className="section-space page-shell" id="new-arrivals" aria-labelledby="new-arrivals-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Fresh from the studio</p>
              <h2 id="new-arrivals-title" className="type-heading">The new arrivals</h2>
            </div>
            <a className="text-link section-link" href="/new-arrivals">View all new arrivals <ArrowIcon /></a>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.slug}>
                <a href={`/products/${product.slug}`} className="product-link" aria-label={`Discover ${product.name}`}>
                  <div className="media-frame product-media">
                    <Image src={product.imageUrl} alt={product.imageAlt} fill sizes="(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 25vw" />
                    {product.badge && <span className="product-tag">{product.badge}</span>}
                    <span className="product-discover">Discover <ArrowIcon diagonal /></span>
                  </div>
                  <div className="product-caption">
                    <span className="product-category">{product.descriptor}</span>
                    <span className="product-name-row"><span>{product.name}</span><span>{formatProductPrice(product.priceCents, product.currency)}</span></span>
                  </div>
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="story-section" id="journal" aria-labelledby="story-title">
          <div className="story-image-wrap">
            <Image
              src="https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1800&q=85"
              alt="A thoughtfully arranged rail of softly structured layers in natural colors"
              fill
              sizes="(max-width: 767px) 100vw, 55vw"
            />
          </div>
          <div className="story-copy">
            <p className="eyebrow">The art of getting dressed</p>
            <h2 id="story-title" className="story-title">Less, but<br />with feeling.</h2>
            <p className="story-description">A wardrobe built around the pieces you reach for first. Thoughtful shapes, natural textures, and room to make them your own.</p>
            <a className="text-link" href="#clothing">Meet the collection <ArrowIcon /></a>
            <span className="story-index">Aurel Journal · 01</span>
          </div>
        </section>

        <section className="section-space page-shell category-section" id="collections" aria-labelledby="category-title">
          <div className="section-heading section-heading--center">
            <div>
              <p className="eyebrow">A considered wardrobe</p>
              <h2 id="category-title" className="type-heading">Find your everyday</h2>
            </div>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <Link className="category-card" href={`/collections/${category.slug}`} id={category.slug} key={category.slug}>
                <div className="media-frame category-media">
                  <Image src={category.imageUrl} alt={category.imageAlt} fill sizes="(max-width: 767px) 100vw, 33vw" />
                </div>
                <div className="category-caption">
                  <div><h3>{category.name}</h3><p>{category.note}</p></div>
                  <ArrowIcon />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="campaign" aria-labelledby="campaign-title">
          <Image
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=2200&q=85"
            alt="A curated rail of timeless, neutral wardrobe pieces"
            fill
            sizes="100vw"
          />
          <div className="campaign-overlay" />
          <div className="campaign-copy">
            <p className="eyebrow">Aurel, by design</p>
            <h2 id="campaign-title" className="campaign-title">Good form.<br />Better feeling.</h2>
            <a className="button button--outline campaign-button" href="#journal">Our point of view <ArrowIcon /></a>
          </div>
        </section>

        <section className="newsletter section-space" id="newsletter" aria-labelledby="newsletter-title">
          <div className="newsletter-inner">
            <p className="eyebrow">A note from us</p>
            <h2 id="newsletter-title" className="type-heading">A little room in your inbox.</h2>
            <p>New collections, studio notes, and the occasional good thing. Only when we have something to say.</p>
            <NewsletterForm />
            <small>By subscribing, you agree to receive occasional updates from Aurel.</small>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="footer">
        <div className="footer-main page-shell">
          <div className="footer-brand-block">
            <a className="wordmark wordmark--footer" href="#top">AUREL</a>
            <p>Well made things<br />for the everyday.</p>
          </div>
          <div className="footer-column">
            <h2>Explore</h2>
            <a href="#clothing">Clothing</a>
            <a href="#bags">Bags</a>
            <a href="#objects">Objects</a>
            <a href="#new-arrivals">New arrivals</a>
          </div>
          <div className="footer-column">
            <h2>Here to help</h2>
            <a href="#footer">Shipping & returns</a>
            <a href="#footer">Care guide</a>
            <a href="#footer">Get in touch</a>
            <a href="#footer">Frequently asked questions</a>
          </div>
          <div className="footer-column footer-note">
            <h2>From our studio</h2>
            <p>Designed with intention. Made to be part of your day, for a long time.</p>
            <a className="text-link" href="#journal">Read our journal <ArrowIcon /></a>
          </div>
        </div>
        <div className="footer-bottom page-shell">
          <span>© Aurel Studio 2026</span>
          <span>Made for everyday life</span>
          <div><a href="#footer">Privacy</a><a href="#footer">Terms</a></div>
        </div>
      </footer>
    </>
  );
}


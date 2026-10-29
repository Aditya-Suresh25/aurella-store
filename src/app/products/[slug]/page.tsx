import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartCountLink, ProductPurchasePanel } from "@/app/cart-store";
import { formatProductPrice, getProductBySlug } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const price = formatProductPrice(product.priceCents, product.currency);
  const stockStatus = product.stockQuantity === 0
    ? "Out of stock"
    : product.stockQuantity <= 5
      ? "Low stock"
      : "In stock";

  return (
    <>
      <header className="site-header">
        <div className="product-nav page-shell">
          <Link className="product-back text-link" href="/#new-arrivals">← Back to the collection</Link>
          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <CartCountLink className="product-bag-link" />
        </div>
      </header>

      <main className="product-detail page-shell">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span>
          <Link href="/#new-arrivals">New arrivals</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="product-detail-grid">
          <div className="product-gallery" aria-label={`${product.name} imagery`}>
            <div className="product-detail-image product-detail-image--main">
              <Image src={product.imageUrl} alt={product.imageAlt} fill priority sizes="(max-width: 767px) 100vw, 58vw" />
            </div>
            <div className="product-detail-image product-detail-image--secondary">
              <Image src={product.detailImageUrl} alt={product.detailImageAlt} fill sizes="(max-width: 767px) 100vw, 28vw" />
            </div>
          </div>

          <aside className="product-information">
            <p className="eyebrow">{product.categoryName} · {product.descriptor}</p>
            <h1 className="product-detail-title">{product.name}</h1>
            <p className="product-detail-price">{price}</p>
            <p className="product-stock"><span className={`stock-indicator${stockStatus === "In stock" ? "" : " stock-indicator--low"}`} />{stockStatus}</p>
            <ProductPurchasePanel product={{ id: slug, name: product.name, price, image: product.imageUrl }} />
            <hr className="rule product-detail-rule" />
            <p className="product-detail-description">{product.description}</p>
            <p className="product-detail-note">{product.note}</p>
            <div className="product-care-note">
              <span>Made with care</span>
              <span>Thoughtful materials, made for repeat wear.</span>
            </div>
            <Link className="text-link product-continue-link" href="/#new-arrivals">Continue exploring <span aria-hidden="true">↗</span></Link>
          </aside>
        </div>
      </main>

      <section className="product-detail-footer" aria-label="More from Aurel">
        <p className="eyebrow">Aurel, by design</p>
        <p>Well made things for the everyday.</p>
        <Link href="/">Return to the studio <span aria-hidden="true">↗</span></Link>
      </section>
    </>
  );
}
